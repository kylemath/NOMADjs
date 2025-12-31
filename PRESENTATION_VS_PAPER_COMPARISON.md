# Comparison: 2015 Presentation vs 2024 Paper

## Overview

This document compares the original 2015 NOMAD presentation (Optical Imaging Summer School, Beckman Institute) with the current paper "Automated Source Multiplexing for Functional Near-Infrared Spectroscopy: A Graph Coloring Approach to Crosstalk Elimination."

## Visual Style Comparison

### Presentation (2015)
- **Theme**: Desert/nomad aesthetic with tan/beige colors
- **Background**: Desert dune imagery with traveler figure
- **GUI Style**: Classic Windows XP/2000 style panels
- **Color Scheme**: DOIL hardware colors (purple, red, pink, yellow, gray, brown, blue, etc.)
- **Visualization**: 2D grid-based helmet schematics resembling crossword puzzles

### Paper (2024)
- **Theme**: Academic/scientific
- **Figures**: Standard matplotlib plots
- **Color Scheme**: Generic colormap (tab10)
- **Visualization**: Scatter plots with node coloring

### Recommendations for Figure Improvement

The paper figures could be enhanced to match the visual identity of the original NOMAD toolbox:

1. **Use DOIL color scheme** in all source coloring visualizations
2. **Add grid-based schematic view** similar to presentation slides 12-13
3. **Include hardware context** showing the DOIL/Imagent units
4. **Adopt consistent styling** with the sand/desert palette

## Content Comparison

### Presentation Content

1. **Introduction to Optical Brain Imaging**
2. **Headgear, Patches, and Montages** - Physical hardware context
3. **Map Coloring** - Intuitive analogy
4. **Multiplexing and Crosstalk**
   - Spatial multiplexing
   - Temporal multiplexing  
   - Frequency multiplexing
5. **DOIL System** - Hardware specifics (DOIL1, DOIL2 banks)
6. **Time Division Multiplexing** - 16 time slots, 1.6ms each
7. **Graph Theory Foundations**
8. **Main Algorithm** - Monte Carlo approach in MATLAB
9. **NOMAD Workflow** - 4-panel GUI structure
10. **Limitations** - Honest assessment of approach

### Paper Content

1. **Abstract** - Formal problem statement
2. **Introduction** - Literature review, motivation
3. **Problem Formulation** - Mathematical definitions
4. **Complexity Analysis** - NP-hardness proof
5. **Algorithms** - Monte Carlo, DSATUR, Greedy
6. **Experimental Evaluation** - Benchmarks
7. **Application** - High-density fNIRS design
8. **Discussion** - Implications, limitations
9. **Conclusion**

## Key Differences

| Aspect | Presentation | Paper |
|--------|-------------|-------|
| **Audience** | Lab members, summer school | Academic reviewers |
| **Tone** | Tutorial, practical | Formal, theoretical |
| **Algorithm detail** | MATLAB code shown | Pseudocode |
| **Figures** | GUI screenshots, schematics | Plots, graphs |
| **Hardware context** | Extensive (DOIL, Boxy) | Minimal |
| **Mathematical rigor** | Informal | Formal proofs |
| **Code availability** | MATLAB toolbox | Python package |

## Missing from Paper (Present in Presentation)

1. **Hardware integration details** - DOIL1/DOIL2 bank system, Boxy integration
2. **Grid-based schematic visualization** - The crossword-style helmet layout
3. **GUI workflow** - Step-by-step visual design process
4. **Real hardware photos** - Imagent units shown in presentation
5. **PPOD/OCP/OPT3D pipeline** - Full processing workflow context
6. **Source/Detector labeling conventions** - A-P, 1-16 schemes

## Missing from Presentation (Present in Paper)

1. **NP-hardness proof** - Formal complexity analysis
2. **DSATUR algorithm** - Alternative heuristic
3. **Benchmark comparisons** - Success rate analysis
4. **Scalability analysis** - 128+ source configurations
5. **Conflict graph visualization**
6. **Color distribution statistics**

## Suggestions for Figure Improvements

### Current Paper Figures

1. `conflict_graph.pdf` - Shows conflict structure
2. `color_distribution.pdf` - Bar chart of slot usage
3. `solution_example_2d.pdf` / `solution_example_3d.pdf` - Scatter plots
4. `success_rate.pdf` - Algorithm comparison
5. `scalability.pdf` - Performance scaling
6. `algorithm_comparison.pdf` - Benchmark results

### Recommended New Figures

1. **Grid Schematic Figure**
   - Recreate the crossword-style helmet layout from slide 12-13
   - Show before (uncolored) and after (colored) states
   - Use authentic DOIL colors

2. **Hardware Context Figure**
   - Include annotated photo of Imagent/DOIL hardware
   - Show source/detector bank organization
   - Connect to time slot assignment

3. **Workflow Pipeline Figure**
   - Recreate the NOMAD→OCP→P_POD→OPT3D pipeline
   - Show file format flow (.elp → .mtg → .gdf)
   - Match original visual style

4. **Interactive Design Figure**
   - Screenshot of web-based montage designer
   - Show click-to-place interface
   - Real-time crosstalk visualization

5. **Multiplexing Animation Concept**
   - Diagram showing time slots cycling
   - Which sources fire in each slot
   - Detector coverage patterns

## Color Palette Recommendations

Based on original NOMAD presentation:

```css
/* DOIL Hardware Colors */
--doil-purple: #9b59b6;   /* Bank A */
--doil-red: #e74c3c;      /* Bank B */
--doil-pink: #fd79a8;     /* Bank C */
--doil-yellow: #f1c40f;   /* Bank D */
--doil-gray: #95a5a6;     /* Unused */
--doil-brown: #8b4513;    /* Bank F */
--doil-blue: #3498db;     /* Bank G */
--doil-cyan: #00cec9;     /* Bank H */
--doil-green: #00b894;    /* Bank I */
--doil-orange: #e17055;   /* Bank J */

/* Background Theme */
--sand-light: #e8ddc8;
--sand-medium: #d4c4a8;
--sand-dark: #b8a68a;
```

## Conclusion

The paper provides rigorous theoretical treatment but loses some of the practical context and visual identity of the original NOMAD toolbox. The new web edition bridges this gap by implementing the algorithms with the original visual style, making the tool more accessible while maintaining the paper's algorithmic contributions.

**Key recommendation**: Add 2-3 figures that connect the paper to the original hardware context and visual style, making it easier for users of the actual DOIL/Imagent systems to understand how the algorithm applies to their workflow.

