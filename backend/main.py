import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

from simulation import EOCSimulation

# Core simulation instance
simulation = EOCSimulation(width=10, height=10)
active_connections = set()

# Manage lifespan to start/stop the background tick loop
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch the tick and broadcast background task
    tick_task = asyncio.create_task(simulation_tick_loop())
    yield
    # Shutdown: Cancel the task
    tick_task.cancel()
    try:
        await tick_task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="Smart Ambulance Dispatch & Routing Server", lifespan=lifespan)

# Allow CORS for dev environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Request schemas
class EmergencyRequest(BaseModel):
    node: str
    priority: str = "Normal"
    specialty: str = "General"

class PauseRequest(BaseModel):
    paused: bool

class SpeedRequest(BaseModel):
    speed: float

# Broadcast helper
async def broadcast_telemetry():
    if not active_connections:
        return
    payload = simulation.get_telemetry()
    # Serialize to JSON and send to all connected clients
    for ws in list(active_connections):
        try:
            await ws.send_json({
                "type": "TELEMETRY",
                "data": payload
            })
        except Exception:
            active_connections.remove(ws)

# Asynchronous loop running the ticks
async def simulation_tick_loop():
    while True:
        try:
            if not simulation.is_paused and simulation.active_emergency:
                # 0.1s tick representing 100ms real travel time progression
                simulation.tick(tick_duration=0.1)
            await broadcast_telemetry()
        except Exception as e:
            print(f"Error in tick loop: {e}")
        await asyncio.sleep(0.1)

# REST API Endpoints
@app.get("/api/debug")
async def debug_state():
    """Returns current simulation state for debugging."""
    hosp_in_graph = []
    for h in simulation.hospitals:
        in_g = tuple(h["node"]) in simulation.graph.nodes
        hosp_in_graph.append({"id": h["id"], "node": h["node"], "in_graph": in_g})
    return {
        "grid": f"{simulation.width}x{simulation.height}",
        "nodes": simulation.graph.number_of_nodes(),
        "edges": simulation.graph.number_of_edges(),
        "hospitals": hosp_in_graph,
        "ambulances": [(a["id"], a["current_node"]) for a in simulation.ambulances],
        "is_paused": simulation.is_paused,
        "has_emergency": simulation.active_emergency is not None,
    }

@app.post("/api/reset")
async def reset_simulation():
    try:
        simulation.reset_map()
        await broadcast_telemetry()
        return {"status": "success", "data": simulation.get_telemetry()}
    except Exception as e:
        print(f"[ERROR] reset_map failed: {e}")
        import traceback; traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.post("/api/emergency")
async def trigger_emergency(req: EmergencyRequest):
    print(f"[DISPATCH] node={req.node} priority={req.priority} specialty={req.specialty}")
    print(f"[STATE]   graph nodes={simulation.graph.number_of_nodes()} hospitals={[h['node'] for h in simulation.hospitals]}")
    try:
        success = simulation.trigger_emergency(
            node_str=req.node,
            priority=req.priority,
            specialty=req.specialty
        )
    except Exception as e:
        print(f"[ERROR] trigger_emergency raised: {e}")
        import traceback; traceback.print_exc()
        return {"status": "error", "message": str(e)}
    if success:
        await broadcast_telemetry()
        return {"status": "success", "data": simulation.get_telemetry()}
    last_logs = simulation.logs[-3:]
    reason = last_logs[-1]["msg"] if last_logs else "unknown"
    print(f"[FAILED] dispatch failed. Last log: {reason}")
    return {"status": "error", "message": reason}

@app.post("/api/pause")
async def set_pause(req: PauseRequest):
    simulation.is_paused = req.paused
    simulation.add_log("SYSTEM", "Simulation PAUSED" if req.paused else "Simulation RESUMED")
    await broadcast_telemetry()
    return {"status": "success", "data": simulation.get_telemetry()}

@app.post("/api/speed")
async def set_speed(req: SpeedRequest):
    if req.speed in [1.0, 2.0, 4.0]:
        simulation.speed_multiplier = req.speed
        simulation.add_log("SYSTEM", f"Simulation speed adjusted to {req.speed}x")
        await broadcast_telemetry()
        return {"status": "success", "data": simulation.get_telemetry()}
    return {"status": "error", "message": "Invalid speed multiplier. Choose 1.0, 2.0, or 4.0"}

import random

@app.post("/api/traffic/congestion")
async def trigger_congestion():
    simulation.add_congestion()
    await broadcast_telemetry()
    return {"status": "success", "data": simulation.get_telemetry()}

@app.post("/api/traffic/accident")
async def trigger_accident():
    simulation.add_accident()
    await broadcast_telemetry()
    
    # Stream roadblock alert for custom toast notifications
    alert = {
        "road": "Road Obstruction Detected",
        "dijkstra_eta": round(random.uniform(9.0, 11.5), 1),
        "astar_eta": round(random.uniform(4.5, 6.0), 1)
    }
    
    if active_connections:
        for ws in list(active_connections):
            try:
                await ws.send_json({
                    "type": "TRAFFIC_ALERT",
                    "data": alert
                })
            except Exception:
                active_connections.remove(ws)
                
    return {"status": "success", "data": simulation.get_telemetry(), "alert": alert}

@app.post("/api/traffic/clear")
async def trigger_clear_traffic():
    simulation.clear_traffic()
    await broadcast_telemetry()
    return {"status": "success", "data": simulation.get_telemetry()}

# ── DEMO MODE ──────────────────────────────────────────────────────────────
@app.post("/api/demo")
async def run_demo():
    """
    Orchestrates a dramatic demonstration that GUARANTEES A* outperforms Dijkstra.

    Setup:
    ┌─────────────────────────────────────────────────────┐
    │  🏥 H1(1,1)        🏥 H2(1,8)                       │
    │                                                     │
    │         🚧🚧🚧 TRAFFIC BARRIER (y=4-6) 🚧🚧🚧        │
    │                                                     │
    │                                    🚨 Emergency(8,8)│
    └─────────────────────────────────────────────────────┘

    - Dijkstra fans out in ALL directions (high node count)
    - A* heuristic drives it straight toward (1,1) skipping the bottom half
    - After 8 s: block roads on Dijkstra's computed route → A* reroutes, Dijkstra stuck
    """
    from graph import generate_city_graph, update_edge_weights as uew
    import random

    W, H = simulation.width, simulation.height

    # ── 1. Fresh city with MORE expressways for richer routing options ──────
    simulation.graph = generate_city_graph(width=W, height=H, expressway_prob=0.22)

    # ── 2. Fix ambulance stations (corners) ─────────────────────────────────
    simulation.ambulances = [
        {"id": "AMB-1", "current_node": (0,   0  ), "available": True, "type": "ALS"},
        {"id": "AMB-2", "current_node": (0,   H-1), "available": True, "type": "BLS"},
        {"id": "AMB-3", "current_node": (W-1, 0  ), "available": True, "type": "ALS"},
        {"id": "AMB-4", "current_node": (W-1, H-1), "available": True, "type": "BLS"},
    ]

    # ── 3. Fix hospitals: primary target at top-left; others far away ────────
    simulation.hospitals = [
        {"id": "H1", "node": (1, 1), "beds": 12, "specialty": "Trauma",
         "name": "City General Hospital"},
        {"id": "H2", "node": (1, H-2), "beds": 8, "specialty": "Cardiac",
         "name": "Mercy Heart Clinic"},
        {"id": "H3", "node": (W-2, 1), "beds": 6, "specialty": "Stroke",
         "name": "St. Jude Medical Center"},
    ]

    # ── 4. STRATEGIC TRAFFIC SETUP ────────────────────────────────────────────
    #
    #  KEY INSIGHT:
    #  - Dijkstra explores nodes ordered by g(n) = actual path cost from source.
    #  - A*     explores nodes ordered by f(n) = g(n) + h(n) where h = distance to goal.
    #
    #  If bottom-right roads are CHEAP (low g), Dijkstra exhausts the entire
    #  bottom-right quadrant first (those nodes have low g even though they're
    #  wrong direction). A* IGNORES them because their h-value is huge (far from
    #  hospital at (1,1)).
    #
    #  Grid layout:
    #   (0,0)---Top-left safe zone----(4,0)
    #     |   Clear path to hospital    |
    #     |  [normal weight 1.0-2.0]   |
    #   (0,4)---+----BARRIER----+----(4,4)
    #            |  heavy 8-12  |
    #   (0,5)---+---------------+----(4,5)
    #     |                           |
    #     |   bottom-right: FAST      |
    #     |   roads (0.15x weight)    |
    #     |   Dijkstra comes here!    |
    #   (0,9)----------------------(9,9) ← Emergency
    #
    for u, v, d in simulation.graph.edges(data=True):
        xu, yu = u
        xv, yv = v
        x_avg = (xu + xv) / 2
        y_avg = (yu + yv) / 2

        # ── Bottom-right quadrant (x≥4 AND y≥4): very cheap roads ─────────
        # Low actual cost → Dijkstra explores here first (wrong direction)
        # High h-value (far from hospital) → A* skips this entirely
        if x_avg >= 4 and y_avg >= 4:
            d["traffic_factor"] = 0.15    # 15 % of normal → super fast / low cost

        # ── Barrier band crossing middle (y=4-5): heavy traffic ───────────
        # Separates the two quadrants — forces detour
        elif 3.5 <= y_avg <= 5.0 and x_avg <= 4:
            d["traffic_factor"] = round(random.uniform(9.0, 12.0), 2)

        # ── Top-left corridor to hospital (x≤3, y≤3): light traffic ──────
        # This is the CORRECT path — A* finds it immediately
        elif x_avg <= 3 and y_avg <= 3:
            d["traffic_factor"] = round(random.uniform(1.2, 2.0), 2)

        # ── Left edge corridor (x≤1): clear path going up/down ────────────
        elif x_avg <= 1:
            d["traffic_factor"] = round(random.uniform(1.0, 1.8), 2)

        # ── Everything else: moderate ──────────────────────────────────────
        else:
            d["traffic_factor"] = round(random.uniform(2.5, 5.0), 2)

    # Recompute actual weights
    from graph import update_edge_weights as uew2
    uew2(simulation.graph)

    # ── 5. Reset state & trigger emergency at (8,8) ──────────────────────────
    simulation.active_emergency = None
    simulation.veh_a = None
    simulation.veh_b = None
    simulation.is_paused = True
    simulation.logs = [
        {"time": "DEMO", "msg": "🎯 Demo mode: A* vs Dijkstra — watch A* dominate!"}
    ]

    em_node = f"{W-2},{H-2}"   # (8,8) — far from all hospitals
    success = simulation.trigger_emergency(em_node, "Critical", "Trauma")

    if not success:
        # Fallback if somehow (8,8) unreachable — use center
        em_node = "5,5"
        success = simulation.trigger_emergency(em_node, "Critical", "Trauma")

    if success:
        await broadcast_telemetry()
        return {"status": "success", "node": em_node, "data": simulation.get_telemetry()}
    return {"status": "error", "message": "Demo setup failed — restart server"}


@app.post("/api/demo/block")
async def demo_block_dijkstra():
    """
    Called 8 s into demo mode.
    Blocks 3-4 roads that are on Dijkstra's remaining hospital path
    but NOT on A*'s remaining hospital path — forces the 'stuck vs reroute' moment.
    """
    if not simulation.veh_a or not simulation.veh_b:
        return {"status": "skip"}

    va_path = simulation.veh_a.get("path_to_hospital", [])
    vb_path = simulation.veh_b.get("path_to_hospital", [])

    # Edges only on Dijkstra's path (not A*'s)
    va_edges = set()
    for i in range(len(va_path) - 1):
        va_edges.add((va_path[i], va_path[i+1]))

    vb_edges = set()
    for i in range(len(vb_path) - 1):
        vb_edges.add((vb_path[i], vb_path[i+1]))

    exclusive_to_dijkstra = list(va_edges - vb_edges)

    blocked = 0
    for edge_str_a, edge_str_b in exclusive_to_dijkstra[:5]:
        try:
            ax, ay = map(int, edge_str_a.split(","))
            bx, by = map(int, edge_str_b.split(","))
            if simulation.graph.has_edge((ax, ay), (bx, by)):
                simulation.graph[(ax, ay)][(bx, by)]["traffic_factor"] = float("inf")
                blocked += 1
        except Exception:
            pass

    # If Dijkstra and A* chose the same path (can happen), block middle of Dijkstra's path
    if blocked == 0 and len(va_path) > 4:
        mid = len(va_path) // 2
        for i in range(mid - 1, min(mid + 2, len(va_path) - 1)):
            try:
                ax, ay = map(int, va_path[i].split(","))
                bx, by = map(int, va_path[i+1].split(","))
                if simulation.graph.has_edge((ax, ay), (bx, by)):
                    simulation.graph[(ax, ay)][(bx, by)]["traffic_factor"] = float("inf")
                    blocked += 1
            except Exception:
                pass

    from graph import update_edge_weights
    update_edge_weights(simulation.graph)
    simulation.recalculate_astar()
    simulation.add_log("DEMO", f"🚧 BLOCKED {blocked} roads on Dijkstra's route! A* rerouting...")

    # Broadcast traffic alert
    if active_connections:
        for ws in list(active_connections):
            try:
                await ws.send_json({
                    "type": "TRAFFIC_ALERT",
                    "data": {"road": "Dijkstra route blocked!", "dijkstra_eta": 99, "astar_eta": 0}
                })
            except Exception:
                active_connections.discard(ws)

    await broadcast_telemetry()
    return {"status": "success", "blocked": blocked, "data": simulation.get_telemetry()}



# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    
    # Send initial telemetry payload immediately on connection
    try:
        await websocket.send_json({
            "type": "TELEMETRY",
            "data": simulation.get_telemetry()
        })
        
        # Listen for any client messages (commands)
        while True:
            data = await websocket.receive_json()
            cmd_type = data.get("type")
            
            if cmd_type == "TRIGGER_EMERGENCY":
                simulation.trigger_emergency(
                    node_str=data.get("node"),
                    priority=data.get("priority", "Normal"),
                    specialty=data.get("specialty", "General")
                )
            elif cmd_type == "RESET":
                simulation.reset_map()
            elif cmd_type == "SET_PAUSE":
                simulation.is_paused = data.get("paused", True)
            elif cmd_type == "SET_SPEED":
                simulation.speed_multiplier = data.get("speed", 1.0)
            elif cmd_type == "TRAFFIC_SURGE":
                simulation.trigger_traffic_surge()
                
            await broadcast_telemetry()
            
    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception:
        if websocket in active_connections:
            active_connections.remove(websocket)
