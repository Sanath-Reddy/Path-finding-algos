import React from "react";

interface AlgorithmSelectorProps {
  activeAlgos: Set<string>;
  onToggle: (id: string) => void;
  onPreset: (preset: string) => void;
}

export const AlgorithmSelector: React.FC<AlgorithmSelectorProps> = ({
  activeAlgos,
  onToggle,
  onPreset,
}) => {
  const algos = [
    { id: "A", name: "Dijkstra", color: "#3B82F6", label: "Static Blue" },
    { id: "B", name: "A*", color: "#22C55E", label: "Dynamic Green" },
    { id: "C", name: "Greedy BFS", color: "#F97316", label: "Dynamic Orange" },
    { id: "D", name: "Bellman-Ford", color: "#A855F7", label: "Static Purple" },
  ];

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.65)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        🔀 Active Route Comparison
      </div>
      
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {algos.map((algo) => {
          const active = activeAlgos.has(algo.id);
          return (
            <button
              key={algo.id}
              onClick={() => onToggle(algo.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                border: active ? `1.5px solid ${algo.color}` : "1.5px solid rgba(255, 255, 255, 0.08)",
                background: active ? `${algo.color}15` : "rgba(30, 41, 59, 0.4)",
                color: active ? "#ffffff" : "#64748b",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                transition: "all 0.2s ease",
                boxShadow: active ? `0 0 10px ${algo.color}25` : "none",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button
          onClick={() => onPreset("DIJKSTRA_VS_ASTAR")}
          style={presetStyle}
        >
          Dijkstra vs A*
        </button>
        <button
          onClick={() => onPreset("OPTIMAL_VS_GREEDY")}
          style={presetStyle}
        >
          Optimal vs Greedy
        </button>
        <button
          onClick={() => onPreset("STATIC_VS_DYNAMIC")}
          style={presetStyle}
        >
          Static vs Dynamic
        </button>
        <button
          onClick={() => onPreset("ALL")}
          style={{
            ...presetStyle,
            borderColor: "rgba(255, 255, 255, 0.2)",
            color: "#e2e8f0",
          }}
        >
          All 4
        </button>
      </div>
    </div>
  );
};

const presetStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255, 255, 255, 0.06)",
  background: "rgba(30, 41, 59, 0.25)",
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s ease",
};
