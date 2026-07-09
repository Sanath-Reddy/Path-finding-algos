import React from "react";
import { HungarianResult } from "../types";

interface HungarianPanelProps {
  result: HungarianResult;
  onClose: () => void;
}

export const HungarianPanel: React.FC<HungarianPanelProps> = ({ result, onClose }) => {
  const {
    cost_matrix,
    ambulance_ids,
    emergency_labels,
    greedy_assignment,
    greedy_cost,
    hungarian_assignment,
    hungarian_cost,
    savings_pct,
    execution_time_ms,
  } = result;

  // Helpers to check matchings
  const isGreedy = (rowIdx: number, colIdx: number) => greedy_assignment[rowIdx] === colIdx;
  const isHungarian = (rowIdx: number, colIdx: number) => hungarian_assignment[rowIdx] === colIdx;

  // Style helper for matrix cells
  const getCellColor = (rowIdx: number, colIdx: number) => {
    const isG = isGreedy(rowIdx, colIdx);
    const isH = isHungarian(rowIdx, colIdx);
    
    if (isG && isH) {
      return {
        bg: "rgba(16, 185, 129, 0.25)", // Green match (both picked it)
        border: "1.5px solid #10b981",
        label: "Both",
      };
    }
    if (isH) {
      return {
        bg: "rgba(34, 197, 94, 0.2)", // Green (Hungarian Optimal)
        border: "1.5px solid #22c55e",
        label: "Hungarian",
      };
    }
    if (isG) {
      return {
        bg: "rgba(249, 115, 22, 0.15)", // Orange (Greedy Suboptimal)
        border: "1.5px dashed #f97316",
        label: "Greedy",
      };
    }
    return {
      bg: "rgba(255, 255, 255, 0.02)",
      border: "1px solid rgba(255, 255, 255, 0.05)",
      label: "",
    };
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(2, 6, 23, 0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 900,
          background: "rgba(15, 23, 42, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          color: "#f8fafc",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            background: "rgba(30, 41, 59, 0.3)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
              🔴 Multi-Emergency Dispatch Optimizer
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#94a3b8" }}>
              Comparing Greedy Bipartite Match vs Hungarian Algorithm for globally optimal fleet dispatch.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "28px", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 28 }}>
          {/* Matrix Panel */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Cost Matrix: Travel Times (mins)
            </div>

            {/* Matrix Header Row */}
            <div style={{ display: "grid", gridTemplateColumns: "100px repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
              <div />
              {emergency_labels.map((lbl, idx) => (
                <div key={idx} style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textAlign: "center", textTransform: "uppercase" }}>
                  EM-{idx + 1}
                </div>
              ))}
            </div>

            {/* Matrix Body Rows */}
            {cost_matrix.map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: "100px repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
                {/* Ambulance ID */}
                <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                  🚒 {ambulance_ids[rowIdx]}
                </div>
                {/* Matrix Columns */}
                {row.map((val, colIdx) => {
                  const state = getCellColor(rowIdx, colIdx);
                  return (
                    <div
                      key={colIdx}
                      style={{
                        height: 70,
                        background: state.bg,
                        border: state.border,
                        borderRadius: 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ fontSize: 17, fontWeight: 700, color: val === 999 ? "#ef4444" : "#f1f5f9" }}>
                        {val === 999 ? "∞" : `${val}m`}
                      </span>
                      {state.label && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: state.label === "Greedy" ? "#f97316" : "#22c55e",
                            background: "rgba(15, 23, 42, 0.7)",
                            padding: "2px 5px",
                            borderRadius: 4,
                            marginTop: 4,
                          }}
                        >
                          {state.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div style={{ display: "flex", gap: 20, marginTop: 24, padding: "12px 16px", background: "rgba(30, 41, 59, 0.2)", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px dashed #f97316", background: "rgba(249, 115, 22, 0.15)" }} />
                Greedy Select
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px solid #22c55e", background: "rgba(34, 197, 94, 0.2)" }} />
                Hungarian Optimal
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px solid #10b981", background: "rgba(16, 185, 129, 0.25)" }} />
                Matched Overlap
              </div>
            </div>
          </div>

          {/* Results Comparison Side Panel */}
          <div
            style={{
              background: "rgba(30, 41, 59, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: 14,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📊 Performance Breakdown
              </div>

              {/* Hungarian Cost Card */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.03))",
                  border: "1.5px solid rgba(34, 197, 94, 0.25)",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  boxShadow: "0 4px 20px rgba(34, 197, 94, 0.05)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  💚 Hungarian Algorithm
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
                  {hungarian_cost} <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8" }}>total mins</span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontFamily: "monospace" }}>
                  Optimized global perfect matching in O(n³)
                </div>
              </div>

              {/* Greedy Cost Card */}
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  🟠 Greedy Dispatch (Local)
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
                  {greedy_cost} <span style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>total mins</span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontFamily: "monospace" }}>
                  Nearest-ambulance-first sequential matching
                </div>
              </div>

              {/* Efficiency Stat */}
              {savings_pct > 0 ? (
                <div style={{ fontSize: 14, color: "#e2e8f0", padding: "10px 0" }}>
                  🎉 Hungarian reduced total arrival delay by{" "}
                  <strong style={{ color: "#22c55e", fontSize: 16 }}>{savings_pct}%</strong>!
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#94a3b8", padding: "10px 0" }}>
                  Greedy match happened to find the optimal arrangement for this specific case.
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                <span>Execution Cost</span>
                <span style={{ fontFamily: "monospace", color: "#94a3b8" }}>{execution_time_ms} ms</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                <span>Decision Scale</span>
                <span style={{ color: "#94a3b8" }}>4x4 Bipartite Bounded</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
