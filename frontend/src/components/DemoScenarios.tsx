import React from "react";

interface Scenario {
  id: string;
  name: string;
  winner: string;
  winColor: string;
  desc: string;
}

interface DemoScenariosProps {
  onTriggerScenario: (id: string) => void;
  activeScenario: string | null;
  disabled: boolean;
}

export const DemoScenarios: React.FC<DemoScenariosProps> = ({
  onTriggerScenario,
  activeScenario,
  disabled,
}) => {
  const scenarios: Scenario[] = [
    {
      id: "open-city",
      name: "Open Grid",
      winner: "Greedy BFS",
      winColor: "#F97316",
      desc: "Clean, traffic-free grid. Greedy runs directly to goal with minimal nodes explored.",
    },
    {
      id: "heuristic",
      name: "Heuristic Trap",
      winner: "A* Search",
      winColor: "#22C55E",
      desc: "Dijkstra gets lured by cheap roads in the wrong direction; A* ignores them.",
    },
    {
      id: "rerouting",
      name: "Rerouting Crisis",
      winner: "A* Search",
      winColor: "#22C55E",
      desc: "Mid-transit roadblock blocks Dijkstra's pre-computed path; A* recalculates.",
    },
    {
      id: "maze",
      name: "Dense Maze",
      winner: "Dijkstra",
      winColor: "#3B82F6",
      desc: "Complex obstacles. Greedy gets trapped in dead ends; Dijkstra guarantees optimality.",
    },
    {
      id: "mci",
      name: "Mass Casualty (MCI)",
      winner: "Hungarian",
      winColor: "#ef4444",
      desc: "4 simultaneous incidents. Parallel fleet race: Greedy assignment vs Hungarian optimal.",
    },
  ];

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        📋 Demo Scenarios
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {scenarios.map((sc) => {
          const isActive = activeScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => !disabled && onTriggerScenario(sc.id)}
              disabled={disabled}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: isActive ? `1.5px solid ${sc.winColor}` : "1px solid rgba(255, 255, 255, 0.05)",
                background: isActive ? `${sc.winColor}10` : "rgba(30, 41, 59, 0.25)",
                color: "#e2e8f0",
                cursor: disabled ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
                opacity: disabled && !isActive ? 0.5 : 1,
                boxShadow: isActive ? `0 0 10px ${sc.winColor}15` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#fff" : "#cbd5e1" }}>
                  {sc.name}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `${sc.winColor}20`,
                    color: sc.winColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {sc.winner} Wins
                </span>
              </div>
              <div style={{ fontSize: 9, color: "#64748b", lineHeight: 1.3 }}>
                {sc.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DemoScenarios;
