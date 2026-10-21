
from astar import astar


def test_path_avoids_obstacle():
    grid = [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
    ]

    path = astar(grid, (0, 0), (0, 3))

    assert path is not None
    assert path[0] == (0, 0)
    assert path[-1] == (0, 3)
    assert all(grid[r][c] == 0 for r, c in path)
    print("PASS: route avoids blocked cells")


def test_no_route():
    grid = [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
    ]

    assert astar(grid, (0, 0), (0, 2)) is None
    print("PASS: impossible route returns None")


if __name__ == "__main__":
    test_path_avoids_obstacle()
    test_no_route()
