"""Core graph coloring algorithms and data structures."""

from .problem import ConstrainedGraphColoringProblem
from .solution import ColoringSolution
from .algorithms import (
    # Classical Heuristics
    DSATURColoring,
    LargestFirstColoring,
    GreedyRandomColoring,
    # Metaheuristics
    RandomRestartMonteCarlo,
    TabuSearchColoring,
    SimulatedAnnealingColoring,
    IteratedLocalSearch,
    ParallelMonteCarlo,
)

__all__ = [
    'ConstrainedGraphColoringProblem',
    'ColoringSolution',
    # Classical Heuristics
    'DSATURColoring',
    'LargestFirstColoring',
    'GreedyRandomColoring',
    # Metaheuristics
    'RandomRestartMonteCarlo',
    'TabuSearchColoring',
    'SimulatedAnnealingColoring',
    'IteratedLocalSearch',
    'ParallelMonteCarlo',
]

