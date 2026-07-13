import React from "react";
import { VehicleTelemetry } from "../types";

interface Props {
  isOpen: boolean;
  vehA: VehicleTelemetry | null;
  vehB: VehicleTelemetry | null;
  vehC: VehicleTelemetry | null;
  vehD: VehicleTelemetry | null;
  activeAlgos: Set<string>;
  onClose: () => void;
  isMCI?: boolean;
  mciGreedyTotal?: number;
  mciHungarianTotal?: number;
  savingsPct?: number;
}

const modal: React.CSSProperties = {
  background: "rgba(8, 12, 24, 0.96)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 20,
  boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
  color: "#e2e8f0",
  fontFamily: "'Inter', sans-serif",
  width: "90%",
  maxWidth: 550,
  overflow: "hidden",
};

export const ResultModal: React.FC<Props> = ({
  isOpen,
  vehA,
  vehB,
  vehC,
  vehD,
  activeAlgos,
  onClose,
  isMCI,
  mciGreedyTotal,
  mciHungarianTotal,
  savingsPct,
}) => {
  if (!isOpen) return null;

  if (isMCI) {
    const greedyVal = mciGreedyTotal ?? 0;
    const hungarianVal = mciHungarianTotal ?? 0;
    const savings = savingsPct ?? 0;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          padding: 16,
        }}
      >
        <div style={modal}>
          <div
            style={{
              padding: "24px 24px 16px",
              background: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, transparent 60%)",
              textAlign: "center",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 8 }}>🏆</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: "0 0 6px", letterSpacing: "0.02em" }}>
              MCI Dispatch Complete!
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              Globally optimized matching vs greedy nearest-first allocation:
            </p>
          </div>

          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", fontWeight: 700, fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ width: 40 }}>Rank</span>
              <span style={{ flex: 2 }}>Fleet Dispatch Policy</span>
              <span style={{ flex: 1, textAlign: "right" }}>Total Travel Time</span>
            </div>

            {/* Rank 1: Hungarian */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "16px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                color: "#ffffff",
                fontWeight: 700,
              }}
            >
              <span style={{ width: 40, fontSize: 14, color: "#fbbf24" }}>🥇 1</span>
              <span style={{ flex: 2, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ef4444", boxShadow: "0 0 6px #ef4444" }} />
                Hungarian (Optimal)
              </span>
              <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontFamily: "monospace", color: "#4ade80" }}>
                {hungarianVal.toFixed(1)}m
              </span>
            </div>

            {/* Rank 2: Greedy */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "16px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                color: "#cbd5e1",
                fontWeight: 500,
              }}
            >
              <span style={{ width: 40, fontSize: 13, color: "#64748b" }}>🥈 2</span>
              <span style={{ flex: 2, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#3B82F6", boxShadow: "0 0 6px #3B82F6" }} />
                Greedy (Nearest-First)
              </span>
              <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontFamily: "monospace", color: "#ef4444" }}>
                {greedyVal.toFixed(1)}m
              </span>
            </div>
          </div>

          <div
            style={{
              margin: "0 24px 16px",
              padding: "14px 16px",
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Total Dispatch Savings
            </span>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#4ade80", marginTop: 4 }}>
              ✅ Saved {savings.toFixed(1)}% Response Time
            </div>
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>
              Kuhn-Munkres algorithm successfully resolved matching conflicts.
            </div>
          </div>

          <div style={{ padding: "0 24px 24px" }}>
            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "13px 0",
                background: "#ef4444",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                boxShadow: "0 0 20px rgba(239, 68, 68, 0.35)",
                transition: "all 0.2s",
              }}
            >
              ↺ Run Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const algos = [
    { id: "A", name: "Dijkstra", color: "#3B82F6", veh: vehA },
    { id: "B", name: "A*", color: "#22C55E", veh: vehB },
    { id: "C", name: "Greedy BFS", color: "#F97316", veh: vehC },
    { id: "D", name: "Bellman-Ford", color: "#A855F7", veh: vehD },
  ].filter((a) => activeAlgos.has(a.id) && a.veh);

  if (algos.length === 0) return null;

  // Find the winner (minimum travel time accumulated_cost)
  const sortedAlgos = [...algos].sort((a, b) => {
    const costDiff = (a.veh?.accumulated_cost ?? 999) - (b.veh?.accumulated_cost ?? 999);
    if (Math.abs(costDiff) < 0.01) {
      const nodesDiff = (a.veh?.nodes_explored ?? 999) - (b.veh?.nodes_explored ?? 999);
      if (nodesDiff === 0) {
        const priority: Record<string, number> = { "C": 1, "B": 2, "A": 3, "D": 4 };
        return priority[a.id] - priority[b.id];
      }
      return nodesDiff;
    }
    return costDiff;
  });
  
  const winner = sortedAlgos[0];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        padding: 16,
      }}
    >
      <div style={modal}>
        {/* Header */}
        <div
          style={{
            padding: "24px 24px 16px",
            background: winner
              ? `linear-gradient(135deg, ${winner.color}15 0%, transparent 60%)`
              : "none",
            textAlign: "center",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 8 }}>🏆</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: "0 0 6px", letterSpacing: "0.02em" }}>
            Mission Complete!
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
            Ambulances have safely reached the hospital. Here is the final leaderboard:
          </p>
        </div>

        {/* Leaders */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", fontWeight: 700, fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ width: 40 }}>Rank</span>
            <span style={{ flex: 1.5 }}>Algorithm</span>
            <span style={{ flex: 1, textAlign: "right" }}>Travel Time</span>
            <span style={{ flex: 1, textAlign: "right" }}>Nodes</span>
            <span style={{ flex: 1, textAlign: "right" }}>Runtime</span>
          </div>

          {sortedAlgos.map((item, idx) => {
            const isWinner = idx === 0;
            const cost = item.veh?.accumulated_cost ?? 0;
            const nodes = item.veh?.nodes_explored ?? 0;
            const runtime = (item.veh as any)?.runtime_ms ?? 0;

            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  color: isWinner ? "#ffffff" : "#cbd5e1",
                  fontWeight: isWinner ? 700 : 500,
                }}
              >
                <span style={{ width: 40, fontSize: 13, color: isWinner ? "#fbbf24" : "#64748b" }}>
                  {isWinner ? "🥇 1" : `# ${idx + 1}`}
                </span>
                <span style={{ flex: 1.5, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontFamily: "monospace", color: isWinner ? "#4ade80" : "#e2e8f0" }}>
                  {cost.toFixed(1)}m
                </span>
                <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontFamily: "monospace" }}>
                  {nodes}
                </span>
                <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontFamily: "monospace" }}>
                  {runtime > 0 ? `${runtime.toFixed(1)}ms` : "–"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Explain Card */}
        {winner && (
          <div
            style={{
              margin: "0 24px 16px",
              padding: "12px 16px",
              background: `${winner.color}10`,
              border: `1px solid ${winner.color}25`,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Fastest Arrival Path
            </span>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginTop: 4 }}>
              🏆 {winner.name} ({winner.veh?.accumulated_cost.toFixed(1)} mins)
            </div>
          </div>
        )}

        {/* Action Button */}
        <div style={{ padding: "0 24px 24px" }}>
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "13px 0",
              background: winner ? winner.color : "#22c55e",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              boxShadow: winner ? `0 0 20px ${winner.color}35` : "0 0 20px rgba(34,197,94,0.3)",
              transition: "all 0.2s",
            }}
          >
            ↺ Run Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultModal;
