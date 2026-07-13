# Smart Ambulance Dispatch & Routing Command Center
## Design & Analysis of Algorithms (DAA) — Project-Based Learning (PBL)

An advanced, real-time command center application implementing multi-agent simulation for emergency vehicle dispatch, optimal routing, and medical resource allocation. This system integrates multiple pathfinding and optimization algorithms to compare their efficiency, execution times, search spaces, and adaptability under dynamically changing traffic conditions.

---

## 🚑 Project Overview

In urban emergency response, seconds save lives. The **Smart Ambulance Dispatch & Routing Command Center** is a full-stack simulation tool that models a city graph grid, places emergency services (ambulances and specialized hospitals), and simulates emergency dispatching in real time. 

The command center demonstrates DAA concepts by applying:
1. **Single-Source Shortest Path (SSSP)** algorithms for routing.
2. **Goal-Directed Heuristic Search** for routing acceleration.
3. **Bipartite Matching** optimization for fleet ambulance-to-incident allocation.
4. **Multi-Criteria Optimization Decision Systems** for selecting specialized clinical hubs.

### Dual Interface Architecture
The project features a dual frontend implementation:
*   **Modern Interactive Dashboard (Current & Recommended):** A full-stack application with a FastAPI backend, real-time telemetry streaming over WebSockets, and a glassmorphic Vite + React + TypeScript frontend dashboard with interactive canvas map components.
*   **Streamlit Interactive Dashboard (Legacy/Quick-Testing):** A lightweight single-process dashboard built using Streamlit and Matplotlib rendering for fast prototyping.

---

## 🏛️ System Architecture

The application is structured as a decoupled full-stack platform:

```mermaid
flowchart TD
    subgraph Frontend ["React + TS Frontend (Vite)"]
        UI["Glassmorphic Dashboard (App.tsx)"]
        Map["Map Panel (Canvas Rendering)"]
        Metrics["Bottom Metrics Panel"]
        HPanel["Hungarian Assignment Panel"]
        WSClient["WebSocket Telemetry Client"]
    end

    subgraph Backend ["FastAPI Python Web Server"]
        API["REST API Endpoints (main.py)"]
        WSServer["WebSocket Telemetry Streamer"]
        Sim["Simulation Engine (simulation.py)"]
        Graph["City Graph Grid (graph.py)"]
        
        subgraph Pathfinding ["Pathfinding Engines"]
            Dijkstra["Dijkstra (dijkstra.py)"]
            AStar["A* Search (astar.py)"]
            GreedyBFS["Greedy BFS (greedy_bfs.py)"]
            BellmanFord["Bellman-Ford (bellman_ford.py)"]
        end

        subgraph ResourceAllocation ["Allocation Engines"]
            Dispatch["Multi-Criteria Scoring (dispatch.py)"]
            Hungarian["Hungarian Bipartite Solver (hungarian.py)"]
        end
    end

    UI -->|REST Command| API
    WSServer -.->|WebSocket Frames (Telemetry & Alerts)| WSClient
    API --> Sim
    Sim --> Graph
    Sim --> Pathfinding
    Sim --> ResourceAllocation
    WSClient --> UI
    Map --> UI
    Metrics --> UI
    HPanel --> UI
```

### 1. The Grid Map Graph System
The city is represented as an undirected graph using the NetworkX library (see [backend/graph.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/graph.py)).
*   **Nodes:** Coordinate pairs $(x, y)$ representing street intersections. Intersections are slightly perturbed mathematically to simulate realistic curved streets instead of perfect grids.
*   **Edges:** Road segments connecting intersections. Each edge contains metadata:
    *   `base_weight`: Euclidean distance between the nodes.
    *   `speed_limit`: Set to `1.0` for normal streets and `2.0` (double speed) for diagonal expressways.
    *   `traffic_factor`: Multiplier ranging from `1.0` (clear) to `12.0` (dense congestion). A value of `float('inf')` representing a complete roadblock.
    *   `current_weight`: Calculated as:
        $$\text{Current Weight} = \left(\frac{\text{base\_weight}}{\text{speed\_limit}}\right) \times \text{traffic\_factor}$$
        This weight represents the actual travel time across the segment.

---

## 🧠 Algorithms Deep Dive

### 1. Dijkstra's Algorithm
*   **Implementation:** [backend/dijkstra.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/dijkstra.py)
*   **Purpose:** SSSP algorithm used as a baseline benchmark.
*   **Operation:** Explores nodes outward from the source, sorted by total path cost $g(n)$, utilizing a binary min-heap (`heapq`) to achieve $O(E \log V)$ time complexity.
*   **Backwards SSSP:** Extends to `dijkstra_all` which runs Dijkstra backwards from the incident node to all nodes in the graph to quickly find path costs for all available ambulances in $O(E \log V)$ instead of executing Dijkstra $N$ times.

### 2. A* Search Algorithm
*   **Implementation:** [backend/astar.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/astar.py)
*   **Purpose:** Goal-directed SSSP acceleration.
*   **Heuristic Selection:** To guarantee path optimality, the heuristic must be **admissible** (never overestimates distance) and **consistent**. The system uses a scaled Euclidean distance heuristic:
    $$h(n) = \frac{\text{Euclidean distance}(n, \text{target})}{\text{Max Speed Limit (2.0)}}$$
    Because speed limits can be up to $2.0$ (expressways) and traffic factors are always $\ge 1.0$, the actual travel time weight is bounded by:
    $$\text{current\_weight} \ge \frac{\text{base\_weight}}{2.0}$$
    Thus, $h(n)$ is a mathematically sound, admissible lower bound.
*   **Operation:** Sorts the priority queue by $f(n) = g(n) + h(n)$. A* dramatically narrows the search space, reducing explored nodes by 40-70% compared to Dijkstra while finding the identical optimal path.

### 3. Greedy Best-First Search (Greedy BFS)
*   **Implementation:** [backend/greedy_bfs.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/greedy_bfs.py)
*   **Purpose:** Contrast heuristic search efficiency and optimality.
*   **Operation:** Sorts the priority queue purely by $f(n) = h(n)$ (distance to goal), ignoring the path cost $g(n)$ accumulated so far.
*   **Trade-off:** While computationally fast (explores very few nodes), it is **non-optimal** and highly vulnerable to roadblocks or heavy congestion, often leading ambulances into massive detours or bottleneck dead-ends.

### 4. Bellman-Ford Algorithm
*   **Implementation:** [backend/bellman_ford.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/bellman_ford.py)
*   **Purpose:** Baseline SSSP showcasing high time complexity ($O(VE)$).
*   **Operation:** Systematically relaxes all edges $|V| - 1$ times. Early termination is implemented if an iteration passes without any edge weights being updated. Shows the disadvantage of dynamic programming without search pruning on sparse grid graphs.

### 5. Hungarian Bipartite Matching (Kuhn-Munkres)
*   **Implementation:** [backend/hungarian.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/hungarian.py)
*   **Purpose:** Fleet-to-incident allocation optimization.
*   **Operation:** Solves the linear sum assignment problem matching $N$ ambulances to $N$ emergencies.
    *   Constructs an $N \times N$ cost matrix where entry $C_{i,j}$ is the SSSP travel time from ambulance $i$ to emergency $j$.
    *   Performs row reduction (subtracts minimum value from each row) and column reduction.
    *   Finds a maximum matching on zero edges using augmenting paths (Kuhn's bipartite matching algorithm).
    *   If matching is less than $N$, finds the minimum uncovered value, subtracts it from all uncovered entries, and adds it to double-covered intersections, repeating until an optimal perfect matching is achieved.
*   **Comparison:** Compared against a standard **Greedy Row Matching** (allocates the closest available emergency to each ambulance in sequence). The Hungarian algorithm achieves optimal allocation, showing up to $15\text{--}30\%$ savings in total dispatch travel time.

---

## 📈 Algorithm Comparison Summary

| Algorithm | Complexity (Grid Graph) | Optimality | Search Space (Explored Nodes) | Dynamic Rerouting Capable | Use Case in Project |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dijkstra** | $O(E \log V)$ | **Optimal** | Large (explores all directions) | Yes | SSSP Route & backwards search for dispatching |
| **A\*** | $O(E \log V)$ (heuristic prunes) | **Optimal** | Small (directed towards goal) | Yes (re-computes on roadblocks) | Primary optimal routing for ambulances |
| **Greedy BFS** | $O(E \log V)$ (average case) | Non-Optimal | Extremely Small | Yes (but chooses bad paths) | Contrast representation of heuristic greed |
| **Bellman-Ford** | $O(V \cdot E)$ | **Optimal** | Extremely Large | Yes | Complexity showcase |
| **Hungarian** | $O(N^3)$ (for $N$ agents) | **Optimal Glob. Assignment** | Depends on Dijkstra runs | N/A (runs at dispatch stage) | Optimal fleet-to-incident dispatch mapping |

---

## 🏥 Clinical Dispatch Decision System

Ambulance and hospital selections are not just based on distance. The dispatch engine implements a multi-criteria scoring system (see [backend/dispatch.py](file:///c:/Users/sanat/Desktop/daa%20pbl/backend/dispatch.py)):

### Ambulance Selection
1.  **Naive Selection:** Selects the ambulance with the shortest straight-line Euclidean distance to the patient.
2.  **Optimized Selection:** Computes backwards SSSP using `dijkstra_all` from the patient node. Selects the available ambulance with the lowest travel time. It correctly ignores closer physical ambulances that are blocked by roadblocks or congested highways.

### Hospital Selection
1.  **Naive Selection:** Selects the closest hospital in Euclidean space.
2.  **Optimized Selection:** Evaluates hospitals using a multi-attribute cost score:
    $$\text{Score} = \text{Travel Time} + \text{Bed Penalty} + \text{Specialty Mismatch Penalty}$$
    *   **Bed Penalty:** Heavy penalty ($+100.0$) if the hospital has zero available beds; minor penalty ($+2.0 \times (10 - B)$) for low capacity below 10 beds.
    *   **Specialty Mismatch Penalty:** In a critical emergency, a heavy penalty ($+40.0$) is applied if the patient's critical condition (e.g., Trauma, Cardiac, Stroke) does not match the hospital's clinical specialty.
    This ensures patients are routed to a clinic capable of treating them, rather than simply the closest building.

---

## 🗂️ File Directory Structure

```ansi
daa pbl/
├── 📄 PROJECT_DETAILS.md            <-- This comprehensive documentation file
├── 📄 run_dashboard.bat             <-- Windows script to launch both servers simultaneously
├── 📄 main.py                       <-- Streamlit app launcher (Legacy GUI)
├── 📄 simulation.py                 <-- Streamlit simulation manager
├── 📄 visualization.py              <-- Matplotlib map drawer
├── 📂 backend/                      <-- FastAPI server codebase
│   ├── 📄 main.py                   <-- Web Server REST endpoints & WS loops
│   ├── 📄 simulation.py             <-- Interactive telemetry simulation ticker
│   ├── 📄 graph.py                  <-- Grid map generator & traffic event generator
│   ├── 📄 dispatch.py               <-- Optimized ambulance & hospital decision matrices
│   ├── 📄 astar.py                  <-- A* pathfinding search
│   ├── 📄 dijkstra.py               <-- Dijkstra & backward-SSSP dijkstra_all
│   ├── 📄 greedy_bfs.py             <-- Greedy Best-First Search pathfinding
│   ├── 📄 bellman_ford.py           <-- Bellman-Ford pathfinding
│   └── 📄 hungarian.py              <-- Kuhn-Munkres optimal assignment comparative engine
└── 📂 frontend/                     <-- Vite + React + TS App
    ├── 📂 src/
    │   ├── 📄 App.tsx               <-- Main command center UI shell & WS connector
    │   ├── 📄 types.ts              <-- Shared TypeScript interfaces for telemetry payloads
    │   ├── 📄 index.css             <-- Dark theme global style sheets
    │   └── 📂 components/
    │       ├── 📄 MapPanel.tsx          <-- HTML5 Canvas dynamic city map visualizer
    │       ├── 📄 BottomMetrics.tsx     <-- Comparative metrics display for the 4 algorithms
    │       ├── 📄 HungarianPanel.tsx    <-- Hungarian vs Greedy comparative analytics layout
    │       ├── 📄 AlgorithmSelector.tsx <-- Toggle which algorithms are active in simulation
    │       └── 📄 ResultModal.tsx       <-- Pop-up modal containing statistics on completed runs
    ├── 📄 package.json              <-- Frontend dependency declarations
    └── 📄 tailwind.config.js        <-- Tailwind utility styles configuration
```

---

## ⚙️ How to Setup & Run

### Prerequisites
*   Python 3.8+ (Libraries: `networkx`, `uvicorn`, `fastapi`, `pydantic`, `scipy` *(optional, pure Python fallback exists)*, `streamlit` *(only for legacy app)*)
*   Node.js 16+ & `npm`

### Fast Launch (All-In-One Script)
The command center is equipped with a launch script. Simply double-click or run:
```powershell
.\run_dashboard.bat
```
This batch script will:
1. Verify python compiles the backend modules.
2. Initialize the FastAPI server in the background on port `8000`.
3. Start the Vite React development server on port `5173`.
4. Open the UI address in your web browser: [http://localhost:5173](http://localhost:5173).

---

## 🖥️ Live Telemetry & Simulation Flow

1.  **City Loading:** The server generates a random city network graph, seeding ambulance stations at the four corners and three specialized hospitals in the interior.
2.  **Incident Creation:** The user clicks any node on the map dashboard to trigger an emergency.
3.  **Real-Time Dispatching:**
    *   `select_ambulance_optimized` assigns the best ambulance.
    *   `select_hospital_optimized` assigns the best specialty hospital.
    *   All selected routing paths (Dijkstra, A*, Greedy BFS, Bellman-Ford) are calculated, and their search metrics are captured.
4.  **Telemetry Broadcast:** The backend pushes 100ms real-time status ticks via WebSockets (`/ws`).
5.  **Dynamic Traffic Obstructions:**
    *   An accident is automatically scheduled 6 seconds into a simulation run, blocking parts of the path.
    *   The **A\*** engine immediately recalculates a new detour route because it checks edge weights dynamically.
    *   The **Dijkstra** vehicle (representing legacy systems) remains stuck at the roadblock, highlighting the advantage of goal-directed dynamic local rerouting.
    *   This beautifully illustrates the concept of dynamic rerouting in graph networks.
6.  **Hungarian Demonstration:** In standby mode, users can click "Hungarian Demo" to test optimal resource matching. The server generates 4 simultaneous incidents, calculates the distance matrix for all 4 ambulances, and displays a detailed cost matrix layout alongside greedy vs. optimal cost metrics.
