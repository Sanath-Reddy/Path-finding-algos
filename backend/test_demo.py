"""
Test different traffic setups to find one that maximizes Dijkstra vs A* difference.
Run from backend directory.
"""
import sys, random
sys.path.insert(0, '.')
from graph import generate_city_graph, update_edge_weights
from dijkstra import dijkstra
from astar import astar

def test_setup(label, traffic_fn, em="8,8", hosp="1,1", runs=5):
    totals_d, totals_a = [], []
    for _ in range(runs):
        G = generate_city_graph(10, 10, expressway_prob=0.0)
        for u, v, d in G.edges(data=True):
            d["traffic_factor"] = traffic_fn(u, v)
        update_edge_weights(G)

        em_t  = tuple(int(x) for x in em.split(","))
        ho_t  = tuple(int(x) for x in hosp.split(","))
        amb   = (9, 9)

        # path: amb → em → hospital  (same as simulation)
        r1d = dijkstra(G, amb,  em_t)
        r2d = dijkstra(G, em_t, ho_t)
        r1a = astar(   G, amb,  em_t)
        r2a = astar(   G, em_t, ho_t)

        nd = r1d['nodes_explored'] + r2d['nodes_explored']
        na = r1a['nodes_explored'] + r2a['nodes_explored']
        totals_d.append(nd); totals_a.append(na)

    avg_d = sum(totals_d) / len(totals_d)
    avg_a = sum(totals_a) / len(totals_a)
    pct   = (1 - avg_a / avg_d) * 100
    print(f"{label}")
    print(f"  Dijkstra avg nodes: {avg_d:.0f}")
    print(f"  A*       avg nodes: {avg_a:.0f}")
    print(f"  A* explores {pct:.1f}% FEWER nodes\n")

print("=== Testing traffic setups ===\n")

# Setup 1: Current (0.15 bottom-right)
test_setup("Setup 1: traffic_factor=0.15 for x>=4,y>=4",
    lambda u,v: 0.15 if (u[0]+v[0])/2 >= 4 and (u[1]+v[1])/2 >= 4 else 2.0)

# Setup 2: Cheaper bottom-right (0.02)
test_setup("Setup 2: traffic_factor=0.02 for x>=4,y>=4",
    lambda u,v: 0.02 if (u[0]+v[0])/2 >= 4 and (u[1]+v[1])/2 >= 4 else 1.8)

# Setup 3: Even cheaper (0.005) + heavier normal
test_setup("Setup 3: traffic_factor=0.005 for x>=4,y>=4 / 2.5 otherwise",
    lambda u,v: 0.005 if (u[0]+v[0])/2 >= 4 and (u[1]+v[1])/2 >= 4 else 2.5)

# Setup 4: Wider cheap zone (x>=3 or y>=3)
def s4(u, v):
    x = (u[0]+v[0])/2
    y = (u[1]+v[1])/2
    if x >= 3 or y >= 3:
        return 0.01
    return 1.5
test_setup("Setup 4: 0.01 for x>=3 OR y>=3",  s4)

# Setup 5: Directional — opposite of hospital (x>=5 AND y>=5)
def s5(u, v):
    x = (u[0]+v[0])/2
    y = (u[1]+v[1])/2
    if x >= 5 and y >= 5: return 0.005   # far from hospital
    if x <= 2 and y <= 2: return 1.5      # near hospital
    return 3.0
test_setup("Setup 5: super cheap far zone + normal hospital zone", s5)

# Setup 6: Maze-like — blocked middle column, cheap right side
def s6(u, v):
    x = (u[0]+v[0])/2
    y = (u[1]+v[1])/2
    # Vertical barrier at x=3-4, gaps only at y=0-1 and y=8-9
    if 3.3 <= x <= 4.7 and 2 <= (u[1]+v[1])/2 <= 7:
        return 15.0   # very heavy (near-blocked)
    if x >= 4:
        return 0.02   # cheap right side
    return 1.5
test_setup("Setup 6: barrier + cheap right side", s6)
