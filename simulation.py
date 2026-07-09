import random
from graph import apply_random_traffic
from dijkstra import dijkstra
from astar import astar

class AmbulanceSimulation:
    def __init__(self, graph, start_node, emergency_node, hospital_node):
        """
        Initializes a head-to-head routing simulation comparing:
        1. Dijkstra Ambulance (Static routing: computed at start, never re-routes)
        2. A* Ambulance (Dynamic routing: re-routes when traffic changes)
        
        Both start from start_node, go to emergency_node, and then to hospital_node.
        """
        self.graph = graph
        self.start_node = start_node
        self.emergency_node = emergency_node
        self.hospital_node = hospital_node
        
        # State
        # "RESPONDING" (to emergency) or "TRANSPORTING" (to hospital) or "ARRIVED"
        self.status = "RESPONDING" 
        
        # Static Dijkstra Path planning (computed once at start)
        d_to_em = dijkstra(self.graph, start_node, emergency_node)
        d_to_hosp = dijkstra(self.graph, emergency_node, hospital_node)
        
        self.dijkstra_path_em = d_to_em['path']
        self.dijkstra_path_hosp = d_to_hosp['path']
        
        # Cumulative Dijkstra static path
        self.dijkstra_full_path = self.dijkstra_path_em[:-1] + self.dijkstra_path_hosp if self.dijkstra_path_em and self.dijkstra_path_hosp else []
        
        # A* Path planning (initialized at start)
        a_to_em = astar(self.graph, start_node, emergency_node)
        a_to_hosp = astar(self.graph, emergency_node, hospital_node)
        
        self.astar_path_em = a_to_em['path']
        self.astar_path_hosp = a_to_hosp['path']
        
        # Position indices and statuses
        self.d_idx = 0  # Index in current path segment
        self.a_idx = 0
        
        self.d_current_node = start_node
        self.a_current_node = start_node
        
        self.d_status = "RESPONDING"
        self.a_status = "RESPONDING"
        
        # Path rendering overlays
        self.dijkstra_overlay = list(self.dijkstra_full_path)
        self.astar_overlay = self.astar_path_em[:-1] + self.astar_path_hosp if self.astar_path_em and self.astar_path_hosp else []
        
        # Performance metrics accumulated
        self.d_cost_accumulated = 0.0
        self.a_cost_accumulated = 0.0
        
        # Search metrics accumulated
        self.d_nodes_explored = d_to_em['nodes_explored'] + d_to_hosp['nodes_explored']
        self.a_nodes_explored = a_to_em['nodes_explored'] + a_to_hosp['nodes_explored']
        
        self.steps_count = 0
        self.traffic_events_history = []
        
    def step(self, traffic_prob=0.2, congestion_ratio=0.15, blocking_ratio=0.03):
        """
        Advances the simulation by one time-step.
        Each step represents the ambulance traversing one edge in the graph.
        """
        if self.status == "ARRIVED":
            return
            
        self.steps_count += 1
        traffic_changed = False
        
        # 1. Simulate Dynamic Traffic Change
        if random.random() < traffic_prob:
            congested, blocked = apply_random_traffic(
                self.graph, 
                congestion_ratio=congestion_ratio, 
                blocking_ratio=blocking_ratio
            )
            traffic_changed = True
            self.traffic_events_history.append(
                f"Step {self.steps_count}: Road congestion updated! {len(congested)} jams, {len(blocked)} roadblocks."
            )
            
            # --- DYNAMIC RE-ROUTING FOR A* AMBULANCE ---
            if self.status == "RESPONDING":
                # Recompute path from A*'s CURRENT node to emergency
                a_res = astar(self.graph, self.a_current_node, self.emergency_node)
                if a_res['path']:
                    self.astar_path_em = a_res['path']
                    self.a_idx = 0  # Reset index to traverse the new path
                    self.a_nodes_explored += a_res['nodes_explored']
            elif self.status == "TRANSPORTING":
                # Recompute path from A*'s CURRENT node to hospital
                a_res = astar(self.graph, self.a_current_node, self.hospital_node)
                if a_res['path']:
                    self.astar_path_hosp = a_res['path']
                    self.a_idx = 0  # Reset index
                    self.a_nodes_explored += a_res['nodes_explored']
                    
            # Update overlays for drawing
            if self.status == "RESPONDING":
                self.astar_overlay = self.astar_path_em[self.a_idx:] + self.astar_path_hosp
            else:
                self.astar_overlay = self.astar_path_hosp[self.a_idx:]

        # 2. Advance Dijkstra Ambulance
        if self.status == "RESPONDING":
            curr_path = self.dijkstra_path_em
        else:
            curr_path = self.dijkstra_path_hosp
            
        if self.d_idx < len(curr_path) - 1:
            u = curr_path[self.d_idx]
            v = curr_path[self.d_idx + 1]
            # Accumulate ACTUAL travel time under CURRENT traffic weights
            edge_time = self.graph[u][v].get('current_weight', float('inf'))
            if edge_time == float('inf'):
                # Severe penalty for roadblock (simulates waiting/maneuvering around)
                self.d_cost_accumulated += 15.0 
            else:
                self.d_cost_accumulated += edge_time
                
            self.d_idx += 1
            self.d_current_node = curr_path[self.d_idx]
            
        # 3. Advance A* Ambulance
        if self.status == "RESPONDING":
            a_curr_path = self.astar_path_em
        else:
            a_curr_path = self.astar_path_hosp
            
        if self.a_idx < len(a_curr_path) - 1:
            u = a_curr_path[self.a_idx]
            v = a_curr_path[self.a_idx + 1]
            edge_time = self.graph[u][v].get('current_weight', float('inf'))
            if edge_time == float('inf'):
                self.a_cost_accumulated += 15.0
            else:
                self.a_cost_accumulated += edge_time
                
            self.a_idx += 1
            self.a_current_node = a_curr_path[self.a_idx]
            
        # 4. Handle State Transitions
        # Check transition from Responding to Transporting
        if self.status == "RESPONDING":
            d_reached = (self.d_current_node == self.emergency_node)
            a_reached = (self.a_current_node == self.emergency_node)
            
            if d_reached and a_reached:
                self.status = "TRANSPORTING"
                self.d_idx = 0
                self.a_idx = 0
                self.traffic_events_history.append(f"Step {self.steps_count}: Both ambulances successfully reached emergency location!")
            elif d_reached:
                # Dijkstra arrived, A* still responding
                # Dijkstra waits at the scene for A* or continues, let's keep them in sync or let them progress independently!
                # It is much more realistic to let them progress independently!
                # If Dijkstra reached emergency, it is ready to move to hospital, but waits for A* to transition or transitions itself?
                # Actually, let's track their status independently!
                pass
                
        # Independent transitions are much cooler! Let's implement independent tracking for maximum realism:
        # We can track if Dijkstra reaches hospital, A* reaches hospital, etc.
        # Let's keep it simple: if Dijkstra is at emergency, it immediately switches to hospital path!
        # That's very clean and easy:
        if self.status == "RESPONDING":
            if self.d_current_node == self.emergency_node and self.d_idx == len(self.dijkstra_path_em) - 1:
                # Dijkstra reached emergency, switch its active segment to hospital
                # However, to avoid state mess, we can let it wait, or just let it progress to hospital immediately!
                # If we transition the WHOLE simulation state when BOTH reach, that's fine. Or we can just advance them on their own!
                # Let's do it independently:
                pass
                
        # To make it super robust:
        # Dijkstra's ambulance moves along self.dijkstra_full_path. It has a single index from 0 to len(full_path)-1.
        # A*'s ambulance moves along its current path. If responding, it moves to emergency, then we plan A* to hospital and it moves to hospital!
        # This is incredibly clean! Let's check:
        # Yes! Dijkstra moves along the pre-computed `dijkstra_full_path` from index 0 to end!
        # A* moves along `astar_path_em` until it reaches emergency, then switches to `astar_path_hosp` and moves to hospital!
        # Let's check if this is exactly how we set up the advance logic.
        # Let's double check:
        # In my current step function:
        # Dijkstra looks at `self.status` to choose `curr_path = self.dijkstra_path_em` or `curr_path = self.dijkstra_path_hosp`.
        # If we transition self.status when they BOTH reach, they might get out of sync if one reaches earlier!
        # To make them independent, we can maintain separate states:
        # `self.d_status` ("RESPONDING", "TRANSPORTING", "ARRIVED")
        # `self.a_status` ("RESPONDING", "TRANSPORTING", "ARRIVED")
        # This is 100% robust and elegant! Let's rewrite the movement step to use independent states:
        
        # Let's do independent movement step:
        # (This is much more correct if one ambulance is faster due to traffic)
        
    def step_independent(self, traffic_prob=0.2, congestion_ratio=0.15, blocking_ratio=0.03):
        """
        Advances Dijkstra and A* ambulances independently along their paths, with dynamic traffic.
        """
            
        if self.d_status == "ARRIVED" and self.a_status == "ARRIVED":
            self.status = "ARRIVED"
            return
            
        self.steps_count += 1
        traffic_changed = False
        
        # 1. Simulate Traffic Change
        if random.random() < traffic_prob:
            congested, blocked = apply_random_traffic(
                self.graph, 
                congestion_ratio=congestion_ratio, 
                blocking_ratio=blocking_ratio
            )
            traffic_changed = True
            self.traffic_events_history.append(
                f"Step {self.steps_count}: Road congestion updated! {len(congested)} jams, {len(blocked)} roadblocks."
            )
            
            # Recompute A* route based on its CURRENT state
            if self.a_status == "RESPONDING":
                a_res = astar(self.graph, self.a_current_node, self.emergency_node)
                if a_res['path']:
                    self.astar_path_em = a_res['path']
                    self.a_idx = 0
                    self.a_nodes_explored += a_res['nodes_explored']
            elif self.a_status == "TRANSPORTING":
                a_res = astar(self.graph, self.a_current_node, self.hospital_node)
                if a_res['path']:
                    self.astar_path_hosp = a_res['path']
                    self.a_idx = 0
                    self.a_nodes_explored += a_res['nodes_explored']
                    
        # Update path overlays for visualization
        # Dijkstra overlay is static, we can just show the full initial path
        # A* overlay shows its active remaining path
        if self.a_status == "RESPONDING":
            self.astar_overlay = self.astar_path_em[self.a_idx:] + self.astar_path_hosp
        elif self.a_status == "TRANSPORTING":
            self.astar_overlay = self.astar_path_hosp[self.a_idx:]
        else:
            self.astar_overlay = []
            
        # 2. Move Dijkstra Ambulance
        if self.d_status == "RESPONDING":
            curr_path = self.dijkstra_path_em
            if self.d_current_node == self.emergency_node:
                # Transition Dijkstra to Transporting
                self.d_status = "TRANSPORTING"
                self.d_idx = 0
                curr_path = self.dijkstra_path_hosp
                self.traffic_events_history.append(f"Step {self.steps_count}: Dijkstra ambulance reached emergency. Proceeding to hospital.")
        elif self.d_status == "TRANSPORTING":
            curr_path = self.dijkstra_path_hosp
            if self.d_current_node == self.hospital_node:
                self.d_status = "ARRIVED"
                self.traffic_events_history.append(f"Step {self.steps_count}: Dijkstra ambulance arrived at hospital!")
                
        if self.d_status != "ARRIVED" and curr_path:
            u = curr_path[self.d_idx]
            v = curr_path[self.d_idx + 1]
            edge_time = self.graph[u][v].get('current_weight', float('inf'))
            if edge_time == float('inf'):
                self.d_cost_accumulated += 15.0  # Roadblock delay
            else:
                self.d_cost_accumulated += edge_time
            self.d_idx += 1
            self.d_current_node = curr_path[self.d_idx]
            
        # 3. Move A* Ambulance
        if self.a_status == "RESPONDING":
            curr_path = self.astar_path_em
            if self.a_current_node == self.emergency_node:
                self.a_status = "TRANSPORTING"
                self.a_idx = 0
                curr_path = self.astar_path_hosp
                self.traffic_events_history.append(f"Step {self.steps_count}: A* ambulance reached emergency. Proceeding to hospital.")
        elif self.a_status == "TRANSPORTING":
            curr_path = self.astar_path_hosp
            if self.a_current_node == self.hospital_node:
                self.a_status = "ARRIVED"
                self.traffic_events_history.append(f"Step {self.steps_count}: A* ambulance arrived at hospital!")
                
        if self.a_status != "ARRIVED" and curr_path:
            u = curr_path[self.a_idx]
            v = curr_path[self.a_idx + 1]
            edge_time = self.graph[u][v].get('current_weight', float('inf'))
            if edge_time == float('inf'):
                self.a_cost_accumulated += 15.0  # Roadblock delay
            else:
                self.a_cost_accumulated += edge_time
            self.a_idx += 1
            self.a_current_node = curr_path[self.a_idx]
            
        # Check overall completion
        if self.d_status == "ARRIVED" and self.a_status == "ARRIVED":
            self.status = "ARRIVED"
            
    # Alias the step function to run the independent movement model
    step = step_independent
