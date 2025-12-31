"""
Constrained Graph Coloring Problem Definition

This module defines the core problem structure for constrained graph coloring
with capacity constraints and spatial/proximity-based conflicts.
"""

import numpy as np
import networkx as nx
from typing import List, Tuple, Optional, Callable
from dataclasses import dataclass


@dataclass
class Node:
    """Represents a node in the graph (e.g., source, task, transmitter)."""
    id: int
    position: Optional[Tuple[float, ...]] = None
    metadata: Optional[dict] = None


@dataclass
class Detector:
    """Represents a detector/receiver that defines conflict regions."""
    id: int
    position: Optional[Tuple[float, ...]] = None
    metadata: Optional[dict] = None


class ConstrainedGraphColoringProblem:
    """
    A constrained graph coloring problem with capacity constraints.
    
    This class represents a generalized multiplexing/scheduling problem where:
    - Nodes must be assigned colors (time slots, channels, resources)
    - Conflicts are determined by proximity to shared detectors/receivers
    - Each color has a limited capacity (max uses)
    
    Attributes:
        nodes: List of nodes to be colored
        detectors: List of detectors that define conflict regions
        n_colors: Number of available colors
        capacity: Maximum number of nodes per color
        max_distance: Distance threshold for conflicts
        distance_func: Function to compute distance between positions
        graph: NetworkX graph representing conflicts
    """
    
    def __init__(
        self,
        nodes: List[Node],
        detectors: List[Detector],
        n_colors: int,
        capacity: int,
        max_distance: float,
        distance_func: Optional[Callable] = None
    ):
        """
        Initialize the constrained graph coloring problem.
        
        Args:
            nodes: List of Node objects to be colored
            detectors: List of Detector objects defining conflict regions
            n_colors: Number of available colors (e.g., time slots)
            capacity: Maximum number of nodes that can share a color
            max_distance: Distance threshold - nodes within this distance
                         of the same detector conflict
            distance_func: Optional custom distance function. 
                          Defaults to Euclidean distance.
        """
        self.nodes = nodes
        self.detectors = detectors
        self.n_colors = n_colors
        self.capacity = capacity
        self.max_distance = max_distance
        self.distance_func = distance_func or self._euclidean_distance
        
        # Build conflict structures
        self._build_distance_matrix()
        self._build_conflict_graph()
        self._build_detector_node_map()
        
    def _euclidean_distance(
        self, 
        pos1: Tuple[float, ...], 
        pos2: Tuple[float, ...]
    ) -> float:
        """Compute Euclidean distance between two positions."""
        return np.sqrt(sum((a - b) ** 2 for a, b in zip(pos1, pos2)))
    
    def _build_distance_matrix(self):
        """Build matrix of distances between nodes and detectors."""
        n_nodes = len(self.nodes)
        n_detectors = len(self.detectors)
        
        self.distance_matrix = np.zeros((n_nodes, n_detectors))
        
        for i, node in enumerate(self.nodes):
            for j, detector in enumerate(self.detectors):
                if node.position is not None and detector.position is not None:
                    self.distance_matrix[i, j] = self.distance_func(
                        node.position, 
                        detector.position
                    )
                else:
                    # If no position, assume infinite distance (no conflict)
                    self.distance_matrix[i, j] = float('inf')
    
    def _build_conflict_graph(self):
        """
        Build conflict graph where edges connect nodes that cannot share a color.
        
        Two nodes conflict if they are both within max_distance of the same detector.
        """
        self.graph = nx.Graph()
        
        # Add all nodes
        for node in self.nodes:
            self.graph.add_node(node.id)
        
        # Add edges for conflicts
        n_nodes = len(self.nodes)
        for i in range(n_nodes):
            for j in range(i + 1, n_nodes):
                if self._nodes_conflict(i, j):
                    self.graph.add_edge(self.nodes[i].id, self.nodes[j].id)
    
    def _nodes_conflict(self, node_idx1: int, node_idx2: int) -> bool:
        """
        Check if two nodes conflict (cannot share the same color).
        
        Nodes conflict if they are both within max_distance of any detector.
        """
        for det_idx in range(len(self.detectors)):
            if (self.distance_matrix[node_idx1, det_idx] <= self.max_distance and
                self.distance_matrix[node_idx2, det_idx] <= self.max_distance):
                return True
        return False
    
    def _build_detector_node_map(self):
        """
        Build mapping of which nodes are within range of each detector.
        
        This is used by some algorithms for efficient conflict checking.
        """
        self.detector_nodes = {}
        
        for det_idx, detector in enumerate(self.detectors):
            nodes_in_range = []
            for node_idx, node in enumerate(self.nodes):
                if self.distance_matrix[node_idx, det_idx] <= self.max_distance:
                    nodes_in_range.append(node.id)
            self.detector_nodes[detector.id] = nodes_in_range
    
    def get_neighbors(self, node_id: int) -> List[int]:
        """Get all nodes that conflict with the given node."""
        return list(self.graph.neighbors(node_id))
    
    def get_degree(self, node_id: int) -> int:
        """Get the degree (number of conflicts) for a node."""
        return self.graph.degree(node_id)
    
    def nodes_within_detector(self, detector_id: int) -> List[int]:
        """Get all nodes within range of a detector."""
        return self.detector_nodes.get(detector_id, [])
    
    @classmethod
    def from_positions(
        cls,
        node_positions: List[Tuple[float, ...]],
        detector_positions: List[Tuple[float, ...]],
        n_colors: int,
        capacity: int,
        max_distance: float,
        distance_func: Optional[Callable] = None
    ) -> 'ConstrainedGraphColoringProblem':
        """
        Convenience constructor from position lists.
        
        Args:
            node_positions: List of position tuples for nodes
            detector_positions: List of position tuples for detectors
            n_colors: Number of available colors
            capacity: Maximum nodes per color
            max_distance: Distance threshold for conflicts
            distance_func: Optional custom distance function
            
        Returns:
            ConstrainedGraphColoringProblem instance
        """
        nodes = [Node(id=i, position=pos) 
                for i, pos in enumerate(node_positions)]
        detectors = [Detector(id=i, position=pos) 
                    for i, pos in enumerate(detector_positions)]
        
        return cls(
            nodes=nodes,
            detectors=detectors,
            n_colors=n_colors,
            capacity=capacity,
            max_distance=max_distance,
            distance_func=distance_func
        )
    
    def __repr__(self) -> str:
        return (f"ConstrainedGraphColoringProblem("
                f"nodes={len(self.nodes)}, "
                f"detectors={len(self.detectors)}, "
                f"colors={self.n_colors}, "
                f"capacity={self.capacity}, "
                f"edges={self.graph.number_of_edges()})")

