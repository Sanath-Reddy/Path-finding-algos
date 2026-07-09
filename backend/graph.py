import networkx as nx
import random
import math

def generate_city_graph(width=8, height=8, perturbation=0.1, expressway_prob=0.15):
    """
    Generates a realistic city graph.
    Nodes are tuples (x, y). Coordinates are perturbed for realism.
    """
    grid = nx.grid_2d_graph(width, height)
    graph = nx.Graph()
    
    positions = {}
    for node in grid.nodes:
        x, y = node
        # Add slight perturbation to make map layout feel more realistic
        px = x + random.uniform(-perturbation, perturbation) if (0 < x < width - 1) else x
        py = y + random.uniform(-perturbation, perturbation) if (0 < y < height - 1) else y
        positions[node] = (round(px, 3), round(py, 3))
        
        # We classify nodes as intersection by default
        graph.add_node(node, 
                       pos=positions[node], 
                       x=positions[node][0], 
                       y=positions[node][1],
                       type="intersection")
    
    for u, v in grid.edges:
        pos_u = positions[u]
        pos_v = positions[v]
        dist = math.hypot(pos_u[0] - pos_v[0], pos_u[1] - pos_v[1])
        
        graph.add_edge(u, v,
                       base_weight=dist,
                       speed_limit=1.0,
                       traffic_factor=1.0,
                       current_weight=dist,
                       is_expressway=False)
                       
    # Add diagonal expressways
    for x in range(width - 1):
        for y in range(height - 1):
            if random.random() < expressway_prob:
                u = (x, y)
                v = (x+1, y+1)
                if not graph.has_edge(u, v):
                    pos_u = positions[u]
                    pos_v = positions[v]
                    dist = math.hypot(pos_u[0] - pos_v[0], pos_u[1] - pos_v[1])
                    graph.add_edge(u, v,
                                   base_weight=dist,
                                   speed_limit=2.0,  # 2x speed
                                   traffic_factor=1.0,
                                   current_weight=dist / 2.0,
                                   is_expressway=True)
            if random.random() < expressway_prob:
                u = (x, y+1)
                v = (x+1, y)
                if not graph.has_edge(u, v):
                    pos_u = positions[u]
                    pos_v = positions[v]
                    dist = math.hypot(pos_u[0] - pos_v[0], pos_u[1] - pos_v[1])
                    graph.add_edge(u, v,
                                   base_weight=dist,
                                   speed_limit=2.0,  # 2x speed
                                   traffic_factor=1.0,
                                   current_weight=dist / 2.0,
                                   is_expressway=True)
    return graph

def update_edge_weights(graph):
    """
    Recalculates actual travel time current_weight based on speed limits and traffic.
    """
    for u, v, d in graph.edges(data=True):
        if d['traffic_factor'] == float('inf'):
            d['current_weight'] = float('inf')
        else:
            d['current_weight'] = (d['base_weight'] / d['speed_limit']) * d['traffic_factor']

def apply_traffic_events(graph, congested_count=4, roadblock_count=2, traffic_mult=6.0):
    """
    Injects specific traffic jams and roadblock closures.
    Returns lists of modified edges.
    """
    # Reset all first
    for u, v, d in graph.edges(data=True):
        d['traffic_factor'] = 1.0
        
    edges = list(graph.edges())
    if not edges:
        return [], []
        
    # Congested
    congested_edges = random.sample(edges, min(congested_count, len(edges)))
    for u, v in congested_edges:
        graph[u][v]['traffic_factor'] = round(random.uniform(3.0, traffic_mult), 2)
        
    # Roadblocks
    remaining = [e for e in edges if e not in congested_edges]
    roadblocked_edges = []
    if remaining:
        roadblocked_edges = random.sample(remaining, min(roadblock_count, len(remaining)))
        for u, v in roadblocked_edges:
            graph[u][v]['traffic_factor'] = float('inf')
            
    update_edge_weights(graph)
    return congested_edges, roadblocked_edges

def reset_traffic(graph):
    for u, v, d in graph.edges(data=True):
        d['traffic_factor'] = 1.0
    update_edge_weights(graph)

def serialize_graph(graph):
    """
    Converts graph into JSON-ready dictionary lists.
    Node IDs are serialized as string "x,y" for simple JS key mapping.
    """
    nodes_list = []
    for node, data in graph.nodes(data=True):
        nodes_list.append({
            "id": f"{node[0]},{node[1]}",
            "x": data["x"],
            "y": data["y"],
            "type": data.get("type", "intersection")
        })
        
    edges_list = []
    for u, v, data in graph.edges(data=True):
        edges_list.append({
            "source": f"{u[0]},{u[1]}",
            "target": f"{v[0]},{v[1]}",
            "base_weight": round(data["base_weight"], 3),
            "speed_limit": data["speed_limit"],
            "traffic_factor": data["traffic_factor"] if data["traffic_factor"] != float('inf') else -1, # -1 signifies blocked
            "current_weight": round(data["current_weight"], 3) if data["current_weight"] != float('inf') else -1,
            "is_expressway": data["is_expressway"]
        })
        
    return {
        "nodes": nodes_list,
        "edges": edges_list
    }
