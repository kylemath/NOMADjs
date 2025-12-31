# Quick Start Guide

This guide will help you get started with the Constrained Graph Coloring library.

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/GraphColouring.git
cd GraphColouring
```

2. **Create a virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

## Basic Usage

### Example 1: Simple Problem

```python
from src.core.problem import ConstrainedGraphColoringProblem
from src.core.algorithms import RandomRestartMonteCarlo

# Define node and detector positions
node_positions = [
    (0, 0, 0), (10, 0, 0), (20, 0, 0),
    (0, 10, 0), (10, 10, 0), (20, 10, 0)
]

detector_positions = [
    (5, 5, 0), (15, 5, 0)
]

# Create problem
problem = ConstrainedGraphColoringProblem.from_positions(
    node_positions=node_positions,
    detector_positions=detector_positions,
    n_colors=3,        # 3 time slots
    capacity=2,        # 2 nodes per slot
    max_distance=15.0  # Conflict distance
)

# Solve
solver = RandomRestartMonteCarlo(n_trials=100)
solution = solver.solve(problem, verbose=True)

# Check results
print(f"Colored: {solution.n_colored}/{len(node_positions)}")
print(f"Color assignment: {solution.coloring}")

# Validate
is_valid, violations = solution.validate(problem)
print(f"Valid: {is_valid}")
```

### Example 2: Run Pre-built Examples

```bash
# Optical imaging example
cd examples
python optical_imaging_example.py

# Wireless communication example
python wireless_communication_example.py

# Task scheduling example
python task_scheduling_example.py

# Visualization example
python visualization_example.py

# Benchmark comparison
python benchmark_example.py
```

## Understanding the Output

### Solution Object

```python
solution = solver.solve(problem)

# Basic info
print(solution.n_colored)      # Number of colored nodes
print(solution.n_uncolored)    # Number of uncolored nodes
print(solution.is_complete)    # True if all nodes colored

# Color assignments
print(solution.coloring)       # Dict: node_id -> color
print(solution.get_nodes_with_color(1))  # Nodes with color 1

# Statistics
stats = solution.compute_statistics()
print(stats['color_utilization'])  # How full each color is
print(stats['balance_std'])        # How balanced the coloring is
```

### Validation

```python
is_valid, violations = solution.validate(problem)

if not is_valid:
    print("Solution has violations:")
    for v in violations:
        print(f"  - {v}")
```

## Algorithm Comparison

```python
from src.core.algorithms import (
    RandomRestartMonteCarlo,
    DSATURColoring,
    GreedyRandomColoring
)

algorithms = [
    RandomRestartMonteCarlo(n_trials=1000),
    DSATURColoring(n_trials=100),
    GreedyRandomColoring(n_trials=100)
]

for algo in algorithms:
    solution = algo.solve(problem)
    print(f"{algo.__class__.__name__}: {solution.n_colored} colored")
```

## Visualization

```python
from src.visualization.plot import (
    plot_solution_3d,
    plot_solution_2d,
    plot_conflict_graph,
    plot_color_distribution
)

# 3D visualization (for 3D problems)
plot_solution_3d(problem, solution, show_detectors=True)

# 2D visualization (for 2D or 3D problems)
plot_solution_2d(problem, solution, show_conflicts=True)

# Conflict graph
plot_conflict_graph(problem, solution)

# Color distribution
plot_color_distribution(solution, problem)
```

## Benchmarking

```python
from src.benchmarks.benchmark import BenchmarkSuite
from src.benchmarks.generators import ProblemGenerator

# Create benchmark suite
suite = BenchmarkSuite()

# Generate test problems
problems = [
    (ProblemGenerator.random_3d_sphere(
        n_nodes=20, n_detectors=10, n_colors=5, 
        capacity=4, max_distance=50.0
    ), "Small_Problem"),
    
    (ProblemGenerator.random_2d_plane(
        n_nodes=30, n_detectors=15, n_colors=6,
        capacity=5, max_distance=200.0
    ), "Medium_Problem")
]

# Run benchmarks
suite.run_suite(
    problems=problems,
    algorithms=algorithms,
    n_runs=3,
    verbose=True
)

# View results
suite.print_summary()
suite.save_results('results.csv')

# Compare algorithms
df = suite.get_results_dataframe()
print(df)
```

## Creating Custom Problems

### From Positions

```python
problem = ConstrainedGraphColoringProblem.from_positions(
    node_positions=[(x1, y1, z1), ...],
    detector_positions=[(x1, y1, z1), ...],
    n_colors=k,
    capacity=c,
    max_distance=delta
)
```

### With Custom Distance Function

```python
def manhattan_distance(pos1, pos2):
    return sum(abs(a - b) for a, b in zip(pos1, pos2))

problem = ConstrainedGraphColoringProblem.from_positions(
    node_positions=node_pos,
    detector_positions=det_pos,
    n_colors=k,
    capacity=c,
    max_distance=delta,
    distance_func=manhattan_distance
)
```

### Using Node and Detector Objects

```python
from src.core.problem import Node, Detector

nodes = [
    Node(id=0, position=(0, 0, 0), metadata={'name': 'Node_A'}),
    Node(id=1, position=(10, 0, 0), metadata={'name': 'Node_B'}),
    # ...
]

detectors = [
    Detector(id=0, position=(5, 5, 0), metadata={'name': 'Det_1'}),
    # ...
]

problem = ConstrainedGraphColoringProblem(
    nodes=nodes,
    detectors=detectors,
    n_colors=k,
    capacity=c,
    max_distance=delta
)
```

## Tips for Best Results

1. **Number of trials**: More trials = better solutions
   - Start with 100 for small problems
   - Use 1000-10000 for important problems
   - Use parallel version for very large problems

2. **Algorithm selection**:
   - **Random Restart MC**: Best quality, use when time permits
   - **DSATUR**: Faster, good for real-time needs
   - **Greedy Random**: Simplest, good for easy problems

3. **Problem structure**:
   - Well-separated detectors → easier problems
   - Overlapping detector coverage → harder problems
   - Check conflict graph density: `problem.graph.number_of_edges()`

4. **Capacity constraints**:
   - Higher capacity → easier to color all nodes
   - Lower capacity → more challenging, may leave nodes uncolored
   - Ideal: `capacity * n_colors ≥ n_nodes`

## Troubleshooting

### Import Errors

If you get import errors, make sure you're in the right directory:
```python
import sys
sys.path.append('..')  # If running from examples/
```

Or install as a package:
```bash
pip install -e .
```

### Visualization Not Showing

Make sure matplotlib backend is set correctly:
```python
import matplotlib
matplotlib.use('TkAgg')  # or 'Qt5Agg'
import matplotlib.pyplot as plt
```

### Slow Performance

- Reduce `n_trials` for faster results
- Use `ParallelMonteCarlo` for multi-core speedup
- Check problem size: large graphs take longer

## Next Steps

- Read the [full documentation](README.md)
- Explore the [examples](examples/)
- Read the [research paper](paper/paper.pdf)
- Check out the [original NOMAD project](nomad/)

## Getting Help

- Open an issue on GitHub
- Email: kyle.mathewson@ualberta.ca
- Check the paper for theoretical background

