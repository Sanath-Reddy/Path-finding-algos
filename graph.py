import networkx as nx
import random
import math

def generate_city_graph(width=8, height=8, perturbation=0.15, expressway_prob=0.2):
    """
    Generates a realistic urban city grid graph.
    
    Parameters:
        width (int): Number of nodes horizontally.
        height (int): Number of nodes vertically.
        perturbation (float): Random offset added to grid coordinates to make it less rigid.
        expressway_prob (float): Probability of adding diagonal expressways (shortcuts).
        
    Returns:
        nx.Graph: A weighted NetworkX graph with node positions and edge weights.
    """
    # Create standard 2D grid graph
    grid = nx.grid_2d_graph(width, height)
    graph = nx.Graph()
    
    # 1. Assign positions with optional slight perturbation
    positions = {}
    for node in grid.nodes:
        x, y = node
        # Add slight randomness to coordinates for realistic street layout
        px = x + random.uniform(-perturbation, perturbation) if (0 < x < width - 1) else x
        py = y + random.uniform(-perturbation, perturbation) if (0 < y < height - 1) else y
        positions[node] = (round(px, 3), round(py, 3))
        graph.add_node(node, pos=positions[node])
    
    # 2. Add grid edges with attributes
    for u, v in grid.edges:
        pos_u = positions[u]
        pos_v = positions[v]
        dist = math.hypot(pos_u[0] - pos_v[0], pos_u[1] - pos_v[1])
        
        # Base road attributes
        speed_limit = 1.0  # standard road speed
        traffic_factor = 1.0
        current_weight = dist / speed_limit
        
        graph.add_edge(u, v, 
                       base_weight=dist,
                       speed_limit=speed_limit,
                       traffic_factor=traffic_factor,
                       current_weight=current_weight,
                       is_expressway=False)
        
    # 3. Add random diagonal expressways for highway-like shortcuts
    for x in range(width - 1):
        for y in range(height - 1):
            if random.random() < expressway_prob:
                # Add diagonal from (x, y) to (x+1, y+1)
                u = (x, y)
                v = (x+1, y+1)
                if not graph.has_edge(u, v):
                    pos_u = positions[u]
                    pos_v = positions[v]
                    dist = math.hypot(pos_u[0] - pos_v[0], pos_u[1] - pos_v[1])
                    
                    speed_limit = 2.0  # expressways are faster
                    traffic_factor = 1.0
                    current_weight = dist / speed_limit
                    
                    graph.add_edge(u, v,
                                   base_weight=dist,
                                   speed_limit=speed_limit,
                                   traffic_factor=traffic_factor,
                                   current_weight=current_weight,
                                   is_expressway=True)
            
            if random.random() < expressway_prob:
                # Add diagonal from (x, y+1) to (x+1, y)
                u = (x, y+1)
                v = (x+1, y)
                if not graph.has_edge(u, v):
                    pos_u = positions[u]
                    pos_v = positions[v]
                    dist = math.hypot(pos_u[0] - pos_v[0], pos_u[1] - pos_v[1])
                    
                    speed_limit = 2.0  # expressways are faster
                    traffic_factor = 1.0
                    current_weight = dist / speed_limit
                    
                    graph.add_edge(u, v,
                                   base_weight=dist,
                                   speed_limit=speed_limit,
                                   traffic_factor=traffic_factor,
                                   current_weight=current_weight,
                                   is_expressway=True)
                    
    return graph

def update_edge_weights(graph):
    """
    Recalculates the current_weight of all edges based on base_weight, speed_limit, and traffic_factor.
    """
    for u, v, d in graph.edges(data=True):
        if d['traffic_factor'] == float('inf'):
            d['current_weight'] = float('inf')
        else:
            d['current_weight'] = (d['base_weight'] / d['speed_limit']) * d['traffic_factor']

def apply_random_traffic(graph, congestion_ratio=0.15, blocking_ratio=0.05, max_traffic_mult=8.0):
    """
    Simulates dynamic city traffic. Randomly selects some edges and increases traffic_factor
    or blocks them entirely (roadblock).
    """
    edges = list(graph.edges())
    # Reset all traffic first
    for u, v, d in graph.edges(data=True):
        d['traffic_factor'] = 1.0
        
    # Congested roads
    num_congested = int(len(edges) * congestion_ratio)
    congested_edges = random.sample(edges, num_congested)
    for u, v in congested_edges:
        factor = random.uniform(3.0, max_traffic_mult)
        graph[u][v]['traffic_factor'] = round(factor, 2)
        
    # Blocked roads (roadblocks)
    remaining_edges = [e for e in edges if e not in congested_edges]
    num_blocked = int(len(edges) * blocking_ratio)
    blocked_edges = random.sample(remaining_edges, num_blocked)
    for u, v in blocked_edges:
        graph[u][v]['traffic_factor'] = float('inf')
        
    update_edge_weights(graph)
    return congested_edges, blocked_edges

def reset_traffic(graph):
    """
    Resets all traffic factors back to 1.0 (clear roads).
    """
    for u, v, d in graph.edges(data=True):
        d['traffic_factor'] = 1.0
    update_edge_weights(graph)
