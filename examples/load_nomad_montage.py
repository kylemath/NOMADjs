#!/usr/bin/env python3
"""
Load NOMAD Montage Data

This script loads actual montage configurations from the original NOMAD MATLAB
code and converts them to our Python format for testing.

This gives us REAL test cases that we know were successfully solved in the
original system.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
import scipy.io as sio
from typing import Tuple, List

from src.core.problem import ConstrainedGraphColoringProblem
from src.core.algorithms import RandomRestartMonteCarlo, DSATURColoring, GreedyRandomColoring


def load_nomad_montage(mat_file_path: str) -> dict:
    """
    Load a NOMAD .mat file and extract montage information.
    
    Args:
        mat_file_path: Path to .mat file
        
    Returns:
        Dictionary with montage data
    """
    print(f"Loading NOMAD montage from: {mat_file_path}")
    
    try:
        mat_data = sio.loadmat(mat_file_path)
        print(f"\nKeys in .mat file: {list(mat_data.keys())}")
        
        # The main structure is usually called 'mtg'
        if 'mtg' in mat_data:
            mtg = mat_data['mtg']
            print(f"\nMontage structure type: {type(mtg)}")
            print(f"Montage structure shape: {mtg.shape if hasattr(mtg, 'shape') else 'N/A'}")
            
            # MATLAB structures are loaded as numpy structured arrays
            if mtg.dtype.names:
                print(f"\nFields in montage structure: {mtg.dtype.names}")
                
                # Try to extract key fields
                for field in mtg.dtype.names:
                    try:
                        value = mtg[field][0, 0]
                        if isinstance(value, np.ndarray):
                            print(f"  {field}: shape {value.shape}, dtype {value.dtype}")
                        else:
                            print(f"  {field}: {type(value)}")
                    except:
                        print(f"  {field}: (couldn't access)")
        
        return mat_data
        
    except Exception as e:
        print(f"Error loading .mat file: {e}")
        import traceback
        traceback.print_exc()
        return None


def extract_montage_data(mat_data: dict) -> Tuple[List, List, dict]:
    """
    Extract source positions, detector positions, and parameters from NOMAD data.
    
    Args:
        mat_data: Loaded MATLAB data
        
    Returns:
        (source_positions, detector_positions, parameters)
    """
    mtg = mat_data['mtg'][0, 0]  # Get first element of structured array
    
    # Extract positions
    # In NOMAD, positions are typically in 'src_xyz' and 'det_xyz' fields
    source_positions = []
    detector_positions = []
    parameters = {}
    
    # Try different possible field names
    possible_src_fields = ['src_xyz', 'srcs', 'source_positions', 'src_pos']
    possible_det_fields = ['det_xyz', 'dets', 'detector_positions', 'det_pos']
    
    for field in possible_src_fields:
        if field in mtg.dtype.names:
            src_data = mtg[field]
            if isinstance(src_data, np.ndarray) and src_data.size > 0:
                # Convert to list of tuples
                if src_data.ndim == 2 and src_data.shape[1] >= 3:
                    source_positions = [(float(x), float(y), float(z)) 
                                       for x, y, z in src_data[:, :3]]
                    print(f"\nFound {len(source_positions)} sources from field '{field}'")
                    break
    
    for field in possible_det_fields:
        if field in mtg.dtype.names:
            det_data = mtg[field]
            if isinstance(det_data, np.ndarray) and det_data.size > 0:
                if det_data.ndim == 2 and det_data.shape[1] >= 3:
                    detector_positions = [(float(x), float(y), float(z)) 
                                         for x, y, z in det_data[:, :3]]
                    print(f"Found {len(detector_positions)} detectors from field '{field}'")
                    break
    
    # Extract parameters
    param_fields = ['n_mux', 'n_srcs_per_mux', 'max_dist', 'min_dist']
    for field in param_fields:
        if field in mtg.dtype.names:
            try:
                value = mtg[field]
                if isinstance(value, np.ndarray):
                    value = value.flat[0]
                parameters[field] = float(value)
                print(f"Parameter {field}: {parameters[field]}")
            except:
                pass
    
    return source_positions, detector_positions, parameters


def create_problem_from_nomad(
    source_positions: List[Tuple],
    detector_positions: List[Tuple],
    n_colors: int = 8,
    capacity: int = 4,
    max_distance: float = 50.0
) -> ConstrainedGraphColoringProblem:
    """
    Create a problem instance from NOMAD montage data.
    
    Args:
        source_positions: List of (x, y, z) tuples for sources
        detector_positions: List of (x, y, z) tuples for detectors
        n_colors: Number of time slots
        capacity: Sources per time slot
        max_distance: Maximum transmission distance
        
    Returns:
        ConstrainedGraphColoringProblem
    """
    print(f"\nCreating problem:")
    print(f"  Sources: {len(source_positions)}")
    print(f"  Detectors: {len(detector_positions)}")
    print(f"  Time slots: {n_colors}")
    print(f"  Capacity: {capacity}")
    print(f"  Max distance: {max_distance}")
    
    problem = ConstrainedGraphColoringProblem.from_positions(
        node_positions=source_positions,
        detector_positions=detector_positions,
        n_colors=n_colors,
        capacity=capacity,
        max_distance=max_distance
    )
    
    print(f"\nConflict graph:")
    print(f"  Nodes: {problem.graph.number_of_nodes()}")
    print(f"  Edges: {problem.graph.number_of_edges()}")
    print(f"  Avg degree: {2 * problem.graph.number_of_edges() / problem.graph.number_of_nodes():.2f}")
    print(f"  Theoretical capacity: {n_colors * capacity} sources")
    
    return problem


def test_nomad_montage(problem: ConstrainedGraphColoringProblem, n_trials: int = 30):
    """
    Test algorithms on a NOMAD montage.
    
    Args:
        problem: Problem instance
        n_trials: Number of independent trials
    """
    print("\n" + "="*70)
    print("TESTING WITH REAL NOMAD MONTAGE")
    print("="*70)
    print(f"Running {n_trials} independent trials per algorithm")
    print(f"(NOMAD's 'lowest_left' shows it needed multiple trials too!)")
    print()
    
    algorithms = [
        ("Random Restart MC (10000)", RandomRestartMonteCarlo(n_trials=10000, seed=None)),
        ("Random Restart MC (5000)", RandomRestartMonteCarlo(n_trials=5000, seed=None)),
        ("Random Restart MC (1000)", RandomRestartMonteCarlo(n_trials=1000, seed=None)),
        ("DSATUR (1000)", DSATURColoring(n_trials=1000, seed=None)),
        ("Greedy Random (1000)", GreedyRandomColoring(n_trials=1000, seed=None)),
    ]
    
    target = len(problem.nodes)
    
    for algo_name, algorithm in algorithms:
        print(f"\n{algo_name}:")
        successes = 0
        qualities = []
        
        for trial in range(n_trials):
            solution = algorithm.solve(problem, verbose=False)
            qualities.append(solution.n_colored)
            if solution.n_colored == target:
                successes += 1
        
        success_rate = successes / n_trials
        avg_quality = np.mean(qualities)
        
        print(f"  Success rate: {success_rate:.1%} ({successes}/{n_trials})")
        print(f"  Avg quality: {avg_quality:.1f}/{target}")
        print(f"  Best: {max(qualities)}/{target}")
        print(f"  Worst: {min(qualities)}/{target}")
        
        if successes > 0:
            print(f"  ✓ ALGORITHM WORKS! Found complete solutions {successes} times")
        else:
            print(f"  ✗ No complete solutions found")


def main():
    """Load and test NOMAD montages."""
    print("="*70)
    print("NOMAD MONTAGE LOADER")
    print("="*70)
    
    # Path to NOMAD repo
    nomad_path = "/Users/kylemathewson/Coding/nomad"
    
    # Try loading the example montages
    montage_files = [
        os.path.join(nomad_path, "examples", "working_test_montage.mat"),
        os.path.join(nomad_path, "examples", "LrgBlkBoth.mat"),
    ]
    
    for mat_file in montage_files:
        if not os.path.exists(mat_file):
            print(f"\nFile not found: {mat_file}")
            continue
        
        print("\n" + "="*70)
        print(f"Processing: {os.path.basename(mat_file)}")
        print("="*70)
        
        # Load the .mat file
        mat_data = load_nomad_montage(mat_file)
        
        if mat_data is None:
            continue
        
        # Try to extract montage data
        try:
            source_positions, detector_positions, parameters = extract_montage_data(mat_data)
            
            if not source_positions or not detector_positions:
                print("\nCouldn't extract source/detector positions from this file")
                continue
            
            # Extract actual parameters from the montage
            mtg_struct = mat_data['mtg'][0, 0]
            n_colors = int(mtg_struct['n_muxs'][0, 0])
            capacity = 4  # NOMAD uses 4 sources per slot
            max_distance = float(mtg_struct['max_dist'][0, 0])
            
            print(f"\nExtracted parameters from NOMAD:")
            print(f"  n_muxs (time slots): {n_colors}")
            print(f"  capacity: {capacity}")
            print(f"  max_dist: {max_distance}")
            
            # Create problem
            problem = create_problem_from_nomad(
                source_positions,
                detector_positions,
                n_colors=n_colors,
                capacity=capacity,
                max_distance=max_distance
            )
            
            # Test algorithms
            test_nomad_montage(problem, n_trials=10)
            
        except Exception as e:
            print(f"\nError processing montage: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()

