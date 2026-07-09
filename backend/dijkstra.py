import heapq
import time

def dijkstra(graph, start, target, weight_attr='current_weight'):
    """
    Computes the shortest path from start to target using Dijkstra's Algorithm.
    Returns JSON-ready serialized metrics.
    """
    start_time = time.perf_counter()
    
    pq = [(0.0, start)]
    distances = {node: float('inf') for node in graph.nodes}
    distances[start] = 0.0
    predecessors = {node: None for node in graph.nodes}
    explored_nodes = set()
    path_found = False
    
    while pq:
        curr_dist, curr_node = heapq.heappop(pq)
        
        if curr_dist > distances[curr_node]:
            continue
            
        explored_nodes.add(curr_node)
        
        if curr_node == target:
            path_found = True
            break
            
        for neighbor in graph.neighbors(curr_node):
            weight = graph[curr_node][neighbor].get(weight_attr, float('inf'))
            if weight == float('inf') or weight < 0: # handle roadblock/negative indicators
                continue
                
            new_dist = curr_dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                predecessors[neighbor] = curr_node
                heapq.heappush(pq, (new_dist, neighbor))
                
    end_time = time.perf_counter()
    execution_time_ms = (end_time - start_time) * 1000.0
    
    # Reconstruct path and format as "x,y" strings for frontend
    path = []
    cost = float('inf')
    if path_found:
        cost = distances[target]
        curr = target
        while curr is not None:
            path.append(f"{curr[0]},{curr[1]}")
            curr = predecessors[curr]
        path.reverse()
        
    return {
        'path': path,
        'cost': round(cost, 3) if path_found else -1, # -1 indicates unreachable
        'nodes_explored': len(explored_nodes),
        'execution_time_ms': round(execution_time_ms, 4)
    }

def dijkstra_all(graph, start, weight_attr='current_weight'):
    """
    Computes shortest paths from start to all nodes.
    Useful for optimized resource dispatch.
    """
    start_time = time.perf_counter()
    
    pq = [(0.0, start)]
    distances = {node: float('inf') for node in graph.nodes}
    distances[start] = 0.0
    predecessors = {node: None for node in graph.nodes}
    explored_nodes = set()
    
    while pq:
        curr_dist, curr_node = heapq.heappop(pq)
        if curr_dist > distances[curr_node]:
            continue
        explored_nodes.add(curr_node)
        
        for neighbor in graph.neighbors(curr_node):
            weight = graph[curr_node][neighbor].get(weight_attr, float('inf'))
            if weight == float('inf') or weight < 0:
                continue
            new_dist = curr_dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                predecessors[neighbor] = curr_node
                heapq.heappush(pq, (new_dist, neighbor))
                
    end_time = time.perf_counter()
    execution_time_ms = (end_time - start_time) * 1000.0
    
    # Convert keys to "x,y" strings
    str_distances = {f"{k[0]},{k[1]}": (round(v, 3) if v != float('inf') else -1) for k, v in distances.items()}
    str_predecessors = {f"{k[0]},{k[1]}": (f"{v[0]},{v[1]}" if v else None) for k, v in predecessors.items()}
    
    return {
        'distances': str_distances,
        'predecessors': str_predecessors,
        'nodes_explored': len(explored_nodes),
        'execution_time_ms': round(execution_time_ms, 4)
    }
