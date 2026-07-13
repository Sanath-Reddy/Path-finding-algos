import React, { useState, useEffect, useRef } from "react";
import { TelemetryPayload, TrafficAlert, HungarianResult, MCIVehicle } from "./types";
import { MapPanel } from "./components/MapPanel";
import { BottomMetrics } from "./components/BottomMetrics";
import { ResultModal } from "./components/ResultModal";
import { AlgorithmSelector } from "./components/AlgorithmSelector";
import { HungarianPanel } from "./components/HungarianPanel";
import { DemoScenarios } from "./components/DemoScenarios";

type Step = "STANDBY" | "COMPUTING" | "SIMULATING" | "ARRIVED";

const API = "http://localhost:8000/api";
const WS  = "ws://localhost:8000/ws";

const post = (path: string, body?: object) =>
  fetch(`${API}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

/* ── Glass panel style helper ──────────────────────────────────────────── */
const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: "rgba(8, 14, 28, 0.88)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 14,
  boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
  fontFamily: "'Inter', sans-serif",
  color: "#e2e8f0",
  ...extra,
});

export default function App() {
  const [tel, setTel]             = useState<TelemetryPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [step, setStep]           = useState<Step>("STANDBY");
  const [alert, setAlert]         = useState<string | null>(null);
  const [isResultOpen, setResult] = useState(false);
  const [selectedHosp, setSelHosp] = useState<string | null>(null);
  const [splitView, setSplitView] = useState(false);
  const [activeAlgos, setActiveAlgos] = useState<Set<string>>(new Set(["A", "B", "C", "D"]));
  const [showHungarian, setShowHungarian] = useState(false);
  const [priority, setPriority] = useState<"Normal" | "Critical">("Critical");
  const [specialty, setSpecialty] = useState<"General" | "Trauma" | "Cardiac" | "Stroke">("Trauma");
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  const stepRef = useRef<Step>("STANDBY");
  const wsRef   = useRef<WebSocket | null>(null);
  const trafficTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAlgosRef = useRef(activeAlgos);

  const patientPickedUp = useRef(false);
  const missionDone     = useRef(false);

  useEffect(() => {
    activeAlgosRef.current = activeAlgos;
  }, [activeAlgos]);

  const go = (s: Step) => { stepRef.current = s; setStep(s); };

  /* ── WebSocket ─────────────────────────────────────────────────────── */
  const connectWS = () => {
    const ws = new WebSocket(WS);
    wsRef.current = ws;
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => { setConnected(false); setTimeout(connectWS, 2500); };
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "TELEMETRY") {
        const d: TelemetryPayload = msg.data;
        setTel(d);
        const va = d.veh_a, vb = d.veh_b, vc = d.veh_c, vd = d.veh_d;
        
        if (d.mci_mode) {
          const mciFinished = d.mci_hungarian_vehicles?.every(v => v.status === "ARRIVED") ?? false;
          if (mciFinished && !missionDone.current && stepRef.current === "SIMULATING") {
            missionDone.current = true;
            go("ARRIVED");
            setResult(true);
          }
        } else {
          const allTransporting = Array.from(activeAlgosRef.current).every(id => {
            const veh = id === "A" ? va : id === "B" ? vb : id === "C" ? vc : vd;
            return !veh || veh.status === "TRANSPORTING" || veh.status === "ARRIVED";
          });
          if (allTransporting && !patientPickedUp.current && (va || vb || vc || vd)) {
            patientPickedUp.current = true;
            showAlert("🚑 Patient picked up — racing to hospital!");
          }

          const activeFinished = Array.from(activeAlgosRef.current).every(id => {
            const veh = id === "A" ? va : id === "B" ? vb : id === "C" ? vc : vd;
            return !veh || veh.status === "ARRIVED";
          });
          if (activeFinished && !missionDone.current && stepRef.current === "SIMULATING") {
            missionDone.current = true;
            go("ARRIVED");
            setResult(true);
          }
        }
      }
      if (msg.type === "TRAFFIC_ALERT") {
        const isDemo = msg.data?.dijkstra_eta === 99;
        if (isDemo) {
          showAlert("🚧 Dijkstra's route BLOCKED — it's stuck! A* detects & reroutes instantly ✓");
        } else {
          showAlert("🚧 Road blocked! A* is re-routing — Dijkstra stays stuck on its original path.");
        }
      }
    };
  };

  useEffect(() => { connectWS(); return () => wsRef.current?.close(); }, []);

  /* ── Toast ─────────────────────────────────────────────────────────── */
  const showAlert = (msg: string, ms = 6000) => {
    setAlert(msg);
    setTimeout(() => setAlert(null), ms);
  };

  /* ── ONE-CLICK DISPATCH ─────────────────────────────────────────────── */
  const handleNodeClick = async (nodeId: string) => {
    if (stepRef.current === "SIMULATING") return;
    patientPickedUp.current = false;
    missionDone.current     = false;
    if (trafficTimerRef.current) clearTimeout(trafficTimerRef.current);

    go("COMPUTING");
    setResult(false); setSelHosp(null); setAlert(null);
    setActiveScenario(null);


    try {
      const res  = await post("/emergency", { node: nodeId, priority, specialty });
      const json = await res.json();
      if (json.status !== "success") {
        showAlert(`⚠️ ${json.message ?? "Could not dispatch"}`);
        go("STANDBY"); return;
      }
      const t: TelemetryPayload = json.data;
      if (t.veh_a?.path_to_hospital?.length) {
        const dest = t.veh_a.path_to_hospital[t.veh_a.path_to_hospital.length - 1];
        const h = t.hospitals.find(h => `${h.node[0]},${h.node[1]}` === dest);
        if (h) setSelHosp(h.id);
      }
      go("SIMULATING");
      
      // Auto accident after 6s unless disaster mode is active
      if (!t.disaster_mode) {
        trafficTimerRef.current = setTimeout(async () => {
          if (stepRef.current === "SIMULATING") await post("/traffic/accident");
        }, 6000);
      }
    } catch {
      showAlert("⚠️ Backend unreachable — is the server running?");
      go("STANDBY");
    }
  };

  const handleReset = async () => {
    if (trafficTimerRef.current) clearTimeout(trafficTimerRef.current);
    await post("/reset");
    go("STANDBY"); setResult(false); setSelHosp(null); setAlert(null);
    setSplitView(false);
    setActiveScenario(null);
    patientPickedUp.current = false; missionDone.current = false;
  };

  const handleRunDemo = async () => {
    // Falls back to heuristic trap scenario
    await handleTriggerScenario("heuristic");
  };

  const handleTriggerScenario = async (scenarioId: string) => {
    if (trafficTimerRef.current) clearTimeout(trafficTimerRef.current);
    patientPickedUp.current = false;
    missionDone.current     = false;

    go("COMPUTING");
    setResult(false); setSelHosp(null); setAlert(null);
    setActiveScenario(scenarioId);

    try {
      const res = await post(`/demo/${scenarioId}`);
      const json = await res.json();
      if (json.status !== "success") {
        showAlert(`⚠️ Scenario failed: ${json.message ?? "unknown error"}`);
        go("STANDBY");
        setActiveScenario(null);
        return;
      }

      const t: TelemetryPayload = json.data;
      go("SIMULATING");

      // Apply layout presets automatically for visual clarity
      if (scenarioId === "open-city") {
        handlePresetAlgo("ALL");
      } else if (scenarioId === "heuristic") {
        handlePresetAlgo("DIJKSTRA_VS_ASTAR");
        trafficTimerRef.current = setTimeout(async () => {
          if (stepRef.current === "SIMULATING") await post("/demo/block");
        }, 6000);
      } else if (scenarioId === "rerouting") {
        handlePresetAlgo("DIJKSTRA_VS_ASTAR");
        trafficTimerRef.current = setTimeout(async () => {
          if (stepRef.current === "SIMULATING") await post("/demo/block");
        }, 5000);
      } else if (scenarioId === "maze") {
        setActiveAlgos(new Set(["A", "C"]));
        setSplitView(true);
      } else if (scenarioId === "mci") {
        setSplitView(true);
      }

      const activeNames = scenarioId === "mci" 
        ? "Hungarian Assignment" 
        : Array.from(activeAlgos).map(id => id === 'A' ? 'Dijkstra' : id === 'B' ? 'A*' : id === 'C' ? 'Greedy BFS' : 'Bellman-Ford').join(" vs ");
      showAlert(`🎯 Scenario activated: ${activeNames}`);
    } catch {
      showAlert("⚠️ Backend unreachable.");
      go("STANDBY");
      setActiveScenario(null);
    }
  };

  const handleToggleAlgo = (id: string) => {
    const next = new Set(activeAlgos);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setActiveAlgos(next);
  };

  const handlePresetAlgo = (preset: string) => {
    setSplitView(preset !== "ALL" || activeAlgos.size > 1);
    if (preset === "DIJKSTRA_VS_ASTAR") {
      setActiveAlgos(new Set(["A", "B"]));
    } else if (preset === "OPTIMAL_VS_GREEDY") {
      setActiveAlgos(new Set(["B", "C"]));
    } else if (preset === "STATIC_VS_DYNAMIC") {
      setActiveAlgos(new Set(["A", "D", "B", "C"]));
    } else if (preset === "ALL") {
      setActiveAlgos(new Set(["A", "B", "C", "D"]));
      setSplitView(true);
    }
  };

  const handleDisasterToggle = async () => {
    try {
      if (tel?.disaster_mode) {
        await post("/traffic/clear");
        showAlert("🟢 Disaster mode cleared. Roads restored.");
      } else {
        await post("/traffic/disaster");
        showAlert("💥 Disaster mode active! Multiple roads completely blocked.");
      }
    } catch {
      showAlert("⚠️ Failed to communicate with traffic controller.");
    }
  };

  const handleHungarianDemo = async () => {
    await handleTriggerScenario("mci");
  };

  const spd = tel?.speed_multiplier ?? 1;
  const isSimActive = step === "SIMULATING" || step === "ARRIVED";

  const statusText = () => {
    if (!connected) return "⚡ Connecting to backend...";
    if (step === "STANDBY")   return "👆 Click any intersection on the map to dispatch";
    if (step === "COMPUTING") return "⚙️ Dispatching ambulances & computing routes...";
    if (step === "SIMULATING") {
      if (tel?.mci_mode) {
        return "🚨 Mass Casualty Response simulation active...";
      }
      const s = tel?.veh_b?.status;
      if (s === "RESPONDING")   return "🚑 Ambulances responding to patient";
      if (s === "TRANSPORTING") return "🏥 Transporting patient to hospital";
      return "🏁 Approaching hospital...";
    }
    return "✅ Mission complete — see results below";
  };

  /* ── Shared map props ──────────────────────────────────────────────── */
  const sharedMapProps = tel ? {
    graph:          tel.graph,
    vehA:           tel.veh_a,
    vehB:           tel.veh_b,
    vehC:           tel.veh_c,
    vehD:           tel.veh_d,
    hospitals:      tel.hospitals,
    ambulances:     tel.ambulances,
    emergency:      tel.active_emergency,
    selectedHospId: selectedHosp,
    onNodeClick:    handleNodeClick,
    step,
    activeAlgos,
    disasterMode:   tel.disaster_mode,
    mciMode:        tel.mci_mode,
    mciEmergencies: tel.mci_emergencies,
    mciGreedyVehicles: tel.mci_greedy_vehicles,
    mciHungarianVehicles: tel.mci_hungarian_vehicles,
  } : null;

  /* ── Inline stat card for each split panel ─────────────────────────── */
  const StatCard = ({ veh, color, label, bg, bd, isCompact, customStats }: {
    veh: any; color: string; label: string; bg: string; bd: string; isCompact?: boolean;
    customStats?: { explored: string; cost: string; status: string };
  }) => (
    <div style={{
      position: "absolute", bottom: isCompact ? 6 : 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 10,
      background: bg, border: `1px solid ${bd}`,
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      borderRadius: 10, padding: isCompact ? "4px 10px" : "8px 16px",
      display: "flex", gap: isCompact ? 12 : 20, alignItems: "center",
      fontFamily: "'Inter', sans-serif",
      pointerEvents: "none",
      width: "max-content",
      maxWidth: "calc(100% - 12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ fontSize: isCompact ? 9 : 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      </div>
      {[
        { k: "Nodes", v: customStats ? customStats.explored : (veh?.nodes_explored ?? "–") },
        { k: "Travel", v: customStats ? customStats.cost : (veh ? `${(veh.accumulated_cost ?? 0).toFixed(1)}m` : "–") },
        { k: "Status", v: customStats ? customStats.status : (veh?.status === "RESPONDING" ? "→ Pat" : veh?.status === "TRANSPORTING" ? "→ Hosp" : veh?.status === "ARRIVED" ? "✓ Done" : "–") },
      ].map(({ k, v }) => (
        <div key={k} style={{ textAlign: "center" }}>
          <div style={{ fontSize: isCompact ? 7 : 8, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>{k}</div>
          <div style={{ fontSize: isCompact ? 11 : 14, fontWeight: 800, color: "#f1f5f9", fontFamily: "monospace" }}>{v}</div>
        </div>
      ))}
    </div>
  );

  const ALGO_CONFIG = [
    { id: "A", name: "Dijkstra", color: "#3B82F6", textColor: "#60a5fa", label: "Dijkstra — Exhaustive Search" },
    { id: "B", name: "A*", color: "#22C55E", textColor: "#4ade80", label: "A* Search — Heuristic-Guided" },
    { id: "C", name: "Greedy BFS", color: "#F97316", textColor: "#fed7aa", label: "Greedy BFS — Heuristic Only" },
    { id: "D", name: "Bellman-Ford", color: "#A855F7", textColor: "#f3e8ff", label: "Bellman-Ford — Iterative Relaxation" },
  ];
  
  const algosList = ALGO_CONFIG
    .filter(a => activeAlgos.has(a.id))
    .map(a => ({
      ...a,
      veh: tel ? (a.id === "A" ? tel.veh_a : a.id === "B" ? tel.veh_b : a.id === "C" ? tel.veh_c : tel.veh_d) : null,
    }));

  const isMCI = !!tel?.mci_mode;

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
                  background: "#07101e", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>
      
      {/* ─── 1. TOP HEADER NAVIGATION BAR ─── */}
      <div style={{
        height: 52,
        minHeight: 52,
        background: "rgba(8, 14, 28, 0.95)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        zIndex: 300,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
      }}>
        {/* Left: Connection and Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
                        background: connected ? "#22c55e" : "#ef4444",
                        boxShadow: connected ? "0 0 10px #22c55e" : "0 0 10px #ef4444" }} />
          <span style={{ fontWeight: 900, fontSize: 14, color: "#fff", letterSpacing: ".02em" }}>
            🚑 EOC Smart Dispatch
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8", borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 12 }}>
            {statusText()}
          </span>
          {selectedHosp && tel && (() => {
            const h = tel.hospitals.find(h => h.id === selectedHosp);
            return h ? (
              <span style={{ fontSize: 10, color: "#67e8f9", background: "rgba(6,182,212,.08)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(6,182,212,.2)" }}>
                🏥 Target: {h.name}
              </span>
            ) : null;
          })()}
        </div>

        {/* Right: Inline Simulation and Quick Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Traffic injection buttons (only visible if simulation is active) */}
          {isSimActive && !isMCI && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12, borderRight: "1px solid rgba(255,255,255,0.15)" }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>Traffic:</span>
              <button onClick={() => post("/traffic/congestion")} style={btnTrafficCongest}>🚧 Congest</button>
              <button onClick={() => post("/traffic/accident")} style={btnTrafficAccident}>💥 Accident</button>
              <button onClick={() => post("/traffic/clear")} style={btnTrafficClear}>✓ Clear</button>
              
              <button onClick={() => post("/pause", { paused: !tel?.is_paused })} style={btnPlayPause}>
                {tel?.is_paused ? "▶ Play" : "⏸ Pause"}
              </button>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 4].map(s => (
                  <button key={s} onClick={() => post("/speed", { speed: s })}
                    style={{ padding: "3px 6px", fontSize: 9, fontWeight: 700, borderRadius: 4,
                              border: "none", cursor: "pointer",
                              background: spd === s ? "#22c55e" : "rgba(255,255,255,.05)",
                              color: spd === s ? "#fff" : "#64748b" }}>
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMCI && isSimActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12, borderRight: "1px solid rgba(255,255,255,0.15)" }}>
              <button onClick={() => post("/pause", { paused: !tel?.is_paused })} style={btnPlayPause}>
                {tel?.is_paused ? "▶ Play" : "⏸ Pause"}
              </button>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 4].map(s => (
                  <button key={s} onClick={() => post("/speed", { speed: s })}
                    style={{ padding: "3px 6px", fontSize: 9, fontWeight: 700, borderRadius: 4,
                              border: "none", cursor: "pointer",
                              background: spd === s ? "#22c55e" : "rgba(255,255,255,.05)",
                              color: spd === s ? "#fff" : "#64748b" }}>
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Preset Actions */}
          {step === "STANDBY" && (
            <button onClick={handleRunDemo} style={btnPrimary}>▶ Auto Demo</button>
          )}

          {!isMCI && (
            <button
              onClick={() => setSplitView(v => !v)}
              style={{
                padding: "6px 12px", fontWeight: 800, fontSize: 11, borderRadius: 8,
                border: "none", cursor: "pointer", letterSpacing: ".04em",
                textTransform: "uppercase",
                background: splitView ? "linear-gradient(135deg,#3b82f6 0%,#22c55e 100%)" : "rgba(255,255,255,.07)",
                color: splitView ? "#fff" : "#94a3b8",
              }}
            >
              {splitView ? "⊟ Full View" : "⊞ Split View"}
            </button>
          )}
          <button onClick={handleReset} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, borderRadius: 8 }}>↺ Reset</button>
        </div>
      </div>

      {/* ─── 2. MAIN GRID AREA (Left Sidebar + Right Map Panels) ─── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", position: "relative" }}>
        
        {/* LEFT SIDEBAR (Controls & Telemetry Info) */}
        <div style={{
          width: 280,
          minWidth: 280,
          background: "rgba(10, 15, 30, 0.90)",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
          zIndex: 100,
        }}>
          {/* Section 0: Scenario Presets */}
          <DemoScenarios
            onTriggerScenario={handleTriggerScenario}
            activeScenario={activeScenario}
            disabled={step === "SIMULATING" || step === "COMPUTING"}
          />

          <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.06)", margin: 0 }} />

          {/* Section 1: Active Route Comparison (Algorithm Selector) */}
          <AlgorithmSelector
            activeAlgos={activeAlgos}
            onToggle={handleToggleAlgo}
            onPreset={handlePresetAlgo}
            onRunHungarian={handleHungarianDemo}
            hungarianActive={isMCI || !!tel?.last_hungarian_result}
            onShowHungarianMatrix={() => setShowHungarian(true)}
            isSidebar={true}
          />

          <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.06)", margin: 0 }} />

          {/* Section 2: Clinical Dispatch Decision System */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🚑 Incident Parameters
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Severity Select */}
              <div>
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Severity</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["Normal", "Critical"] as const).map(p => (
                    <button key={p} onClick={() => setPriority(p)}
                      style={{
                        flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 700, borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
                        background: priority === p ? (p === "Critical" ? "#ef444430" : "#3b82f630") : "rgba(30, 41, 59, 0.25)",
                        color: priority === p ? (p === "Critical" ? "#f87171" : "#60a5fa") : "#94a3b8",
                        borderColor: priority === p ? (p === "Critical" ? "#ef444470" : "#3b82f670") : "rgba(255,255,255,0.06)",
                      }}>
                      {p === "Critical" ? "🔴 Critical" : "🔵 Normal"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specialty Select */}
              <div>
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Specialty Required</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {(["General", "Trauma", "Cardiac", "Stroke"] as const).map(s => (
                    <button key={s} onClick={() => setSpecialty(s)}
                      style={{
                        padding: "6px 0", fontSize: 11, fontWeight: 700, borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
                        background: specialty === s ? "rgba(34, 197, 94, 0.15)" : "rgba(30, 41, 59, 0.25)",
                        color: specialty === s ? "#4ade80" : "#94a3b8",
                        borderColor: specialty === s ? "rgba(34, 197, 94, 0.4)" : "rgba(255,255,255,0.06)",
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.06)", margin: 0 }} />

          {/* Section 3: Special Operations (Disaster only — Hungarian moved to Route Comparison above) */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🛠️ Command Directives
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Disaster Button */}
              <button onClick={handleDisasterToggle}
                style={{
                  width: "100%", padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "#fff",
                  background: tel?.disaster_mode
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                  boxShadow: tel?.disaster_mode
                    ? "0 0 14px rgba(16, 185, 129, 0.3)"
                    : "0 0 14px rgba(239, 68, 68, 0.3)",
                }}>
                {tel?.disaster_mode ? "🟢 Clear Disaster Mode" : "💥 Activate Disaster"}
              </button>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.06)", margin: 0 }} />

          {/* Section 4: Live Bed capacities */}
          {tel && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  🏥 Hospital Beds
                </span>
                {tel.global_stats.hospital_overflow_count !== undefined && tel.global_stats.hospital_overflow_count > 0 && (
                  <span style={{ fontSize: 9, color: "#f87171", background: "rgba(239,68,68,0.15)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                    ⚠️ {tel.global_stats.hospital_overflow_count} Overflow
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tel.hospitals.map(h => {
                  const pct = (h.beds / 14) * 100;
                  const isFull = h.beds === 0;
                  return (
                    <div key={h.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#cbd5e1", fontWeight: 600 }}>
                        <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 170 }}>
                          {h.name}
                        </span>
                        <span style={{ fontFamily: "monospace", color: isFull ? "#ef4444" : "#4ade80" }}>
                          {h.beds}/14
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                        <input
                          type="range"
                          min="0"
                          max="14"
                          value={h.beds}
                          onChange={async (e) => {
                            const val = parseInt(e.target.value);
                            await post("/hospitals/beds", { id: h.id, beds: val });
                          }}
                          style={{
                            width: "100%",
                            accentColor: isFull ? "#ef4444" : h.beds <= 3 ? "#f59e0b" : "#10b981",
                            background: "rgba(255,255,255,0.08)",
                            borderRadius: 4,
                            outline: "none",
                            height: 6,
                            cursor: "ew-resize",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b", marginTop: 2 }}>
                        <span>Spec: {h.specialty}</span>
                        <span>Node: {h.node[0]},{h.node[1]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL (Map View Container) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
          
          {/* Map grid display */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {!tel ? (
              /* Loading screen */
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 16 }}>
                <div style={{ width: 40, height: 40, border: "2px solid rgba(34,197,94,.3)",
                              borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span style={{ color: "#64748b", fontSize: 13 }}>Connecting to simulation server…</span>
              </div>
            ) : isMCI && splitView ? (
              /* MCI Split Screen Mode: Greedy Assignment vs Hungarian Assignment */
              <div style={getGridStyle(2)}>
                {[
                  { id: "greedy", name: "Greedy Fleet", color: "#3B82F6", textColor: "#60a5fa", label: "Greedy Assignment — Nearest Incident First", keyAlgos: new Set(["C"]) },
                  { id: "hungarian", name: "Hungarian Fleet", color: "#ef4444", textColor: "#fca5a5", label: "Hungarian Assignment — Globally Optimal", keyAlgos: new Set(["B"]) }
                ].map((mciItem, index) => {
                  const isLastCol = index === 1;
                  const arrivedCount = index === 0
                    ? (tel.mci_greedy_vehicles?.filter(v => v.status === "ARRIVED").length ?? 0)
                    : (tel.mci_hungarian_vehicles?.filter(v => v.status === "ARRIVED").length ?? 0);
                  const costVal = index === 0 ? tel.mci_greedy_total : tel.mci_hungarian_total;
                  
                  return (
                    <div key={mciItem.id} style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      borderRight: !isLastCol ? "2px solid rgba(255, 255, 255, 0.15)" : "none",
                    }}>
                      <div style={{
                        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                        zIndex: 10, background: `${mciItem.color}18`,
                        border: `1px solid ${mciItem.color}35`, borderRadius: 10,
                        padding: "6px 18px", display: "flex", alignItems: "center", gap: 8,
                        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      }}>
                        <div style={{ width: 9, height: 9, borderRadius: "50%", background: mciItem.color, boxShadow: `0 0 8px ${mciItem.color}` }}/>
                        <span style={{ fontSize: 11, fontWeight: 800, color: mciItem.textColor, letterSpacing: ".07em", textTransform: "uppercase" }}>
                          {mciItem.label}
                        </span>
                      </div>
                      <MapPanel {...sharedMapProps!} activeAlgos={mciItem.keyAlgos} />
                      {isSimActive && (
                        <StatCard 
                          veh={null}
                          customStats={{
                            explored: "N/A",
                            cost: `${(costVal ?? 0).toFixed(1)}m`,
                            status: `${arrivedCount}/4 Arrived`
                          }}
                          color={mciItem.color} 
                          label={mciItem.name}
                          bg={`${mciItem.color}10`} 
                          bd={`${mciItem.color}30`} 
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : splitView ? (
              /* Regular Split Screen Mode */
              <div style={getGridStyle(algosList.length)}>
                {algosList.map((algo, index) => {
                  const singleAlgoSet = new Set([algo.id]);
                  const isLastCol = index === algosList.length - 1 || (algosList.length === 4 && index % 2 === 1);
                  const isLastRow = index >= algosList.length - 2 || algosList.length < 4;
                  
                  const panelBorderStyles: React.CSSProperties = {
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    borderRight: !isLastCol ? "2px solid rgba(255, 255, 255, 0.15)" : "none",
                    borderBottom: !isLastRow ? "2px solid rgba(255, 255, 255, 0.15)" : "none",
                  };

                  return (
                    <div key={algo.id} style={panelBorderStyles}>
                      {/* Sub-Panel Header */}
                      <div style={{
                        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                        zIndex: 10, background: `${algo.color}18`,
                        border: `1px solid ${algo.color}35`, borderRadius: 10,
                        padding: "6px 18px", display: "flex", alignItems: "center", gap: 8,
                        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      }}>
                        <div style={{ width: 9, height: 9, borderRadius: "50%", background: algo.color, boxShadow: `0 0 8px ${algo.color}` }}/>
                        <span style={{ fontSize: 11, fontWeight: 800, color: algo.textColor, letterSpacing: ".07em", textTransform: "uppercase" }}>
                          {algo.label}
                        </span>
                      </div>
                      <MapPanel {...sharedMapProps!} activeAlgos={singleAlgoSet} />
                      {isSimActive && (
                        <StatCard 
                          veh={algo.veh} 
                          color={algo.color} 
                          label={algo.name}
                          bg={`${algo.color}10`} 
                          bd={`${algo.color}30`} 
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Full Screen Single Map Mode */
              <MapPanel {...sharedMapProps!} />
            )}
          </div>

          {/* Bottom telemetry metric bar */}
          {tel && (
            <BottomMetrics
              vehA={tel.veh_a}
              vehB={tel.veh_b}
              vehC={tel.veh_c}
              vehD={tel.veh_d}
              activeAlgos={activeAlgos}
              hungarianResult={tel.last_hungarian_result}
              mciMode={tel.mci_mode}
              mciGreedyTotal={tel.mci_greedy_total}
              mciHungarianTotal={tel.mci_hungarian_total}
              savingsPct={tel.last_hungarian_result?.savings_pct}
            />
          )}

          {/* Map Legend (drawn inside the map viewport for reference) */}
          {tel && !splitView && (
            <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 200 }}>
              <div style={glass({ padding: "10px 14px", borderRadius: 10, display: "flex", flexDirection: "column", gap: 6 })}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: ".1em" }}>LEGEND</span>
                {[
                  { el: <div style={{ width: 18, height: 2.5, background: "#3b82f6", borderRadius: 2 }}/>, label: "Dijkstra (Static)" },
                  { el: <div style={{ width: 18, height: 2.5, background: "#22c55e", borderRadius: 2 }}/>, label: "A* Path (Dynamic)" },
                  { el: <div style={{ width: 18, height: 2.5, borderBottom: "2px dashed #f97316", borderRadius: 1 }}/>, label: "Greedy BFS (Dynamic)" },
                  { el: <div style={{ width: 18, height: 2.5, borderBottom: "2px dotted #a855f7", borderRadius: 1 }}/>, label: "Bellman-Ford (Static)" },
                  { el: <div style={{ width: 12, height: 12, border: "2px solid #06b6d4", borderRadius: 3, background: "rgba(6,182,212,.12)"}}/>, label: "Hospital" },
                  { el: <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ef4444" }}/>, label: "Emergency" },
                  { el: <div style={{ width: 12, height: 12, border: "2px solid #a78bfa", borderRadius: 3, background: "rgba(167,139,250,.12)"}}/>, label: "Ambulance Station" },
                ].map(({ el, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {el}
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. OVERLAYS, TOASTS & DIALOG MODALS ─── */}
      {/* Toast popup notifications */}
      {alert && (
        <div style={{
          position: "absolute", top: 66, left: "50%", transform: "translateX(-50%)",
          zIndex: 500, ...glass({ padding: "12px 20px", borderLeft: "4px solid #ef4444",
          display: "flex", alignItems: "center", gap: 10, borderRadius: 12 })
        }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#f1f5f9" }}>{alert}</p>
        </div>
      )}

      {/* Leaderboard/Result popup card */}
      <ResultModal
        isOpen={isResultOpen}
        vehA={tel ? tel.veh_a : null}
        vehB={tel ? tel.veh_b : null}
        vehC={tel ? tel.veh_c : null}
        vehD={tel ? tel.veh_d : null}
        activeAlgos={activeAlgos}
        onClose={handleReset}
        isMCI={isMCI}
        mciGreedyTotal={tel?.mci_greedy_total}
        mciHungarianTotal={tel?.mci_hungarian_total}
        savingsPct={tel?.last_hungarian_result?.savings_pct}
      />

      {/* Hungarian Assignment Analysis panel */}
      {showHungarian && tel?.last_hungarian_result && (
        <HungarianPanel
          result={tel.last_hungarian_result}
          onClose={() => setShowHungarian(false)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "9px 18px", background: "#22c55e", color: "#fff", fontWeight: 800,
  fontSize: 12, borderRadius: 10, border: "none", cursor: "pointer",
  letterSpacing: ".05em", textTransform: "uppercase",
  boxShadow: "0 0 18px rgba(34,197,94,.35)",
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 14px", background: "rgba(255,255,255,.07)", color: "#94a3b8",
  fontWeight: 800, fontSize: 12, borderRadius: 10, border: "none", cursor: "pointer",
  letterSpacing: ".05em", textTransform: "uppercase",
};

const getGridStyle = (count: number): React.CSSProperties => {
  if (count <= 1) {
    return { display: "flex", width: "100%", height: "100%", overflow: "hidden" };
  }
  if (count === 2) {
    return {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
      gridTemplateRows: "minmax(0, 1fr)",
      width: "100%",
      height: "100%",
      overflow: "hidden",
    };
  }
  if (count === 3) {
    return {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
      gridTemplateRows: "minmax(0, 1fr)",
      width: "100%",
      height: "100%",
      overflow: "hidden",
    };
  }
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };
};

const btnTrafficCongest: React.CSSProperties = {
  padding: "5px 10px", background: "rgba(245,158,11,.1)", color: "#f59e0b",
  fontWeight: 700, fontSize: 10, borderRadius: 6, border: "1px solid rgba(245,158,11,.25)", cursor: "pointer"
};

const btnTrafficAccident: React.CSSProperties = {
  padding: "5px 10px", background: "rgba(239,68,68,.1)", color: "#ef4444",
  fontWeight: 700, fontSize: 10, borderRadius: 6, border: "1px solid rgba(239,68,68,.25)", cursor: "pointer"
};

const btnTrafficClear: React.CSSProperties = {
  padding: "5px 10px", background: "rgba(34,197,94,.1)", color: "#22c55e",
  fontWeight: 700, fontSize: 10, borderRadius: 6, border: "1px solid rgba(34,197,94,.25)", cursor: "pointer"
};

const btnPlayPause: React.CSSProperties = {
  padding: "5px 10px", background: "rgba(255,255,255,.05)", color: "#e2e8f0",
  fontSize: 10, fontWeight: 700, borderRadius: 6, border: "1px solid rgba(255,255,255,.08)", cursor: "pointer"
};
