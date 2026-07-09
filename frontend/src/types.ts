export interface GraphNode {
  id: string; // Serialized string "x,y"
  x: number;
  y: number;
  type: "intersection" | "hospital" | "ambulance";
}

export interface GraphEdge {
  source: string;
  target: string;
  base_weight: number;
  speed_limit: number;
  traffic_factor: number; // -1 signifies roadblock
  current_weight: number; // -1 signifies roadblock
  is_expressway: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Ambulance {
  id: string;
  current_node: [number, number]; // [x, y]
  available: boolean;
  type: "ALS" | "BLS";
}

export interface Hospital {
  id: string;
  node: [number, number]; // [x, y]
  beds: number;
  specialty: string;
  name: string;
}

export interface ActiveEmergency {
  node: string; // "x,y"
  priority: "Normal" | "Critical";
  specialty: "General" | "Trauma" | "Cardiac";
  status: "ACTIVE" | "RESOLVED";
}

export interface VehicleTelemetry {
  id: string;
  current_node: [number, number];
  status: "RESPONDING" | "TRANSPORTING" | "ARRIVED";
  path_to_emergency: string[];
  path_to_hospital: string[];
  segment_index: number;
  segment_progress: number; // 0.0 to 1.0
  x: number;
  y: number;
  angle: number; // rotation in degrees
  est_travel_time: number;
  accumulated_cost: number;
  nodes_explored: number;
  route_len: number;
}

export interface IncidentLog {
  time: string;
  msg: string;
}

export interface GlobalStats {
  resolved_count: number;
  avg_response_time: number;
  history: number[];
}

export interface TelemetryPayload {
  graph: GraphData;
  ambulances: Ambulance[];
  hospitals: Hospital[];
  active_emergency: ActiveEmergency | null;
  veh_a: VehicleTelemetry | null; // Dijkstra
  veh_b: VehicleTelemetry | null; // A*
  logs: IncidentLog[];
  global_stats: GlobalStats;
  speed_multiplier: number;
  is_paused: boolean;
}

export interface TrafficAlert {
  road: string;
  dijkstra_eta: number;
  astar_eta: number;
}
