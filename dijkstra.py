import heapq
import time

def dijkstra(graph, start, target, weight_attr='current_weight'):
    """
    Computes the shortest path from start to target using Dijkstra's Algorithm.
    
    Parameters:
        graph (nx.Graph): The city network.
        start (tuple): The starting (x, y) node.
        target (tuple): The target (x, y) node.
        weight_attr (str): The edge attribute to use as weight.
        
    Returns:
        dict: {
            'path': list of nodes,
            'cost': float,
            'nodes_explored': int,
            'execution_time_ms': float
        }
    """
    start_time = time.perf_counter()
    
    # Priority Queue elements format: (cumulative_distance, node)
    pq = [(0.0, start)]
    
    distances = {node: float('inf') for node in graph.nodes}
    distances[start] = 0.0
    
    predecessors = {node: None for node in graph.nodes}
    
    explored_nodes = set()
    
    path_found = False
    
    while pq:
        curr_dist, curr_node = heapq.heappop(pq)
        
        # If we already found a shorter path to this node, skip
        if curr_dist > distances[curr_node]:
            continue
            
        explored_nodes.add(curr_node)
        
        # If we reached the target, we can stop early
        if curr_node == target:
            path_found = True
            break
            
        for neighbor in graph.neighbors(curr_node):
            weight = graph[curr_node][neighbor].get(weight_attr, float('inf'))
            if weight == float('inf'):
                continue  # Roadblocked edge
                
            new_dist = curr_dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                predecessors[neighbor] = curr_node
                heapq.heappush(pq, (new_dist, neighbor))
                
    end_time = time.perf_counter()
    execution_time_ms = (end_time - start_time) * 1000.0
    
    # Reconstruct path
    path = []
    cost = float('inf')
    if path_found:
        cost = distances[target]
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

def dijkstra_all(graph, start, weight_attr='current_weight'):
    """
    Computes shortest paths from a start node to ALL other nodes in the graph.
    Useful for optimized multi-source matching (e.g. finding closest ambulance/hospital).
    
    Parameters:
        graph (nx.Graph): The city network.
        start (tuple): The start (x, y) node.
        weight_attr (str): The edge attribute to use as weight.
        
    Returns:
        dict: {
            'distances': dict of {node: distance},
            'predecessors': dict of {node: predecessor_node},
            'nodes_explored': int,
            'execution_time_ms': float
        }
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
            if weight == float('inf'):
                continue
                
            new_dist = curr_dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                predecessors[neighbor] = curr_node
                heapq.heappush(pq, (new_dist, neighbor))
                
    end_time = time.perf_counter()
    execution_time_ms = (end_time - start_time) * 1000.0
    
    return {
        'distances': distances,
        'predecessors': predecessors,
        'nodes_explored': len(explored_nodes),
        'execution_time_ms': round(execution_time_ms, 4)
    }

