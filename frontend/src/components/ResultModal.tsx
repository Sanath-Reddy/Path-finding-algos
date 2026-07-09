import React from "react";
import { VehicleTelemetry } from "../types";

interface Props {
  isOpen: boolean;
  vehA: VehicleTelemetry | null;
  vehB: VehicleTelemetry | null;
  onClose: () => void;
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
  width: "100%",
  maxWidth: 480,
  overflow: "hidden",
};

export const ResultModal: React.FC<Props> = ({ isOpen, vehA, vehB, onClose }) => {
  if (!isOpen || !vehA || !vehB) return null;

  const tA = vehA.accumulated_cost;
  const tB = vehB.accumulated_cost;
  const nA = vehA.nodes_explored;
  const nB = vehB.nodes_explored;
  const rA = (vehA as any).runtime_ms ?? 0;
  const rB = (vehB as any).runtime_ms ?? 0;

  const timeSavedPct = tA > 0 ? ((tA - tB) / tA) * 100 : 0;
  const nodesSavedPct = nA > 0 ? ((nA - nB) / nA) * 100 : 0;
  const winner = tB < tA ? "A* Search" : tA < tB ? "Dijkstra" : "Tie";
  const isAStarWin = winner === "A* Search";

  const Row = ({ label, vA, vB }: { label: string; vA: string; vB: string }) => (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ flex: 1, fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</span>
      <span style={{ width: 120, textAlign: "center", fontSize: 13, fontWeight: 800, fontFamily: "monospace", color: "#93c5fd" }}>{vA}</span>
      <span style={{ width: 120, textAlign: "center", fontSize: 13, fontWeight: 800, fontFamily: "monospace", color: "#86efac" }}>{vB}</span>
    </div>
  );

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 500,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(6px)",
      padding: 16
    }}>
      <div style={modal}>

        {/* ── Header ── */}
        <div style={{
          padding: "24px 24px 16px",
          background: isAStarWin
            ? "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, transparent 60%)"
            : "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, transparent 60%)",
          textAlign: "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)"
        }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🏆</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: "0 0 6px", letterSpacing: "0.02em" }}>
            Mission Complete!
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
            Both ambulances reached the hospital. Here's how they compared:
          </p>
        </div>

        {/* ── Column Headers ── */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 24px 4px" }}>
          <div style={{ flex: 1 }} />
          <div style={{
            width: 120, textAlign: "center", fontSize: 10, fontWeight: 800,
            letterSpacing: "0.08em", textTransform: "uppercase", color: "#60a5fa"
          }}>
            🔵 Dijkstra {!isAStarWin && winner !== "Tie" ? "🥇" : ""}
          </div>
          <div style={{
            width: 120, textAlign: "center", fontSize: 10, fontWeight: 800,
            letterSpacing: "0.08em", textTransform: "uppercase", color: "#4ade80"
          }}>
            🟢 A* {isAStarWin ? "🥇" : ""}
          </div>
        </div>

        {/* ── Stats Rows ── */}
        <div style={{ padding: "0 24px 8px" }}>
          <Row label="Total Travel Time" vA={`${tA.toFixed(2)} min`} vB={`${tB.toFixed(2)} min`} />
          <Row label="Nodes Explored" vA={String(nA)} vB={String(nB)} />
          <Row label="Algorithm Runtime" vA={`${rA.toFixed(2)} ms`} vB={`${rB.toFixed(2)} ms`} />
        </div>

        {/* ── Winner Banner ── */}
        <div style={{
          margin: "0 24px 16px",
          padding: "12px 16px",
          background: isAStarWin ? "rgba(34,197,94,0.10)" : "rgba(59,130,246,0.10)",
          border: `1px solid ${isAStarWin ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)"}`,
          borderRadius: 12,
          display: "flex", alignItems: "center", gap: 16
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Winner</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: isAStarWin ? "#4ade80" : "#60a5fa" }}>{winner}</div>
          </div>
          <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Time Saved</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#f1f5f9" }}>{Math.abs(timeSavedPct).toFixed(0)}% faster</div>
          </div>
          <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Search Saved</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#f1f5f9" }}>{Math.abs(nodesSavedPct).toFixed(0)}% fewer nodes</div>
          </div>
        </div>

        {/* ── Why A* explanation ── */}
        <div style={{ padding: "0 24px 16px" }}>
          <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: "#4ade80" }}>Why A* typically wins:</strong>{" "}
            Dijkstra explores outward equally from the source (blind BFS on weights). A* uses a
            consistent Euclidean heuristic h(n) to focus search toward the goal, expanding far
            fewer nodes. When traffic changes, A* re-routes instantly while Dijkstra stays on its
            original path.
          </p>
        </div>

        {/* ── Action ── */}
        <div style={{ padding: "0 24px 24px" }}>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "13px 0",
              background: isAStarWin ? "#22c55e" : "#3b82f6",
              color: "#fff", fontWeight: 800, fontSize: 13,
              borderRadius: 12, border: "none", cursor: "pointer",
              letterSpacing: "0.06em", textTransform: "uppercase",
              boxShadow: isAStarWin ? "0 0 20px rgba(34,197,94,0.3)" : "0 0 20px rgba(59,130,246,0.3)",
              transition: "all 0.2s"
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
