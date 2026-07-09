import React from "react";
import { VehicleTelemetry } from "../types";

interface Props {
  vehA: VehicleTelemetry | null;
  vehB: VehicleTelemetry | null;
}

const panelStyle: React.CSSProperties = {
  background: "rgba(10, 15, 30, 0.90)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  color: "#e2e8f0",
  fontFamily: "'Inter', sans-serif",
};

export const BottomMetrics: React.FC<Props> = ({ vehA, vehB }) => {
  const aNodes = vehA?.nodes_explored ?? 0;
  const bNodes = vehB?.nodes_explored ?? 0;
  const aTime = vehA?.accumulated_cost ?? 0;
  const bTime = vehB?.accumulated_cost ?? 0;
  const aRuntime = (vehA as any)?.runtime_ms ?? 0;
  const bRuntime = (vehB as any)?.runtime_ms ?? 0;
  const nodesSavedPct = aNodes > 0 ? Math.max(0, ((aNodes - bNodes) / aNodes) * 100) : 0;

  const etaLabel = (veh: VehicleTelemetry | null) => {
    if (!veh) return "–";
    if (veh.status === "ARRIVED") return "✓ Done";
    const rem = Math.max(0, veh.est_travel_time - veh.accumulated_cost);
    return `${rem.toFixed(1)} m`;
  };

  const statusLabel = (veh: VehicleTelemetry | null) => {
    if (!veh) return "Idle";
    if (veh.status === "RESPONDING") return "→ Patient";
    if (veh.status === "TRANSPORTING") return "→ Hospital";
    return "Arrived ✓";
  };

  const aheadBy = aTime - bTime;

  const MetricCell = ({ label, value, highlight }: { label: string; value: string; highlight?: string }) => (
    <div style={{ textAlign: "center", minWidth: 52 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', 'Courier New', monospace", color: highlight ?? "#f1f5f9" }}>{value}</div>
    </div>
  );

  return (
    <div style={{
      position: "absolute",
      bottom: 16,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 100,
    }}>
      <div style={{ ...panelStyle, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>

        {/* ── DIJKSTRA ── */}
        <div style={{
          padding: "10px 14px", borderRadius: 12,
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.20)",
          display: "flex", alignItems: "center", gap: 12
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 8px #3b82f6" }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: "#60a5fa", letterSpacing: "0.08em", textTransform: "uppercase" }}>Dijkstra</span>
            <span style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>{statusLabel(vehA)}</span>
          </div>

          <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.07)" }} />

          <div style={{ display: "flex", gap: 16 }}>
            <MetricCell label="Nodes" value={String(aNodes)} />
            <MetricCell label="Travel" value={`${aTime.toFixed(1)}m`} />
            <MetricCell label="Runtime" value={aRuntime > 0 ? `${aRuntime.toFixed(1)}ms` : "–"} />
            <MetricCell label="ETA left" value={etaLabel(vehA)} highlight="#60a5fa" />
          </div>
        </div>

        {/* ── VS DIVIDER ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 4px" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#334155" }}>VS</span>
          {aheadBy > 0.2 && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", textAlign: "center", whiteSpace: "nowrap" }}>
              A* +{aheadBy.toFixed(1)}m ahead
            </span>
          )}
          {nodesSavedPct > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#4ade80",
              background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
              padding: "2px 6px", borderRadius: 99, whiteSpace: "nowrap"
            }}>
              A* {nodesSavedPct.toFixed(0)}% fewer nodes
            </span>
          )}
        </div>

        {/* ── A* ── */}
        <div style={{
          padding: "10px 14px", borderRadius: 12,
          background: "rgba(34,197,94,0.06)",
          border: "1px solid rgba(34,197,94,0.20)",
          display: "flex", alignItems: "center", gap: 12
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.08em", textTransform: "uppercase" }}>A* Search</span>
            <span style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>{statusLabel(vehB)}</span>
          </div>

          <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.07)" }} />

          <div style={{ display: "flex", gap: 16 }}>
            <MetricCell label="Nodes" value={String(bNodes)} />
            <MetricCell label="Travel" value={`${bTime.toFixed(1)}m`} />
            <MetricCell label="Runtime" value={bRuntime > 0 ? `${bRuntime.toFixed(1)}ms` : "–"} />
            <MetricCell label="ETA left" value={etaLabel(vehB)} highlight="#4ade80" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default BottomMetrics;
