import heapq
import time
import math

def astar(graph, start, target, weight_attr='current_weight', max_speed_limit=2.0):
    """
    Computes shortest path from start to target using A* Search.
    Uses an admissible scaled Euclidean distance heuristic.
    """
    start_time = time.perf_counter()
    
    pos_target = graph.nodes[target]['pos']
    
    def heuristic(node):
        pos_node = graph.nodes[node]['pos']
        dist = math.hypot(pos_node[0] - pos_target[0], pos_node[1] - pos_target[1])
        # Scaled by max speed limit to ensure admissibility on roads with speed limits up to 2.0
        return dist / max_speed_limit

    pq = [(heuristic(start), 0.0, start)]
    g_scores = {node: float('inf') for node in graph.nodes}
    g_scores[start] = 0.0
    predecessors = {node: None for node in graph.nodes}
    explored_nodes = set()
    path_found = False
    
    while pq:
        f_score, curr_g, curr_node = heapq.heappop(pq)
        
        if curr_g > g_scores[curr_node]:
            continue
            
        explored_nodes.add(curr_node)
        
        if curr_node == target:
            path_found = True
            break
            
        for neighbor in graph.neighbors(curr_node):
            weight = graph[curr_node][neighbor].get(weight_attr, float('inf'))
            if weight == float('inf') or weight < 0:
                continue
                
            new_g = curr_g + weight
            if new_g < g_scores[neighbor]:
                g_scores[neighbor] = new_g
                predecessors[neighbor] = curr_node
                f_neighbor = new_g + heuristic(neighbor)
                heapq.heappush(pq, (f_neighbor, new_g, neighbor))
                
    end_time = time.perf_counter()
    execution_time_ms = (end_time - start_time) * 1000.0
    
    # Reconstruct path and format as "x,y" strings for frontend
    path = []
    cost = float('inf')
    if path_found:
        cost = g_scores[target]
        curr = target
        while curr is not None:
            path.append(f"{curr[0]},{curr[1]}")
            curr = predecessors[curr]
        path.reverse()
        
    return {
        'path': path,
        'cost': round(cost, 3) if path_found else -1,
        'nodes_explored': len(explored_nodes),
        'execution_time_ms': round(execution_time_ms, 4)
    }
