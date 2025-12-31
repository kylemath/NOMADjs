"""
Graph coloring algorithms for constrained coloring problems.

This module implements several algorithms for solving constrained graph
coloring problems with capacity constraints:

Classical Heuristics:
- DSATUR (Degree of Saturation) - Brélaz 1979
- Largest First (LF) - Welsh & Powell 1967
- Greedy with Random Ordering

Metaheuristics:
- Random Restart Monte Carlo
- Tabu Search (TabuCol variant)
- Simulated Annealing
- Iterated Local Search (ILS)
- Parallel Monte Carlo

Note on Deep Learning Approaches:
Recent work (2020-2024) has shown promise for GNN-based and 
reinforcement learning approaches to graph coloring. See:
- Deep k-Grouping Framework (2025)
- GNN-based Graph Coloring (Lemos et al. 2019)
- Deep RL for Combinatorial Optimization (Khalil et al. 2017)
These are not implemented here but discussed in the paper.
"""

import numpy as np
import math
from typing import List, Optional, Dict, Set, Tuple
from abc import ABC, abstractmethod
import random
from concurrent.futures import ProcessPoolExecutor
from tqdm import tqdm
from collections import defaultdict

from .problem import ConstrainedGraphColoringProblem
from .solution import ColoringSolution, create_empty_solution


class ColoringAlgorithm(ABC):
    """Abstract base class for graph coloring algorithms."""
    
    @abstractmethod
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """
        Solve the constrained graph coloring problem.
        
        Args:
            problem: Problem instance to solve
            verbose: Whether to print progress information
            
        Returns:
            ColoringSolution instance
        """
        pass


class RandomRestartMonteCarlo(ColoringAlgorithm):
    """
    Random restart Monte Carlo algorithm for constrained graph coloring.
    
    This algorithm performs multiple trials of randomized greedy coloring,
    keeping the best solution found. It's surprisingly effective for this
    problem class, often outperforming more sophisticated heuristics.
    
    Algorithm:
    1. Randomly order detectors
    2. For each detector, randomly order its nodes
    3. Greedily assign colors to nodes, checking conflicts
    4. If a node can't be colored, leave it uncolored
    5. Repeat for n_trials, keeping the best solution
    
    Attributes:
        n_trials: Number of random trials to perform
        seed: Random seed for reproducibility
    """
    
    def __init__(self, n_trials: int = 10000, seed: Optional[int] = None):
        """
        Initialize the Random Restart Monte Carlo algorithm.
        
        Args:
            n_trials: Number of random trials to perform
            seed: Random seed for reproducibility
        """
        self.n_trials = n_trials
        self.seed = seed
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
    
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """Solve using random restart Monte Carlo."""
        best_solution = None
        best_uncolored = len(problem.nodes) + 1
        
        iterator = range(self.n_trials)
        if verbose:
            iterator = tqdm(iterator, desc="Monte Carlo trials")
        
        for trial in iterator:
            solution = self._single_trial(problem)
            
            if solution.n_uncolored < best_uncolored:
                best_uncolored = solution.n_uncolored
                best_solution = solution
                
                if verbose:
                    print(f"Trial {trial}: Found solution with {solution.n_colored} colored nodes")
                
                # Early exit if perfect solution found
                if solution.is_complete:
                    if verbose:
                        print(f"Perfect solution found at trial {trial}")
                    break
        
        best_solution.metadata['n_trials'] = trial + 1
        best_solution.metadata['algorithm'] = 'RandomRestartMonteCarlo'
        
        return best_solution
    
    def _single_trial(
        self, 
        problem: ConstrainedGraphColoringProblem
    ) -> ColoringSolution:
        """Perform a single randomized trial."""
        # Initialize solution
        node_ids = [node.id for node in problem.nodes]
        coloring = {node_id: 0 for node_id in node_ids}
        
        # Create available color list (with capacity duplicates)
        available_colors = []
        for color in range(1, problem.n_colors + 1):
            available_colors.extend([color] * problem.capacity)
        random.shuffle(available_colors)
        
        # Track which colors are available for each detector
        detector_available = {}
        for detector in problem.detectors:
            detector_available[detector.id] = set(range(1, problem.n_colors + 1))
        
        # Randomize detector order
        detector_order = list(range(len(problem.detectors)))
        random.shuffle(detector_order)
        
        # Process each detector
        for det_idx in detector_order:
            detector = problem.detectors[det_idx]
            nodes_in_range = problem.nodes_within_detector(detector.id)
            
            # Randomize node order for this detector
            random.shuffle(nodes_in_range)
            
            # Try to color each uncolored node
            for node_id in nodes_in_range:
                if coloring[node_id] == 0:  # Not yet colored
                    # Find first available color that doesn't conflict
                    color_assigned = False
                    for i, color in enumerate(available_colors):
                        if self._can_assign_color(
                            node_id, color, coloring, problem
                        ):
                            coloring[node_id] = color
                            available_colors.pop(i)
                            
                            # Update detector availability
                            for det in problem.detectors:
                                if node_id in problem.nodes_within_detector(det.id):
                                    detector_available[det.id].discard(color)
                            
                            color_assigned = True
                            break
                    
                    if not color_assigned:
                        # Node couldn't be colored
                        pass
        
        # Identify uncolored nodes
        uncolored = [node_id for node_id, color in coloring.items() if color == 0]
        
        return ColoringSolution(
            coloring=coloring,
            n_colors=problem.n_colors,
            capacity=problem.capacity,
            uncolored_nodes=uncolored
        )
    
    def _can_assign_color(
        self,
        node_id: int,
        color: int,
        coloring: Dict[int, int],
        problem: ConstrainedGraphColoringProblem
    ) -> bool:
        """Check if a color can be assigned to a node without conflicts."""
        # Check all neighbors
        neighbors = problem.get_neighbors(node_id)
        for neighbor_id in neighbors:
            if coloring.get(neighbor_id, 0) == color:
                return False
        return True


class DSATURColoring(ColoringAlgorithm):
    """
    DSATUR (Degree of Saturation) algorithm with capacity constraints.
    
    DSATUR is a well-known graph coloring heuristic that prioritizes nodes
    with the most constrained color choices. This implementation is modified
    to handle capacity constraints.
    
    Algorithm:
    1. Start with the highest degree node
    2. Color it with the first available color
    3. Select next node with highest saturation degree (most unique neighbor colors)
    4. In case of tie, select node with highest degree
    5. Repeat until all nodes are colored or no valid coloring exists
    
    Attributes:
        n_trials: Number of trials with different random tie-breaking
        seed: Random seed for reproducibility
    """
    
    def __init__(self, n_trials: int = 100, seed: Optional[int] = None):
        """
        Initialize DSATUR algorithm.
        
        Args:
            n_trials: Number of trials with random tie-breaking
            seed: Random seed for reproducibility
        """
        self.n_trials = n_trials
        self.seed = seed
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
    
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """Solve using DSATUR algorithm."""
        best_solution = None
        best_uncolored = len(problem.nodes) + 1
        
        iterator = range(self.n_trials)
        if verbose:
            iterator = tqdm(iterator, desc="DSATUR trials")
        
        for trial in iterator:
            solution = self._single_trial(problem)
            
            if solution.n_uncolored < best_uncolored:
                best_uncolored = solution.n_uncolored
                best_solution = solution
                
                if solution.is_complete:
                    if verbose:
                        print(f"Perfect solution found at trial {trial}")
                    break
        
        best_solution.metadata['n_trials'] = trial + 1
        best_solution.metadata['algorithm'] = 'DSATUR'
        
        return best_solution
    
    def _single_trial(
        self, 
        problem: ConstrainedGraphColoringProblem
    ) -> ColoringSolution:
        """Perform a single DSATUR trial."""
        node_ids = [node.id for node in problem.nodes]
        n_nodes = len(node_ids)
        
        coloring = {node_id: 0 for node_id in node_ids}
        
        # Create available color list (with capacity)
        available_colors = []
        for color in range(1, problem.n_colors + 1):
            available_colors.extend([color] * problem.capacity)
        random.shuffle(available_colors)
        
        # Compute degrees
        degrees = {node_id: problem.get_degree(node_id) for node_id in node_ids}
        
        # Saturation degrees (number of unique colors in neighborhood)
        saturation = {node_id: 0 for node_id in node_ids}
        
        # Color nodes one by one
        for _ in range(n_nodes):
            # Find uncolored nodes
            uncolored = [nid for nid in node_ids if coloring[nid] == 0]
            
            if not uncolored:
                break
            
            # Select node with highest saturation, breaking ties by degree
            node_id = max(
                uncolored,
                key=lambda nid: (saturation[nid], degrees[nid], random.random())
            )
            
            # Find first available color
            neighbors = problem.get_neighbors(node_id)
            neighbor_colors = {coloring[nid] for nid in neighbors if coloring[nid] > 0}
            
            color_assigned = False
            for i, color in enumerate(available_colors):
                if color not in neighbor_colors:
                    coloring[node_id] = color
                    available_colors.pop(i)
                    color_assigned = True
                    
                    # Update saturation of neighbors
                    for neighbor_id in neighbors:
                        if coloring[neighbor_id] == 0:
                            neighbor_neighbor_colors = {
                                coloring[nid] 
                                for nid in problem.get_neighbors(neighbor_id)
                                if coloring[nid] > 0
                            }
                            saturation[neighbor_id] = len(neighbor_neighbor_colors)
                    
                    break
            
            if not color_assigned:
                # Can't color this node
                pass
        
        uncolored = [node_id for node_id, color in coloring.items() if color == 0]
        
        return ColoringSolution(
            coloring=coloring,
            n_colors=problem.n_colors,
            capacity=problem.capacity,
            uncolored_nodes=uncolored
        )


class GreedyRandomColoring(ColoringAlgorithm):
    """
    Simple greedy coloring with randomized node ordering.
    
    This is the simplest approach: order nodes randomly and greedily
    assign the first available color to each node.
    
    Attributes:
        n_trials: Number of trials with different random orderings
        seed: Random seed for reproducibility
    """
    
    def __init__(self, n_trials: int = 1000, seed: Optional[int] = None):
        """
        Initialize greedy random coloring.
        
        Args:
            n_trials: Number of trials with different orderings
            seed: Random seed for reproducibility
        """
        self.n_trials = n_trials
        self.seed = seed
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
    
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """Solve using greedy random coloring."""
        best_solution = None
        best_uncolored = len(problem.nodes) + 1
        
        iterator = range(self.n_trials)
        if verbose:
            iterator = tqdm(iterator, desc="Greedy trials")
        
        for trial in iterator:
            solution = self._single_trial(problem)
            
            if solution.n_uncolored < best_uncolored:
                best_uncolored = solution.n_uncolored
                best_solution = solution
                
                if solution.is_complete:
                    if verbose:
                        print(f"Perfect solution found at trial {trial}")
                    break
        
        best_solution.metadata['n_trials'] = trial + 1
        best_solution.metadata['algorithm'] = 'GreedyRandom'
        
        return best_solution
    
    def _single_trial(
        self, 
        problem: ConstrainedGraphColoringProblem
    ) -> ColoringSolution:
        """Perform a single greedy trial."""
        node_ids = [node.id for node in problem.nodes]
        random.shuffle(node_ids)
        
        coloring = {node_id: 0 for node_id in node_ids}
        
        # Create available color list
        available_colors = []
        for color in range(1, problem.n_colors + 1):
            available_colors.extend([color] * problem.capacity)
        random.shuffle(available_colors)
        
        # Color each node greedily
        for node_id in node_ids:
            neighbors = problem.get_neighbors(node_id)
            neighbor_colors = {coloring[nid] for nid in neighbors if coloring[nid] > 0}
            
            # Find first available color
            for i, color in enumerate(available_colors):
                if color not in neighbor_colors:
                    coloring[node_id] = color
                    available_colors.pop(i)
                    break
        
        uncolored = [node_id for node_id, color in coloring.items() if color == 0]
        
        return ColoringSolution(
            coloring=coloring,
            n_colors=problem.n_colors,
            capacity=problem.capacity,
            uncolored_nodes=uncolored
        )


class ParallelMonteCarlo(ColoringAlgorithm):
    """
    Parallel version of Random Restart Monte Carlo.
    
    Uses multiprocessing to run multiple trials in parallel,
    significantly speeding up the search for large problems.
    
    Attributes:
        n_trials: Total number of trials to perform
        n_workers: Number of parallel workers (defaults to CPU count)
        seed: Random seed for reproducibility
    """
    
    def __init__(
        self, 
        n_trials: int = 10000,
        n_workers: Optional[int] = None,
        seed: Optional[int] = None
    ):
        """
        Initialize parallel Monte Carlo.
        
        Args:
            n_trials: Total number of trials
            n_workers: Number of parallel workers (None = CPU count)
            seed: Random seed for reproducibility
        """
        self.n_trials = n_trials
        self.n_workers = n_workers
        self.seed = seed
    
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """Solve using parallel Monte Carlo."""
        # Create base algorithm
        base_algo = RandomRestartMonteCarlo(n_trials=1, seed=self.seed)
        
        best_solution = None
        best_uncolored = len(problem.nodes) + 1
        
        # Run trials in parallel
        with ProcessPoolExecutor(max_workers=self.n_workers) as executor:
            futures = [
                executor.submit(base_algo._single_trial, problem)
                for _ in range(self.n_trials)
            ]
            
            iterator = futures
            if verbose:
                from concurrent.futures import as_completed
                iterator = tqdm(
                    as_completed(futures),
                    total=self.n_trials,
                    desc="Parallel trials"
                )
            
            for future in iterator:
                solution = future.result()
                
                if solution.n_uncolored < best_uncolored:
                    best_uncolored = solution.n_uncolored
                    best_solution = solution
                    
                    if solution.is_complete:
                        if verbose:
                            print("Perfect solution found")
                        # Cancel remaining futures
                        for f in futures:
                            f.cancel()
                        break
        
        best_solution.metadata['n_trials'] = self.n_trials
        best_solution.metadata['algorithm'] = 'ParallelMonteCarlo'
        
        return best_solution


class LargestFirstColoring(ColoringAlgorithm):
    """
    Largest First (LF) ordering heuristic - Welsh & Powell 1967.
    
    A classic deterministic approach that orders nodes by decreasing
    degree before applying greedy coloring. Simple but effective baseline.
    
    Algorithm:
    1. Sort nodes by degree (descending)
    2. Greedily assign smallest available color to each node
    
    Attributes:
        seed: Random seed for tie-breaking reproducibility
    """
    
    def __init__(self, seed: Optional[int] = None):
        """Initialize Largest First coloring."""
        self.seed = seed
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
    
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """Solve using largest first ordering."""
        node_ids = [node.id for node in problem.nodes]
        
        # Sort by degree (descending), with random tie-breaking
        degrees = {nid: problem.get_degree(nid) for nid in node_ids}
        sorted_nodes = sorted(
            node_ids, 
            key=lambda nid: (-degrees[nid], random.random())
        )
        
        coloring = {node_id: 0 for node_id in node_ids}
        
        # Track color usage for capacity
        color_usage = defaultdict(int)
        
        # Color each node greedily
        for node_id in sorted_nodes:
            neighbors = problem.get_neighbors(node_id)
            neighbor_colors = {coloring[nid] for nid in neighbors if coloring[nid] > 0}
            
            # Find first available color with capacity
            for color in range(1, problem.n_colors + 1):
                if color not in neighbor_colors and color_usage[color] < problem.capacity:
                    coloring[node_id] = color
                    color_usage[color] += 1
                    break
        
        uncolored = [nid for nid, c in coloring.items() if c == 0]
        
        solution = ColoringSolution(
            coloring=coloring,
            n_colors=problem.n_colors,
            capacity=problem.capacity,
            uncolored_nodes=uncolored
        )
        solution.metadata['algorithm'] = 'LargestFirst'
        
        return solution


class TabuSearchColoring(ColoringAlgorithm):
    """
    Tabu Search for graph coloring (TabuCol variant).
    
    A local search metaheuristic that uses memory (tabu list) to 
    avoid revisiting recent solutions. Effective for hard instances.
    
    Algorithm:
    1. Start with a greedy initial solution
    2. Iteratively move to neighbor solution (swap colors)
    3. Maintain tabu list of recently changed (node, color) pairs
    4. Accept moves that improve or are non-tabu
    5. Track best solution found
    
    References:
    - Hertz & de Werra (1987) "Using tabu search techniques for graph coloring"
    
    Attributes:
        max_iterations: Maximum iterations
        tabu_tenure: Number of iterations a move stays tabu
        seed: Random seed for reproducibility
    """
    
    def __init__(
        self, 
        max_iterations: int = 5000,
        tabu_tenure: int = 7,
        seed: Optional[int] = None
    ):
        """Initialize Tabu Search."""
        self.max_iterations = max_iterations
        self.tabu_tenure = tabu_tenure
        self.seed = seed
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
    
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """Solve using Tabu Search."""
        # Get initial solution using greedy
        greedy = GreedyRandomColoring(n_trials=10, seed=self.seed)
        current = greedy.solve(problem, verbose=False)
        
        best_solution = current
        best_conflicts = self._count_conflicts(current, problem)
        
        # Tabu list: (node_id, color) -> iteration when it becomes non-tabu
        tabu_list: Dict[Tuple[int, int], int] = {}
        
        # Track color usage
        color_usage = defaultdict(int)
        for nid, c in current.coloring.items():
            if c > 0:
                color_usage[c] += 1
        
        iterator = range(self.max_iterations)
        if verbose:
            iterator = tqdm(iterator, desc="Tabu Search")
        
        for iteration in iterator:
            # Find best non-tabu move
            best_move = None
            best_move_delta = float('inf')
            
            # Try swapping colors for conflicting nodes
            for node_id, color in current.coloring.items():
                if color == 0:
                    continue
                    
                neighbors = problem.get_neighbors(node_id)
                current_conflicts = sum(
                    1 for n in neighbors if current.coloring.get(n, 0) == color
                )
                
                # Try each alternative color
                for new_color in range(1, problem.n_colors + 1):
                    if new_color == color:
                        continue
                    
                    # Check capacity
                    if color_usage[new_color] >= problem.capacity:
                        continue
                    
                    # Check if tabu (unless aspiration criterion met)
                    is_tabu = tabu_list.get((node_id, new_color), 0) > iteration
                    
                    # Count new conflicts
                    new_conflicts = sum(
                        1 for n in neighbors if current.coloring.get(n, 0) == new_color
                    )
                    
                    delta = new_conflicts - current_conflicts
                    
                    # Aspiration: accept if better than best known
                    total_after = best_conflicts + delta
                    aspiration_met = total_after < best_conflicts
                    
                    if (not is_tabu or aspiration_met) and delta < best_move_delta:
                        best_move = (node_id, color, new_color)
                        best_move_delta = delta
            
            if best_move is None:
                break
            
            # Apply best move
            node_id, old_color, new_color = best_move
            new_coloring = current.coloring.copy()
            new_coloring[node_id] = new_color
            
            # Update color usage
            color_usage[old_color] -= 1
            color_usage[new_color] += 1
            
            # Add to tabu list
            tabu_list[(node_id, old_color)] = iteration + self.tabu_tenure
            
            current = ColoringSolution(
                coloring=new_coloring,
                n_colors=problem.n_colors,
                capacity=problem.capacity,
                uncolored_nodes=[nid for nid, c in new_coloring.items() if c == 0]
            )
            
            # Update best
            current_conflicts = self._count_conflicts(current, problem)
            if current_conflicts < best_conflicts:
                best_solution = current
                best_conflicts = current_conflicts
                
                if best_conflicts == 0 and current.is_complete:
                    break
        
        best_solution.metadata['algorithm'] = 'TabuSearch'
        best_solution.metadata['iterations'] = iteration + 1
        
        return best_solution
    
    def _count_conflicts(
        self, 
        solution: ColoringSolution, 
        problem: ConstrainedGraphColoringProblem
    ) -> int:
        """Count number of constraint violations."""
        conflicts = 0
        seen_pairs = set()
        
        for node_id, color in solution.coloring.items():
            if color == 0:
                continue
            for neighbor_id in problem.get_neighbors(node_id):
                if solution.coloring.get(neighbor_id, 0) == color:
                    pair = tuple(sorted([node_id, neighbor_id]))
                    if pair not in seen_pairs:
                        conflicts += 1
                        seen_pairs.add(pair)
        
        return conflicts


class SimulatedAnnealingColoring(ColoringAlgorithm):
    """
    Simulated Annealing for graph coloring.
    
    A probabilistic metaheuristic that gradually reduces the probability
    of accepting worse solutions as the "temperature" decreases.
    
    Algorithm:
    1. Start with initial solution
    2. Generate random neighbor (color swap)
    3. Accept if better, or probabilistically if worse
    4. Decrease temperature according to cooling schedule
    5. Repeat until frozen or max iterations
    
    Attributes:
        initial_temp: Starting temperature
        cooling_rate: Temperature decay factor (0 < α < 1)
        max_iterations: Maximum iterations
        seed: Random seed for reproducibility
    """
    
    def __init__(
        self, 
        initial_temp: float = 100.0,
        cooling_rate: float = 0.995,
        max_iterations: int = 10000,
        seed: Optional[int] = None
    ):
        """Initialize Simulated Annealing."""
        self.initial_temp = initial_temp
        self.cooling_rate = cooling_rate
        self.max_iterations = max_iterations
        self.seed = seed
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
    
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """Solve using Simulated Annealing."""
        # Get initial solution
        greedy = GreedyRandomColoring(n_trials=10, seed=self.seed)
        current = greedy.solve(problem, verbose=False)
        current_cost = self._evaluate(current, problem)
        
        best_solution = current
        best_cost = current_cost
        
        temperature = self.initial_temp
        
        # Track color usage
        color_usage = defaultdict(int)
        for nid, c in current.coloring.items():
            if c > 0:
                color_usage[c] += 1
        
        iterator = range(self.max_iterations)
        if verbose:
            iterator = tqdm(iterator, desc="Simulated Annealing")
        
        for iteration in iterator:
            if temperature < 0.01:
                break
            
            # Generate neighbor: randomly change one node's color
            node_ids = [nid for nid, c in current.coloring.items() if c > 0]
            if not node_ids:
                break
                
            node_id = random.choice(node_ids)
            old_color = current.coloring[node_id]
            
            # Find valid new colors
            valid_colors = [
                c for c in range(1, problem.n_colors + 1)
                if c != old_color and color_usage[c] < problem.capacity
            ]
            
            if not valid_colors:
                temperature *= self.cooling_rate
                continue
            
            new_color = random.choice(valid_colors)
            
            # Create neighbor solution
            new_coloring = current.coloring.copy()
            new_coloring[node_id] = new_color
            
            neighbor = ColoringSolution(
                coloring=new_coloring,
                n_colors=problem.n_colors,
                capacity=problem.capacity,
                uncolored_nodes=[nid for nid, c in new_coloring.items() if c == 0]
            )
            neighbor_cost = self._evaluate(neighbor, problem)
            
            # Accept or reject
            delta = neighbor_cost - current_cost
            
            if delta < 0 or random.random() < math.exp(-delta / temperature):
                # Update color usage
                color_usage[old_color] -= 1
                color_usage[new_color] += 1
                
                current = neighbor
                current_cost = neighbor_cost
                
                if current_cost < best_cost:
                    best_solution = current
                    best_cost = current_cost
            
            # Cool down
            temperature *= self.cooling_rate
        
        best_solution.metadata['algorithm'] = 'SimulatedAnnealing'
        best_solution.metadata['final_temp'] = temperature
        
        return best_solution
    
    def _evaluate(
        self, 
        solution: ColoringSolution, 
        problem: ConstrainedGraphColoringProblem
    ) -> float:
        """Evaluate solution quality (lower is better)."""
        # Count conflicts
        conflicts = 0
        for node_id, color in solution.coloring.items():
            if color == 0:
                continue
            for neighbor_id in problem.get_neighbors(node_id):
                if solution.coloring.get(neighbor_id, 0) == color:
                    conflicts += 1
        
        # Penalize uncolored nodes heavily
        uncolored_penalty = solution.n_uncolored * 10
        
        return conflicts / 2 + uncolored_penalty  # /2 because counted twice


class IteratedLocalSearch(ColoringAlgorithm):
    """
    Iterated Local Search (ILS) for graph coloring.
    
    Combines local search with perturbation to escape local optima.
    
    Algorithm:
    1. Generate initial solution
    2. Apply local search to get local optimum
    3. Perturb the solution
    4. Apply local search again
    5. Accept new solution based on acceptance criterion
    6. Repeat
    
    Attributes:
        n_iterations: Number of ILS iterations
        perturbation_strength: Fraction of nodes to perturb
        seed: Random seed for reproducibility
    """
    
    def __init__(
        self, 
        n_iterations: int = 100,
        perturbation_strength: float = 0.2,
        seed: Optional[int] = None
    ):
        """Initialize Iterated Local Search."""
        self.n_iterations = n_iterations
        self.perturbation_strength = perturbation_strength
        self.seed = seed
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
    
    def solve(
        self, 
        problem: ConstrainedGraphColoringProblem,
        verbose: bool = False
    ) -> ColoringSolution:
        """Solve using Iterated Local Search."""
        # Initial solution
        greedy = GreedyRandomColoring(n_trials=50, seed=self.seed)
        current = greedy.solve(problem, verbose=False)
        current = self._local_search(current, problem)
        
        best_solution = current
        best_uncolored = current.n_uncolored
        
        iterator = range(self.n_iterations)
        if verbose:
            iterator = tqdm(iterator, desc="ILS")
        
        for iteration in iterator:
            # Perturb
            perturbed = self._perturb(current, problem)
            
            # Local search
            improved = self._local_search(perturbed, problem)
            
            # Acceptance criterion (accept if not worse)
            if improved.n_uncolored <= current.n_uncolored:
                current = improved
                
                if current.n_uncolored < best_uncolored:
                    best_solution = current
                    best_uncolored = current.n_uncolored
                    
                    if best_uncolored == 0:
                        break
        
        best_solution.metadata['algorithm'] = 'IteratedLocalSearch'
        best_solution.metadata['iterations'] = iteration + 1
        
        return best_solution
    
    def _perturb(
        self, 
        solution: ColoringSolution, 
        problem: ConstrainedGraphColoringProblem
    ) -> ColoringSolution:
        """Perturb solution by randomly recoloring some nodes."""
        new_coloring = solution.coloring.copy()
        
        # Select nodes to perturb
        colored_nodes = [nid for nid, c in new_coloring.items() if c > 0]
        n_perturb = max(1, int(len(colored_nodes) * self.perturbation_strength))
        nodes_to_perturb = random.sample(colored_nodes, min(n_perturb, len(colored_nodes)))
        
        # Track color usage
        color_usage = defaultdict(int)
        for nid, c in new_coloring.items():
            if c > 0 and nid not in nodes_to_perturb:
                color_usage[c] += 1
        
        # Recolor perturbed nodes
        for node_id in nodes_to_perturb:
            new_coloring[node_id] = 0  # Temporarily uncolor
        
        for node_id in nodes_to_perturb:
            neighbors = problem.get_neighbors(node_id)
            neighbor_colors = {new_coloring[n] for n in neighbors if new_coloring.get(n, 0) > 0}
            
            valid_colors = [
                c for c in range(1, problem.n_colors + 1)
                if c not in neighbor_colors and color_usage[c] < problem.capacity
            ]
            
            if valid_colors:
                new_color = random.choice(valid_colors)
                new_coloring[node_id] = new_color
                color_usage[new_color] += 1
        
        return ColoringSolution(
            coloring=new_coloring,
            n_colors=problem.n_colors,
            capacity=problem.capacity,
            uncolored_nodes=[nid for nid, c in new_coloring.items() if c == 0]
        )
    
    def _local_search(
        self, 
        solution: ColoringSolution, 
        problem: ConstrainedGraphColoringProblem,
        max_no_improve: int = 50
    ) -> ColoringSolution:
        """Apply local search to improve solution."""
        current = solution
        no_improve = 0
        
        while no_improve < max_no_improve:
            improved = False
            
            # Try to color uncolored nodes
            for node_id in list(current.uncolored_nodes):
                neighbors = problem.get_neighbors(node_id)
                neighbor_colors = {current.coloring[n] for n in neighbors if current.coloring.get(n, 0) > 0}
                
                color_usage = defaultdict(int)
                for nid, c in current.coloring.items():
                    if c > 0:
                        color_usage[c] += 1
                
                for color in range(1, problem.n_colors + 1):
                    if color not in neighbor_colors and color_usage[color] < problem.capacity:
                        new_coloring = current.coloring.copy()
                        new_coloring[node_id] = color
                        
                        current = ColoringSolution(
                            coloring=new_coloring,
                            n_colors=problem.n_colors,
                            capacity=problem.capacity,
                            uncolored_nodes=[nid for nid, c in new_coloring.items() if c == 0]
                        )
                        improved = True
                        break
            
            if improved:
                no_improve = 0
            else:
                no_improve += 1
        
        return current

