import React, { useState, useEffect, useRef } from "react";
import { TelemetryPayload, TrafficAlert, HungarianResult } from "./types";
import { MapPanel } from "./components/MapPanel";
import { BottomMetrics } from "./components/BottomMetrics";
import { ResultModal } from "./components/ResultModal";
import { AlgorithmSelector } from "./components/AlgorithmSelector";
import { HungarianPanel } from "./components/HungarianPanel";

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
  const [splitView, setSplitView] = useState(false);   // ← NEW
  const [activeAlgos, setActiveAlgos] = useState<Set<string>>(new Set(["A", "B", "C", "D"]));
  const [showHungarian, setShowHungarian] = useState(false);
  const [hungarianResult, setHungarianResult] = useState<HungarianResult | null>(null);

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
  const showAlert = (msg: string, ms = 5000) => {
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

    await post("/reset");

    try {
      const res  = await post("/emergency", { node: nodeId, priority: "Critical", specialty: "Trauma" });
      const json = await res.json();
      if (json.status !== "success") {
        showAlert(`⚠️ ${json.message ?? "Could not dispatch"}`);
        go("STANDBY"); return;
      }
      /* find selected hospital from path endpoint */
      const t: TelemetryPayload = json.data;
      if (t.veh_a?.path_to_hospital?.length) {
        const dest = t.veh_a.path_to_hospital[t.veh_a.path_to_hospital.length - 1];
        const h = t.hospitals.find(h => `${h.node[0]},${h.node[1]}` === dest);
        if (h) setSelHosp(h.id);
      }
      go("SIMULATING");
      /* auto-inject accident at 6 s to show A* rerouting */
      trafficTimerRef.current = setTimeout(async () => {
        if (stepRef.current === "SIMULATING") await post("/traffic/accident");
      }, 6000);
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
    patientPickedUp.current = false; missionDone.current = false;
  };

  const handleRunDemo = async () => {
    if (stepRef.current === "SIMULATING") return;
    if (trafficTimerRef.current) clearTimeout(trafficTimerRef.current);

    patientPickedUp.current = false;
    missionDone.current     = false;
    go("COMPUTING");
    setResult(false); setSelHosp(null); setAlert(null);
    setSplitView(false);

    try {
      const res  = await post("/demo");
      const json = await res.json();

      if (json.status !== "success") {
        showAlert(`⚠️ Demo failed: ${json.message ?? "unknown error"}`);
        go("STANDBY"); return;
      }

      /* find selected hospital */
      const t: TelemetryPayload = json.data;
      if (t.veh_a?.path_to_hospital?.length) {
        const dest = t.veh_a.path_to_hospital[t.veh_a.path_to_hospital.length - 1];
        const h = t.hospitals.find(h => `${h.node[0]},${h.node[1]}` === dest);
        if (h) setSelHosp(h.id);
      }

      go("SIMULATING");

      /* ── Auto split-view after a short delay so map renders first ── */
      setTimeout(() => setSplitView(true), 800);

      /* ── Announcements ── */
      const activeNames = Array.from(activeAlgos).map(id => id === 'A' ? 'Dijkstra' : id === 'B' ? 'A*' : id === 'C' ? 'Greedy BFS' : 'Bellman-Ford').join(" vs ");
      showAlert(`🎯 Demo: ${activeNames} — watch the routing comparison unfold!`);

      /* ── At 5 s: block roads on Dijkstra's route (not A*'s) ── */
      trafficTimerRef.current = setTimeout(async () => {
        if (stepRef.current !== "SIMULATING") return;
        await post("/demo/block");
        // Toast is sent via WS TRAFFIC_ALERT
      }, 5000);

    } catch {
      showAlert("⚠️ Backend unreachable — is the server running?");
      go("STANDBY");
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
    setSplitView(true);
    if (preset === "DIJKSTRA_VS_ASTAR") {
      setActiveAlgos(new Set(["A", "B"]));
    } else if (preset === "OPTIMAL_VS_GREEDY") {
      setActiveAlgos(new Set(["B", "C"]));
    } else if (preset === "STATIC_VS_DYNAMIC") {
      setActiveAlgos(new Set(["A", "D", "B", "C"]));
    } else if (preset === "ALL") {
      setActiveAlgos(new Set(["A", "B", "C", "D"]));
    } else {
      setActiveAlgos(new Set(["A", "B", "C", "D"]));
    }
  };

  const spd = tel?.speed_multiplier ?? 1;
  const isSimActive = step === "SIMULATING" || step === "ARRIVED";

  const statusText = () => {
    if (!connected) return "⚡ Connecting to backend...";
    if (step === "STANDBY")   return "👆 Click any node on the map to create an emergency";
    if (step === "COMPUTING") return "⚙️ Computing Dijkstra & A* routes...";
    if (step === "SIMULATING") {
      const s = tel?.veh_b?.status;
      if (s === "RESPONDING")   return "🚑 Ambulances racing to patient";
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
  } : null;

  /* ── Inline stat card for each split panel ─────────────────────────── */
  const StatCard = ({ veh, color, label, bg, bd, isCompact }: {
    veh: any; color: string; label: string; bg: string; bd: string; isCompact?: boolean;
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
        { k: "Nodes", v: veh?.nodes_explored ?? "–" },
        { k: "Travel", v: veh ? `${(veh.accumulated_cost ?? 0).toFixed(1)}m` : "–" },
        { k: "Status", v: veh?.status === "RESPONDING" ? "→ Pat" : veh?.status === "TRANSPORTING" ? "→ Hosp" : veh?.status === "ARRIVED" ? "✓ Done" : "–" },
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

  if (tel && splitView) {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
                    background: "#07101e", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>
        
        {/* ─── SLIM TOP HEADER BAR ─── */}
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
          {/* Left: Title & Status indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%",
                          background: connected ? "#22c55e" : "#ef4444",
                          boxShadow: connected ? "0 0 10px #22c55e" : "0 0 10px #ef4444" }} />
            <span style={{ fontWeight: 800, fontSize: 13, color: "#fff", letterSpacing: ".02em" }}>
              Smart Dispatch Command Center
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8", borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 12 }}>
              {statusText()}
            </span>
            {selectedHosp && (() => {
              const h = tel.hospitals.find(h => h.id === selectedHosp);
              return h ? (
                <span style={{ fontSize: 10, color: "#67e8f9", background: "rgba(6,182,212,.08)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(6,182,212,.2)" }}>
                  🏥 Target: {h.name}
                </span>
              ) : null;
            })()}
          </div>

          {/* Right: Inline Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Traffic injection buttons (very compact) */}
            {isSimActive && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12, borderRight: "1px solid rgba(255,255,255,0.15)" }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>Traffic:</span>
                <button onClick={() => post("/traffic/congestion")} style={btnTrafficCongest}>🚧 Congestion</button>
                <button onClick={() => post("/traffic/accident")} style={btnTrafficAccident}>💥 Accident</button>
                <button onClick={() => post("/traffic/clear")} style={btnTrafficClear}>✓ Clear</button>
                
                <button onClick={() => post("/pause", { paused: !tel.is_paused })} style={btnPlayPause}>
                  {tel.is_paused ? "▶ Play" : "⏸ Pause"}
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

            {/* Split View Toggle + Reset */}
            <button
              onClick={() => setSplitView(v => !v)}
              style={{
                padding: "6px 12px", fontWeight: 800, fontSize: 11, borderRadius: 8,
                border: "none", cursor: "pointer", letterSpacing: ".04em",
                textTransform: "uppercase",
                background: "linear-gradient(135deg,#3b82f6 0%,#22c55e 100%)",
                color: "#fff",
                boxShadow: "0 0 12px rgba(59,130,246,0.3)"
              }}
            >
              ⊟ Full View
            </button>
            <button onClick={handleReset} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, borderRadius: 8 }}>↺ Reset</button>
          </div>
        </div>

        {/* ─── GRID CONTENT AREA ─── */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ ...getGridStyle(algosList.length), flex: 1, minHeight: 0 }}>
            {algosList.map((algo, index) => {
              const singleAlgoSet = new Set([algo.id]);
              const isLastCol = index === algosList.length - 1 || (algosList.length === 4 && index % 2 === 1);
              const isLastRow = index >= algosList.length - 2 || algosList.length < 4;
              
              const panelBorderStyles: React.CSSProperties = {
                position: "relative",
                overflow: "hidden",
                minHeight: 0,
                borderRight: !isLastCol ? "2px solid rgba(255, 255, 255, 0.15)" : "none",
                borderBottom: !isLastRow ? "2px solid rgba(255, 255, 255, 0.15)" : "none",
              };

              return (
                <div key={algo.id} style={panelBorderStyles}>
                  {/* Panel label */}
                  <div style={{
                    position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
                    zIndex: 10, background: `${algo.color}18`,
                    border: `1px solid ${algo.color}35`, borderRadius: 8,
                    padding: "4px 12px", display: "flex", alignItems: "center", gap: 6,
                    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: algo.color, boxShadow: `0 0 8px ${algo.color}` }}/>
                    <span style={{ fontSize: 10, fontWeight: 800, color: algo.textColor, letterSpacing: ".05em", textTransform: "uppercase" }}>
                      {algo.label}
                    </span>
                  </div>
                  
                  <MapPanel {...sharedMapProps!} activeAlgos={singleAlgoSet} />
                  
                  {isSimActive && (
                    <StatCard 
                      veh={algo.veh} 
                      color={algo.color} 
                      label={algo.name}
                      bg={`${algo.color}15`} 
                      bd={`${algo.color}35`} 
                      isCompact={true}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── TOAST ALERT ─── */}
        {alert && (
          <div style={{
            position: "absolute", top: 66, left: "50%", transform: "translateX(-50%)",
            zIndex: 300, ...glass({ padding: "10px 18px", borderLeft: "4px solid #ef4444",
            display: "flex", alignItems: "center", gap: 10, borderRadius: 10 })
          }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#f1f5f9" }}>{alert}</p>
          </div>
        )}

        {/* ─── MODALS ─── */}
        <ResultModal
          isOpen={isResultOpen}
          vehA={tel.veh_a}
          vehB={tel.veh_b}
          vehC={tel.veh_c}
          vehD={tel.veh_d}
          activeAlgos={activeAlgos}
          onClose={handleReset}
        />
        {showHungarian && hungarianResult && (
          <HungarianPanel
            result={hungarianResult}
            onClose={() => setShowHungarian(false)}
          />
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative",
                  background: "#07101e", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>

      {/* ════════ MAP AREA ════════ */}
      <div style={{ position: "absolute", inset: 0 }}>
        {!tel ? (
          /* Loading */
          <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", gap:16 }}>
            <div style={{ width:40, height:40, border:"2px solid rgba(34,197,94,.3)",
                          borderTopColor:"#22c55e", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
            <span style={{ color:"#64748b", fontSize:13 }}>Connecting to simulation server…</span>
          </div>
        ) : splitView ? (
          /* ── SPLIT VIEW ── */
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
                  {/* Panel label */}
                  <div style={{
                    position:"absolute", top:12, left:"50%", transform:"translateX(-50%)",
                    zIndex:10, background: `${algo.color}18`,
                    border:`1px solid ${algo.color}35`, borderRadius:10,
                    padding:"6px 18px", display:"flex", alignItems:"center", gap:8,
                    backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                  }}>
                    <div style={{ width:9, height:9, borderRadius:"50%", background: algo.color, boxShadow:`0 0 8px ${algo.color}` }}/>
                    <span style={{ fontSize:11, fontWeight:800, color: algo.textColor, letterSpacing:".07em", textTransform:"uppercase" }}>
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
          /* ── FULL VIEW ── */
          <MapPanel {...sharedMapProps!} />
        )}
      </div>

      {/* ════════ TOP-LEFT: TITLE + STATUS ════════ */}
      <div style={{ position:"absolute", top:14, left:14, zIndex:200,
                    display:"flex", flexDirection:"column", gap:8 }}>
        <div style={glass({ padding:"10px 16px", display:"flex", alignItems:"center", gap:12 })}>
          <div style={{ width:8, height:8, borderRadius:"50%",
                        background: connected ? "#22c55e" : "#ef4444",
                        boxShadow: connected ? "0 0 10px #22c55e" : "0 0 10px #ef4444" }} />
          <span style={{ fontWeight:800, fontSize:13, color:"#fff", letterSpacing:".03em" }}>
            Smart Ambulance Dispatch
          </span>
          <span style={{
            fontSize:9, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase",
            padding:"2px 8px", borderRadius:99,
            background: connected ? "rgba(34,197,94,.14)" : "rgba(239,68,68,.14)",
            color: connected ? "#4ade80" : "#f87171",
            border: `1px solid ${connected ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
          }}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
        <div style={glass({ padding:"8px 14px", borderRadius:10 })}>
          <p style={{ fontSize:12, color:"#cbd5e1", margin:0 }}>{statusText()}</p>
        </div>
        {selectedHosp && tel && (() => {
          const h = tel.hospitals.find(h => h.id === selectedHosp);
          return h ? (
            <div style={glass({ padding:"8px 14px", borderRadius:10,
              background:"rgba(6,182,212,.08)", borderColor:"rgba(6,182,212,.25)" })}>
              <p style={{ fontSize:11, color:"#67e8f9", margin:0 }}>
                🏥 <strong>Target:</strong> {h.name} — {h.specialty} · {h.beds} beds
              </p>
            </div>
          ) : null;
        })()}
        <AlgorithmSelector
          activeAlgos={activeAlgos}
          onToggle={handleToggleAlgo}
          onPreset={handlePresetAlgo}
        />
      </div>

      {/* ════════ TOP-RIGHT: CONTROLS ════════ */}
      <div style={{ position:"absolute", top:14, right:14, zIndex:200,
                    display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>

        {/* Primary buttons row */}
        <div style={glass({ padding:8, display:"flex", gap:8, alignItems:"center" })}>
          {step === "STANDBY" && (
            <>
              <button onClick={handleRunDemo} style={btnPrimary}>▶ Auto Demo</button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API}/hungarian-demo`);
                    const json = await res.json();
                    if (json.status === "success") {
                      setHungarianResult(json.data);
                      setShowHungarian(true);
                    } else {
                      showAlert(`⚠️ Hungarian optimization failed: ${json.message}`);
                    }
                  } catch {
                    showAlert("⚠️ Backend unreachable.");
                  }
                }}
                style={{
                  ...btnPrimary,
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  boxShadow: "0 0 18px rgba(239, 68, 68, 0.35)",
                }}
              >
                📊 Hungarian Dispatch
              </button>
            </>
          )}
          {step === "COMPUTING" && (
            <span style={{ padding:"9px 14px", fontSize:12, color:"#64748b", fontWeight:600 }}>Computing…</span>
          )}

          {/* ── SPLIT VIEW TOGGLE ── */}
          {isSimActive && (
            <button
              onClick={() => setSplitView(v => !v)}
              style={{
                padding:"9px 16px", fontWeight:800, fontSize:12, borderRadius:10,
                border:"none", cursor:"pointer", letterSpacing:".04em",
                textTransform:"uppercase" as const,
                background: splitView
                  ? "linear-gradient(135deg,#3b82f6 0%,#22c55e 100%)"
                  : "rgba(255,255,255,0.07)",
                color: splitView ? "#fff" : "#94a3b8",
                boxShadow: splitView ? "0 0 18px rgba(59,130,246,0.4)" : "none",
                transition: "all 0.25s ease",
              }}
            >
              {splitView ? "⊟ Full View" : "⊞ Split View"}
            </button>
          )}

          <button onClick={handleReset} style={btnSecondary}>↺ Reset</button>
        </div>

        {/* Traffic controls */}
        {isSimActive && (
          <div style={glass({ padding:"10px 12px", display:"flex", flexDirection:"column", gap:8, minWidth:230 })}>
            <span style={{ fontSize:9, fontWeight:800, color:"#475569", textTransform:"uppercase", letterSpacing:".09em" }}>
              Inject Traffic Event
            </span>
            <div style={{ display:"flex", gap:6 }}>
              {[
                { label:"🚧 Congestion", c:"#f59e0b", bg:"rgba(245,158,11,.1)", bd:"rgba(245,158,11,.25)", fn:()=>post("/traffic/congestion") },
                { label:"💥 Accident",   c:"#ef4444", bg:"rgba(239,68,68,.1)",  bd:"rgba(239,68,68,.25)",  fn:()=>post("/traffic/accident")   },
                { label:"✓ Clear",       c:"#22c55e", bg:"rgba(34,197,94,.1)",  bd:"rgba(34,197,94,.25)",  fn:()=>post("/traffic/clear")      },
              ].map(({ label, c, bg, bd, fn }) => (
                <button key={label} onClick={fn} style={{
                  flex:1, padding:"7px 4px", background:bg, color:c, fontWeight:700,
                  fontSize:10, borderRadius:8, border:`1px solid ${bd}`, cursor:"pointer" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={() => post("/pause", { paused: !tel?.is_paused })}
                style={{ padding:"5px 10px", background:"rgba(255,255,255,.06)", color:"#e2e8f0",
                          fontSize:10, fontWeight:700, borderRadius:6,
                          border:"1px solid rgba(255,255,255,.08)", cursor:"pointer" }}>
                {tel?.is_paused ? "▶ Play" : "⏸ Pause"}
              </button>
              <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
                {[1, 2, 4].map(s => (
                  <button key={s} onClick={() => post("/speed", { speed: s })}
                    style={{ padding:"5px 8px", fontSize:10, fontWeight:700, borderRadius:6,
                              border:"none", cursor:"pointer",
                              background: spd === s ? "#22c55e" : "rgba(255,255,255,.06)",
                              color: spd === s ? "#fff" : "#64748b" }}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════ TOAST ALERT ════════ */}
      {alert && (
        <div style={{
          position:"absolute", top:14, left:"50%", transform:"translateX(-50%)",
          zIndex:300, ...glass({ padding:"12px 20px", borderLeft:"4px solid #ef4444",
          display:"flex", alignItems:"center", gap:10, borderRadius:12 })
        }}>
          <p style={{ margin:0, fontSize:12, fontWeight:700, color:"#f1f5f9" }}>{alert}</p>
        </div>
      )}

      {/* ════════ BOTTOM COMPARISON BAR (only in full view) ════════ */}
      {tel && isSimActive && !splitView && (
        <BottomMetrics
          vehA={tel.veh_a}
          vehB={tel.veh_b}
          vehC={tel.veh_c}
          vehD={tel.veh_d}
          activeAlgos={activeAlgos}
        />
      )}

      {/* ════════ LEGEND (hidden in split view to reduce clutter) ════════ */}
      {!splitView && (
        <div style={{ position:"absolute", bottom:14, left:14, zIndex:200 }}>
          <div style={glass({ padding:"10px 14px", borderRadius:10,
                               display:"flex", flexDirection:"column", gap:6 })}>
            <span style={{ fontSize:9, fontWeight:800, color:"#334155",
                           textTransform:"uppercase", letterSpacing:".1em" }}>LEGEND</span>
            {[
              { el:<div style={{ width:18, height:2.5, background:"#3b82f6", borderRadius:2 }}/>, label:"Dijkstra route (Static)" },
              { el:<div style={{ width:18, height:2.5, background:"#22c55e", borderRadius:2 }}/>, label:"A* route (Dynamic)" },
              { el:<div style={{ width:18, height:2.5, borderBottom:"2px dashed #f97316", borderRadius:1 }}/>, label:"Greedy BFS (Dynamic)" },
              { el:<div style={{ width:18, height:2.5, borderBottom:"2px dotted #a855f7", borderRadius:1 }}/>, label:"Bellman-Ford (Static)" },
              { el:<div style={{ width:12, height:12, border:"2px solid #06b6d4", borderRadius:3, background:"rgba(6,182,212,.12)"}}/>, label:"Hospital" },
              { el:<div style={{ width:11, height:11, borderRadius:"50%", background:"#ef4444" }}/>, label:"Emergency" },
              { el:<div style={{ width:12, height:12, border:"2px solid #a78bfa", borderRadius:3, background:"rgba(167,139,250,.12)"}}/>, label:"Amb. Station" },
            ].map(({ el, label }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                {el}
                <span style={{ fontSize:10, color:"#94a3b8", fontWeight:500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════ RESULT MODAL ════════ */}
      <ResultModal
        isOpen={isResultOpen}
        vehA={tel ? tel.veh_a : null}
        vehB={tel ? tel.veh_b : null}
        vehC={tel ? tel.veh_c : null}
        vehD={tel ? tel.veh_d : null}
        activeAlgos={activeAlgos}
        onClose={handleReset}
      />

      {/* ════════ HUNGARIAN OPTIMIZER MODAL ════════ */}
      {showHungarian && hungarianResult && (
        <HungarianPanel
          result={hungarianResult}
          onClose={() => setShowHungarian(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding:"9px 18px", background:"#22c55e", color:"#fff", fontWeight:800,
  fontSize:12, borderRadius:10, border:"none", cursor:"pointer",
  letterSpacing:".05em", textTransform:"uppercase",
  boxShadow:"0 0 18px rgba(34,197,94,.35)",
};

const btnSecondary: React.CSSProperties = {
  padding:"9px 14px", background:"rgba(255,255,255,.07)", color:"#94a3b8",
  fontWeight:800, fontSize:12, borderRadius:10, border:"none", cursor:"pointer",
  letterSpacing:".05em", textTransform:"uppercase",
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
  // 4 — 2×2 grid, rows MUST be constrained with minmax(0,1fr)
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
