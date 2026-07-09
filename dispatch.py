import math
from dijkstra import dijkstra_all

def get_euclidean_distance(node1, node2, graph):
    """
    Computes Euclidean distance between two nodes using their coordinate attributes.
    """
    pos1 = graph.nodes[node1]['pos']
    pos2 = graph.nodes[node2]['pos']
    return math.hypot(pos1[0] - pos2[0], pos1[1] - pos2[1])

# ==========================================
# STAGE 1: AMBULANCE SELECTION
# ==========================================

def select_ambulance_naive(ambulances, emergency_node, graph):
    """
    Naive Ambulance Selection: Choose closest available ambulance using Euclidean distance.
    """
    best_amb = None
    min_dist = float('inf')
    
    for amb in ambulances:
        if not amb.get('available', True):
            continue
        dist = get_euclidean_distance(amb['current_node'], emergency_node, graph)
        if dist < min_dist:
            min_dist = dist
            best_amb = amb
            
    if best_amb is None:
        return None, float('inf'), []
        
    # Reconstruct a direct path on graph if we just want a naive path (fallback to standard Dijkstra)
    from dijkstra import dijkstra
    res = dijkstra(graph, best_amb['current_node'], emergency_node)
    
    return best_amb, min_dist, res['path']

def select_ambulance_optimized(ambulances, emergency_node, graph):
    """
    Optimized Ambulance Selection: Run Dijkstra backwards from the emergency node 
    to all nodes, selecting the available ambulance with the minimum travel time.
    """
    # 1. Run Dijkstra from emergency node to all nodes
    d_res = dijkstra_all(graph, emergency_node)
    distances = d_res['distances']
    predecessors = d_res['predecessors']
    
    best_amb = None
    min_time = float('inf')
    
    for amb in ambulances:
        if not amb.get('available', True):
            continue
        amb_node = amb['current_node']
        time_to_reach = distances.get(amb_node, float('inf'))
        if time_to_reach < min_time:
            min_time = time_to_reach
            best_amb = amb
            
    if best_amb is None:
        return None, float('inf'), []
        
    # 2. Reconstruct path from the selected ambulance's node to emergency node
    # Since we ran dijkstra_all starting from emergency_node, the predecessor chain
    # goes from amb_node back to emergency_node. This is EXACTLY the path from ambulance to emergency!
    path = []
    curr = best_amb['current_node']
    while curr is not None:
        path.append(curr)
        # Stop once we reach the starting node (emergency_node)
        if curr == emergency_node:
            break
        curr = predecessors[curr]
        
    return best_amb, min_time, path

# ==========================================
# STAGE 3: HOSPITAL SELECTION
# ==========================================

def select_hospital_naive(hospitals, emergency_node, graph):
    """
    Naive Hospital Selection: Choose closest hospital using Euclidean distance.
    """
    best_hosp = None
    min_dist = float('inf')
    
    for hosp in hospitals:
        dist = get_euclidean_distance(emergency_node, hosp['node'], graph)
        if dist < min_dist:
            min_dist = dist
            best_hosp = hosp
            
    return best_hosp, min_dist

def select_hospital_optimized(hospitals, emergency_node, graph, priority='Normal', specialty='General'):
    """
    Optimized Hospital Selection: Multi-criteria selection incorporating travel time,
    bed availability, and specialty matching (for critical patients).
    
    Score = TravelTime + 1.5 * (10 - available_beds) + SpecialtyPenalty
    Lower score is better.
    """
    # 1. Run Dijkstra from emergency node to calculate travel times to all hospitals
    d_res = dijkstra_all(graph, emergency_node)
    distances = d_res['distances']
    
    best_hosp = None
    min_score = float('inf')
    best_travel_time = float('inf')
    
    for hosp in hospitals:
        hosp_node = hosp['node']
        travel_time = distances.get(hosp_node, float('inf'))
        
        # If hospital is unreachable, skip
        if travel_time == float('inf'):
            continue
            
        # Bed availability factor
        beds = hosp.get('beds', 0)
        # Severe penalty if there are absolutely no beds
        if beds <= 0:
            bed_penalty = 100.0
        else:
            # Fewer available beds = higher penalty (max penalty of 15.0 when only 0 beds left, or lower if some exist)
            bed_penalty = 1.5 * max(0, 10 - beds)
            
        # Specialty match factor
        specialty_penalty = 0.0
        if priority == 'Critical':
            hosp_specialty = hosp.get('specialty', 'General')
            if specialty != 'General' and hosp_specialty != specialty:
                # Add penalty if the hospital doesn't match the required specialization
                specialty_penalty = 30.0
                
        # Calculate overall score
        score = travel_time + bed_penalty + specialty_penalty
        
        if score < min_score:
            min_score = score
            best_hosp = hosp
            best_travel_time = travel_time
            
    return best_hosp, best_travel_time
