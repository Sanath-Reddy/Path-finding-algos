import React from "react";

interface AlgorithmSelectorProps {
  activeAlgos: Set<string>;
  onToggle: (id: string) => void;
  onPreset: (preset: string) => void;
  onRunHungarian: () => void;
  hungarianActive: boolean;
  onShowHungarianMatrix: () => void;
  isSidebar?: boolean;
}

export const AlgorithmSelector: React.FC<AlgorithmSelectorProps> = ({
  activeAlgos,
  onToggle,
  onPreset,
  onRunHungarian,
  hungarianActive,
  onShowHungarianMatrix,
  isSidebar,
}) => {
  const algos = [
    { id: "A", name: "Dijkstra",     color: "#3B82F6" },
    { id: "B", name: "A*",           color: "#22C55E" },
    { id: "C", name: "Greedy BFS",   color: "#F97316" },
    { id: "D", name: "Bellman-Ford", color: "#A855F7" },
  ];

  const HUN_COLOR = "#ef4444";

  return (
    <div
      style={
        isSidebar
          ? { marginBottom: 16 }
          : {
              background: "rgba(15, 23, 42, 0.65)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
            }
      }
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        🔀 Route Comparison
      </div>
      
      {/* ── 4 routing algorithm toggles ───────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {algos.map((algo) => {
          const active = activeAlgos.has(algo.id);
          return (
            <button
              key={algo.id}
              onClick={() => onToggle(algo.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 8,
                border: active ? `1.5px solid ${algo.color}` : "1.5px solid rgba(255, 255, 255, 0.08)",
                background: active ? `${algo.color}15` : "rgba(30, 41, 59, 0.4)",
                color: active ? "#ffffff" : "#64748b",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
                transition: "all 0.2s ease",
                boxShadow: active ? `0 0 10px ${algo.color}25` : "none",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: algo.color,
                  boxShadow: active ? `0 0 6px ${algo.color}` : "none",
                  opacity: active ? 1 : 0.4,
                }}
              />
              {algo.name}
            </button>
          );
        })}
      </div>

      {/* ── Hungarian algorithm ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <button
            onClick={onRunHungarian}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 10px",
              borderRadius: 8,
              border: hungarianActive ? `1.5px solid ${HUN_COLOR}` : "1.5px solid rgba(255, 255, 255, 0.08)",
              background: hungarianActive ? `${HUN_COLOR}15` : "rgba(30, 41, 59, 0.4)",
              color: hungarianActive ? "#ffffff" : "#64748b",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              transition: "all 0.2s ease",
              boxShadow: hungarianActive ? `0 0 12px ${HUN_COLOR}30` : "none",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: HUN_COLOR,
                boxShadow: hungarianActive ? `0 0 6px ${HUN_COLOR}` : "none",
                opacity: hungarianActive ? 1 : 0.4,
              }}
            />
            Hungarian
            {!hungarianActive && (
              <span style={{ fontSize: 9, color: "#475569", fontWeight: 600, marginLeft: "auto" }}>
                click to run ▶
              </span>
            )}
            {hungarianActive && (
              <span style={{ fontSize: 9, color: "#f87171", fontWeight: 700, marginLeft: "auto", letterSpacing: "0.04em" }}>
                LIVE ●
              </span>
            )}
          </button>

          {/* Matrix detail button — only shown after a run */}
          {hungarianActive && (
            <button
              onClick={onShowHungarianMatrix}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                border: `1px solid ${HUN_COLOR}50`,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 800,
                color: "#f87171",
                background: `${HUN_COLOR}10`,
                transition: "all 0.2s ease",
              }}
              title="View cost matrix"
            >
              Matrix
            </button>
          )}
        </div>

        {/* Descriptive hint text under Hungarian */}
        <p style={{ margin: "5px 0 0", fontSize: 9, color: "#475569", lineHeight: 1.4 }}>
          {hungarianActive
            ? "Optimal fleet-to-incident assignment active — see savings in metrics bar ↓"
            : "Kuhn-Munkres bipartite matching for optimal multi-ambulance dispatch"}
        </p>
      </div>

      {/* ── Preset quick-selects ──────────────────────────────────── */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Presets
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <button onClick={() => onPreset("DIJKSTRA_VS_ASTAR")} style={presetStyle}>
          Dijkstra vs A*
        </button>
        <button onClick={() => onPreset("OPTIMAL_VS_GREEDY")} style={presetStyle}>
          Optimal vs Greedy
        </button>
        <button onClick={() => onPreset("STATIC_VS_DYNAMIC")} style={presetStyle}>
          Static vs Dynamic
        </button>
        <button onClick={() => onPreset("ALL")} style={{ ...presetStyle, borderColor: "rgba(255,255,255,0.2)", color: "#e2e8f0" }}>
          All 4
        </button>
      </div>
    </div>
  );
};

const presetStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderRadius: 6,
  border: "1px solid rgba(255, 255, 255, 0.06)",
  background: "rgba(30, 41, 59, 0.25)",
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s ease",
};
