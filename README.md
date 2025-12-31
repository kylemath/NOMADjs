# Automated Source Multiplexing for fNIRS: A Graph Coloring Approach

An automated solution for designing crosstalk-free multiplexing schemes in functional near-infrared spectroscopy (fNIRS) systems using constrained graph coloring algorithms.

## Overview

This project provides an automated approach to the fNIRS source multiplexing problem, eliminating the tedious manual process of designing time-division multiplexing schemes. Originally developed for the NOMAD optical imaging system, this tool formulates the crosstalk elimination problem as a constrained graph coloring problem and solves it efficiently using randomized algorithms.

**The Problem:** In high-density fNIRS systems with multiple light sources and detectors, sources must be turned on in different time slots to prevent crosstalk—when light from multiple sources reaches the same detector simultaneously, contaminating the measurements.

**The Solution:** Automatically assign sources to time slots such that:
1. **No crosstalk**: Sources within range of the same detector are in different time slots
2. **Capacity constraints**: Each time slot accommodates a limited number of sources
3. **Complete coverage**: All (or as many as possible) sources are assigned

The framework also generalizes to other multiplexing and resource allocation problems with spatial conflict constraints.

## The fNIRS Multiplexing Problem

**Given:**
- A set of light sources S with 3D positions on the head surface
- A set of optical detectors D with 3D positions on the head surface  
- A maximum transmission distance δ (e.g., 50mm for fNIRS)
- A number of time slots k in the multiplexing cycle (e.g., 8)
- A capacity c: maximum sources per time slot (e.g., 4)

**Find:** An assignment of time slots to sources such that:
- **No crosstalk**: Sources within distance δ of the same detector are in different time slots
- **Capacity respected**: Each time slot contains at most c sources
- **Complete montage**: All (or as many as possible) sources are assigned

**Generalized formulation:** This extends to any spatial multiplexing problem where conflicts are determined by proximity to shared resources (detectors, receivers, processors).

## Mathematical Formulation

This is a variant of the **List Coloring Problem** with additional **capacity constraints**, making it NP-hard. The conflict graph G = (V, E) is constructed where:
- Vertices represent nodes (sources)
- Edges connect nodes that conflict (within range of same detector)
- We seek a k-coloring with capacity c per color

## Algorithms Implemented

1. **Random Restart Monte Carlo** (Best performer for this problem class)
   - Randomly order detectors and nodes
   - Greedily assign colors avoiding conflicts
   - Restart if stuck
   - Keep best solution across multiple trials

2. **DSATUR (Degree of Saturation)**
   - Heuristic that prioritizes nodes with most constrained color choices
   - Modified for capacity constraints

3. **Greedy with Random Ordering**
   - Simple greedy coloring with randomized node ordering

4. **Parallel Monte Carlo**
   - Parallelized random restart for faster convergence

## Project Structure

```
GraphColouring/
├── nomad/                  # Original MATLAB implementation
├── src/                    # Python implementation
│   ├── core/              # Core graph coloring algorithms
│   ├── problems/          # Problem-specific implementations
│   ├── benchmarks/        # Benchmark suite
│   └── visualization/     # Visualization tools
├── paper/                 # LaTeX paper and figures
├── examples/              # Example applications
└── tests/                 # Unit tests
```

## Applications

### Primary: fNIRS Source Multiplexing (Original Motivation)
- **Problem**: High-density fNIRS systems with 32+ sources and 15+ detectors need carefully designed multiplexing to avoid crosstalk
- **Solution**: Automatic assignment of sources to 8 time slots with 4 sources per slot
- **Impact**: Reduces design time from hours of manual work to seconds, eliminates human error
- **Status**: Validated on real fNIRS montages, including the NOMAD system (Beckman Institute, 2013)

### Generalizations (Same Mathematical Framework):

2. **Wireless Communication**
   - Channel assignment to transmitters avoiding interference
   
3. **Task Scheduling**
   - Assigning time slots to tasks with resource conflicts
   
4. **Any Spatial Multiplexing Problem**
   - Where conflicts arise from proximity to shared resources

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt
```

## Quick Start

```python
from src.core.problem import ConstrainedGraphColoringProblem
from src.core.algorithms import RandomRestartMonteCarlo

# Define your fNIRS montage
sources = [(x1, y1, z1), (x2, y2, z2), ...]  # Source positions (mm)
detectors = [(x1, y1, z1), (x2, y2, z2), ...]  # Detector positions (mm)
max_distance = 50.0  # Maximum light transmission distance (mm)
n_time_slots = 8  # Number of time slots in multiplexing cycle
sources_per_slot = 4  # Maximum sources per time slot

# Create problem instance
problem = ConstrainedGraphColoringProblem.from_positions(
    node_positions=sources,
    detector_positions=detectors,
    max_distance=max_distance,
    n_colors=n_time_slots,
    capacity=sources_per_slot
)

# Solve with random restart Monte Carlo (best for fNIRS)
solver = RandomRestartMonteCarlo(n_trials=1000)
solution = solver.solve(problem)

print(f"Assigned {solution.n_colored}/{len(sources)} sources")
print(f"Time slot assignment: {solution.coloring}")

# Use this assignment to program your fNIRS system!
```

**For a complete fNIRS example**, see `examples/optical_imaging_example.py`

## Citation

If you use this work, please cite:

```bibtex
@article{mathewson2024fnirs,
  title={Automated Source Multiplexing for Functional Near-Infrared Spectroscopy: 
         A Graph Coloring Approach to Crosstalk Elimination},
  author={Mathewson, Kyle},
  journal={TBD},
  year={2024}
}
```

## Original NOMAD Project

This work builds on the NOMAD (Neuroimaging Optode Montage And Deployment) project developed at the Beckman Institute, University of Illinois (2012-2013). The original MATLAB implementation can be found at:
https://github.com/kylemath/nomad

This Python implementation provides an automated, algorithmic solution to the multiplexing problem that was previously solved manually.

## License

MIT License - see LICENSE file for details

