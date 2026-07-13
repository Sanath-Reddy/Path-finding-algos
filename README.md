# Smart Ambulance Dispatch & Routing Command Center
## Design & Analysis of Algorithms (DAA) — Project-Based Learning (PBL)

A real-time command center application implementing multi-agent simulation for emergency vehicle dispatch, optimal routing, and medical resource allocation. It integrates five different pathfinding and assignment algorithms to compare their efficiency, search space, and execution speeds.

---

## 🚀 Quick Launch

Ensure you have Python 3.8+ and Node.js 16+ installed, then simply run the dashboard launcher script:

```powershell
.\run_dashboard.bat
```

This will automatically compile the backend modules, start both servers, and launch the command center dashboard at **[http://localhost:5173](http://localhost:5173)**.

---

## 🏛️ Project Directory Structure

*   [PROJECT_DETAILS.md](file:///c:/Users/sanat/Desktop/daa%20pbl/PROJECT_DETAILS.md): Detailed algorithm specifications, time/space complexities, mathematical formulations, and system designs.
*   [run_dashboard.bat](file:///c:/Users/sanat/Desktop/daa%20pbl/run_dashboard.bat): Windows script to run both the FastAPI server and Vite frontend simultaneously.
*   [main.py](file:///c:/Users/sanat/Desktop/daa%20pbl/main.py): Legacy CLI and Streamlit GUI dashboard.
*   [backend/](file:///c:/Users/sanat/Desktop/daa%20pbl/backend): Python FastAPI backend server containing all algorithm modules.
*   [frontend/](file:///c:/Users/sanat/Desktop/daa%20pbl/frontend): Vite + React + TS dashboard client application.

---

## 🧠 Key Algorithms

1.  **Dijkstra's Algorithm** ([backend/dijkstra.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/dijkstra.py)) — Shortest paths routing baseline.
2.  **A\* Search Algorithm** ([backend/astar.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/astar.py)) — Goal-directed routing with admissible scaled Euclidean distance heuristic.
3.  **Greedy Best-First Search** ([backend/greedy_bfs.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/greedy_bfs.py)) — Purely heuristic-driven search.
4.  **Bellman-Ford Algorithm** ([backend/bellman_ford.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/bellman_ford.py)) — Baseline SSSP using relaxation iterations.
5.  **Hungarian Algorithm** ([backend/hungarian.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/hungarian.py)) — Kuhn-Munkres algorithm for optimal ambulance-to-emergency bipartite matching.

For full technical specifications, scoring equations, and algorithm analysis, view the comprehensive [PROJECT_DETAILS.md](file:///c:/Users/sanat/Desktop/daa%20pbl/PROJECT_DETAILS.md).
