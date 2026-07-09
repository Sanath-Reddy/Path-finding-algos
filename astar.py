import heapq
import time
import math

def astar(graph, start, target, weight_attr='current_weight', max_speed_limit=2.0):
    """
    Computes the shortest path from start to target using the A* Algorithm.
    
    Parameters:
        graph (nx.Graph): The city network.
        start (tuple): The starting (x, y) node.
        target (tuple): The target (x, y) node.
        weight_attr (str): The edge attribute to use as weight.
        max_speed_limit (float): Max speed limit in the graph, used to ensure admissibility of the heuristic.
        
    Returns:
        dict: {
            'path': list of nodes,
            'cost': float,
            'nodes_explored': int,
            'execution_time_ms': float
        }
    """
    start_time = time.perf_counter()
    
    # Heuristic: Euclidean distance divided by max speed limit to guarantee admissibility
    # (since travel time = distance / speed, and actual speed is always <= max_speed_limit)
    pos_target = graph.nodes[target]['pos']
    
    def heuristic(node):
        pos_node = graph.nodes[node]['pos']
        dist = math.hypot(pos_node[0] - pos_target[0], pos_node[1] - pos_target[1])
        return dist / max_speed_limit

    # Priority Queue elements format: (f_score, g_score, node)
    # We sort by f_score. If f_scores are equal, we sort by g_score (optional but helpful).
    pq = [(heuristic(start), 0.0, start)]
    
    g_scores = {node: float('inf') for node in graph.nodes}
    g_scores[start] = 0.0
    
    predecessors = {node: None for node in graph.nodes}
    
    explored_nodes = set()
    path_found = False
    
    while pq:
        f_score, curr_g, curr_node = heapq.heappop(pq)
        
        # Skip if we found a better g_score for this node already
        if curr_g > g_scores[curr_node]:
            continue
            
        explored_nodes.add(curr_node)
        
        # If we reached the target, we can stop
        if curr_node == target:
            path_found = True
            break
            
        for neighbor in graph.neighbors(curr_node):
            weight = graph[curr_node][neighbor].get(weight_attr, float('inf'))
            if weight == float('inf'):
                continue  # Roadblock
                
            new_g = curr_g + weight
            if new_g < g_scores[neighbor]:
                g_scores[neighbor] = new_g
                predecessors[neighbor] = curr_node
                f_neighbor = new_g + heuristic(neighbor)
                heapq.heappush(pq, (f_neighbor, new_g, neighbor))
                
    end_time = time.perf_counter()
    execution_time_ms = (end_time - start_time) * 1000.0
    
    # Reconstruct path
    path = []
    cost = float('inf')
    if path_found:
        cost = g_scores[target]
        curr = target
        while curr is not None:
            path.append(curr)
            curr = predecessors[curr]
        path.reverse()
        
    return {
        'path': path,
        'cost': cost if path_found else float('inf'),
        'nodes_explored': len(explored_nodes),
        'execution_time_ms': round(execution_time_ms, 4)
    }
