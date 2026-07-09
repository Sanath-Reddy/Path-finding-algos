import matplotlib.pyplot as plt
import networkx as nx
import numpy as np

def draw_city_map(graph, 
                  dijkstra_path=None, 
                  astar_path=None, 
                  ambulances=None, 
                  hospitals=None, 
                  emergency_node=None,
                  active_ambulance=None,
                  active_hospital=None):
    """
    Renders the city graph and returns a Matplotlib Figure.
    
    Parameters:
        graph (nx.Graph): The city network.
        dijkstra_path (list): Node path sequence for Dijkstra's algorithm.
        astar_path (list): Node path sequence for A* algorithm.
        ambulances (list): List of ambulance state dicts.
        hospitals (list): List of hospital state dicts.
        emergency_node (tuple): (x, y) coordinates of active emergency.
        active_ambulance (dict): The ambulance selected for dispatch.
        active_hospital (dict): The hospital selected for patient transport.
        
    Returns:
        plt.Figure: The Matplotlib figure object.
    """
    # Create figure and axis
    fig, ax = plt.subplots(figsize=(9, 8), dpi=100)
    fig.patch.set_facecolor('#1E1E1E')  # Dark sleek background
    ax.set_facecolor('#1E1E1E')
    
    # Get positions
    pos = nx.get_node_attributes(graph, 'pos')
    
    # 1. Draw Normal Edges, Congested Edges, and Expressways
    normal_edges = []
    congested_edges = []
    blocked_edges = []
    expressway_edges = []
    
    for u, v, d in graph.edges(data=True):
        if d.get('traffic_factor') == float('inf'):
            blocked_edges.append((u, v))
        elif d.get('traffic_factor', 1.0) > 1.5:
            congested_edges.append((u, v))
        elif d.get('is_expressway', False):
            expressway_edges.append((u, v))
        else:
            normal_edges.append((u, v))
            
    # Draw base network layer
    nx.draw_networkx_edges(graph, pos, edgelist=normal_edges, ax=ax,
                           edge_color='#404040', width=2.0, alpha=0.8)
    
    # Draw expressways (cyan highway-like lines)
    nx.draw_networkx_edges(graph, pos, edgelist=expressway_edges, ax=ax,
                           edge_color='#008080', width=3.0, alpha=0.9, style='solid')
                           
    # Draw congested edges (Red/Orange representing traffic)
    nx.draw_networkx_edges(graph, pos, edgelist=congested_edges, ax=ax,
                           edge_color='#E74C3C', width=3.5, alpha=0.9)
                           
    # Draw blocked edges (Dashed Red representing roadblocks)
    nx.draw_networkx_edges(graph, pos, edgelist=blocked_edges, ax=ax,
                           edge_color='#FF0000', width=2.5, alpha=0.8, style='dashed')

    # 2. Draw standard intersections (nodes)
    nx.draw_networkx_nodes(graph, pos, ax=ax, node_size=60, 
                           node_color='#333333', edgecolors='#555555', linewidths=1.0)

    # 3. Draw Path Overlays
    # Dijkstra path (Blue 🔵)
    if dijkstra_path and len(dijkstra_path) > 1:
        d_edges = list(zip(dijkstra_path[:-1], dijkstra_path[1:]))
        nx.draw_networkx_edges(graph, pos, edgelist=d_edges, ax=ax,
                               edge_color='#3498DB', width=5.5, alpha=0.75, label='Dijkstra Path')
        nx.draw_networkx_nodes(graph, pos, nodelist=dijkstra_path, ax=ax,
                               node_size=80, node_color='#3498DB', alpha=0.5)
                               
    # A* path (Green 🟢)
    if astar_path and len(astar_path) > 1:
        a_edges = list(zip(astar_path[:-1], astar_path[1:]))
        nx.draw_networkx_edges(graph, pos, edgelist=a_edges, ax=ax,
                               edge_color='#2ECC71', width=3.5, alpha=0.85, label='A* Path')
        nx.draw_networkx_nodes(graph, pos, nodelist=astar_path, ax=ax,
                               node_size=60, node_color='#2ECC71', alpha=0.6)

    # 4. Draw Hospitals (🏥 Teal Squares)
    if hospitals:
        hosp_nodes = [h['node'] for h in hospitals]
        # Check if they are selected/active to highlight them
        nx.draw_networkx_nodes(graph, pos, nodelist=hosp_nodes, ax=ax,
                               node_shape='s', node_size=280, node_color='#1ABC9C',
                               edgecolors='#FFFFFF', linewidths=1.5)
        
        # Label hospital IDs
        for hosp in hospitals:
            hx, hy = pos[hosp['node']]
            is_active = active_hospital and active_hospital['id'] == hosp['id']
            lbl_color = '#FFFFFF' if is_active else '#888888'
            lbl_text = f"{hosp['id']}\n({hosp['beds']}B)"
            ax.text(hx, hy + 0.18, lbl_text, color=lbl_color, fontsize=8,
                    ha='center', fontweight='bold', 
                    bbox=dict(facecolor='#1E1E1E', alpha=0.8, edgecolor=lbl_color, boxstyle='round,pad=0.2'))

    # 5. Draw Ambulances (🚑 Yellow/Orange Circles)
    if ambulances:
        for amb in ambulances:
            node = amb['current_node']
            ax_x, ax_y = pos[node]
            
            # Select color based on availability and active status
            is_active = active_ambulance and active_ambulance['id'] == amb['id']
            if not amb.get('available', True):
                node_col = '#7F8C8D'  # Busy (Gray)
            elif is_active:
                node_col = '#F1C40F'  # Active selected (Golden Yellow)
            else:
                node_col = '#F39C12'  # Idle Available (Orange)
                
            edge_col = '#FFFFFF' if is_active else '#333333'
            lw = 2.0 if is_active else 1.0
            
            nx.draw_networkx_nodes(graph, pos, nodelist=[node], ax=ax,
                                   node_shape='o', node_size=240, node_color=node_col,
                                   edgecolors=edge_col, linewidths=lw)
            
            # Label vehicle ID
            lbl_text = f"🚑 {amb['id']}" if is_active else amb['id']
            ax.text(ax_x, ax_y - 0.18, lbl_text, color=node_col, fontsize=8,
                    ha='center', fontweight='bold',
                    bbox=dict(facecolor='#1E1E1E', alpha=0.8, edgecolor='none', boxstyle='round,pad=0.1'))

    # 6. Draw Emergency Site (🔴 Big Glowing Red Star)
    if emergency_node:
        em_x, em_y = pos[emergency_node]
        # Glowing halo
        nx.draw_networkx_nodes(graph, pos, nodelist=[emergency_node], ax=ax,
                               node_shape='*', node_size=600, node_color='#E74C3C',
                               edgecolors='#FFFFFF', linewidths=2.0)
        ax.text(em_x, em_y + 0.2, "🚨 EMERGENCY", color='#E74C3C', fontsize=10,
                ha='center', fontweight='bold',
                bbox=dict(facecolor='#1E1E1E', alpha=0.9, edgecolor='#E74C3C', boxstyle='round,pad=0.2'))

    # Set boundaries and clean look
    ax.axis('off')
    ax.set_title("Smart Ambulance Dispatch & Routing Network Map", color='#FFFFFF', fontsize=14, fontweight='bold', pad=10)
    
    # Custom legends
    from matplotlib.lines import Line2D
    legend_elements = [
        Line2D([0], [0], color='#404040', lw=2, label='Normal Road'),
        Line2D([0], [0], color='#008080', lw=3, label='Diagonal Expressway'),
        Line2D([0], [0], color='#E74C3C', lw=3.5, label='Congested Road (Traffic)'),
        Line2D([0], [0], color='#FF0000', lw=2, ls='--', label='Roadblock (Closed)'),
        Line2D([0], [0], color='#3498DB', lw=5, alpha=0.75, label='Dijkstra Route (Static Blue)'),
        Line2D([0], [0], color='#2ECC71', lw=3.5, alpha=0.85, label='A* Route (Dynamic Green)'),
        Line2D([0], [0], marker='s', color='#1E1E1E', markerfacecolor='#1ABC9C', markeredgecolor='#FFFFFF', markersize=12, label='Hospital (🏥 Teal Sq)'),
        Line2D([0], [0], marker='o', color='#1E1E1E', markerfacecolor='#F1C40F', markeredgecolor='#FFFFFF', markersize=10, label='Selected Ambulance'),
        Line2D([0], [0], marker='o', color='#1E1E1E', markerfacecolor='#F39C12', markeredgecolor='#333333', markersize=8, label='Idle Ambulance'),
        Line2D([0], [0], marker='*', color='#1E1E1E', markerfacecolor='#E74C3C', markeredgecolor='#FFFFFF', markersize=14, label='Emergency Location'),
    ]
    ax.legend(handles=legend_elements, loc='lower center', bbox_to_anchor=(0.5, -0.15), 
              ncol=3, facecolor='#1E1E1E', edgecolor='#333333', labelcolor='#FFFFFF', fontsize=8)
    
    plt.tight_layout()
    return fig
