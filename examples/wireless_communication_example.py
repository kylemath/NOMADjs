"""
Example: Wireless Communication Channel Assignment

This example demonstrates applying constrained graph coloring to wireless
communication, where transmitters must be assigned frequency channels to
avoid interference at receivers.
"""

import numpy as np
import sys
sys.path.append('..')

from src.core.problem import ConstrainedGraphColoringProblem
from src.core.algorithms import RandomRestartMonteCarlo


def generate_wireless_network(
    n_transmitters: int = 20,
    n_receivers: int = 10,
    area_size: float = 1000.0,
    seed: int = 42
) -> tuple:
    """
    Generate a 2D wireless network layout.
    
    Args:
        n_transmitters: Number of transmitters
        n_receivers: Number of receivers
        area_size: Size of the square area (meters)
        seed: Random seed
        
    Returns:
        Tuple of (transmitter_positions, receiver_positions)
    """
    np.random.seed(seed)
    
    # Random 2D positions
    transmitter_positions = [
        (np.random.uniform(0, area_size), np.random.uniform(0, area_size))
        for _ in range(n_transmitters)
    ]
    
    receiver_positions = [
        (np.random.uniform(0, area_size), np.random.uniform(0, area_size))
        for _ in range(n_receivers)
    ]
    
    return transmitter_positions, receiver_positions


def main():
    """Run wireless communication channel assignment example."""
    print("=" * 70)
    print("Wireless Communication Channel Assignment Example")
    print("=" * 70)
    print()
    
    # Problem parameters
    n_transmitters = 20
    n_receivers = 10
    n_channels = 5  # Available frequency channels
    capacity = 4    # Transmitters per channel (frequency reuse)
    interference_range = 300.0  # meters
    
    print(f"Problem Configuration:")
    print(f"  Transmitters: {n_transmitters}")
    print(f"  Receivers: {n_receivers}")
    print(f"  Frequency channels: {n_channels}")
    print(f"  Transmitters per channel: {capacity}")
    print(f"  Interference range: {interference_range} m")
    print()
    
    # Generate network layout
    print("Generating network layout...")
    transmitter_positions, receiver_positions = generate_wireless_network(
        n_transmitters=n_transmitters,
        n_receivers=n_receivers
    )
    
    # Create problem instance
    print("Building interference graph...")
    problem = ConstrainedGraphColoringProblem.from_positions(
        node_positions=transmitter_positions,
        detector_positions=receiver_positions,
        n_colors=n_channels,
        capacity=capacity,
        max_distance=interference_range
    )
    
    print(f"  Interference graph: {problem.graph.number_of_nodes()} nodes, "
          f"{problem.graph.number_of_edges()} edges")
    print(f"  Average degree: {2 * problem.graph.number_of_edges() / problem.graph.number_of_nodes():.2f}")
    print()
    
    # Solve
    print("Solving channel assignment problem...")
    algorithm = RandomRestartMonteCarlo(n_trials=1000)
    solution = algorithm.solve(problem, verbose=False)
    
    # Validate
    is_valid, violations = solution.validate(problem)
    stats = solution.compute_statistics()
    
    print(f"Result:")
    print(f"  Transmitters assigned: {solution.n_colored}/{n_transmitters}")
    print(f"  Channels used: {stats['colors_used']}/{n_channels}")
    print(f"  Avg transmitters per channel: {stats['avg_nodes_per_color']:.2f}")
    print(f"  Channel utilization: {stats['color_utilization']:.1%}")
    print(f"  Valid assignment: {is_valid}")
    print()
    
    # Show channel assignments
    print("Channel Assignments:")
    print("-" * 70)
    
    for channel in range(1, n_channels + 1):
        transmitters = solution.get_nodes_with_color(channel)
        if transmitters:
            print(f"  Channel {channel}: Transmitters {transmitters}")
    
    if solution.uncolored_nodes:
        print(f"  Unassigned: Transmitters {solution.uncolored_nodes}")
        print()
        print("Note: Unassigned transmitters may need additional channels")
        print("or could be scheduled in a different time slot.")
    
    print()
    print("This solution ensures no two transmitters on the same channel")
    print("interfere at any receiver, maximizing spectrum efficiency.")


if __name__ == "__main__":
    main()

