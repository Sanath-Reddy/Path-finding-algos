import random
import math
from graph import apply_traffic_events, serialize_graph, update_edge_weights
from dijkstra import dijkstra, dijkstra_all
from astar import astar
from bellman_ford import bellman_ford
from greedy_bfs import greedy_bfs
from dispatch import (
    select_ambulance_optimized,
    select_hospital_optimized
)

HOSPITAL_NAMES = [
    "City General Hospital",
    "Mercy Heart Clinic",
    "St. Jude Medical Center",
]
HOSPITAL_SPECIALTIES = ["Trauma", "Cardiac", "Stroke"]


class EOCSimulation:
    def __init__(self, width=10, height=10):
        self.width = width
        self.height = height
        self.graph = None

        self.ambulances = []
        self.hospitals = []
        self.active_emergency = None

        self.speed_multiplier = 1.0
        self.is_paused = True

        self.veh_a = None   # Dijkstra vehicle (Blue)
        self.veh_b = None   # A* vehicle (Green)
        self.veh_c = None   # Greedy BFS vehicle (Orange)
        self.veh_d = None   # Bellman-Ford vehicle (Purple)

        self.logs = []
        self.total_emergencies_resolved = 0
        self.average_response_time = 0.0
        self.response_times_history = []
        
        self.last_hungarian_result = None
        self.hospital_overflow_count = 0
        self.disaster_mode = False

        self.mci_mode = False
        self.mci_emergencies = []
        self.mci_greedy_vehicles = []
        self.mci_hungarian_vehicles = []
        self.mci_greedy_total = 0.0
        self.mci_hungarian_total = 0.0

        self.reset_map()

    # ------------------------------------------------------------------
    def reset_map(self):
        from graph import generate_city_graph
        self.graph = generate_city_graph(
            width=self.width, height=self.height, expressway_prob=0.10
        )

        # ── 4 ambulance stations at the four corners ──────────────────
        W, H = self.width, self.height
        self.ambulances = [
            {"id": "AMB-1", "current_node": (0,       0      ), "available": True,  "type": "ALS"},
            {"id": "AMB-2", "current_node": (0,       H - 1  ), "available": True,  "type": "BLS"},
            {"id": "AMB-3", "current_node": (W - 1,   0      ), "available": True,  "type": "ALS"},
            {"id": "AMB-4", "current_node": (W - 1,   H - 1  ), "available": True,  "type": "BLS"},
        ]

        # ── 3 random hospitals in the interior of the grid ────────────
        corners = {(0, 0), (0, H-1), (W-1, 0), (W-1, H-1)}
        interior = [
            (x, y)
            for x in range(1, W - 1)
            for y in range(1, H - 1)
            if (x, y) not in corners
        ]
        hosp_nodes = random.sample(interior, min(3, len(interior)))

        self.hospitals = [
            {
                "id":        f"H{i+1}",
                "node":      hosp_nodes[i],
                "beds":      random.randint(4, 14),
                "specialty": HOSPITAL_SPECIALTIES[i],
                "name":      HOSPITAL_NAMES[i],
            }
            for i in range(len(hosp_nodes))
        ]

        # ── Seed realistic random traffic ─────────────────────────────
        self._seed_random_traffic()

        self.active_emergency = None
        self.veh_a = None
        self.veh_b = None
        self.veh_c = None
        self.veh_d = None
        self.is_paused = True
        self.disaster_mode = False
        self.last_hungarian_result = None
        self.mci_mode = False
        self.mci_emergencies = []
        self.mci_greedy_vehicles = []
        self.mci_hungarian_vehicles = []
        self.mci_greedy_total = 0.0
        self.mci_hungarian_total = 0.0
        self.logs = [
            {"time": "SYSTEM", "msg": "City loaded. Click any node to create an emergency."}
        ]

    def reset_incident(self):
        """
        Clears the active incident and vehicle routes, resetting ambulances to their corners
        but PRESERVING the graph structure, traffic weights, and hospital bed counts.
        """
        W, H = self.width, self.height
        self.ambulances = [
            {"id": "AMB-1", "current_node": (0,   0  ), "available": True, "type": "ALS"},
            {"id": "AMB-2", "current_node": (0,   H-1), "available": True, "type": "BLS"},
            {"id": "AMB-3", "current_node": (W-1, 0  ), "available": True, "type": "ALS"},
            {"id": "AMB-4", "current_node": (W-1, H-1), "available": True, "type": "BLS"},
        ]
        self.active_emergency = None
        self.veh_a = None
        self.veh_b = None
        self.veh_c = None
        self.veh_d = None
        self.is_paused = True
        self.disaster_mode = False
        self.last_hungarian_result = None
        self.mci_mode = False
        self.mci_emergencies = []
        self.mci_greedy_vehicles = []
        self.mci_hungarian_vehicles = []
        self.mci_greedy_total = 0.0
        self.mci_hungarian_total = 0.0
        self.logs = [
            {"time": "SYSTEM", "msg": "Incident cleared. Preserved hospital bed capacities."}
        ]

    # ------------------------------------------------------------------
    def _seed_random_traffic(self):
        """Randomly congests ~25 % of roads to create interesting routing."""
        if not self.graph:
            return
        edges = list(self.graph.edges())
        n = max(4, int(len(edges) * 0.25))
        for u, v in random.sample(edges, min(n, len(edges))):
            self.graph[u][v]["traffic_factor"] = round(random.uniform(2.5, 6.0), 2)
        update_edge_weights(self.graph)

    # ------------------------------------------------------------------
    def add_log(self, time_str, msg):
        self.logs.append({"time": time_str, "msg": msg})
        if len(self.logs) > 40:
            self.logs.pop(0)

    # ------------------------------------------------------------------
    def trigger_emergency(self, node_str, priority="Normal", specialty="General"):
        """
        Creates an emergency, selects best ambulance & hospital,
        computes Dijkstra and A* routes, then starts the simulation.
        """
        self.reset_incident()
        parts = node_str.split(",")
        em_node = (int(parts[0]), int(parts[1]))

        # Guard: node must exist in graph
        if em_node not in self.graph.nodes:
            self.add_log("ERROR", f"Node {node_str} not in graph.")
            return False

        self.active_emergency = {
            "node":      em_node,
            "priority":  priority,
            "specialty": specialty,
            "status":    "ACTIVE",
        }

        self.add_log("INCIDENT", f"🚨 Emergency at {node_str} [{priority}, {specialty}]")

        # ── Stage 1: pick best ambulance ─────────────────────────────
        opt_amb, amb_time, _ = select_ambulance_optimized(
            self.ambulances, em_node, self.graph
        )
        # ── Stage 2: pick best hospital ──────────────────────────────
        opt_hosp, hosp_time = select_hospital_optimized(
            self.hospitals, em_node, self.graph, priority, specialty
        )

        if opt_hosp and opt_hosp.get("beds", 0) == 0:
            hospitals_with_beds = [h for h in self.hospitals if h.get("beds", 0) > 0]
            if hospitals_with_beds:
                self.add_log("OVERFLOW", f"⚠️ {opt_hosp['name']} is FULL! Overflow redirection triggered...")
                self.hospital_overflow_count += 1
                opt_hosp, hosp_time = select_hospital_optimized(
                    hospitals_with_beds, em_node, self.graph, priority, specialty
                )

        if not opt_amb or not opt_hosp:
            self.add_log("ERROR", "Dispatch failed — no reachable resources.")
            return False

        start_node = opt_amb["current_node"]
        hosp_node  = opt_hosp["node"]

        self.add_log("DISPATCH", f"🚒 {opt_amb['id']} dispatched from {start_node}.")
        self.add_log("HOSPITAL", f"🏥 Target: {opt_hosp['name']} ({opt_hosp['specialty']})")

        # ── Compute routes ────────────────────────────────────────────
        d_to_em = dijkstra(self.graph, start_node, em_node)
        d_to_h  = dijkstra(self.graph, em_node,    hosp_node)
        a_to_em = astar(   self.graph, start_node, em_node)
        a_to_h  = astar(   self.graph, em_node,    hosp_node)
        g_to_em = greedy_bfs(self.graph, start_node, em_node)
        g_to_h  = greedy_bfs(self.graph, em_node,    hosp_node)
        bf_to_em = bellman_ford(self.graph, start_node, em_node)
        bf_to_h  = bellman_ford(self.graph, em_node,    hosp_node)

        if not d_to_em["path"] or not a_to_em["path"] or not g_to_em["path"] or not bf_to_em["path"]:
            self.add_log("ERROR", "Path not found to emergency.")
            return False
        if not d_to_h["path"] or not a_to_h["path"] or not g_to_h["path"] or not bf_to_h["path"]:
            self.add_log("ERROR", "Path not found to hospital.")
            return False

        # ── Dijkstra vehicle (Blue / A) ───────────────────────────────
        sx = self.graph.nodes[start_node]["x"]
        sy = self.graph.nodes[start_node]["y"]

        self.veh_a = {
            "id":                 "Dijkstra (Blue)",
            "current_node":       start_node,
            "status":             "RESPONDING",
            "path_to_emergency":  d_to_em["path"],
            "path_to_hospital":   d_to_h["path"],
            "segment_index":      0,
            "segment_progress":   0.0,
            "x":                  sx,
            "y":                  sy,
            "angle":              0.0,
            "est_travel_time":    d_to_em["cost"] + d_to_h["cost"],
            "accumulated_cost":   0.0,
            "nodes_explored":     d_to_em["nodes_explored"] + d_to_h["nodes_explored"],
            "route_len":          len(d_to_em["path"]) + len(d_to_h["path"]) - 1,
            "runtime_ms":         d_to_em["execution_time_ms"] + d_to_h["execution_time_ms"],
        }

        # ── A* vehicle (Green / B) ────────────────────────────────────
        self.veh_b = {
            "id":                 "A* (Green)",
            "current_node":       start_node,
            "status":             "RESPONDING",
            "path_to_emergency":  a_to_em["path"],
            "path_to_hospital":   a_to_h["path"],
            "segment_index":      0,
            "segment_progress":   0.0,
            "x":                  sx,
            "y":                  sy,
            "angle":              0.0,
            "est_travel_time":    a_to_em["cost"] + a_to_h["cost"],
            "accumulated_cost":   0.0,
            "nodes_explored":     a_to_em["nodes_explored"] + a_to_h["nodes_explored"],
            "route_len":          len(a_to_em["path"]) + len(a_to_h["path"]) - 1,
            "runtime_ms":         a_to_em["execution_time_ms"] + a_to_h["execution_time_ms"],
        }

        # ── Greedy BFS vehicle (Orange / C) ───────────────────────────
        self.veh_c = {
            "id":                 "Greedy BFS (Orange)",
            "current_node":       start_node,
            "status":             "RESPONDING",
            "path_to_emergency":  g_to_em["path"],
            "path_to_hospital":   g_to_h["path"],
            "segment_index":      0,
            "segment_progress":   0.0,
            "x":                  sx,
            "y":                  sy,
            "angle":              0.0,
            "est_travel_time":    g_to_em["cost"] + g_to_h["cost"],
            "accumulated_cost":   0.0,
            "nodes_explored":     g_to_em["nodes_explored"] + g_to_h["nodes_explored"],
            "route_len":          len(g_to_em["path"]) + len(g_to_h["path"]) - 1,
            "runtime_ms":         g_to_em["execution_time_ms"] + g_to_h["execution_time_ms"],
        }

        # ── Bellman-Ford vehicle (Purple / D) ─────────────────────────
        self.veh_d = {
            "id":                 "Bellman-Ford (Purple)",
            "current_node":       start_node,
            "status":             "RESPONDING",
            "path_to_emergency":  bf_to_em["path"],
            "path_to_hospital":   bf_to_h["path"],
            "segment_index":      0,
            "segment_progress":   0.0,
            "x":                  sx,
            "y":                  sy,
            "angle":              0.0,
            "est_travel_time":    bf_to_em["cost"] + bf_to_h["cost"],
            "accumulated_cost":   0.0,
            "nodes_explored":     bf_to_em["nodes_explored"] + bf_to_h["nodes_explored"],
            "route_len":          len(bf_to_em["path"]) + len(bf_to_h["path"]) - 1,
            "runtime_ms":         bf_to_em["execution_time_ms"] + bf_to_h["execution_time_ms"],
        }

        self.is_paused = False
        return True

    # ------------------------------------------------------------------
    def recalculate_astar(self):
        """Re-routes veh_b (A*) and veh_c (Greedy BFS) from their current position to current target."""
        # 1. Re-route A*
        if self.veh_b and self.veh_b["status"] != "ARRIVED":
            if self.veh_b["status"] == "RESPONDING":
                target = self.active_emergency["node"]
                res = astar(self.graph, self.veh_b["current_node"], target)
                if res["path"]:
                    self.veh_b["path_to_emergency"] = res["path"]
                    self.veh_b["segment_index"]     = 0
                    self.veh_b["segment_progress"]  = 0.0
                    self.veh_b["nodes_explored"]   += res["nodes_explored"]
                    self.veh_b["runtime_ms"]       += res["execution_time_ms"]
            elif self.veh_b["status"] == "TRANSPORTING":
                dest_str = self.veh_a["path_to_hospital"][-1]
                px, py = dest_str.split(",")
                h_tuple = (int(px), int(py))
                res = astar(self.graph, self.veh_b["current_node"], h_tuple)
                if res["path"]:
                    self.veh_b["path_to_hospital"] = res["path"]
                    self.veh_b["segment_index"]    = 0
                    self.veh_b["segment_progress"] = 0.0
                    self.veh_b["nodes_explored"]  += res["nodes_explored"]
                    self.veh_b["runtime_ms"]      += res["execution_time_ms"]

        # 2. Re-route Greedy BFS
        if self.veh_c and self.veh_c["status"] != "ARRIVED":
            if self.veh_c["status"] == "RESPONDING":
                target = self.active_emergency["node"]
                res = greedy_bfs(self.graph, self.veh_c["current_node"], target)
                if res["path"]:
                    self.veh_c["path_to_emergency"] = res["path"]
                    self.veh_c["segment_index"]     = 0
                    self.veh_c["segment_progress"]  = 0.0
                    self.veh_c["nodes_explored"]   += res["nodes_explored"]
                    self.veh_c["runtime_ms"]       += res["execution_time_ms"]
            elif self.veh_c["status"] == "TRANSPORTING":
                dest_str = self.veh_a["path_to_hospital"][-1]
                px, py = dest_str.split(",")
                h_tuple = (int(px), int(py))
                res = greedy_bfs(self.graph, self.veh_c["current_node"], h_tuple)
                if res["path"]:
                    self.veh_c["path_to_hospital"] = res["path"]
                    self.veh_c["segment_index"]    = 0
                    self.veh_c["segment_progress"] = 0.0
                    self.veh_c["nodes_explored"]  += res["nodes_explored"]
                    self.veh_c["runtime_ms"]      += res["execution_time_ms"]

    # ------------------------------------------------------------------
    def add_congestion(self):
        edges = list(self.graph.edges())
        for u, v in random.sample(edges, min(8, len(edges))):
            self.graph[u][v]["traffic_factor"] = round(random.uniform(4.0, 8.0), 2)
        update_edge_weights(self.graph)
        self.add_log("TRAFFIC", "⚠️ Heavy congestion added on multiple roads.")
        self.recalculate_astar()

    def add_accident(self):
        edges = list(self.graph.edges())
        for u, v in random.sample(edges, min(4, len(edges))):
            self.graph[u][v]["traffic_factor"] = float("inf")
        update_edge_weights(self.graph)
        self.add_log("TRAFFIC", "🚧 Road accident! Multiple routes blocked.")
        self.recalculate_astar()

    def clear_traffic(self):
        from graph import reset_traffic
        reset_traffic(self.graph)
        self.disaster_mode = False
        self.add_log("TRAFFIC", "🟢 All traffic cleared.")
        self.recalculate_astar()

    def trigger_disaster_mode(self):
        """
        Simulates a major natural disaster by blocking ~20 % of roads.
        Sets traffic_factor = float('inf') on these roads.
        """
        if not self.graph:
            return
        self.disaster_mode = True
        edges = list(self.graph.edges())
        # Block 20% of edges randomly
        n = max(5, int(len(edges) * 0.20))
        blocked_edges = random.sample(edges, min(n, len(edges)))
        for u, v in blocked_edges:
            self.graph[u][v]["traffic_factor"] = float("inf")
        update_edge_weights(self.graph)
        self.add_log("DISASTER", "💥 DISASTER MODE ACTIVATED! Major routes blocked across the city.")
        self.recalculate_astar()

    def trigger_traffic_surge(self):
        self.add_congestion()
        self.add_accident()

    # ------------------------------------------------------------------
    def advance_vehicle(self, veh, tick_duration=0.1):
        if veh["status"] == "ARRIVED":
            return

        path = (
            veh["path_to_emergency"]
            if veh["status"] == "RESPONDING"
            else veh["path_to_hospital"]
        )

        if not path or veh["segment_index"] >= len(path) - 1:
            if veh["status"] == "RESPONDING":
                veh["status"]           = "TRANSPORTING"
                veh["segment_index"]    = 0
                veh["segment_progress"] = 0.0
                veh["current_node"]     = self.active_emergency["node"]
                self.add_log("PATIENT", f"🚑 {veh['id']} reached patient.")
            else:
                veh["status"] = "ARRIVED"
                self.add_log("HOSPITAL", f"🏁 {veh['id']} arrived at hospital.")
                if "A*" in veh["id"]:
                    self.total_emergencies_resolved += 1
                    t = veh["accumulated_cost"]
                    self.response_times_history.append(round(t, 2))
                    self.average_response_time = round(
                        sum(self.response_times_history) / len(self.response_times_history), 2
                    )
            return

        u_str = path[veh["segment_index"]]
        v_str = path[veh["segment_index"] + 1]
        pu = u_str.split(",")
        pv = v_str.split(",")
        u = (int(pu[0]), int(pu[1]))
        v = (int(pv[0]), int(pv[1]))

        ew = self.graph[u][v].get("current_weight", float("inf"))
        if ew == float("inf") or ew < 0:
            ew = 12.0   # blocked-road delay

        step = self.speed_multiplier * tick_duration / max(0.01, ew)
        veh["segment_progress"]  += step
        veh["accumulated_cost"]  += step * ew

        pos_u = self.graph.nodes[u]["pos"]
        pos_v = self.graph.nodes[v]["pos"]
        t = min(1.0, veh["segment_progress"])
        veh["x"] = round((1 - t) * pos_u[0] + t * pos_v[0], 3)
        veh["y"] = round((1 - t) * pos_u[1] + t * pos_v[1], 3)

        dx = pos_v[0] - pos_u[0]
        dy = pos_v[1] - pos_u[1]
        veh["angle"] = round(math.degrees(math.atan2(dy, dx)), 1)

        if veh["segment_progress"] >= 1.0:
            veh["segment_index"]    += 1
            veh["segment_progress"] = 0.0
            veh["current_node"]     = v

    def advance_mci_vehicle(self, veh, tick_duration=0.1):
        if veh["status"] == "ARRIVED":
            return

        path = veh["path"]
        if not path or veh["segment_index"] >= len(path) - 1:
            veh["status"] = "ARRIVED"
            self.add_log("MCI", f"🏁 {veh['id']} reached assigned emergency.")
            return

        u_str = path[veh["segment_index"]]
        v_str = path[veh["segment_index"] + 1]
        pu = u_str.split(",")
        pv = v_str.split(",")
        u = (int(pu[0]), int(pu[1]))
        v = (int(pv[0]), int(pv[1]))

        ew = self.graph[u][v].get("current_weight", float("inf"))
        if ew == float("inf") or ew < 0:
            ew = 12.0   # blocked-road delay

        step = self.speed_multiplier * tick_duration / max(0.01, ew)
        veh["segment_progress"]  += step
        veh["accumulated_cost"]  += step * ew

        pos_u = self.graph.nodes[u]["pos"]
        pos_v = self.graph.nodes[v]["pos"]
        t = min(1.0, veh["segment_progress"])
        veh["x"] = round((1 - t) * pos_u[0] + t * pos_v[0], 3)
        veh["y"] = round((1 - t) * pos_u[1] + t * pos_v[1], 3)

        dx = pos_v[0] - pos_u[0]
        dy = pos_v[1] - pos_u[1]
        veh["angle"] = round(math.degrees(math.atan2(dy, dx)), 1)

        if veh["segment_progress"] >= 1.0:
            veh["segment_index"]    += 1
            veh["segment_progress"] = 0.0
            veh["current_node"]     = v

    def trigger_mci(self):
        """
        Triggers a Mass Casualty Incident (MCI) Demo with 4 emergencies and 4 ambulances.
        Solves assignment using both Greedy (nearest first) and Hungarian algorithms,
        then starts both fleets in parallel.
        """
        import random
        random.seed(400)
        self.reset_map()
        self.mci_mode = True
        
        W, H = self.width, self.height
        
        # 4 predefined emergencies at symmetric interior nodes
        em_nodes = [(2, 2), (2, H-3), (W-3, 2), (W-3, H-3)]
        self.mci_emergencies = [f"{n[0]},{n[1]}" for n in em_nodes]
        
        # Ensure 4 ambulances are at their base stations
        self.ambulances = [
            {"id": "AMB-1", "current_node": (0,   0  ), "available": True, "type": "ALS"},
            {"id": "AMB-2", "current_node": (0,   H-1), "available": True, "type": "BLS"},
            {"id": "AMB-3", "current_node": (W-1, 0  ), "available": True, "type": "ALS"},
            {"id": "AMB-4", "current_node": (W-1, H-1), "available": True, "type": "BLS"},
        ]
        
        # Compute 4x4 cost matrix (ambulance i to emergency j)
        cost_matrix = []
        paths_matrix = [] # paths_matrix[i][j] = path from amb i to em j
        for i, amb in enumerate(self.ambulances):
            row_costs = []
            row_paths = []
            for j, em in enumerate(em_nodes):
                res = dijkstra(self.graph, amb["current_node"], em)
                row_costs.append(res["cost"])
                row_paths.append(res["path"])
            cost_matrix.append(row_costs)
            paths_matrix.append(row_paths)
            
        # 1. Hungarian assignment
        from hungarian import hungarian_assign
        hungarian_assignment, hungarian_cost = hungarian_assign(cost_matrix)
        
        # 2. Greedy assignment (loop over emergencies, assign nearest available ambulance)
        greedy_assignment = [-1] * 4
        assigned_ambs = set()
        for j in range(4):
            best_amb = None
            min_cost = float('inf')
            for i in range(4):
                if i in assigned_ambs:
                    continue
                if cost_matrix[i][j] < min_cost:
                    min_cost = cost_matrix[i][j]
                    best_amb = i
            greedy_assignment[best_amb] = j
            assigned_ambs.add(best_amb)
            
        # Store results for display / comparison
        self.last_hungarian_result = {
            "cost_matrix": cost_matrix,
            "ambulance_ids": [a["id"] for a in self.ambulances],
            "emergency_labels": [f"Patient at {n}" for n in em_nodes],
            "greedy_assignment": greedy_assignment,
            "greedy_cost": sum(cost_matrix[i][greedy_assignment[i]] for i in range(4)),
            "hungarian_assignment": hungarian_assignment,
            "hungarian_cost": hungarian_cost,
            "savings_pct": ((sum(cost_matrix[i][greedy_assignment[i]] for i in range(4)) - hungarian_cost) / max(0.1, sum(cost_matrix[i][greedy_assignment[i]] for i in range(4)))) * 100.0,
            "execution_time_ms": 0.1
        }
        
        # Setup MCI Greedy vehicles (shades of blue / dashed paths visually on front-end)
        self.mci_greedy_vehicles = []
        for i, amb in enumerate(self.ambulances):
            em_idx = greedy_assignment[i]
            target_node = em_nodes[em_idx]
            path = paths_matrix[i][em_idx]
            start_node = amb["current_node"]
            sx = self.graph.nodes[start_node]["x"]
            sy = self.graph.nodes[start_node]["y"]
            self.mci_greedy_vehicles.append({
                "id": f"{amb['id']} (Greedy)",
                "color": "#3B82F6",
                "start_node": f"{start_node[0]},{start_node[1]}",
                "target_node": f"{target_node[0]},{target_node[1]}",
                "path": path,
                "x": sx, "y": sy, "angle": 0.0,
                "accumulated_cost": 0.0,
                "segment_index": 0,
                "segment_progress": 0.0,
                "status": "RESPONDING"
            })
            
        # Setup MCI Hungarian vehicles (shades of red / solid paths)
        self.mci_hungarian_vehicles = []
        for i, amb in enumerate(self.ambulances):
            em_idx = hungarian_assignment[i]
            target_node = em_nodes[em_idx]
            path = paths_matrix[i][em_idx]
            start_node = amb["current_node"]
            sx = self.graph.nodes[start_node]["x"]
            sy = self.graph.nodes[start_node]["y"]
            self.mci_hungarian_vehicles.append({
                "id": f"{amb['id']} (Hungarian)",
                "color": "#ef4444",
                "start_node": f"{start_node[0]},{start_node[1]}",
                "target_node": f"{target_node[0]},{target_node[1]}",
                "path": path,
                "x": sx, "y": sy, "angle": 0.0,
                "accumulated_cost": 0.0,
                "segment_index": 0,
                "segment_progress": 0.0,
                "status": "RESPONDING"
            })
            
        self.mci_greedy_total = 0.0
        self.mci_hungarian_total = 0.0
        self.is_paused = False
        self.add_log("MCI", "🚨 MASS CASUALTY INCIDENT declared! Dispatching 4 ambulances.")
        self.add_log("MCI", "Compare Greedy (Blue) vs optimal Hungarian (Red) fleets.")

    # ------------------------------------------------------------------
    def tick(self, tick_duration=0.1):
        if self.is_paused:
            return

        if self.mci_mode:
            # Advance all MCI vehicles
            for veh in self.mci_greedy_vehicles:
                self.advance_mci_vehicle(veh, tick_duration)
            for veh in self.mci_hungarian_vehicles:
                self.advance_mci_vehicle(veh, tick_duration)
                
            # Accumulate live stats for display
            self.mci_greedy_total = sum(v["accumulated_cost"] for v in self.mci_greedy_vehicles)
            self.mci_hungarian_total = sum(v["accumulated_cost"] for v in self.mci_hungarian_vehicles)

            # Check if all Hungarian vehicles arrived to finish
            all_arrived = all(v["status"] == "ARRIVED" for v in self.mci_hungarian_vehicles)
            if all_arrived:
                self.is_paused = True
                self.add_log("MCI", "🏁 Mass Casualty Incident dispatch simulation completed.")
            return

        if not self.active_emergency:
            return
        if self.veh_a:
            self.advance_vehicle(self.veh_a, tick_duration)
        if self.veh_b:
            self.advance_vehicle(self.veh_b, tick_duration)
        if self.veh_c:
            self.advance_vehicle(self.veh_c, tick_duration)
        if self.veh_d:
            self.advance_vehicle(self.veh_d, tick_duration)
            
        all_arrived = True
        for veh in [self.veh_a, self.veh_b, self.veh_c, self.veh_d]:
            if veh and veh["status"] != "ARRIVED":
                all_arrived = False
                break
                
        if all_arrived and self.veh_a:
            self.active_emergency["status"] = "RESOLVED"
            self.add_log("SYSTEM", "✅ Emergency resolved.")

    # ------------------------------------------------------------------
    def get_telemetry(self):
        ae = self.active_emergency
        return {
            "graph":     serialize_graph(self.graph),
            "ambulances": self.ambulances,
            "hospitals": self.hospitals,
            "active_emergency": {
                "node":      f"{ae['node'][0]},{ae['node'][1]}",
                "priority":  ae["priority"],
                "specialty": ae["specialty"],
                "status":    ae["status"],
            } if ae else None,
            "veh_a": self.veh_a,
            "veh_b": self.veh_b,
            "veh_c": self.veh_c,
            "veh_d": self.veh_d,
            "logs":  self.logs,
            "global_stats": {
                "resolved_count":    self.total_emergencies_resolved,
                "avg_response_time": self.average_response_time,
                "history":           self.response_times_history,
                "hospital_overflow_count": self.hospital_overflow_count,
            },
            "speed_multiplier": self.speed_multiplier,
            "is_paused":        self.is_paused,
            "last_hungarian_result": self.last_hungarian_result,
            "disaster_mode":    self.disaster_mode,
            "mci_mode":         self.mci_mode,
            "mci_emergencies":  self.mci_emergencies,
            "mci_greedy_vehicles": self.mci_greedy_vehicles,
            "mci_hungarian_vehicles": self.mci_hungarian_vehicles,
            "mci_greedy_total": self.mci_greedy_total,
            "mci_hungarian_total": self.mci_hungarian_total,
        }
