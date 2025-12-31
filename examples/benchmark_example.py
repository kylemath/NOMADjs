"""
Example: Benchmarking different algorithms on various problem types.
"""

import sys
sys.path.append('..')

from src.core.algorithms import (
    RandomRestartMonteCarlo,
    DSATURColoring,
    GreedyRandomColoring
)
from src.benchmarks.benchmark import BenchmarkSuite
from src.benchmarks.generators import ProblemGenerator


def main():
    """Run comprehensive benchmark."""
    print("=" * 70)
    print("Constrained Graph Coloring Algorithm Benchmark")
    print("=" * 70)
    print()
    
    # Create benchmark suite
    suite = BenchmarkSuite()
    
    # Define test problems
    problems = []
    
    # Small problems
    print("Generating test problems...")
    
    problems.append((
        ProblemGenerator.random_3d_sphere(
            n_nodes=20, n_detectors=10, n_colors=5, capacity=4,
            max_distance=50.0, seed=42
        ),
        "Small_Sphere_20n_10d"
    ))
    
    problems.append((
        ProblemGenerator.random_2d_plane(
            n_nodes=20, n_detectors=8, n_colors=5, capacity=4,
            max_distance=200.0, seed=42
        ),
        "Small_Plane_20n_8d"
    ))
    
    # Medium problems
    problems.append((
        ProblemGenerator.random_3d_sphere(
            n_nodes=32, n_detectors=15, n_colors=8, capacity=4,
            max_distance=50.0, seed=42
        ),
        "Medium_Sphere_32n_15d"
    ))
    
    problems.append((
        ProblemGenerator.clustered_nodes(
            n_clusters=4, nodes_per_cluster=8, n_detectors=10,
            n_colors=8, capacity=4, max_distance=30.0, seed=42
        ),
        "Medium_Clustered_32n_10d"
    ))
    
    # Larger problems
    problems.append((
        ProblemGenerator.random_3d_sphere(
            n_nodes=50, n_detectors=20, n_colors=10, capacity=5,
            max_distance=50.0, seed=42
        ),
        "Large_Sphere_50n_20d"
    ))
    
    problems.append((
        ProblemGenerator.grid_layout(
            grid_size=7, n_detectors=15, n_colors=10, capacity=5,
            max_distance=25.0, seed=42
        ),
        "Large_Grid_49n_15d"
    ))
    
    print(f"Generated {len(problems)} test problems")
    print()
    
    # Define algorithms to test
    algorithms = [
        RandomRestartMonteCarlo(n_trials=500),
        DSATURColoring(n_trials=50),
        GreedyRandomColoring(n_trials=100)
    ]
    
    print(f"Testing {len(algorithms)} algorithms:")
    for algo in algorithms:
        print(f"  - {algo.__class__.__name__}")
    print()
    
    # Run benchmark suite
    suite.run_suite(
        problems=problems,
        algorithms=algorithms,
        n_runs=3,  # Average over 3 runs
        verbose=True
    )
    
    # Print summary
    suite.print_summary()
    
    # Save results
    suite.save_results('benchmark_results.csv')
    
    # Detailed comparisons
    print("\n" + "="*70)
    print("DETAILED COMPARISONS")
    print("="*70)
    
    print("\nNodes Colored (higher is better):")
    print("-"*70)
    print(suite.compare_algorithms(metric='n_colored'))
    
    print("\n\nExecution Time in seconds (lower is better):")
    print("-"*70)
    print(suite.compare_algorithms(metric='time_seconds'))
    
    print("\n\nColor Utilization (higher is better):")
    print("-"*70)
    print(suite.compare_algorithms(metric='color_utilization'))
    
    print("\n\nKey Findings:")
    print("-"*70)
    print("1. Random Restart Monte Carlo typically finds the best solutions")
    print("2. DSATUR is faster but may find slightly worse solutions")
    print("3. Performance depends on problem structure (clustered vs random)")
    print("4. All algorithms scale reasonably well to larger problems")


if __name__ == "__main__":
    main()

