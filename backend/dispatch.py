import math
from dijkstra import dijkstra_all, dijkstra

def get_euclidean_distance(node1, node2, graph):
    pos1 = graph.nodes[node1]['pos']
    pos2 = graph.nodes[node2]['pos']
    return math.hypot(pos1[0] - pos2[0], pos1[1] - pos2[1])

# ==========================================
# STAGE 1: AMBULANCE SELECTION
# ==========================================

def select_ambulance_naive(ambulances, emergency_node, graph):
    """
    Naive Ambulance Selection: Euclidean distance only.
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
        
    res = dijkstra(graph, best_amb['current_node'], emergency_node)
    return best_amb, min_dist, res['path']

def select_ambulance_optimized(ambulances, emergency_node, graph):
    """
    Optimized Ambulance Selection: SSSP backwards travel time.
    """
    # SSSP backwards from emergency to all nodes
    d_res = dijkstra_all(graph, emergency_node)
    distances = d_res['distances']
    predecessors = d_res['predecessors']
    
    best_amb = None
    min_time = float('inf')
    
    for amb in ambulances:
        if not amb.get('available', True):
            continue
        node_str = f"{amb['current_node'][0]},{amb['current_node'][1]}"
        time_to_reach = distances.get(node_str, -1)
        
        if time_to_reach == -1 or time_to_reach == float('inf'):
            continue
            
        if time_to_reach < min_time:
            min_time = time_to_reach
            best_amb = amb
            
    if best_amb is None:
        return None, float('inf'), []
        
    # Reconstruct path using predecessors from dijkstra_all
    path = []
    curr_str = f"{best_amb['current_node'][0]},{best_amb['current_node'][1]}" if best_amb else None
    em_str = f"{emergency_node[0]},{emergency_node[1]}"
    
    while curr_str is not None:
        path.append(curr_str)
        if curr_str == em_str:
            break
        curr_str = predecessors.get(curr_str)
        
    return best_amb, min_time, path

# ==========================================
# STAGE 3: HOSPITAL SELECTION
# ==========================================

def select_hospital_naive(hospitals, emergency_node, graph):
    """
    Naive Hospital Selection: Euclidean distance only.
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
    Optimized Hospital Selection: Multi-criteria scoring.
    Score = TravelTime + 2.0 * (10 - Beds) + SpecialtyMismatch
    """
    # SSSP from emergency to all nodes
    d_res = dijkstra_all(graph, emergency_node)
    distances = d_res['distances']
    
    best_hosp = None
    min_score = float('inf')
    best_travel_time = float('inf')
    
    for hosp in hospitals:
        node_str = f"{hosp['node'][0]},{hosp['node'][1]}"
        travel_time = distances.get(node_str, -1)
        
        if travel_time == -1 or travel_time == float('inf'):
            continue
            
        beds = hosp.get('beds', 0)
        if beds <= 0:
            bed_penalty = 100.0  # Massive penalty if full
        else:
            # Penalty for low beds: 2.0 per empty bed below standard 10 capacity
            bed_penalty = 2.0 * max(0, 10 - beds)
            
        specialty_penalty = 0.0
        if priority == 'Critical':
            hosp_specialty = hosp.get('specialty', 'General')
            if specialty != 'General' and hosp_specialty != specialty:
                # Add heavy penalty if critical mismatch
                specialty_penalty = 40.0
                
        score = travel_time + bed_penalty + specialty_penalty
        
        if score < min_score:
            min_score = score
            best_hosp = hosp
            best_travel_time = travel_time
            
    return best_hosp, best_travel_time
