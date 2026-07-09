import React from "react";
import { VehicleTelemetry } from "../types";

interface Props {
  vehA: VehicleTelemetry | null;
  vehB: VehicleTelemetry | null;
  vehC: VehicleTelemetry | null;
  vehD: VehicleTelemetry | null;
  activeAlgos: Set<string>;
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
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

export const BottomMetrics: React.FC<Props> = ({
  vehA,
  vehB,
  vehC,
  vehD,
  activeAlgos,
}) => {
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

  const MetricCell = ({ label, value, highlight }: { label: string; value: string; highlight?: string }) => (
    <div style={{ textAlign: "center", minWidth: 48 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono', 'Courier New', monospace", color: highlight ?? "#f1f5f9" }}>{value}</div>
    </div>
  );

  const renderCard = (
    id: string,
    name: string,
    color: string,
    textColor: string,
    veh: VehicleTelemetry | null
  ) => {
    if (!activeAlgos.has(id)) return null;

    const nodes = veh?.nodes_explored ?? 0;
    const time = veh?.accumulated_cost ?? 0;
    const runtime = (veh as any)?.runtime_ms ?? 0;

    return (
      <div
        key={id}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: `${color}06`,
          border: `1px solid ${color}20`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 65 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          <span style={{ fontSize: 9, fontWeight: 800, color: textColor, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center" }}>
            {name}
          </span>
          <span style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>{statusLabel(veh)}</span>
        </div>

        <div style={{ width: 1, height: 38, background: "rgba(255,255,255,0.07)" }} />

        <div style={{ display: "flex", gap: 12 }}>
          <MetricCell label="Nodes" value={String(nodes)} />
          <MetricCell label="Travel" value={`${time.toFixed(1)}m`} />
          <MetricCell label="Runtime" value={runtime > 0 ? `${runtime.toFixed(1)}ms` : "–"} />
          <MetricCell label="ETA left" value={etaLabel(veh)} highlight={textColor} />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        width: "90%",
        maxWidth: 1000,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={panelStyle}>
        {renderCard("A", "Dijkstra", "#3B82F6", "#60a5fa", vehA)}
        {renderCard("B", "A*", "#22C55E", "#4ade80", vehB)}
        {renderCard("C", "Greedy BFS", "#F97316", "#fed7aa", vehC)}
        {renderCard("D", "Bellman-Ford", "#A855F7", "#f3e8ff", vehD)}
      </div>
    </div>
  );
};

export default BottomMetrics;
