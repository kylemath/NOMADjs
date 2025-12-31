"""
Example: Visualizing graph coloring solutions.
"""

import sys
sys.path.append('..')

from src.core.algorithms import RandomRestartMonteCarlo
from src.benchmarks.generators import ProblemGenerator
from src.visualization.plot import (
    plot_solution_3d,
    plot_solution_2d,
    plot_conflict_graph,
    plot_color_distribution
)


def main():
    """Run visualization examples."""
    print("=" * 70)
    print("Graph Coloring Visualization Examples")
    print("=" * 70)
    print()
    
    # Create a 3D problem
    print("Creating 3D problem (optical imaging scenario)...")
    problem_3d = ProblemGenerator.random_3d_sphere(
        n_nodes=32,
        n_detectors=15,
        n_colors=8,
        capacity=4,
        max_distance=50.0,
        seed=42
    )
    
    print(f"  Nodes: {len(problem_3d.nodes)}")
    print(f"  Detectors: {len(problem_3d.detectors)}")
    print(f"  Conflicts: {problem_3d.graph.number_of_edges()}")
    print()
    
    # Solve
    print("Solving with Random Restart Monte Carlo...")
    algorithm = RandomRestartMonteCarlo(n_trials=1000)
    solution_3d = algorithm.solve(problem_3d, verbose=False)
    
    print(f"  Colored: {solution_3d.n_colored}/{len(problem_3d.nodes)}")
    print()
    
    # Visualizations for 3D problem
    print("Generating 3D visualizations...")
    
    print("  1. 3D scatter plot with detectors...")
    plot_solution_3d(
        problem_3d,
        solution_3d,
        show_detectors=True,
        show_conflicts=False,
        title="3D Solution: Optical Imaging Multiplexing"
    )
    
    print("  2. Conflict graph...")
    plot_conflict_graph(
        problem_3d,
        solution_3d,
        layout='spring',
        title="Conflict Graph with Solution Coloring"
    )
    
    print("  3. Color distribution...")
    plot_color_distribution(
        solution_3d,
        problem_3d,
        title="Color Distribution Analysis"
    )
    
    # Create a 2D problem
    print("\nCreating 2D problem (wireless communication scenario)...")
    problem_2d = ProblemGenerator.random_2d_plane(
        n_nodes=25,
        n_detectors=12,
        n_colors=6,
        capacity=4,
        max_distance=250.0,
        area_size=1000.0,
        seed=42
    )
    
    print(f"  Nodes: {len(problem_2d.nodes)}")
    print(f"  Detectors: {len(problem_2d.detectors)}")
    print(f"  Conflicts: {problem_2d.graph.number_of_edges()}")
    print()
    
    # Solve
    print("Solving...")
    solution_2d = algorithm.solve(problem_2d, verbose=False)
    
    print(f"  Colored: {solution_2d.n_colored}/{len(problem_2d.nodes)}")
    print()
    
    # Visualizations for 2D problem
    print("Generating 2D visualizations...")
    
    print("  1. 2D scatter plot with conflict edges...")
    plot_solution_2d(
        problem_2d,
        solution_2d,
        show_detectors=True,
        show_conflicts=True,
        title="2D Solution: Wireless Channel Assignment"
    )
    
    print("\nAll visualizations complete!")
    print("\nNote: Close each plot window to see the next visualization.")


if __name__ == "__main__":
    main()

