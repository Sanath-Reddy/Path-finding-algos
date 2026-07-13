import time
from dijkstra import dijkstra

def hungarian_assign(cost_matrix):
    """
    Solves the linear sum assignment problem using the Hungarian (Kuhn-Munkres) algorithm.
    Returns: (col_ind, total_cost)
    where col_ind[i] is the column index matched to row i, and total_cost is the sum of costs.
    
    Tries to use scipy.optimize.linear_sum_assignment first, and falls back to a pure Python implementation.
    """
    try:
        from scipy.optimize import linear_sum_assignment
        import numpy as np
        row_ind, col_ind = linear_sum_assignment(np.array(cost_matrix))
        total_cost = sum(cost_matrix[i][col_ind[i]] for i in range(len(cost_matrix)))
        return [int(x) for x in col_ind], float(total_cost)
    except ImportError:
        # Standalone pure Python Hungarian algorithm solver for NxN matrix
        return _pure_python_hungarian(cost_matrix)

def _pure_python_hungarian(cost_matrix):
    """
    Pure Python Kuhn-Munkres (Hungarian) algorithm implementation for square matrices.
    """
    n = len(cost_matrix)
    # Convert to mutable float matrix
    grid = [[float(x) for x in row] for row in cost_matrix]
    
    # Step 1: Subtract row minimums
    for r in range(n):
        row_min = min(grid[r])
        for c in range(n):
            grid[r][c] -= row_min
            
    # Step 2: Subtract column minimums
    for c in range(n):
        col_min = min(grid[r][c] for r in range(n))
        for r in range(n):
            grid[r][c] -= col_min
            
    # Helper to find a perfect matching on zero-edges
    # Using simple Kuhn's algorithm for maximum bipartite matching
    matching = [-1] * n
    
    def try_match(u, visited, adj):
        for v in adj[u]:
            if not visited[v]:
                visited[v] = True
                if matching[v] < 0 or try_match(matching[v], visited, adj):
                    matching[v] = u
                    return True
        return False

    def get_max_matching(zero_grid):
        nonlocal matching
        matching = [-1] * n
        adj = []
        for r in range(n):
            neighbors = [c for c in range(n) if abs(zero_grid[r][c]) < 1e-9]
            adj.append(neighbors)
            
        matches_found = 0
        for r in range(n):
            visited = [False] * n
            if try_match(r, visited, adj):
                matches_found += 1
        return matches_found

    # Main Hungarian loop (alternating path / dual adjustments)
    # For small N (<= 4), we can also use a simple backtracking DFS if matching is not perfect
    # Let's implement full Hungarian steps:
    row_covered = [False] * n
    col_covered = [False] * n
    
    # We will do a standard vertex cover / adjustment loop
    max_iter = 100
    for _ in range(max_iter):
        # Find maximum matching in zeros
        match_count = get_max_matching(grid)
        if match_count == n:
            # We found a perfect matching of size N!
            # Col matching is in 'matching' array (where index is col, value is row)
            col_ind = [0] * n
            for c, r in enumerate(matching):
                col_ind[r] = c
            total_cost = sum(cost_matrix[i][col_ind[i]] for i in range(n))
            return col_ind, total_cost
            
        # If not perfect, construct the vertex cover
        # Mark all rows that do not have an assignment in matching
        row_assigned = [False] * n
        col_assigned = [False] * n
        for c in range(n):
            if matching[c] != -1:
                row_assigned[matching[c]] = True
                col_assigned[c] = True
                
        marked_rows = [not row_assigned[r] for r in range(n)]
        marked_cols = [False] * n
        
        # Iteratively mark columns having zeros in marked rows,
        # then mark rows assigned to marked columns
        changed = True
        while changed:
            changed = False
            # Mark cols
            for r in range(n):
                if marked_rows[r]:
                    for c in range(n):
                        if abs(grid[r][c]) < 1e-9 and not marked_cols[c]:
                            marked_cols[c] = True
                            changed = True
            # Mark rows
            for c in range(n):
                if marked_cols[c] and matching[c] != -1:
                    r = matching[c]
                    if not marked_rows[r]:
                        marked_rows[r] = True
                        changed = True
                        
        # Cover columns that are marked, and rows that are NOT marked
        row_covered = [not marked_rows[r] for r in range(n)]
        col_covered = marked_cols
        
        # Find the minimum uncovered element
        min_uncovered = float('inf')
        for r in range(n):
            for c in range(n):
                if not row_covered[r] and not col_covered[c]:
                    if grid[r][c] < min_uncovered:
                        min_uncovered = grid[r][c]
                        
        if min_uncovered == float('inf') or min_uncovered < 1e-9:
            break
            
        # Subtract min_uncovered from all uncovered elements,
        # and add it to double-covered elements
        for r in range(n):
            for c in range(n):
                if not row_covered[r] and not col_covered[c]:
                    grid[r][c] -= min_uncovered
                elif row_covered[r] and col_covered[c]:
                    grid[r][c] += min_uncovered
                    
    # Fallback in case of numerical or limit issues: simple greedy/backtracking match
    # Since N is tiny (e.g. 3 or 4), backtracking search is extremely fast
    best_matching = []
    best_cost = float('inf')
    
    def backtrack(r, current_assignment, current_cost, used_cols):
        nonlocal best_matching, best_cost
        if current_cost >= best_cost:
            return
        if r == n:
            best_cost = current_cost
            best_matching = list(current_assignment)
            return
        for c in range(n):
            if not used_cols[c]:
                used_cols[c] = True
                backtrack(r + 1, current_assignment + [c], current_cost + cost_matrix[r][c], used_cols)
                used_cols[c] = False
                
    backtrack(0, [], 0, [False] * n)
    return best_matching, best_cost


def build_dispatch_comparison(ambulances, emergencies, graph):
    """
    Computes matching comparison between ambulances and emergencies using:
    1. Greedy row-by-row matching
    2. Hungarian optimal bipartite matching
    """
    start_time = time.perf_counter()
    
    # 1. Build cost matrix (Dijkstra travel time from each ambulance to each emergency)
    # Rows: Ambulances, Cols: Emergencies
    cost_matrix = []
    ambulance_ids = [amb['id'] for amb in ambulances]
    emergency_labels = [f"Emergency {i+1} ({em['node']})" for i, em in enumerate(emergencies)]
    
    for amb in ambulances:
        row = []
        # Precompute Dijkstra from ambulance to all nodes
        from dijkstra import dijkstra_all
        d_res = dijkstra_all(graph, amb['current_node'])
        distances = d_res['distances']
        
        for em in emergencies:
            em_node_str = f"{em['node'][0]},{em['node'][1]}"
            time_to_reach = distances.get(em_node_str, float('inf'))
            # Fallback to absolute Euclidean distance if unreachable
            if time_to_reach == float('inf') or time_to_reach < 0:
                pos1 = graph.nodes[amb['current_node']]['pos']
                pos2 = graph.nodes[em['node']]['pos']
                time_to_reach = ((pos1[0] - pos2[0])**2 + (pos1[1] - pos2[1])**2)**0.5 * 10.0
            row.append(round(time_to_reach, 2))
        cost_matrix.append(row)
        
    n = len(cost_matrix)
    
    # 2. Greedy assignment (for each ambulance in order, pick the closest remaining emergency)
    greedy_assignment = [-1] * n
    greedy_cost = 0.0
    matched_emergencies = [False] * n
    for r in range(n):
        best_c = -1
        min_c_val = float('inf')
        for c in range(n):
            if not matched_emergencies[c]:
                if cost_matrix[r][c] < min_c_val:
                    min_c_val = cost_matrix[r][c]
                    best_c = c
        if best_c != -1:
            greedy_assignment[r] = best_c
            greedy_cost += min_c_val
            matched_emergencies[best_c] = True
            
    # 3. Hungarian optimal assignment
    hungarian_assignment, hungarian_cost = hungarian_assign(cost_matrix)
    
    end_time = time.perf_counter()
    execution_time_ms = (end_time - start_time) * 1000.0
    
    savings_pct = 0.0
    if greedy_cost > 0:
        savings_pct = round(((greedy_cost - hungarian_cost) / greedy_cost) * 100.0, 1)
        
    return {
        'cost_matrix': cost_matrix,
        'ambulance_ids': ambulance_ids,
        'emergency_labels': emergency_labels,
        'greedy_assignment': greedy_assignment,
        'greedy_cost': round(greedy_cost, 2),
        'hungarian_assignment': hungarian_assignment,
        'hungarian_cost': round(hungarian_cost, 2),
        'savings_pct': max(0.0, savings_pct),
        'execution_time_ms': round(execution_time_ms, 3)
    }
