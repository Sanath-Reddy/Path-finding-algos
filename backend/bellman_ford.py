import time

def bellman_ford(graph, start, target, weight_attr='current_weight'):
    """
    Computes the shortest path from start to target using the Bellman-Ford Algorithm.
    Returns JSON-ready serialized metrics.
    """
    start_time = time.perf_counter()
    
    # Initialize distances and predecessors
    distances = {node: float('inf') for node in graph.nodes}
    distances[start] = 0.0
    predecessors = {node: None for node in graph.nodes}
    
    # We count how many times we check vertices/edges.
    # In Bellman-Ford, we perform |V| - 1 iterations.
    # In each iteration, we relax all edges.
    nodes_explored_count = 0
    edges = list(graph.edges(data=True))
    num_vertices = len(graph.nodes)
    
    path_found = False
    
    # Relax edges |V| - 1 times
    for _ in range(num_vertices - 1):
        updated = False
        for u, v, data in edges:
            weight = data.get(weight_attr, float('inf'))
            if weight == float('inf') or weight < 0:
                continue
            
            nodes_explored_count += 2  # We explore both u and v for this edge relaxation
            
            # Since the graph is undirected, we relax in both directions
            # u -> v
            if distances[u] != float('inf') and distances[u] + weight < distances[v]:
                distances[v] = distances[u] + weight
                predecessors[v] = u
                updated = True
            
            # v -> u
            if distances[v] != float('inf') and distances[v] + weight < distances[u]:
                distances[u] = distances[v] + weight
                predecessors[u] = v
                updated = True
                
        if not updated:
            break
            
    # Check if a path to target was found
    if distances[target] != float('inf'):
        path_found = True
        
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
        'cost': round(cost, 3) if path_found else -1,
        'nodes_explored': nodes_explored_count,
        'execution_time_ms': round(execution_time_ms, 4)
    }
