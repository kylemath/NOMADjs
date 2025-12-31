"""
Constrained Graph Coloring Library

A generalized framework for solving constrained graph coloring problems
with applications to multiplexing, scheduling, and resource allocation.
"""

__version__ = "1.0.0"
__author__ = "Kyle Mathewson"

from .core.problem import ConstrainedGraphColoringProblem
from .core.solution import ColoringSolution
from .core.algorithms import (
    RandomRestartMonteCarlo,
    DSATURColoring,
    GreedyRandomColoring,
    ParallelMonteCarlo
)

__all__ = [
    'ConstrainedGraphColoringProblem',
    'ColoringSolution',
    'RandomRestartMonteCarlo',
    'DSATURColoring',
    'GreedyRandomColoring',
    'ParallelMonteCarlo'
]

