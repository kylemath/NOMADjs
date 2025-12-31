"""
Problem generators for benchmarking.

This module provides various generators for creating test problems
with different characteristics, including challenging high-conflict instances.
"""

import numpy as np
from typing import List, Tuple, Optional
import sys
sys.path.append('..')

from src.core.problem import ConstrainedGraphColoringProblem


class ProblemGenerator:
    """Generator for constrained graph coloring problems."""
    
    @staticmethod
    def high_conflict_dense(
        n_nodes: int,
        n_detectors: int,
        n_colors: int,
        capacity: int,
        density: float = 0.7,
        seed: int = None
    ) -> ConstrainedGraphColoringProblem:
        """
        Generate a challenging high-conflict dense problem.
        
        Creates problems where most nodes are within range of multiple
        detectors, leading to dense conflict graphs that are hard to color.
        
        Args:
            n_nodes: Number of nodes
            n_detectors: Number of detectors
            n_colors: Number of colors
            capacity: Capacity per color
            density: Target graph density (0-1), higher = more conflicts
            seed: Random seed
            
        Returns:
            ConstrainedGraphColoringProblem with dense conflicts
        """
        if seed is not None:
            np.random.seed(seed)
        
        # Place nodes and detectors in a small region to maximize overlap
        region_size = 100.0
        
        # Place detectors in overlapping grid pattern
        det_per_side = int(np.ceil(np.sqrt(n_detectors)))
        detector_positions = []
        for i in range(n_detectors):
            x = (i % det_per_side) * (region_size / det_per_side) + region_size / (2 * det_per_side)
            y = (i // det_per_side) * (region_size / det_per_side) + region_size / (2 * det_per_side)
            z = np.random.uniform(0, 10)  # Slight z variation
            detector_positions.append((x, y, z))
        
        # Place nodes randomly in the same region
        node_positions = [
            (
                np.random.uniform(0, region_size),
                np.random.uniform(0, region_size),
                np.random.uniform(0, 10)
            )
            for _ in range(n_nodes)
        ]
        
        # Calculate max_distance to achieve target density
        # Higher density = larger max_distance
        max_distance = region_size * (0.3 + 0.5 * density)
        
        return ConstrainedGraphColoringProblem.from_positions(
            node_positions=node_positions,
            detector_positions=detector_positions,
            n_colors=n_colors,
            capacity=capacity,
            max_distance=max_distance
        )
    
    @staticmethod
    def extreme_conflict(
        n_nodes: int = 40,
        n_colors: int = 6,
        capacity: int = 6,
        seed: int = None
    ) -> ConstrainedGraphColoringProblem:
        """
        Generate an extremely challenging near-clique problem.
        
        All nodes are placed near a single detector, creating a near-complete
        conflict graph. This is one of the hardest cases for graph coloring.
        
        Args:
            n_nodes: Number of nodes
            n_colors: Number of colors  
            capacity: Capacity per color
            seed: Random seed
            
        Returns:
            ConstrainedGraphColoringProblem with near-clique structure
        """
        if seed is not None:
            np.random.seed(seed)
        
        # All nodes clustered around single detector
        center = (50.0, 50.0, 50.0)
        
        node_positions = [
            (
                center[0] + np.random.uniform(-5, 5),
                center[1] + np.random.uniform(-5, 5),
                center[2] + np.random.uniform(-5, 5)
            )
            for _ in range(n_nodes)
        ]
        
        detector_positions = [center]
        
        # Large max_distance ensures all nodes conflict with each other
        max_distance = 100.0
        
        return ConstrainedGraphColoringProblem.from_positions(
            node_positions=node_positions,
            detector_positions=detector_positions,
            n_colors=n_colors,
            capacity=capacity,
            max_distance=max_distance
        )
    
    @staticmethod
    def overlapping_clusters(
        n_clusters: int = 5,
        nodes_per_cluster: int = 10,
        n_detectors: int = 8,
        n_colors: int = 8,
        capacity: int = 6,
        overlap_factor: float = 0.5,
        seed: int = None
    ) -> ConstrainedGraphColoringProblem:
        """
        Generate overlapping clusters creating complex inter-cluster conflicts.
        
        Creates clusters that overlap in detector coverage, making the
        problem harder than well-separated clusters.
        
        Args:
            n_clusters: Number of clusters
            nodes_per_cluster: Nodes per cluster
            n_detectors: Number of detectors
            n_colors: Number of colors
            capacity: Capacity per color
            overlap_factor: How much clusters overlap (0=separate, 1=fully overlapping)
            seed: Random seed
            
        Returns:
            ConstrainedGraphColoringProblem with overlapping clusters
        """
        if seed is not None:
            np.random.seed(seed)
        
        node_positions = []
        cluster_radius = 30.0
        # Smaller separation = more overlap
        cluster_separation = cluster_radius * 3 * (1 - overlap_factor) + cluster_radius
        
        # Create clusters in circular arrangement
        for i in range(n_clusters):
            angle = 2 * np.pi * i / n_clusters
            center_x = 100 + cluster_separation * np.cos(angle)
            center_y = 100 + cluster_separation * np.sin(angle)
            center_z = 0
            
            for _ in range(nodes_per_cluster):
                offset_x = np.random.uniform(-cluster_radius, cluster_radius)
                offset_y = np.random.uniform(-cluster_radius, cluster_radius)
                offset_z = np.random.uniform(-10, 10)
                
                node_positions.append((
                    center_x + offset_x,
                    center_y + offset_y,
                    center_z + offset_z
                ))
        
        # Place detectors between clusters to maximize coverage overlap
        detector_positions = []
        for i in range(n_detectors):
            angle = 2 * np.pi * (i + 0.5) / n_detectors  # Offset from cluster centers
            detector_positions.append((
                100 + cluster_separation * 0.5 * np.cos(angle),
                100 + cluster_separation * 0.5 * np.sin(angle),
                0
            ))
        
        # Large max_distance to create inter-cluster conflicts
        max_distance = cluster_radius * 2.5
        
        return ConstrainedGraphColoringProblem.from_positions(
            node_positions=node_positions,
            detector_positions=detector_positions,
            n_colors=n_colors,
            capacity=capacity,
            max_distance=max_distance
        )
    
    @staticmethod
    def realistic_brain_imaging(
        n_sources: int = 32,
        n_detectors: int = 15,
        n_timeslots: int = 8,
        capacity: int = 4,
        head_radius: float = 100.0,
        transmission_range: float = 50.0,
        seed: int = None
    ) -> ConstrainedGraphColoringProblem:
        """
        Generate a realistic optical brain imaging (fNIRS/DOT) problem.
        
        Simulates the actual NOMAD problem: sources and detectors on a
        hemispherical head surface with realistic transmission distances.
        
        Args:
            n_sources: Number of light sources
            n_detectors: Number of light detectors  
            n_timeslots: Number of time slots in multiplexing cycle
            capacity: Max sources per time slot
            head_radius: Head radius in mm
            transmission_range: Source-detector coupling range in mm
            seed: Random seed
            
        Returns:
            ConstrainedGraphColoringProblem mimicking real fNIRS setup
        """
        if seed is not None:
            np.random.seed(seed)
        
        def random_hemisphere_point(radius):
            """Generate random point on upper hemisphere."""
            theta = np.random.uniform(0, 2 * np.pi)
            # Only upper hemisphere (phi from 0 to pi/2)
            phi = np.random.uniform(0, np.pi / 2)
            x = radius * np.sin(phi) * np.cos(theta)
            y = radius * np.sin(phi) * np.sin(theta)
            z = radius * np.cos(phi)
            return (x, y, z)
        
        # Sources on head surface
        source_positions = [random_hemisphere_point(head_radius) for _ in range(n_sources)]
        
        # Detectors slightly closer to center (inside the sources)
        detector_positions = [random_hemisphere_point(head_radius * 0.95) for _ in range(n_detectors)]
        
        return ConstrainedGraphColoringProblem.from_positions(
            node_positions=source_positions,
            detector_positions=detector_positions,
            n_colors=n_timeslots,
            capacity=capacity,
            max_distance=transmission_range
        )
    
    @staticmethod
    def random_3d_sphere(
        n_nodes: int,
        n_detectors: int,
        n_colors: int,
        capacity: int,
        max_distance: float,
        radius: float = 100.0,
        seed: int = None
    ) -> ConstrainedGraphColoringProblem:
        """
        Generate random problem with nodes on a sphere.
        
        Args:
            n_nodes: Number of nodes
            n_detectors: Number of detectors
            n_colors: Number of colors
            capacity: Capacity per color
            max_distance: Distance threshold
            radius: Sphere radius
            seed: Random seed
            
        Returns:
            ConstrainedGraphColoringProblem
        """
        if seed is not None:
            np.random.seed(seed)
        
        def random_sphere_point(r):
            theta = np.random.uniform(0, 2 * np.pi)
            phi = np.random.uniform(0, np.pi)
            x = r * np.sin(phi) * np.cos(theta)
            y = r * np.sin(phi) * np.sin(theta)
            z = r * np.cos(phi)
            return (x, y, z)
        
        node_positions = [random_sphere_point(radius) for _ in range(n_nodes)]
        detector_positions = [
            random_sphere_point(radius * 1.05) 
            for _ in range(n_detectors)
        ]
        
        return ConstrainedGraphColoringProblem.from_positions(
            node_positions=node_positions,
            detector_positions=detector_positions,
            n_colors=n_colors,
            capacity=capacity,
            max_distance=max_distance
        )
    
    @staticmethod
    def random_2d_plane(
        n_nodes: int,
        n_detectors: int,
        n_colors: int,
        capacity: int,
        max_distance: float,
        area_size: float = 1000.0,
        seed: int = None
    ) -> ConstrainedGraphColoringProblem:
        """
        Generate random problem with nodes on a 2D plane.
        
        Args:
            n_nodes: Number of nodes
            n_detectors: Number of detectors
            n_colors: Number of colors
            capacity: Capacity per color
            max_distance: Distance threshold
            area_size: Size of square area
            seed: Random seed
            
        Returns:
            ConstrainedGraphColoringProblem
        """
        if seed is not None:
            np.random.seed(seed)
        
        node_positions = [
            (np.random.uniform(0, area_size), np.random.uniform(0, area_size))
            for _ in range(n_nodes)
        ]
        
        detector_positions = [
            (np.random.uniform(0, area_size), np.random.uniform(0, area_size))
            for _ in range(n_detectors)
        ]
        
        return ConstrainedGraphColoringProblem.from_positions(
            node_positions=node_positions,
            detector_positions=detector_positions,
            n_colors=n_colors,
            capacity=capacity,
            max_distance=max_distance
        )
    
    @staticmethod
    def clustered_nodes(
        n_clusters: int,
        nodes_per_cluster: int,
        n_detectors: int,
        n_colors: int,
        capacity: int,
        max_distance: float,
        cluster_radius: float = 20.0,
        cluster_separation: float = 100.0,
        seed: int = None
    ) -> ConstrainedGraphColoringProblem:
        """
        Generate problem with clustered nodes.
        
        This creates a more structured problem where nodes are grouped
        into clusters, useful for testing algorithm performance on
        problems with community structure.
        
        Args:
            n_clusters: Number of clusters
            nodes_per_cluster: Nodes in each cluster
            n_detectors: Number of detectors
            n_colors: Number of colors
            capacity: Capacity per color
            max_distance: Distance threshold
            cluster_radius: Radius of each cluster
            cluster_separation: Distance between cluster centers
            seed: Random seed
            
        Returns:
            ConstrainedGraphColoringProblem
        """
        if seed is not None:
            np.random.seed(seed)
        
        node_positions = []
        
        # Create cluster centers in a circle
        for i in range(n_clusters):
            angle = 2 * np.pi * i / n_clusters
            center_x = cluster_separation * np.cos(angle)
            center_y = cluster_separation * np.sin(angle)
            center_z = 0
            
            # Add nodes around this center
            for _ in range(nodes_per_cluster):
                offset_x = np.random.uniform(-cluster_radius, cluster_radius)
                offset_y = np.random.uniform(-cluster_radius, cluster_radius)
                offset_z = np.random.uniform(-cluster_radius, cluster_radius)
                
                node_positions.append((
                    center_x + offset_x,
                    center_y + offset_y,
                    center_z + offset_z
                ))
        
        # Place detectors at cluster centers
        detector_positions = []
        for i in range(n_detectors):
            angle = 2 * np.pi * i / n_detectors
            detector_positions.append((
                cluster_separation * np.cos(angle),
                cluster_separation * np.sin(angle),
                0
            ))
        
        return ConstrainedGraphColoringProblem.from_positions(
            node_positions=node_positions,
            detector_positions=detector_positions,
            n_colors=n_colors,
            capacity=capacity,
            max_distance=max_distance
        )
    
    @staticmethod
    def grid_layout(
        grid_size: int,
        n_detectors: int,
        n_colors: int,
        capacity: int,
        max_distance: float,
        spacing: float = 10.0,
        seed: int = None
    ) -> ConstrainedGraphColoringProblem:
        """
        Generate problem with nodes on a regular grid.
        
        Args:
            grid_size: Size of grid (grid_size x grid_size nodes)
            n_detectors: Number of detectors
            n_colors: Number of colors
            capacity: Capacity per color
            max_distance: Distance threshold
            spacing: Distance between grid points
            seed: Random seed
            
        Returns:
            ConstrainedGraphColoringProblem
        """
        if seed is not None:
            np.random.seed(seed)
        
        # Create grid of nodes
        node_positions = []
        for i in range(grid_size):
            for j in range(grid_size):
                node_positions.append((i * spacing, j * spacing, 0))
        
        # Random detector positions
        max_coord = (grid_size - 1) * spacing
        detector_positions = [
            (
                np.random.uniform(0, max_coord),
                np.random.uniform(0, max_coord),
                0
            )
            for _ in range(n_detectors)
        ]
        
        return ConstrainedGraphColoringProblem.from_positions(
            node_positions=node_positions,
            detector_positions=detector_positions,
            n_colors=n_colors,
            capacity=capacity,
            max_distance=max_distance
        )

