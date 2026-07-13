import React, { useState, useRef, useEffect } from "react";
import { GraphData, VehicleTelemetry, Hospital, ActiveEmergency, Ambulance, MCIVehicle } from "../types";

interface MapPanelProps {
  graph:          GraphData;
  vehA:           VehicleTelemetry | null;   // Dijkstra – Blue
  vehB:           VehicleTelemetry | null;   // A*        – Green
  vehC:           VehicleTelemetry | null;   // Greedy BFS – Orange
  vehD:           VehicleTelemetry | null;   // Bellman-Ford – Purple
  hospitals:      Hospital[];
  ambulances:     Ambulance[];
  emergency:      ActiveEmergency | null;
  selectedHospId: string | null;             // highlight the chosen hospital
  onNodeClick:    (nodeId: string) => void;
  step:           string;
  activeAlgos:    Set<string>;
  disasterMode?:  boolean;
  mciMode?:       boolean;
  mciEmergencies?: string[];
  mciGreedyVehicles?: MCIVehicle[];
  mciHungarianVehicles?: MCIVehicle[];
}

export const MapPanel: React.FC<MapPanelProps> = ({
  graph, vehA, vehB, vehC, vehD, hospitals, ambulances,
  emergency, selectedHospId, onNodeClick, step,
  activeAlgos, disasterMode, mciMode, mciEmergencies,
  mciGreedyVehicles, mciHungarianVehicles
}) => {
  const showA = activeAlgos.has("A");
  const showB = activeAlgos.has("B");
  const showC = activeAlgos.has("C");
  const showD = activeAlgos.has("D");
  const [vp,  setVp]  = useState({ x:0, y:0, scale:1.0 });
  const [hov, setHov] = useState<string | null>(null);

  const dragging = useRef(false);
  const dragStart = useRef({ x:0, y:0 });
  const mapRef    = useRef<HTMLDivElement>(null);

  /* ── grid → SVG pixel mapping ──────────────────────────────────────── */
  const maxX = Math.max(...graph.nodes.map(n => n.x), 9);
  const maxY = Math.max(...graph.nodes.map(n => n.y), 9);
  const PAD = 64, CELL = 74;
  const px = (gx: number) => PAD + gx * CELL;
  const py = (gy: number) => PAD + gy * CELL;
  const svgW = PAD * 2 + maxX * CELL;
  const svgH = PAD * 2 + maxY * CELL;

  /* ── pan & zoom ────────────────────────────────────────────────────── */
  const onMD = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX - vp.x, y: e.clientY - vp.y };
  };
  const onMM = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setVp(v => ({ ...v, x: e.clientX - dragStart.current.x,
                         y: e.clientY - dragStart.current.y }));
  };
  const onMU = () => { dragging.current = false; };
  const onWh = (e: React.WheelEvent) => {
    const f = e.deltaY < 0 ? 1.08 : 0.93;
    setVp(v => ({ ...v, scale: Math.max(0.3, Math.min(3.5, v.scale * f)) }));
  };

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const fitViewport = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const scaleX = width / svgW;
      const scaleY = height / svgH;
      const scale = Math.min(scaleX, scaleY) * 1.05;
      const x = (width - svgW * scale) / 2;
      const y = (height - svgH * scale) / 2;
      setVp({ x, y, scale });
    };
    fitViewport();
    const ro = new ResizeObserver(fitViewport);
    ro.observe(el);
    return () => ro.disconnect();
  }, [svgW, svgH]);

  /* ── build path points string ──────────────────────────────────────── */
  const pts = (veh: VehicleTelemetry | null): string | null => {
    if (!veh || veh.status === "ARRIVED") return null;
    const path = veh.status === "RESPONDING"
      ? veh.path_to_emergency : veh.path_to_hospital;
    if (!path || path.length < 2) return null;
    return path.map(s => {
      const [a, b] = s.split(",");
      return `${px(+a)},${py(+b)}`;
    }).join(" ");
  };

  const mciPts = (path: string[] | null): string | null => {
    if (!path || path.length < 2) return null;
    return path.map(s => {
      const [a, b] = s.split(",");
      return `${px(+a)},${py(+b)}`;
    }).join(" ");
  };

  const showMCIGreedy = mciMode ? (!activeAlgos.has("B") || activeAlgos.has("C") || activeAlgos.has("A")) : false;
  const showMCIHungarian = mciMode ? (!activeAlgos.has("C") || activeAlgos.has("B") || activeAlgos.has("D")) : false;

  const canClick = step === "STANDBY" || step === "COMPUTING";

  return (
    <div ref={mapRef}
      onMouseDown={onMD} onMouseMove={onMM}
      onMouseUp={onMU}   onMouseLeave={onMU}
      onWheel={onWh}
      style={{ width:"100%", height:"100%", position:"relative", overflow:"hidden",
               cursor: dragging.current ? "grabbing" : canClick ? "crosshair" : "grab",
               userSelect:"none" }}>

      <svg width="100%" height="100%"
        style={{ display: "block", overflow: "hidden" }}>

        <defs>
          {/* glow filters */}
          {(["blue","green","red","cyan","violet","orange","purple"] as const).map(c => {
            const cols: Record<string, string> = {
              blue:"#3b82f6", green:"#22c55e", red:"#ef4444", cyan:"#06b6d4", violet:"#a78bfa", orange:"#f97316", purple:"#a855f7"
            };
            return (
              <filter key={c} id={`glow-${c}`} x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
                <feColorMatrix in="b" type="matrix"
                  values={`0 0 0 0 ${hexR(cols[c])}  0 0 0 0 ${hexG(cols[c])}  0 0 0 0 ${hexB(cols[c])}  0 0 0 0.8 0`}
                  result="col"/>
                <feMerge><feMergeNode in="col"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            );
          })}

          {/* ambulance body gradient */}
          <linearGradient id="ambGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff"/>
            <stop offset="100%" stopColor="#dde4f0"/>
          </linearGradient>

          {/* CSS keyframes embedded in SVG */}
          <style>{`
            @keyframes rping  { 0%{r:8;opacity:.9} 100%{r:28;opacity:0} }
            @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:.15} }
            @keyframes dashgo { to{stroke-dashoffset:-22} }
            @keyframes throb  { 0%,100%{opacity:.65;stroke-width:2.5} 50%{opacity:1;stroke-width:4.5} }
            .rp1{animation:rping 2s infinite ease-out}
            .rp2{animation:rping 2s .7s infinite ease-out}
            .blk{animation:blink .7s infinite}
            .dgo{animation:dashgo 1s linear infinite}
            .thr{animation:throb 1.1s infinite ease-in-out}
          `}</style>
        </defs>

        <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>

          {/* ── LAYER 1: ROADS ── */}
          {graph.edges.map((e, i) => {
            const [ax,ay] = e.source.split(",").map(Number);
            const [bx,by] = e.target.split(",").map(Number);
            let stroke="#1c2a3d", sw=1.8, dash="", cls="", opa=0.75;
            if      (e.traffic_factor === -1)     { stroke="#7f1d1d"; sw=3.5; dash="5,4"; opa=1; }
            else if (e.traffic_factor > 1.5)      { stroke="#ef4444"; sw=3.5; opa=1; cls="thr"; }
            else if (e.is_expressway)             { stroke="#0d9488"; sw=1;   dash="4,4"; opa=0.4; }
            return (
              <line key={i}
                x1={px(ax)} y1={py(ay)} x2={px(bx)} y2={py(by)}
                stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
                opacity={opa} strokeLinecap="round" className={cls}/>
            );
          })}

          {/* ── LAYER 2: ROUTE PATHS ── */}
          {/* Dijkstra (Blue) */}
          {showA && (() => { const p = pts(vehA); if (!p) return null; return (
            <g filter="url(#glow-blue)">
              <polyline points={p} fill="none" stroke="#3b82f6" strokeWidth="7"
                strokeLinecap="round" strokeLinejoin="round" opacity=".15"/>
              <polyline points={p} fill="none" stroke="#3b82f6" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" opacity=".95"
                strokeDasharray="12,5" className="dgo"/>
            </g>
          ); })()}

          {/* A* (Green) */}
          {showB && (() => { const p = pts(vehB); if (!p) return null; return (
            <g filter="url(#glow-green)">
              <polyline points={p} fill="none" stroke="#22c55e" strokeWidth="7"
                strokeLinecap="round" strokeLinejoin="round" opacity=".15"/>
              <polyline points={p} fill="none" stroke="#22c55e" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" opacity=".95"
                strokeDasharray="12,5" className="dgo"/>
            </g>
          ); })()}

          {/* Greedy BFS (Orange) */}
          {showC && (() => { const p = pts(vehC); if (!p) return null; return (
            <g filter="url(#glow-orange)">
              <polyline points={p} fill="none" stroke="#f97316" strokeWidth="7"
                strokeLinecap="round" strokeLinejoin="round" opacity=".15"/>
              <polyline points={p} fill="none" stroke="#f97316" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" opacity=".95"
                strokeDasharray="6,4" className="dgo"/>
            </g>
          ); })()}

          {/* Bellman-Ford (Purple) */}
          {showD && (() => { const p = pts(vehD); if (!p) return null; return (
            <g filter="url(#glow-purple)">
              <polyline points={p} fill="none" stroke="#a855f7" strokeWidth="7"
                strokeLinecap="round" strokeLinejoin="round" opacity=".15"/>
              <polyline points={p} fill="none" stroke="#a855f7" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" opacity=".95"
                strokeDasharray="2,3" className="dgo"/>
            </g>
          ); })()}

          {/* MCI Greedy Paths (Blue / Dashed) */}
          {showMCIGreedy && mciGreedyVehicles && mciGreedyVehicles.map((veh, idx) => {
            const p = mciPts(veh.path);
            if (!p || veh.status === "ARRIVED") return null;
            return (
              <g key={`mci-g-path-${idx}`} filter="url(#glow-blue)">
                <polyline points={p} fill="none" stroke="#3b82f6" strokeWidth="6"
                  strokeLinecap="round" strokeLinejoin="round" opacity=".12"/>
                <polyline points={p} fill="none" stroke="#3b82f6" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" opacity=".85"
                  strokeDasharray="6,4" className="dgo"/>
              </g>
            );
          })}

          {/* MCI Hungarian Paths (Red / Solid) */}
          {showMCIHungarian && mciHungarianVehicles && mciHungarianVehicles.map((veh, idx) => {
            const p = mciPts(veh.path);
            if (!p || veh.status === "ARRIVED") return null;
            return (
              <g key={`mci-h-path-${idx}`} filter="url(#glow-red)">
                <polyline points={p} fill="none" stroke="#ef4444" strokeWidth="6"
                  strokeLinecap="round" strokeLinejoin="round" opacity=".12"/>
                <polyline points={p} fill="none" stroke="#ef4444" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" opacity=".85"
                  className="dgo"/>
              </g>
            );
          })}

          {/* ── LAYER 3: NODES (intersections) ── */}
          {graph.nodes.map(node => {
            const cx = px(node.x), cy = py(node.y);
            const isH = hov === node.id;
            const isE = emergency?.node === node.id;
            /* skip rendering a plain node if hospital/station sits there */
            const isHosp = hospitals.some(h => `${h.node[0]},${h.node[1]}` === node.id);
            const isAmb  = ambulances.some(a => `${a.current_node[0]},${a.current_node[1]}` === node.id);
            if (isHosp || isAmb) return null;
            return (
              <g key={node.id}
                onClick={() => canClick && onNodeClick(node.id)}
                onMouseEnter={() => setHov(node.id)}
                onMouseLeave={() => setHov(null)}
                style={{ cursor: canClick ? "crosshair" : "default" }}>
                <circle cx={cx} cy={cy} r="14" fill="transparent"/>
                {isH && canClick && (
                  <circle cx={cx} cy={cy} r="13" fill="none"
                    stroke="#22c55e" strokeWidth="1.5" opacity=".4"/>
                )}
                <circle cx={cx} cy={cy}
                  r={isE ? 7 : isH && canClick ? 5.5 : 3.5}
                  fill={isE ? "#ef4444" : isH && canClick ? "#22c55e" : "#263547"}
                  stroke={isE ? "#fca5a5" : isH && canClick ? "#86efac" : "#334155"}
                  strokeWidth={isE ? 2.5 : 1}/>
                {isH && canClick && (
                  <g>
                    <rect x={cx-30} y={cy-28} width="60" height="17" rx="4"
                      fill="#0c1520" stroke="#334155" strokeWidth=".5"/>
                    <text x={cx} y={cy-17} fill="#e2e8f0" fontSize="8.5"
                      textAnchor="middle" fontFamily="monospace" fontWeight="600">
                      ({node.id})
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── LAYER 4: AMBULANCE STATIONS ── */}
          {ambulances.map(amb => {
            const cx = px(amb.current_node[0]), cy = py(amb.current_node[1]);
            return (
              <g key={amb.id} filter="url(#glow-violet)">
                {/* station marker */}
                <rect x={cx-11} y={cy-11} width="22" height="22" rx="5"
                  fill="#0e0d20" stroke="#a78bfa" strokeWidth="2"/>
                {/* ambulance cross */}
                <line x1={cx-5} y1={cy} x2={cx+5} y2={cy} stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1={cx} y1={cy-5} x2={cx} y2={cy+5} stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>
                <text x={cx} y={cy-15} fill="#c4b5fd" fontSize="7.5" fontWeight="700"
                  textAnchor="middle" fontFamily="Inter,sans-serif">{amb.id}</text>
              </g>
            );
          })}

          {/* ── LAYER 5: HOSPITALS ── */}
          {hospitals.map(h => {
            const cx = px(h.node[0]), cy = py(h.node[1]);
            const isSelected = h.id === selectedHospId;
            return (
              <g key={h.id} filter="url(#glow-cyan)">
                {/* selection ring */}
                {isSelected && (
                  <circle cx={cx} cy={cy} r="22" fill="none" stroke="#06b6d4"
                    strokeWidth="1.5" opacity=".5" className="rp1"/>
                )}
                {/* box */}
                <rect x={cx-13} y={cy-13} width="26" height="26" rx="6"
                  fill="#071828"
                  stroke={isSelected ? "#06b6d4" : "#0e7490"}
                  strokeWidth={isSelected ? 3 : 2}/>
                {/* H cross */}
                <line x1={cx-6} y1={cy} x2={cx+6} y2={cy} stroke={isSelected?"#06b6d4":"#0891b2"} strokeWidth="3" strokeLinecap="round"/>
                <line x1={cx} y1={cy-6} x2={cx} y2={cy+6} stroke={isSelected?"#06b6d4":"#0891b2"} strokeWidth="3" strokeLinecap="round"/>
                {/* name */}
                <text x={cx} y={cy-18} fill={isSelected?"#67e8f9":"#22d3ee"} fontSize="8"
                  fontWeight="700" textAnchor="middle" fontFamily="Inter,sans-serif">
                  {h.name.split(" ").slice(0,2).join(" ")}
                </text>
                {isSelected && (
                  <text x={cx} y={cy+22} fill="#67e8f9" fontSize="7.5"
                    fontWeight="700" textAnchor="middle" fontFamily="Inter,sans-serif">
                    ← TARGET
                  </text>
                )}
              </g>
            );
          })}

          {/* ── LAYER 6: EMERGENCY MARKER ── */}
          {emergency?.status === "ACTIVE" && (() => {
            const [ex, ey] = emergency.node.split(",").map(Number);
            const cx = px(ex), cy = py(ey);
            return (
              <g filter="url(#glow-red)">
                <circle cx={cx} cy={cy} r="8" fill="none" stroke="#ef4444" strokeWidth="2" className="rp1"/>
                <circle cx={cx} cy={cy} r="8" fill="none" stroke="#ef4444" strokeWidth="2" className="rp2"/>
                <circle cx={cx} cy={cy} r="9"  fill="#ef4444" opacity=".18"/>
                <circle cx={cx} cy={cy} r="7"  fill="#ef4444" opacity=".95"/>
                <circle cx={cx} cy={cy} r="3"  fill="#fff"/>
                <text x={cx} y={cy+21} fill="#fca5a5" fontSize="8.5" fontWeight="800"
                  textAnchor="middle" fontFamily="Inter,sans-serif">🚨 EMERGENCY</text>
              </g>
            );
          })()}

          {/* MCI Emergencies */}
          {mciMode && mciEmergencies && mciEmergencies.map((emNode, idx) => {
            const [ex, ey] = emNode.split(",").map(Number);
            const cx = px(ex), cy = py(ey);
            return (
              <g key={`mci-em-marker-${idx}`} filter="url(#glow-red)">
                <circle cx={cx} cy={cy} r="8" fill="none" stroke="#ef4444" strokeWidth="2" className="rp1"/>
                <circle cx={cx} cy={cy} r="8" fill="none" stroke="#ef4444" strokeWidth="2" className="rp2"/>
                <circle cx={cx} cy={cy} r="9"  fill="#ef4444" opacity=".18"/>
                <circle cx={cx} cy={cy} r="7"  fill="#ef4444" opacity=".95"/>
                <circle cx={cx} cy={cy} r="3"  fill="#fff"/>
                <text x={cx} y={cy+18} fill="#fca5a5" fontSize="8" fontWeight="800"
                  textAnchor="middle" fontFamily="Inter,sans-serif">P{idx + 1}</text>
              </g>
            );
          })}

          {/* MCI Greedy Vehicles */}
          {showMCIGreedy && mciGreedyVehicles && mciGreedyVehicles.map((veh, idx) => {
            if (veh.status === "ARRIVED") return null;
            const cx = px(veh.x), cy = py(veh.y);
            return (
              <g key={`mci-g-veh-${idx}`} transform={`translate(${cx},${cy}) rotate(${veh.angle})`}>
                <ellipse cx="0" cy="4" rx="14" ry="5" fill="rgba(0,0,0,.4)"/>
                <rect x="-14" y="-8" width="28" height="16" rx="4"
                  fill="url(#ambGrad)" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="3,2"/>
                <rect x="-5" y="-12" width="10" height="4" rx="2" fill="#3b82f6" className="blk"/>
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="0" y1="-4" x2="0" y2="5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
                <text x="0" y="-20" fill="#93c5fd" fontSize="7.5" fontWeight="800"
                  textAnchor="middle" fontFamily="Inter,sans-serif">{veh.id.replace(" (Greedy)", "").replace("AMB-", "G-")}</text>
              </g>
            );
          })}

          {/* MCI Hungarian Vehicles */}
          {showMCIHungarian && mciHungarianVehicles && mciHungarianVehicles.map((veh, idx) => {
            if (veh.status === "ARRIVED") return null;
            const cx = px(veh.x), cy = py(veh.y);
            return (
              <g key={`mci-h-veh-${idx}`} transform={`translate(${cx},${cy}) rotate(${veh.angle})`}>
                <ellipse cx="0" cy="4" rx="14" ry="5" fill="rgba(0,0,0,.4)"/>
                <rect x="-14" y="-8" width="28" height="16" rx="4"
                  fill="url(#ambGrad)" stroke="#ef4444" strokeWidth="2.5"/>
                <rect x="-5" y="-12" width="10" height="4" rx="2" fill="#ef4444" className="blk"/>
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="0" y1="-4" x2="0" y2="5" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
                <text x="0" y="-20" fill="#fca5a5" fontSize="7.5" fontWeight="800"
                  textAnchor="middle" fontFamily="Inter,sans-serif">{veh.id.replace(" (Hungarian)", "").replace("AMB-", "H-")}</text>
              </g>
            );
          })}

          {/* ── LAYER 7: ANIMATED AMBULANCES ── */}
          {/* Dijkstra — Blue */}
          {showA && vehA && vehA.status !== "ARRIVED" && (() => {
            const cx = px(vehA.x), cy = py(vehA.y);
            return (
              <g transform={`translate(${cx},${cy}) rotate(${vehA.angle})`}>
                <ellipse cx="0" cy="4" rx="14" ry="5" fill="rgba(0,0,0,.4)"/>
                <rect x="-14" y="-8" width="28" height="16" rx="4"
                  fill="url(#ambGrad)" stroke="#3b82f6" strokeWidth="2.5"/>
                <rect x="-5" y="-12" width="10" height="4" rx="2" fill="#3b82f6" className="blk"/>
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="0" y1="-4" x2="0" y2="5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
                <text x="0" y="-20" fill="#93c5fd" fontSize="8" fontWeight="800"
                  textAnchor="middle" fontFamily="Inter,sans-serif">Dijkstra</text>
              </g>
            );
          })()}

          {/* A* — Green */}
          {showB && vehB && vehB.status !== "ARRIVED" && (() => {
            const cx = px(vehB.x), cy = py(vehB.y);
            return (
              <g transform={`translate(${cx},${cy}) rotate(${vehB.angle})`}>
                <ellipse cx="0" cy="4" rx="14" ry="5" fill="rgba(0,0,0,.4)"/>
                <rect x="-14" y="-8" width="28" height="16" rx="4"
                  fill="url(#ambGrad)" stroke="#22c55e" strokeWidth="2.5"/>
                <rect x="-5" y="-12" width="10" height="4" rx="2" fill="#22c55e" className="blk"/>
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="0" y1="-4" x2="0" y2="5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"/>
                <text x="0" y="-20" fill="#86efac" fontSize="8" fontWeight="800"
                  textAnchor="middle" fontFamily="Inter,sans-serif">A*</text>
              </g>
            );
          })()}

          {/* Greedy BFS — Orange */}
          {showC && vehC && vehC.status !== "ARRIVED" && (() => {
            const cx = px(vehC.x), cy = py(vehC.y);
            return (
              <g transform={`translate(${cx},${cy}) rotate(${vehC.angle})`}>
                <ellipse cx="0" cy="4" rx="14" ry="5" fill="rgba(0,0,0,.4)"/>
                <rect x="-14" y="-8" width="28" height="16" rx="4"
                  fill="url(#ambGrad)" stroke="#f97316" strokeWidth="2.5"/>
                <rect x="-5" y="-12" width="10" height="4" rx="2" fill="#f97316" className="blk"/>
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="0" y1="-4" x2="0" y2="5" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"/>
                <text x="0" y="-20" fill="#fed7aa" fontSize="8" fontWeight="800"
                  textAnchor="middle" fontFamily="Inter,sans-serif">Greedy BFS</text>
              </g>
            );
          })()}

          {/* Bellman-Ford — Purple */}
          {showD && vehD && vehD.status !== "ARRIVED" && (() => {
            const cx = px(vehD.x), cy = py(vehD.y);
            return (
              <g transform={`translate(${cx},${cy}) rotate(${vehD.angle})`}>
                <ellipse cx="0" cy="4" rx="14" ry="5" fill="rgba(0,0,0,.4)"/>
                <rect x="-14" y="-8" width="28" height="16" rx="4"
                  fill="url(#ambGrad)" stroke="#a855f7" strokeWidth="2.5"/>
                <rect x="-5" y="-12" width="10" height="4" rx="2" fill="#a855f7" className="blk"/>
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="0" y1="-4" x2="0" y2="5" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round"/>
                <text x="0" y="-20" fill="#f3e8ff" fontSize="8" fontWeight="800"
                  textAnchor="middle" fontFamily="Inter,sans-serif">Bellman-Ford</text>
              </g>
            );
          })()}

        </g>{/* end transform group */}
      </svg>

      {/* ── Disaster mode banner ── */}
      {disasterMode && (
        <div style={{
          position:"absolute", top:16, left:"50%", transform:"translateX(-50%)",
          background:"rgba(239,68,68,.16)", border:"1px solid rgba(239,68,68,.4)",
          borderRadius:10, padding:"8px 24px",
          fontSize:13, fontWeight:900, color:"#ef4444",
          pointerEvents:"none",
          backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
          boxShadow: "0 0 20px rgba(239,68,68,0.25)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>
          ⚠️ Disaster Mode Active: Major Routes Blocked! 💥
        </div>
      )}

      {/* ── Hint banner ── */}
      {canClick && (
        <div style={{
          position:"absolute", bottom:88, left:"50%", transform:"translateX(-50%)",
          background:"rgba(34,197,94,.12)", border:"1px solid rgba(34,197,94,.3)",
          borderRadius:10, padding:"8px 20px",
          fontSize:12, fontWeight:700, color:"#4ade80",
          pointerEvents:"none",
          backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)"
        }}>
          {step === "STANDBY"
            ? "👆 Click any intersection to place an emergency — simulation starts automatically"
            : "⚙️ Dispatching ambulances and computing routes…"}
        </div>
      )}
    </div>
  );
};

/* helper: convert hex colour to 0–1 float for feColorMatrix */
function hexR(hex: string) { return parseInt(hex.slice(1,3),16)/255; }
function hexG(hex: string) { return parseInt(hex.slice(3,5),16)/255; }
function hexB(hex: string) { return parseInt(hex.slice(5,7),16)/255; }

export default MapPanel;
