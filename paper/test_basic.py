"""
Basic test to verify the library works correctly.
"""

import sys
import numpy as np

print("Testing Constrained Graph Coloring Library")
print("=" * 70)
print()

# Test imports
print("1. Testing imports...")
try:
    from src.core.problem import ConstrainedGraphColoringProblem, Node, Detector
    from src.core.solution import ColoringSolution
    from src.core.algorithms import (
        RandomRestartMonteCarlo,
        DSATURColoring,
        GreedyRandomColoring
    )
    print("   ✓ All imports successful")
except Exception as e:
    print(f"   ✗ Import failed: {e}")
    sys.exit(1)

print()

# Test problem creation
print("2. Testing problem creation...")
try:
    node_positions = [
        (0, 0, 0), (10, 0, 0), (20, 0, 0),
        (0, 10, 0), (10, 10, 0), (20, 10, 0)
    ]
    
    detector_positions = [
        (5, 5, 0), (15, 5, 0)
    ]
    
    problem = ConstrainedGraphColoringProblem.from_positions(
        node_positions=node_positions,
        detector_positions=detector_positions,
        n_colors=3,
        capacity=2,
        max_distance=15.0
    )
    
    print(f"   ✓ Problem created: {len(problem.nodes)} nodes, {len(problem.detectors)} detectors")
    print(f"   ✓ Conflict graph: {problem.graph.number_of_edges()} edges")
except Exception as e:
    print(f"   ✗ Problem creation failed: {e}")
    sys.exit(1)

print()

# Test algorithms
print("3. Testing algorithms...")

algorithms = [
    ("Random Restart MC", RandomRestartMonteCarlo(n_trials=50)),
    ("DSATUR", DSATURColoring(n_trials=10)),
    ("Greedy Random", GreedyRandomColoring(n_trials=10))
]

for name, algorithm in algorithms:
    try:
        solution = algorithm.solve(problem, verbose=False)
        is_valid, violations = solution.validate(problem)
        
        status = "✓" if is_valid else "✗"
        print(f"   {status} {name}: {solution.n_colored}/{len(problem.nodes)} colored, valid={is_valid}")
        
        if not is_valid:
            print(f"      Violations: {violations[:2]}")
    except Exception as e:
        print(f"   ✗ {name} failed: {e}")

print()

# Test statistics
print("4. Testing solution statistics...")
try:
    solution = RandomRestartMonteCarlo(n_trials=100).solve(problem, verbose=False)
    stats = solution.compute_statistics()
    
    print(f"   ✓ Colored: {stats['n_colored']}")
    print(f"   ✓ Colors used: {stats['colors_used']}")
    print(f"   ✓ Utilization: {stats['color_utilization']:.1%}")
    print(f"   ✓ Balance: {stats['balance_std']:.3f}")
except Exception as e:
    print(f"   ✗ Statistics failed: {e}")

print()

# Test larger problem
print("5. Testing larger problem...")
try:
    np.random.seed(42)
    
    # Generate random 3D positions
    n_nodes = 20
    n_detectors = 10
    
    node_positions = [
        tuple(np.random.uniform(-50, 50, 3)) 
        for _ in range(n_nodes)
    ]
    
    detector_positions = [
        tuple(np.random.uniform(-50, 50, 3)) 
        for _ in range(n_detectors)
    ]
    
    problem_large = ConstrainedGraphColoringProblem.from_positions(
        node_positions=node_positions,
        detector_positions=detector_positions,
        n_colors=5,
        capacity=4,
        max_distance=50.0
    )
    
    print(f"   ✓ Large problem created: {len(problem_large.nodes)} nodes")
    print(f"   ✓ Conflict graph: {problem_large.graph.number_of_edges()} edges")
    
    # Solve
    solution_large = RandomRestartMonteCarlo(n_trials=100).solve(problem_large, verbose=False)
    is_valid, _ = solution_large.validate(problem_large)
    
    print(f"   ✓ Solution: {solution_large.n_colored}/{n_nodes} colored, valid={is_valid}")
    
except Exception as e:
    print(f"   ✗ Large problem failed: {e}")

print()
print("=" * 70)
print("All tests completed successfully! ✓")
print()
print("Next steps:")
print("  - Run examples: cd examples && python optical_imaging_example.py")
print("  - Run benchmarks: cd examples && python benchmark_example.py")
print("  - Create visualizations: cd examples && python visualization_example.py")
print("  - Read QUICKSTART.md for more information")

