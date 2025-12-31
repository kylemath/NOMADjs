"""
Benchmark suite for comparing graph coloring algorithms.

Provides two evaluation modes:
1. Best-of-N: Run N times, take best solution (for comparison)
2. Success Rate: Measure reliability and time-to-success (for solvable problems)
"""

import time
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from dataclasses import dataclass, field
import sys
sys.path.append('..')

from src.core.problem import ConstrainedGraphColoringProblem
from src.core.algorithms import ColoringAlgorithm
from src.core.solution import ColoringSolution


@dataclass
class BenchmarkResult:
    """Results from a single benchmark run."""
    problem_name: str
    algorithm_name: str
    n_nodes: int
    n_detectors: int
    n_colors: int
    capacity: int
    graph_edges: int
    avg_degree: float
    
    # Solution quality
    n_colored: int
    n_uncolored: int
    colors_used: int
    color_utilization: float
    balance_std: float
    
    # Performance
    time_seconds: float
    n_trials: int
    
    # Validation
    is_valid: bool
    n_violations: int
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            'problem_name': self.problem_name,
            'algorithm_name': self.algorithm_name,
            'n_nodes': self.n_nodes,
            'n_detectors': self.n_detectors,
            'n_colors': self.n_colors,
            'capacity': self.capacity,
            'graph_edges': self.graph_edges,
            'avg_degree': self.avg_degree,
            'n_colored': self.n_colored,
            'n_uncolored': self.n_uncolored,
            'colors_used': self.colors_used,
            'color_utilization': self.color_utilization,
            'balance_std': self.balance_std,
            'time_seconds': self.time_seconds,
            'n_trials': self.n_trials,
            'is_valid': self.is_valid,
            'n_violations': self.n_violations
        }


class BenchmarkSuite:
    """
    Benchmark suite for comparing graph coloring algorithms.
    
    This class provides tools to:
    - Run multiple algorithms on multiple problems
    - Collect performance and quality metrics
    - Generate comparison reports
    """
    
    def __init__(self):
        """Initialize benchmark suite."""
        self.results: List[BenchmarkResult] = []
    
    def run_benchmark(
        self,
        problem: ConstrainedGraphColoringProblem,
        algorithm: ColoringAlgorithm,
        problem_name: str = "Unknown",
        n_runs: int = 1,
        verbose: bool = False
    ) -> BenchmarkResult:
        """
        Run a single benchmark.
        
        Args:
            problem: Problem instance
            algorithm: Algorithm to test
            problem_name: Name for the problem
            n_runs: Number of runs to average over
            verbose: Whether to print progress
            
        Returns:
            BenchmarkResult
        """
        if verbose:
            print(f"Running {algorithm.__class__.__name__} on {problem_name}...")
        
        # Run multiple times and take best solution
        best_solution = None
        best_colored = -1
        total_time = 0.0
        
        for run in range(n_runs):
            start_time = time.time()
            solution = algorithm.solve(problem, verbose=False)
            elapsed = time.time() - start_time
            
            total_time += elapsed
            
            if solution.n_colored > best_colored:
                best_colored = solution.n_colored
                best_solution = solution
        
        avg_time = total_time / n_runs
        
        # Validate solution
        is_valid, violations = best_solution.validate(problem)
        
        # Compute statistics
        stats = best_solution.compute_statistics()
        
        # Create result
        result = BenchmarkResult(
            problem_name=problem_name,
            algorithm_name=algorithm.__class__.__name__,
            n_nodes=len(problem.nodes),
            n_detectors=len(problem.detectors),
            n_colors=problem.n_colors,
            capacity=problem.capacity,
            graph_edges=problem.graph.number_of_edges(),
            avg_degree=(
                2 * problem.graph.number_of_edges() / problem.graph.number_of_nodes()
                if problem.graph.number_of_nodes() > 0 else 0
            ),
            n_colored=best_solution.n_colored,
            n_uncolored=best_solution.n_uncolored,
            colors_used=stats['colors_used'],
            color_utilization=stats['color_utilization'],
            balance_std=stats['balance_std'],
            time_seconds=avg_time,
            n_trials=best_solution.metadata.get('n_trials', 1),
            is_valid=is_valid,
            n_violations=len(violations),
            metadata=best_solution.metadata
        )
        
        self.results.append(result)
        
        if verbose:
            print(f"  Colored: {result.n_colored}/{result.n_nodes}")
            print(f"  Time: {result.time_seconds:.3f}s")
            print(f"  Valid: {result.is_valid}")
        
        return result
    
    def run_suite(
        self,
        problems: List[tuple],  # List of (problem, name) tuples
        algorithms: List[ColoringAlgorithm],
        n_runs: int = 1,
        verbose: bool = True
    ):
        """
        Run full benchmark suite.
        
        Args:
            problems: List of (problem, name) tuples
            algorithms: List of algorithms to test
            n_runs: Number of runs per algorithm-problem pair
            verbose: Whether to print progress
        """
        total_benchmarks = len(problems) * len(algorithms)
        current = 0
        
        for problem, problem_name in problems:
            if verbose:
                print(f"\n{'='*70}")
                print(f"Problem: {problem_name}")
                print(f"{'='*70}")
            
            for algorithm in algorithms:
                current += 1
                if verbose:
                    print(f"\n[{current}/{total_benchmarks}] ", end="")
                
                self.run_benchmark(
                    problem=problem,
                    algorithm=algorithm,
                    problem_name=problem_name,
                    n_runs=n_runs,
                    verbose=verbose
                )
    
    def get_results_dataframe(self) -> pd.DataFrame:
        """
        Get results as a pandas DataFrame.
        
        Returns:
            DataFrame with all benchmark results
        """
        if not self.results:
            return pd.DataFrame()
        
        return pd.DataFrame([r.to_dict() for r in self.results])
    
    def print_summary(self):
        """Print a summary of benchmark results."""
        if not self.results:
            print("No results to summarize.")
            return
        
        df = self.get_results_dataframe()
        
        print("\n" + "="*70)
        print("BENCHMARK SUMMARY")
        print("="*70)
        
        # Group by algorithm
        print("\nResults by Algorithm:")
        print("-"*70)
        
        algo_summary = df.groupby('algorithm_name').agg({
            'n_colored': 'mean',
            'n_uncolored': 'mean',
            'color_utilization': 'mean',
            'time_seconds': 'mean',
            'is_valid': 'sum'
        })
        
        print(algo_summary.to_string())
        
        # Group by problem
        print("\n\nResults by Problem:")
        print("-"*70)
        
        problem_summary = df.groupby('problem_name').agg({
            'n_colored': 'mean',
            'n_uncolored': 'mean',
            'time_seconds': 'mean',
            'is_valid': 'sum'
        })
        
        print(problem_summary.to_string())
        
        # Best algorithm per problem
        print("\n\nBest Algorithm per Problem (by nodes colored):")
        print("-"*70)
        
        best_per_problem = df.loc[df.groupby('problem_name')['n_colored'].idxmax()]
        print(best_per_problem[['problem_name', 'algorithm_name', 'n_colored', 'time_seconds']].to_string(index=False))
        
        print()
    
    def save_results(self, filename: str):
        """
        Save results to CSV file.
        
        Args:
            filename: Output filename
        """
        df = self.get_results_dataframe()
        df.to_csv(filename, index=False)
        print(f"Results saved to {filename}")
    
    def compare_algorithms(
        self,
        metric: str = 'n_colored',
        problem_name: str = None
    ) -> pd.DataFrame:
        """
        Compare algorithms on a specific metric.
        
        Args:
            metric: Metric to compare ('n_colored', 'time_seconds', etc.)
            problem_name: Optional problem name to filter by
            
        Returns:
            DataFrame with comparison
        """
        df = self.get_results_dataframe()
        
        if problem_name:
            df = df[df['problem_name'] == problem_name]
        
        comparison = df.pivot_table(
            values=metric,
            index='problem_name',
            columns='algorithm_name',
            aggfunc='mean'
        )
        
        return comparison
    
    def run_success_rate_benchmark(
        self,
        problem: ConstrainedGraphColoringProblem,
        algorithm: ColoringAlgorithm,
        problem_name: str = "Unknown",
        n_trials: int = 100,
        timeout_seconds: float = 60.0,
        verbose: bool = False
    ) -> Dict[str, Any]:
        """
        Measure success rate and time-to-success for solvable problems.
        
        For problems that CAN be fully solved (all nodes colored), measures:
        - Success rate: percentage of trials that find complete solution
        - Time to first success: how long until first complete solution found
        - Average solution quality: for successful trials
        - Consistency: std dev of solution quality
        
        This is the proper evaluation for fNIRS montages and other fully-solvable
        instances, rather than just taking the best solution after N trials.
        
        Args:
            problem: Problem instance
            algorithm: Algorithm to test
            problem_name: Name for the problem
            n_trials: Number of independent trials to run
            timeout_seconds: Maximum time to spend
            verbose: Whether to print progress
            
        Returns:
            Dictionary with success rate metrics
        """
        if verbose:
            print(f"Running success rate benchmark: {algorithm.__class__.__name__} on {problem_name}")
            print(f"  Target: {len(problem.nodes)} nodes")
        
        n_nodes = len(problem.nodes)
        successes = 0
        success_times = []
        all_times = []
        solution_qualities = []
        
        start_time = time.time()
        
        for trial in range(n_trials):
            # Check timeout
            if time.time() - start_time > timeout_seconds:
                if verbose:
                    print(f"  Timeout reached after {trial} trials")
                break
            
            # Run single trial
            trial_start = time.time()
            solution = algorithm.solve(problem, verbose=False)
            trial_time = time.time() - trial_start
            
            all_times.append(trial_time)
            solution_qualities.append(solution.n_colored)
            
            # Check if complete solution found
            if solution.n_colored == n_nodes:
                successes += 1
                success_times.append(trial_time)
            
            if verbose and (trial + 1) % 10 == 0:
                print(f"  Trial {trial + 1}/{n_trials}: Success rate = {successes/(trial+1):.1%}")
        
        total_trials = len(all_times)
        success_rate = successes / total_trials if total_trials > 0 else 0.0
        
        result = {
            'problem_name': problem_name,
            'algorithm_name': algorithm.__class__.__name__,
            'n_nodes': n_nodes,
            'n_trials': total_trials,
            'n_successes': successes,
            'success_rate': success_rate,
            'avg_time_all': np.mean(all_times) if all_times else 0.0,
            'avg_time_success': np.mean(success_times) if success_times else np.nan,
            'median_time_success': np.median(success_times) if success_times else np.nan,
            'min_time_success': np.min(success_times) if success_times else np.nan,
            'avg_quality': np.mean(solution_qualities) if solution_qualities else 0.0,
            'std_quality': np.std(solution_qualities) if solution_qualities else 0.0,
            'best_quality': np.max(solution_qualities) if solution_qualities else 0,
            'worst_quality': np.min(solution_qualities) if solution_qualities else 0,
        }
        
        if verbose:
            print(f"\n  Results:")
            print(f"    Success rate: {success_rate:.1%} ({successes}/{total_trials})")
            if success_times:
                print(f"    Avg time to success: {np.mean(success_times):.3f}s")
                print(f"    Median time to success: {np.median(success_times):.3f}s")
            print(f"    Avg quality: {result['avg_quality']:.1f}/{n_nodes}")
        
        return result

