
import heapq
from math import hypot


def astar(grid, start, goal):
    """
    Find the shortest path on a 2D grid using A*.

    grid: 2D list; 0 = traversable, 1 = blocked.
    start, goal: (row, column) tuples.

    Returns a list of (row, column) waypoints, including
    start and goal, or None if no route exists.
    """
    rows = len(grid)

    if rows == 0:
        return None

    cols = len(grid[0])

    if cols == 0 or any(len(row) != cols for row in grid):
        raise ValueError("Grid must be rectangular and non-empty")

    def valid(cell):
        r, c = cell
        return (
                0 <= r < rows
                and 0 <= c < cols
                and grid[r][c] == 0
        )

    if not valid(start) or not valid(goal):
        return None

    def heuristic(cell):
        return hypot(goal[0] - cell[0], goal[1] - cell[1])

    open_heap = [(heuristic(start), 0.0, start)]
    came_from = {}
    g_score = {start: 0.0}
    closed = set()

    # Eight-direction movement, including diagonals.
    neighbors = [
        (-1, 0, 1.0),
        (1, 0, 1.0),
        (0, -1, 1.0),
        (0, 1, 1.0),
        (-1, -1, 2**0.5),
        (-1, 1, 2**0.5),
        (1, -1, 2**0.5),
        (1, 1, 2**0.5),
    ]

    while open_heap:
        _, current_g, current = heapq.heappop(open_heap)

        if current in closed or current_g > g_score.get(current, float("inf")):
            continue

        if current == goal:
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            return list(reversed(path))

        closed.add(current)

        for dr, dc, cost in neighbors:
            nxt = (current[0] + dr, current[1] + dc)

            if not valid(nxt) or nxt in closed:
                continue

            # Prevent diagonal movement through blocked corners.
            if dr != 0 and dc != 0:
                side_a = (current[0] + dr, current[1])
                side_b = (current[0], current[1] + dc)
                if not valid(side_a) or not valid(side_b):
                    continue

            tentative_g = g_score[current] + cost

            if tentative_g < g_score.get(nxt, float("inf")):
                came_from[nxt] = current
                g_score[nxt] = tentative_g
                heapq.heappush(
                    open_heap,
                    (tentative_g + heuristic(nxt), tentative_g, nxt),
                )

    return None
