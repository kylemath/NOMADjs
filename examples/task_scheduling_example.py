"""
Example: Task Scheduling with Resource Conflicts

This example demonstrates applying constrained graph coloring to task
scheduling, where tasks must be assigned to time slots while respecting
resource conflicts.
"""

import numpy as np
import sys
sys.path.append('..')

from src.core.problem import Node, Detector, ConstrainedGraphColoringProblem
from src.core.algorithms import RandomRestartMonteCarlo


def create_task_scheduling_problem():
    """
    Create a task scheduling problem.
    
    Tasks need to be scheduled into time slots, where tasks conflict if
    they require the same resource (processor, memory bank, I/O device).
    
    Returns:
        ConstrainedGraphColoringProblem instance
    """
    # Define tasks (nodes)
    # Each task has a set of required resources
    tasks = [
        Node(id=0, metadata={'name': 'Task_A', 'resources': [0, 1]}),
        Node(id=1, metadata={'name': 'Task_B', 'resources': [0, 2]}),
        Node(id=2, metadata={'name': 'Task_C', 'resources': [1, 2]}),
        Node(id=3, metadata={'name': 'Task_D', 'resources': [0]}),
        Node(id=4, metadata={'name': 'Task_E', 'resources': [1]}),
        Node(id=5, metadata={'name': 'Task_F', 'resources': [2]}),
        Node(id=6, metadata={'name': 'Task_G', 'resources': [0, 1, 2]}),
        Node(id=7, metadata={'name': 'Task_H', 'resources': [1, 2]}),
        Node(id=8, metadata={'name': 'Task_I', 'resources': [0, 2]}),
        Node(id=9, metadata={'name': 'Task_J', 'resources': [0, 1]}),
    ]
    
    # Define resources (detectors)
    # Tasks conflict if they both require the same resource
    resources = [
        Detector(id=0, metadata={'name': 'Processor_1'}),
        Detector(id=1, metadata={'name': 'Processor_2'}),
        Detector(id=2, metadata={'name': 'I/O_Device'}),
    ]
    
    # Custom conflict function: tasks conflict if they share any resource
    def resource_conflict_distance(task_resources, resource_id):
        """
        Return 0 if task requires resource, infinity otherwise.
        This makes tasks that require the same resource conflict.
        """
        if resource_id in task_resources:
            return 0.0
        return float('inf')
    
    # Build problem with custom distance function
    problem = ConstrainedGraphColoringProblem(
        nodes=tasks,
        detectors=resources,
        n_colors=4,  # 4 time slots
        capacity=3,  # Up to 3 tasks per time slot
        max_distance=0.0,  # Tasks conflict if distance = 0
        distance_func=lambda t, r: 0.0 if r in t else float('inf')
    )
    
    # Override distance matrix with resource requirements
    for i, task in enumerate(tasks):
        for j, resource in enumerate(resources):
            if resource.id in task.metadata['resources']:
                problem.distance_matrix[i, j] = 0.0
            else:
                problem.distance_matrix[i, j] = float('inf')
    
    # Rebuild conflict graph with new distances
    problem._build_conflict_graph()
    problem._build_detector_node_map()
    
    return problem, tasks, resources


def main():
    """Run task scheduling example."""
    print("=" * 70)
    print("Task Scheduling with Resource Conflicts Example")
    print("=" * 70)
    print()
    
    # Create problem
    problem, tasks, resources = create_task_scheduling_problem()
    
    print(f"Problem Configuration:")
    print(f"  Tasks: {len(tasks)}")
    print(f"  Resources: {len(resources)}")
    print(f"  Time slots: {problem.n_colors}")
    print(f"  Tasks per slot: {problem.capacity}")
    print()
    
    # Show task resource requirements
    print("Task Resource Requirements:")
    print("-" * 70)
    for task in tasks:
        resource_names = [
            resources[r].metadata['name'] 
            for r in task.metadata['resources']
        ]
        print(f"  {task.metadata['name']}: {', '.join(resource_names)}")
    print()
    
    print(f"Conflict Graph:")
    print(f"  Nodes: {problem.graph.number_of_nodes()}")
    print(f"  Edges: {problem.graph.number_of_edges()}")
    print(f"  Average degree: {2 * problem.graph.number_of_edges() / problem.graph.number_of_nodes():.2f}")
    print()
    
    # Solve
    print("Solving scheduling problem...")
    algorithm = RandomRestartMonteCarlo(n_trials=1000)
    solution = algorithm.solve(problem, verbose=False)
    
    # Validate
    is_valid, violations = solution.validate(problem)
    stats = solution.compute_statistics()
    
    print(f"Result:")
    print(f"  Tasks scheduled: {solution.n_colored}/{len(tasks)}")
    print(f"  Time slots used: {stats['colors_used']}/{problem.n_colors}")
    print(f"  Avg tasks per slot: {stats['avg_nodes_per_color']:.2f}")
    print(f"  Slot utilization: {stats['color_utilization']:.1%}")
    print(f"  Valid schedule: {is_valid}")
    print()
    
    # Show schedule
    print("Task Schedule:")
    print("=" * 70)
    
    for time_slot in range(1, problem.n_colors + 1):
        task_ids = solution.get_nodes_with_color(time_slot)
        if task_ids:
            print(f"\nTime Slot {time_slot}:")
            print("-" * 70)
            
            for task_id in task_ids:
                task = tasks[task_id]
                resource_names = [
                    resources[r].metadata['name'] 
                    for r in task.metadata['resources']
                ]
                print(f"  {task.metadata['name']}: {', '.join(resource_names)}")
    
    if solution.uncolored_nodes:
        print(f"\nUnscheduled Tasks:")
        print("-" * 70)
        for task_id in solution.uncolored_nodes:
            task = tasks[task_id]
            print(f"  {task.metadata['name']}")
        print()
        print("Note: Unscheduled tasks need additional time slots or")
        print("may require resource allocation adjustments.")
    
    print()
    print("This schedule ensures no resource conflicts occur within")
    print("any time slot, maximizing parallel task execution.")


if __name__ == "__main__":
    main()

