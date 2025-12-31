"""
Visualization functions for graph coloring problems and solutions.
"""

import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import networkx as nx
from typing import Optional
import sys
sys.path.append('../..')

from src.core.problem import ConstrainedGraphColoringProblem
from src.core.solution import ColoringSolution


def plot_solution_3d(
    problem: ConstrainedGraphColoringProblem,
    solution: ColoringSolution,
    show_detectors: bool = True,
    show_conflicts: bool = False,
    title: Optional[str] = None,
    save_path: Optional[str] = None
):
    """
    Plot a 3D visualization of the solution.
    
    Args:
        problem: Problem instance
        solution: Solution to visualize
        show_detectors: Whether to show detector positions
        show_conflicts: Whether to show conflict edges
        title: Plot title
        save_path: Optional path to save figure
    """
    fig = plt.figure(figsize=(12, 10))
    ax = fig.add_subplot(111, projection='3d')
    
    # Get node positions
    node_positions = np.array([node.position for node in problem.nodes])
    
    if node_positions.shape[1] != 3:
        raise ValueError("Node positions must be 3D for this plot")
    
    # Color map
    colors = plt.cm.tab10(np.linspace(0, 1, problem.n_colors + 1))
    
    # Plot nodes colored by solution
    for node in problem.nodes:
        color_idx = solution.coloring[node.id]
        pos = node.position
        
        if color_idx == 0:  # Uncolored
            ax.scatter(*pos, c='gray', s=100, alpha=0.5, edgecolors='black', linewidths=2)
        else:
            ax.scatter(*pos, c=[colors[color_idx]], s=200, alpha=0.8, edgecolors='black', linewidths=1)
    
    # Plot detectors
    if show_detectors:
        detector_positions = np.array([det.position for det in problem.detectors])
        ax.scatter(
            detector_positions[:, 0],
            detector_positions[:, 1],
            detector_positions[:, 2],
            c='red', s=300, alpha=0.6, marker='^',
            edgecolors='darkred', linewidths=2,
            label='Detectors'
        )
    
    # Plot conflict edges
    if show_conflicts:
        for edge in problem.graph.edges():
            node1_pos = problem.nodes[edge[0]].position
            node2_pos = problem.nodes[edge[1]].position
            
            # Only show conflicts between same-colored nodes
            if solution.coloring[edge[0]] == solution.coloring[edge[1]] and solution.coloring[edge[0]] > 0:
                ax.plot(
                    [node1_pos[0], node2_pos[0]],
                    [node1_pos[1], node2_pos[1]],
                    [node1_pos[2], node2_pos[2]],
                    'r-', alpha=0.3, linewidth=0.5
                )
    
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    
    if title:
        ax.set_title(title, fontsize=14, fontweight='bold')
    else:
        stats = solution.compute_statistics()
        ax.set_title(
            f'Solution: {solution.n_colored}/{len(problem.nodes)} nodes colored\n'
            f'Utilization: {stats["color_utilization"]:.1%}',
            fontsize=12
        )
    
    if show_detectors:
        ax.legend()
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Figure saved to {save_path}")
    
    plt.show()


def plot_solution_2d(
    problem: ConstrainedGraphColoringProblem,
    solution: ColoringSolution,
    show_detectors: bool = True,
    show_conflicts: bool = False,
    title: Optional[str] = None,
    save_path: Optional[str] = None
):
    """
    Plot a 2D visualization of the solution.
    
    Args:
        problem: Problem instance
        solution: Solution to visualize
        show_detectors: Whether to show detector positions
        show_conflicts: Whether to show conflict edges
        title: Plot title
        save_path: Optional path to save figure
    """
    fig, ax = plt.subplots(figsize=(12, 10))
    
    # Get node positions (use first 2 dimensions)
    node_positions = np.array([node.position[:2] for node in problem.nodes])
    
    # Color map
    colors = plt.cm.tab10(np.linspace(0, 1, problem.n_colors + 1))
    
    # Plot conflict edges first (so they're behind nodes)
    if show_conflicts:
        for edge in problem.graph.edges():
            node1_pos = problem.nodes[edge[0]].position[:2]
            node2_pos = problem.nodes[edge[1]].position[:2]
            ax.plot(
                [node1_pos[0], node2_pos[0]],
                [node1_pos[1], node2_pos[1]],
                'k-', alpha=0.1, linewidth=0.5, zorder=1
            )
    
    # Plot nodes colored by solution
    for node in problem.nodes:
        color_idx = solution.coloring[node.id]
        pos = node.position[:2]
        
        if color_idx == 0:  # Uncolored
            ax.scatter(*pos, c='gray', s=200, alpha=0.5, edgecolors='black', linewidths=2, zorder=3)
        else:
            ax.scatter(*pos, c=[colors[color_idx]], s=300, alpha=0.8, edgecolors='black', linewidths=1, zorder=3)
    
    # Plot detectors
    if show_detectors:
        detector_positions = np.array([det.position[:2] for det in problem.detectors])
        ax.scatter(
            detector_positions[:, 0],
            detector_positions[:, 1],
            c='red', s=400, alpha=0.6, marker='^',
            edgecolors='darkred', linewidths=2,
            label='Detectors', zorder=2
        )
    
    ax.set_xlabel('X', fontsize=12)
    ax.set_ylabel('Y', fontsize=12)
    ax.set_aspect('equal')
    ax.grid(True, alpha=0.3)
    
    if title:
        ax.set_title(title, fontsize=14, fontweight='bold')
    else:
        stats = solution.compute_statistics()
        ax.set_title(
            f'Solution: {solution.n_colored}/{len(problem.nodes)} nodes colored | '
            f'Utilization: {stats["color_utilization"]:.1%}',
            fontsize=12
        )
    
    if show_detectors:
        ax.legend(fontsize=10)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Figure saved to {save_path}")
    
    plt.show()


def plot_conflict_graph(
    problem: ConstrainedGraphColoringProblem,
    solution: Optional[ColoringSolution] = None,
    layout: str = 'spring',
    title: Optional[str] = None,
    save_path: Optional[str] = None
):
    """
    Plot the conflict graph.
    
    Args:
        problem: Problem instance
        solution: Optional solution to color nodes
        layout: Layout algorithm ('spring', 'circular', 'kamada_kawai')
        title: Plot title
        save_path: Optional path to save figure
    """
    fig, ax = plt.subplots(figsize=(12, 10))
    
    # Choose layout
    if layout == 'spring':
        pos = nx.spring_layout(problem.graph, seed=42)
    elif layout == 'circular':
        pos = nx.circular_layout(problem.graph)
    elif layout == 'kamada_kawai':
        pos = nx.kamada_kawai_layout(problem.graph)
    else:
        pos = nx.spring_layout(problem.graph, seed=42)
    
    # Color nodes by solution if provided
    if solution:
        colors = plt.cm.tab10(np.linspace(0, 1, problem.n_colors + 1))
        node_colors = [
            colors[solution.coloring[node.id]] if solution.coloring[node.id] > 0 else 'gray'
            for node in problem.nodes
        ]
    else:
        node_colors = 'lightblue'
    
    # Draw graph
    nx.draw_networkx_nodes(
        problem.graph, pos,
        node_color=node_colors,
        node_size=500,
        alpha=0.8,
        edgecolors='black',
        linewidths=1,
        ax=ax
    )
    
    nx.draw_networkx_edges(
        problem.graph, pos,
        alpha=0.3,
        width=1,
        ax=ax
    )
    
    nx.draw_networkx_labels(
        problem.graph, pos,
        font_size=8,
        font_weight='bold',
        ax=ax
    )
    
    if title:
        ax.set_title(title, fontsize=14, fontweight='bold')
    else:
        ax.set_title(
            f'Conflict Graph: {problem.graph.number_of_nodes()} nodes, '
            f'{problem.graph.number_of_edges()} edges\n'
            f'Avg degree: {2 * problem.graph.number_of_edges() / problem.graph.number_of_nodes():.2f}',
            fontsize=12
        )
    
    ax.axis('off')
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Figure saved to {save_path}")
    
    plt.show()


def plot_color_distribution(
    solution: ColoringSolution,
    problem: ConstrainedGraphColoringProblem,
    title: Optional[str] = None,
    save_path: Optional[str] = None
):
    """
    Plot the distribution of nodes across colors.
    
    Args:
        solution: Solution to visualize
        problem: Problem instance
        title: Plot title
        save_path: Optional path to save figure
    """
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    # Bar chart of nodes per color
    color_counts = solution.get_color_counts()
    colors_list = list(range(1, problem.n_colors + 1))
    counts = [color_counts.get(c, 0) for c in colors_list]
    
    bars = ax1.bar(colors_list, counts, color=plt.cm.tab10(np.linspace(0, 1, problem.n_colors + 1)[1:]))
    ax1.axhline(y=problem.capacity, color='r', linestyle='--', label=f'Capacity ({problem.capacity})')
    ax1.set_xlabel('Color (Time Slot)', fontsize=12)
    ax1.set_ylabel('Number of Nodes', fontsize=12)
    ax1.set_title('Nodes per Color', fontsize=12, fontweight='bold')
    ax1.legend()
    ax1.grid(True, alpha=0.3, axis='y')
    
    # Add value labels on bars
    for bar in bars:
        height = bar.get_height()
        if height > 0:
            ax1.text(bar.get_x() + bar.get_width()/2., height,
                    f'{int(height)}',
                    ha='center', va='bottom', fontsize=10)
    
    # Statistics table
    stats = solution.compute_statistics()
    
    stats_text = [
        ['Metric', 'Value'],
        ['─' * 30, '─' * 15],
        ['Nodes colored', f"{stats['n_colored']}/{stats['n_colored'] + stats['n_uncolored']}"],
        ['Colors used', f"{stats['colors_used']}/{problem.n_colors}"],
        ['Avg nodes/color', f"{stats['avg_nodes_per_color']:.2f}"],
        ['Min nodes/color', f"{stats['min_nodes_per_color']}"],
        ['Max nodes/color', f"{stats['max_nodes_per_color']}"],
        ['Capacity', f"{problem.capacity}"],
        ['Utilization', f"{stats['color_utilization']:.1%}"],
        ['Balance (std)', f"{stats['balance_std']:.3f}"],
    ]
    
    ax2.axis('tight')
    ax2.axis('off')
    
    table = ax2.table(
        cellText=stats_text,
        cellLoc='left',
        loc='center',
        colWidths=[0.6, 0.4]
    )
    
    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 2)
    
    # Style header row
    for i in range(2):
        table[(0, i)].set_facecolor('#4CAF50')
        table[(0, i)].set_text_props(weight='bold', color='white')
    
    # Style data rows
    for i in range(2, len(stats_text)):
        for j in range(2):
            if i % 2 == 0:
                table[(i, j)].set_facecolor('#f0f0f0')
    
    ax2.set_title('Solution Statistics', fontsize=12, fontweight='bold', pad=20)
    
    if title:
        fig.suptitle(title, fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Figure saved to {save_path}")
    
    plt.show()


def plot_benchmark_comparison(
    results_df,
    metric: str = 'n_colored',
    title: Optional[str] = None,
    save_path: Optional[str] = None
):
    """
    Plot benchmark comparison across algorithms and problems.
    
    Args:
        results_df: DataFrame from BenchmarkSuite.get_results_dataframe()
        metric: Metric to compare
        title: Plot title
        save_path: Optional path to save figure
    """
    import pandas as pd
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    
    # Grouped bar chart by problem
    pivot_data = results_df.pivot_table(
        values=metric,
        index='problem_name',
        columns='algorithm_name',
        aggfunc='mean'
    )
    
    pivot_data.plot(kind='bar', ax=ax1, width=0.8)
    ax1.set_xlabel('Problem', fontsize=12)
    ax1.set_ylabel(metric.replace('_', ' ').title(), fontsize=12)
    ax1.set_title(f'{metric.replace("_", " ").title()} by Problem', fontsize=12, fontweight='bold')
    ax1.legend(title='Algorithm', fontsize=10)
    ax1.grid(True, alpha=0.3, axis='y')
    plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    # Box plot by algorithm
    algorithms = results_df['algorithm_name'].unique()
    data_by_algo = [results_df[results_df['algorithm_name'] == algo][metric].values 
                    for algo in algorithms]
    
    bp = ax2.boxplot(data_by_algo, labels=algorithms, patch_artist=True)
    
    # Color boxes
    colors = plt.cm.Set3(np.linspace(0, 1, len(algorithms)))
    for patch, color in zip(bp['boxes'], colors):
        patch.set_facecolor(color)
    
    ax2.set_xlabel('Algorithm', fontsize=12)
    ax2.set_ylabel(metric.replace('_', ' ').title(), fontsize=12)
    ax2.set_title(f'{metric.replace("_", " ").title()} Distribution', fontsize=12, fontweight='bold')
    ax2.grid(True, alpha=0.3, axis='y')
    plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    if title:
        fig.suptitle(title, fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Figure saved to {save_path}")
    
    plt.show()

