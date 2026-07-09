import heapq
import time
import math

def greedy_bfs(graph, start, target, weight_attr='current_weight', max_speed_limit=2.0):
    """
    Computes a path from start to target using Greedy Best-First Search.
    Sorts search frontier purely by heuristic h(n) (distance to target), ignoring g(n).
    Returns JSON-ready serialized metrics.
    """
    start_time = time.perf_counter()
    
    pos_target = graph.nodes[target]['pos']
    
    def heuristic(node):
        pos_node = graph.nodes[node]['pos']
        dist = math.hypot(pos_node[0] - pos_target[0], pos_node[1] - pos_target[1])
        return dist / max_speed_limit

    # Priority queue format: (h_score, node)
    pq = [(heuristic(start), start)]
    
    # Track paths and costs
    g_scores = {node: float('inf') for node in graph.nodes}
    g_scores[start] = 0.0
    
    predecessors = {node: None for node in graph.nodes}
    explored_nodes = set()
    path_found = False
    
    while pq:
        h_score, curr_node = heapq.heappop(pq)
        
        if curr_node in explored_nodes:
            continue
            
        explored_nodes.add(curr_node)
        
        if curr_node == target:
            path_found = True
            break
            
        for neighbor in graph.neighbors(curr_node):
            weight = graph[curr_node][neighbor].get(weight_attr, float('inf'))
            if weight == float('inf') or weight < 0:
                continue
                
            new_g = g_scores[curr_node] + weight
            
            # For Greedy BFS, we just want to explore nodes based on heuristic
            if neighbor not in explored_nodes:
                # If we found a better or first g_score for the neighbor, record it
                if new_g < g_scores[neighbor]:
                    g_scores[neighbor] = new_g
                    predecessors[neighbor] = curr_node
                    
                heapq.heappush(pq, (heuristic(neighbor), neighbor))
                
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
