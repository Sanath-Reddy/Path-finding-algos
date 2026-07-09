import sys
import time
import streamlit as st
import matplotlib.pyplot as plt

# Import custom modules
from graph import generate_city_graph, apply_random_traffic, reset_traffic
from dijkstra import dijkstra, dijkstra_all
from astar import astar
from dispatch import (
    select_ambulance_naive,
    select_ambulance_optimized,
    select_hospital_naive,
    select_hospital_optimized
)
from visualization import draw_city_map
from simulation import AmbulanceSimulation

# ==========================================
# CLI RUNNER FOR PHASES 1 & 2
# ==========================================

def run_cli_tests():
    print("==================================================")
    print("Smart Ambulance Dispatch & Routing System: CLI Mode")
    print("==================================================")
    
    # 1. Run Phase 1
    width, height = 10, 10
    print(f"Generating a {width}x{height} city grid graph...")
    graph = generate_city_graph(width=width, height=height, perturbation=0.1, expressway_prob=0.25)
    print(f"Graph loaded successfully with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges.")
    
    start = (0, 0)
    target = (width - 1, height - 1)
    print(f"\nOrigin: {start}")
    print(f"Destination: {target}")
    
    print("\nRunning Dijkstra...")
    d_res = dijkstra(graph, start, target)
    print(f"  Dijkstra Path Cost (travel time): {d_res['cost']:.4f}")
    print(f"  Dijkstra Nodes Explored: {d_res['nodes_explored']}")
    print(f"  Dijkstra Computation Time: {d_res['execution_time_ms']:.4f} ms")
    
    print("\nRunning A*...")
    a_res = astar(graph, start, target)
    print(f"  A* Path Cost (travel time): {a_res['cost']:.4f}")
    print(f"  A* Nodes Explored: {a_res['nodes_explored']}")
    print(f"  A* Computation Time: {a_res['execution_time_ms']:.4f} ms")
    
    print("\n------------------ Pathfinding Verification ------------------")
    if abs(d_res['cost'] - a_res['cost']) < 1e-5:
        print("[OK] Path costs match perfectly.")
    else:
        print(f"[WARNING] Path costs differ. Dijkstra={d_res['cost']:.4f}, A*={a_res['cost']:.4f}")
    print(f"[TIP] Nodes Explored Comparison: {d_res['nodes_explored']} (Dijkstra) vs {a_res['nodes_explored']} (A*)")
    reduction = ((d_res['nodes_explored'] - a_res['nodes_explored']) / d_res['nodes_explored']) * 100
    print(f"   A* reduced the search space by {reduction:.1f}%!")
    print("--------------------------------------------------\n")
    
    # 2. Run Phase 2
    print("Testing Multi-Stage Decision System...")
    ambulances = [
        {'id': 'AMB-1', 'current_node': (0, 2), 'available': True},
        {'id': 'AMB-2', 'current_node': (2, 0), 'available': True},
        {'id': 'AMB-3', 'current_node': (1, 1), 'available': False},
    ]
    hospitals = [
        {'id': 'HOSP-A', 'node': (1, 3), 'beds': 0, 'specialty': 'General', 'name': 'City General (Full)'},
        {'id': 'HOSP-B', 'node': (4, 4), 'beds': 8, 'specialty': 'Trauma', 'name': 'County Trauma Center'},
        {'id': 'HOSP-C', 'node': (9, 0), 'beds': 10, 'specialty': 'Cardiac', 'name': 'St. Jude Heart Clinic'}
    ]
    emergency_node = (1, 2)
    priority = 'Critical'
    specialty = 'Trauma'
    
    print(f"Emergency Triggered at: {emergency_node} [Priority: {priority}, Need: {specialty}]")
    
    # Selection
    naive_amb, _, _ = select_ambulance_naive(ambulances, emergency_node, graph)
    opt_amb, opt_time, _ = select_ambulance_optimized(ambulances, emergency_node, graph)
    print(f"  Ambulance Selection: Naive={naive_amb['id']}, Optimized={opt_amb['id']} (Time: {opt_time:.2f})")
    
    naive_hosp, _ = select_hospital_naive(hospitals, emergency_node, graph)
    opt_hosp, opt_h_time = select_hospital_optimized(hospitals, emergency_node, graph, priority, specialty)
    print(f"  Hospital Selection: Naive={naive_hosp['name']}, Optimized={opt_hosp['name']} (Time: {opt_h_time:.2f})")
    
    print("\n------------------ Decision Verification ------------------")
    if opt_hosp['id'] == 'HOSP-B':
        print("[OK] Decision system correctly chose HOSP-B (available beds + Trauma specialization) over closer but full HOSP-A.")
    print("--------------------------------------------------\n")
    print("[CLI runs finished successfully. Use 'streamlit run main.py' to run the GUI app.]")

# ==========================================
# STREAMLIT GUI DASHBOARD & ANIMATION
# ==========================================

def initialize_session_state(width, height):
    """
    Initializes/resets the simulation session state variables.
    """
    st.session_state.width = width
    st.session_state.height = height
    
    # Generate graph
    st.session_state.graph = generate_city_graph(
        width=width, 
        height=height, 
        perturbation=0.1, 
        expressway_prob=0.2
    )
    
    # Layout dimensions
    x_mid = width // 2
    y_mid = height // 2
    
    # Place standard test ambulances
    st.session_state.ambulances = [
        {'id': 'AMB-1', 'current_node': (0, y_mid), 'available': True, 'type': 'ALS'},
        {'id': 'AMB-2', 'current_node': (x_mid, 0), 'available': True, 'type': 'BLS'},
        {'id': 'AMB-3', 'current_node': (x_mid, y_mid), 'available': False, 'type': 'ALS'},
    ]
    
    # Place standard test hospitals
    st.session_state.hospitals = [
        {'id': 'HOSP-A', 'node': (1, y_mid + 1 if y_mid + 1 < height else y_mid - 1), 'beds': 0, 'specialty': 'General', 'name': 'City General (Full)'},
        {'id': 'HOSP-B', 'node': (x_mid + 1 if x_mid + 1 < width else x_mid, y_mid + 1 if y_mid + 1 < height else y_mid), 'beds': 8, 'specialty': 'Trauma', 'name': 'County Trauma Center'},
        {'id': 'HOSP-C', 'node': (width - 1, 1), 'beds': 10, 'specialty': 'Cardiac', 'name': 'St. Jude Heart Clinic'}
    ]
    
    # Active simulation state variables
    st.session_state.emergency_node = None
    st.session_state.patient_priority = 'Normal'
    st.session_state.patient_specialty = 'General'
    
    st.session_state.active_ambulance = None
    st.session_state.active_hospital = None
    
    st.session_state.dijkstra_path = None
    st.session_state.astar_path = None
    
    st.session_state.metrics = None
    st.session_state.dispatch_mode = "Optimized"
    
    # Simulation engine holder
    st.session_state.simulation = None
    st.session_state.sim_running = False

def render_streamlit_app():
    st.set_page_config(
        page_title="Smart Ambulance Dispatch & Routing Simulation",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # Custom CSS for Sleek Dark theme
    st.markdown("""
        <style>
        .main {
            background-color: #121212;
            color: #FFFFFF;
        }
        div[data-testid="stSidebar"] {
            background-color: #1E1E1E;
            border-right: 1px solid #333333;
        }
        .stMetric {
            background-color: #1E1E1E;
            border: 1px solid #333333;
            border-radius: 8px;
            padding: 10px;
        }
        .incident-log {
            background-color: #1A1A1A;
            border: 1px solid #333333;
            border-radius: 6px;
            padding: 10px;
            font-family: monospace;
            height: 180px;
            overflow-y: auto;
            color: #2ECC71;
        }
        </style>
    """, unsafe_allow_html=True)
    
    st.title("🚑 Smart Ambulance Dispatch & Routing System")
    st.caption("A visually interactive demonstration of Dijkstra vs A* shortest-path routing and multi-stage hospital allocation under dynamic traffic.")
    
    # Sidebar control panel
    with st.sidebar:
        st.header("⚙️ Map Configuration")
        grid_width = st.slider("Grid Width", min_value=6, max_value=12, value=8)
        grid_height = st.slider("Grid Height", min_value=6, max_value=12, value=8)
        
        if st.button("🔄 Generate New City Map") or 'graph' not in st.session_state:
            initialize_session_state(grid_width, grid_height)
            st.success("New map generated successfully.")
            
        st.markdown("---")
        st.header("🚨 Emergency Case Setup")
        
        # Select emergency node
        nodes_list = sorted(list(st.session_state.graph.nodes))
        # Default node (usually near upper right)
        default_idx = min(len(nodes_list) - 2, int(len(nodes_list) * 0.75))
        emergency_node = st.selectbox(
            "Emergency Location (Intersection)", 
            options=nodes_list, 
            index=default_idx
        )
        
        patient_priority = st.selectbox("Priority Level", ["Normal", "Critical"])
        patient_specialty = st.selectbox("Emergency Medical Needs", ["General", "Trauma", "Cardiac"])
        
        st.markdown("---")
        st.header("⚡ Dynamic Traffic Setup")
        traffic_prob = st.slider("Traffic Congestion Event Probability", min_value=0.0, max_value=1.0, value=0.25, step=0.05)
        congestion_ratio = st.slider("Congested Roads Ratio", min_value=0.0, max_value=0.5, value=0.15, step=0.05)
        blocking_ratio = st.slider("Roadblock (Blocked Road) Ratio", min_value=0.0, max_value=0.15, value=0.04, step=0.01)
        
        st.markdown("---")
        st.header("🔀 Dispatch Controls")
        dispatch_mode = st.radio("Dispatch Algorithm", ["Naive (Closest Distance)", "Optimized (Multi-Stage DAA)"])
        
        # Dispatch button
        if st.button("🚨 Initial Dispatch & Route Planning"):
            # Reset traffic to initial state for dispatch planning
            reset_traffic(st.session_state.graph)
            
            st.session_state.emergency_node = emergency_node
            st.session_state.patient_priority = patient_priority
            st.session_state.patient_specialty = patient_specialty
            st.session_state.dispatch_mode = dispatch_mode
            
            # --- STAGE 1 & 3: DECISION SYSTEM ---
            if dispatch_mode == "Naive (Closest Distance)":
                amb, _, amb_path = select_ambulance_naive(
                    st.session_state.ambulances, 
                    emergency_node, 
                    st.session_state.graph
                )
                hosp, _ = select_hospital_naive(
                    st.session_state.hospitals, 
                    emergency_node, 
                    st.session_state.graph
                )
            else:
                amb, _, amb_path = select_ambulance_optimized(
                    st.session_state.ambulances, 
                    emergency_node, 
                    st.session_state.graph
                )
                hosp, _ = select_hospital_optimized(
                    st.session_state.hospitals, 
                    emergency_node, 
                    st.session_state.graph,
                    priority=patient_priority,
                    specialty=patient_specialty
                )
                
            st.session_state.active_ambulance = amb
            st.session_state.active_hospital = hosp
            
            # --- STAGE 2: INITIAL ROUTE PLANNING ---
            if amb and hosp:
                start_node = amb['current_node']
                hosp_node = hosp['node']
                
                # Dijkstra performance
                d1 = dijkstra(st.session_state.graph, start_node, emergency_node)
                d2 = dijkstra(st.session_state.graph, emergency_node, hosp_node)
                
                d_full_path = d1['path'][:-1] + d2['path'] if d1['path'] and d2['path'] else []
                d_full_cost = d1['cost'] + d2['cost']
                d_full_nodes = d1['nodes_explored'] + d2['nodes_explored']
                d_full_time = d1['execution_time_ms'] + d2['execution_time_ms']
                
                # A* performance
                a1 = astar(st.session_state.graph, start_node, emergency_node)
                a2 = astar(st.session_state.graph, emergency_node, hosp_node)
                
                a_full_path = a1['path'][:-1] + a2['path'] if a1['path'] and a2['path'] else []
                a_full_cost = a1['cost'] + a2['cost']
                a_full_nodes = a1['nodes_explored'] + a2['nodes_explored']
                a_full_time = a1['execution_time_ms'] + a2['execution_time_ms']
                
                st.session_state.dijkstra_path = d_full_path
                st.session_state.astar_path = a_full_path
                
                # Setup simulation engine
                st.session_state.simulation = AmbulanceSimulation(
                    graph=st.session_state.graph,
                    start_node=start_node,
                    emergency_node=emergency_node,
                    hospital_node=hosp_node
                )
                
                st.session_state.metrics = {
                    'dijkstra': {
                        'est_cost': d_full_cost,
                        'actual_cost': 0.0,
                        'nodes': d_full_nodes,
                        'time': d_full_time,
                        'path_len': len(d_full_path)
                    },
                    'astar': {
                        'est_cost': a_full_cost,
                        'actual_cost': 0.0,
                        'nodes': a_full_nodes,
                        'time': a_full_time,
                        'path_len': len(a_full_path)
                    }
                }
                st.success("Ambulances prepared and ready for dispatch!")
            else:
                st.error("Error: Could not dispatch. Verify ambulance availability or hospital paths.")

    # --- MAIN PANEL LAYOUT ---
    col_map, col_info = st.columns([3, 2])
    
    # Placeholders for dynamic rendering during animation
    with col_map:
        map_title_placeholder = st.subheader("🗺️ Live City Dispatch Map")
        map_placeholder = st.empty()
        
    with col_info:
        st.subheader("📊 Dispatch Operations & Logic")
        
        # Display Decision card
        decision_placeholder = st.empty()
        
        # Render decision text
        if st.session_state.active_ambulance and st.session_state.active_hospital:
            amb = st.session_state.active_ambulance
            hosp = st.session_state.active_hospital
            priority_color = '🔴' if st.session_state.patient_priority == 'Critical' else '🟡'
            
            intelligence_text = ""
            if st.session_state.dispatch_mode.startswith("Optimized"):
                intelligence_text = "<div style='color:#2ECC71; font-weight:bold; margin-top:5px;'>💡 Optimized Selection: Chose nearest available vehicle and matched hospital beds + specialty.</div>"
            else:
                intelligence_text = "<div style='color:#E74C3C; font-weight:bold; margin-top:5px;'>⚠️ Naive Selection: Closest by Euclidean distance. Ignored hospital capacity & specialty.</div>"
                
            decision_placeholder.markdown(f"""
            <div style='background-color:#1E1E1E; padding:15px; border-radius:8px; border:1px solid #333333;'>
                <strong style='font-size:16px;'>🚨 Incident: Node {st.session_state.emergency_node} [Need: {st.session_state.patient_specialty} ({st.session_state.patient_priority} {priority_color})]</strong><br/>
                🚒 Dispatched: <b>{amb['id']}</b> at Node {amb['current_node']}<br/>
                🏥 Target Hospital: <b>{hosp['name']}</b> at Node {hosp['node']} (Beds: {hosp['beds']})<br/>
                {intelligence_text}
            </div>
            """, unsafe_allow_html=True)
        else:
            decision_placeholder.info("👈 Set up the emergency details in the sidebar and click **Initial Dispatch** to prepare the path comparisons.")
            
        # Animation Trigger Buttons
        anim_controls_placeholder = st.empty()
        
        # Metric dashboard placeholder
        metrics_placeholder = st.empty()
        
        # Live log placeholder
        log_placeholder = st.empty()
        
    # Render static map if simulation not running yet
    if st.session_state.simulation is None:
        fig = draw_city_map(
            graph=st.session_state.graph,
            dijkstra_path=st.session_state.dijkstra_path,
            astar_path=st.session_state.astar_path,
            ambulances=st.session_state.ambulances,
            hospitals=st.session_state.hospitals,
            emergency_node=st.session_state.emergency_node,
            active_ambulance=st.session_state.active_ambulance,
            active_hospital=st.session_state.active_hospital
        )
        map_placeholder.pyplot(fig)
        plt.close(fig)
    else:
        # Show animation controls if simulation is loaded
        sim = st.session_state.simulation
        
        # Set up values in placeholders
        def update_renderings():
            # Update Map
            # Prepare mock vehicles at their LIVE locations
            live_vehicles = [
                {'id': f"Dijkstra (Static) {sim.d_status}", 'current_node': sim.d_current_node, 'available': True},
                {'id': f"A* (Dynamic) {sim.a_status}", 'current_node': sim.a_current_node, 'available': True}
            ]
            fig = draw_city_map(
                graph=st.session_state.graph,
                dijkstra_path=sim.dijkstra_overlay,
                astar_path=sim.astar_overlay,
                ambulances=live_vehicles,
                hospitals=st.session_state.hospitals,
                emergency_node=sim.emergency_node,
                active_ambulance={'id': f"A* (Dynamic) {sim.a_status}"},
                active_hospital={'node': sim.hospital_node, 'id': 'TARGET'}
            )
            map_placeholder.pyplot(fig)
            plt.close(fig)
            
            # Update Metrics Panel
            d_total_nodes = sim.d_nodes_explored
            a_total_nodes = sim.a_nodes_explored
            
            nodes_saved = d_total_nodes - a_total_nodes
            pct_saved = (nodes_saved / d_total_nodes * 100) if d_total_nodes > 0 else 0
            
            time_diff = sim.d_cost_accumulated - sim.a_cost_accumulated
            time_saved_text = ""
            if sim.status == "ARRIVED":
                if time_diff > 0:
                    time_saved_text = f"<div style='color:#2ECC71; font-weight:bold;'>🏆 A* (Dynamic) reached hospital {time_diff:.2f} mins FASTER than Dijkstra under traffic!</div>"
                elif time_diff < 0:
                    time_saved_text = f"<div style='color:#E74C3C; font-weight:bold;'>🏆 Dijkstra (Static) reached hospital {-time_diff:.2f} mins FASTER! (Normal anomaly)</div>"
                else:
                    time_saved_text = "<div style='color:#FFFFFF; font-weight:bold;'>🏆 Both ambulances arrived at the exact same time.</div>"
            
            metrics_placeholder.markdown(f"""
            ### 📈 Head-to-Head Performance (Step {sim.steps_count})
            
            <div style='display: flex; gap: 10px; margin-bottom:15px;'>
                <div style='flex: 1; background-color: #1E1E1E; padding: 10px; border-radius: 8px; border: 1px solid #3498DB;'>
                    <span style='color: #3498DB; font-weight: bold;'>🔵 DIJKSTRA (Static)</span><br/>
                    • Actual Travel Time: <b>{sim.d_cost_accumulated:.2f} mins</b><br/>
                    • Initial Estimate: {st.session_state.metrics['dijkstra']['est_cost']:.2f} mins<br/>
                    • Search Nodes Visited: <b>{d_total_nodes} nodes</b><br/>
                    • Status: <span style='font-family:monospace;'>{sim.d_status}</span>
                </div>
                <div style='flex: 1; background-color: #1E1E1E; padding: 10px; border-radius: 8px; border: 1px solid #2ECC71;'>
                    <span style='color: #2ECC71; font-weight: bold;'>🟢 A* (Dynamic Heuristic)</span><br/>
                    • Actual Travel Time: <b>{sim.a_cost_accumulated:.2f} mins</b><br/>
                    • Initial Estimate: {st.session_state.metrics['astar']['est_cost']:.2f} mins<br/>
                    • Search Nodes Visited: <b>{a_total_nodes} nodes</b><br/>
                    • Status: <span style='font-family:monospace;'>{sim.a_status}</span>
                </div>
            </div>
            
            {time_saved_text}
            <div style='color:#F1C40F; font-weight:bold; margin-top:5px; margin-bottom:15px;'>
                ⚡ Heuristic Efficiency: A* searched {pct_saved:.1f}% fewer nodes ({nodes_saved} nodes saved) than Dijkstra.
            </div>
            """, unsafe_allow_html=True)
            
            # Update Live Logs
            log_events = "<br/>".join([f"&gt; {evt}" for evt in reversed(sim.traffic_events_history)])
            log_placeholder.markdown(f"""
            ### 📰 Live Dispatch Incident Logs
            <div class='incident-log'>
                {log_events if log_events else '&gt; Dispatched! Awaiting incident timeline updates...'}
            </div>
            """, unsafe_allow_html=True)
            
        # Draw initial simulation rendering
        update_renderings()
        
        # Render animation buttons
        if sim.status != "ARRIVED":
            if anim_controls_placeholder.button("🎬 Start Simulation Animation"):
                st.session_state.sim_running = True
                
                # Run the simulation loop
                while sim.status != "ARRIVED" and st.session_state.sim_running:
                    sim.step(
                        traffic_prob=traffic_prob, 
                        congestion_ratio=congestion_ratio,
                        blocking_ratio=blocking_ratio
                    )
                    update_renderings()
                    time.sleep(0.4)  # Fluid animation delay
                    
                st.session_state.sim_running = False
                st.rerun()  # Refresh button states when completed
        else:
            anim_controls_placeholder.success("🎉 Simulation Complete! Both ambulances have safely completed transport.")
            if st.button("⏹️ Reset Simulation"):
                reset_traffic(st.session_state.graph)
                st.session_state.simulation = None
                st.session_state.dijkstra_path = None
                st.session_state.astar_path = None
                st.session_state.metrics = None
                st.session_state.active_ambulance = None
                st.session_state.active_hospital = None
                st.session_state.emergency_node = None
                st.rerun()

# ==========================================
# MAIN EXECUTION DISPATCHER
# ==========================================

if __name__ == "__main__":
    # Check if running within a Streamlit environment
    import streamlit as st
    if st.runtime.exists():
        render_streamlit_app()
    else:
        run_cli_tests()
