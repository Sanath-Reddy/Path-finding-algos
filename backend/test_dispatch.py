from simulation import EOCSimulation
from dispatch import select_ambulance_optimized, select_hospital_optimized
from dijkstra import dijkstra, dijkstra_all
from astar import astar

print("=== Creating EOCSimulation(10, 10) ===")
sim = EOCSimulation(10, 10)
print(f"Grid: {sim.width}x{sim.height}")
print(f"Graph nodes: {sim.graph.number_of_nodes()}")
print(f"Graph edges: {sim.graph.number_of_edges()}")

print("\nHospitals:")
for h in sim.hospitals:
    in_graph = h["node"] in sim.graph.nodes
    print(f"  {h['name']} at {h['node']} -> in_graph={in_graph}")

print("\nAmbulances:")
for a in sim.ambulances:
    in_graph = a["current_node"] in sim.graph.nodes
    print(f"  {a['id']} at {a['current_node']} -> in_graph={in_graph}")

em_node = (5, 5)
print(f"\n=== Dispatch test from emergency at {em_node} ===")
em_in_graph = em_node in sim.graph.nodes
print(f"Emergency node in graph: {em_in_graph}")

# Test dijkstra_all
print("\nRunning dijkstra_all from emergency node...")
d_res = dijkstra_all(sim.graph, em_node)
print(f"  Keys sample: {list(d_res['distances'].keys())[:5]}")
print(f"  Total nodes reached: {len([v for v in d_res['distances'].values() if v != -1])}")

# Check ambulance distances
for a in sim.ambulances:
    key = f"{a['current_node'][0]},{a['current_node'][1]}"
    dist = d_res["distances"].get(key, "NOT_FOUND")
    print(f"  Distance to {a['id']} at {key}: {dist}")

# Test select_ambulance
print("\nSelecting best ambulance...")
amb, t, _ = select_ambulance_optimized(sim.ambulances, em_node, sim.graph)
print(f"  Best ambulance: {amb}")
print(f"  Time: {t}")

# Test select_hospital
print("\nSelecting best hospital...")
hosp, ht = select_hospital_optimized(sim.hospitals, em_node, sim.graph)
print(f"  Best hospital: {hosp}")
print(f"  Time: {ht}")

# Full trigger
print("\n=== Full trigger_emergency test ===")
result = sim.trigger_emergency("5,5")
print(f"Result: {result}")
print("Logs:")
for log in sim.logs[-6:]:
    print(f"  [{log['time']}] {log['msg']}")
