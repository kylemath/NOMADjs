"""
Solution representation for constrained graph coloring problems.
"""

import numpy as np
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field


@dataclass
class ColoringSolution:
    """
    Represents a solution to a constrained graph coloring problem.
    
    Attributes:
        coloring: Dictionary mapping node_id -> color (0 means uncolored)
        n_colors: Number of colors used
        capacity: Maximum nodes per color
        uncolored_nodes: List of nodes that couldn't be colored
        metadata: Optional metadata about the solution
    """
    coloring: Dict[int, int]
    n_colors: int
    capacity: int
    uncolored_nodes: List[int] = field(default_factory=list)
    metadata: Optional[Dict] = field(default_factory=dict)
    
    @property
    def n_colored(self) -> int:
        """Number of nodes that were successfully colored."""
        return sum(1 for c in self.coloring.values() if c > 0)
    
    @property
    def n_uncolored(self) -> int:
        """Number of nodes that remain uncolored."""
        return len(self.uncolored_nodes)
    
    @property
    def is_complete(self) -> bool:
        """Check if all nodes were colored."""
        return self.n_uncolored == 0
    
    def get_nodes_with_color(self, color: int) -> List[int]:
        """Get all nodes assigned to a specific color."""
        return [node_id for node_id, c in self.coloring.items() if c == color]
    
    def get_color_counts(self) -> Dict[int, int]:
        """Get count of nodes for each color."""
        counts = {}
        for color in self.coloring.values():
            if color > 0:  # Ignore uncolored (0)
                counts[color] = counts.get(color, 0) + 1
        return counts
    
    def validate(self, problem) -> Tuple[bool, List[str]]:
        """
        Validate the solution against the problem constraints.
        
        Args:
            problem: ConstrainedGraphColoringProblem instance
            
        Returns:
            Tuple of (is_valid, list_of_violations)
        """
        violations = []
        
        # Check capacity constraints
        color_counts = self.get_color_counts()
        for color, count in color_counts.items():
            if count > self.capacity:
                violations.append(
                    f"Color {color} has {count} nodes, exceeds capacity {self.capacity}"
                )
        
        # Check conflict constraints
        for node_id, color in self.coloring.items():
            if color == 0:  # Skip uncolored nodes
                continue
            
            neighbors = problem.get_neighbors(node_id)
            for neighbor_id in neighbors:
                neighbor_color = self.coloring.get(neighbor_id, 0)
                if neighbor_color == color:
                    violations.append(
                        f"Nodes {node_id} and {neighbor_id} conflict but share color {color}"
                    )
        
        return len(violations) == 0, violations
    
    def compute_statistics(self) -> Dict:
        """Compute statistics about the solution."""
        color_counts = self.get_color_counts()
        
        if not color_counts:
            return {
                'n_colored': 0,
                'n_uncolored': self.n_uncolored,
                'colors_used': 0,
                'avg_nodes_per_color': 0,
                'min_nodes_per_color': 0,
                'max_nodes_per_color': 0,
                'color_utilization': 0.0,
                'balance_std': 0.0
            }
        
        counts = list(color_counts.values())
        
        return {
            'n_colored': self.n_colored,
            'n_uncolored': self.n_uncolored,
            'colors_used': len(color_counts),
            'avg_nodes_per_color': np.mean(counts),
            'min_nodes_per_color': min(counts),
            'max_nodes_per_color': max(counts),
            'color_utilization': np.mean(counts) / self.capacity if self.capacity > 0 else 0.0,
            'balance_std': np.std(counts)
        }
    
    def __repr__(self) -> str:
        stats = self.compute_statistics()
        return (f"ColoringSolution("
                f"colored={self.n_colored}, "
                f"uncolored={self.n_uncolored}, "
                f"colors_used={stats['colors_used']}/{self.n_colors}, "
                f"utilization={stats['color_utilization']:.2%})")


def create_empty_solution(
    node_ids: List[int],
    n_colors: int,
    capacity: int
) -> ColoringSolution:
    """
    Create an empty solution with all nodes uncolored.
    
    Args:
        node_ids: List of node IDs
        n_colors: Number of available colors
        capacity: Maximum nodes per color
        
    Returns:
        ColoringSolution with all nodes uncolored
    """
    coloring = {node_id: 0 for node_id in node_ids}
    return ColoringSolution(
        coloring=coloring,
        n_colors=n_colors,
        capacity=capacity,
        uncolored_nodes=node_ids.copy()
    )
