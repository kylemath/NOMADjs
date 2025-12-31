# Paper: Automated Source Multiplexing for fNIRS

**Full Title:** *Automated Source Multiplexing for Functional Near-Infrared Spectroscopy: A Graph Coloring Approach to Crosstalk Elimination*

This directory contains the LaTeX source for the research paper and scripts to generate all figures and tables.

## Reproducibility

All figures and benchmark results in the paper are automatically generated from the codebase using a fixed random seed, ensuring complete reproducibility for fNIRS montage evaluations.

### Prerequisites

1. Ensure you have Python 3.8+ with the required packages:
   ```bash
   cd ..
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   ```

2. Ensure you have a LaTeX distribution (e.g., TeX Live, MacTeX, or MiKTeX)

### Generating Figures and Tables

Run the generation script from the paper directory:

```bash
cd paper/
python generate_paper_figures.py
```

This script will:
1. Run comprehensive benchmarks with fixed random seed (42)
2. Generate all figures as PDF files in `figures/`
3. Generate the benchmark results table in `tables/`
4. Save raw data as CSV files in `results/`

**Expected output:**
```
figures/
├── scalability.pdf          # Scalability analysis
├── algorithm_comparison.pdf # Algorithm performance comparison
├── solution_example_3d.pdf  # 3D optical imaging example
├── solution_example_2d.pdf  # 2D wireless example
├── conflict_graph.pdf       # Conflict graph visualization
└── color_distribution.pdf   # Color distribution analysis

tables/
└── benchmark_results.tex    # LaTeX table for paper

results/
├── benchmark_data.csv       # Raw benchmark results
└── scalability_data.csv     # Scalability analysis data
```

### Compiling the Paper

After generating figures:

```bash
cd paper/
pdflatex paper.tex
bibtex paper        # For bibliography
pdflatex paper.tex
pdflatex paper.tex  # Run twice for references
```

Or use `latexmk`:
```bash
latexmk -pdf paper.tex
```

## File Structure

```
paper/
├── paper.tex                  # Main LaTeX document
├── generate_paper_figures.py  # Figure/table generation script
├── README.md                  # This file
├── figures/                   # Generated figures (PDF)
├── tables/                    # Generated tables (LaTeX)
└── results/                   # Raw data (CSV)
```

## Random Seed

The master random seed is set to `42` in `generate_paper_figures.py`. This ensures:
- All benchmark problems are generated identically
- All algorithms produce the same results
- Figures are pixel-identical across runs

To change the seed, modify `MASTER_SEED` in `generate_paper_figures.py`.

## Benchmark Configuration

The script evaluates multiple algorithms on realistic fNIRS montage configurations:
- **Random Restart Monte Carlo**: 1000 trials, seed=42
- **DSATUR**: 100 trials, seed=42  
- **Greedy Random**: 200 trials, seed=42
- **Tabu Search**: Varying iterations
- **Simulated Annealing**: Varying iterations

Each algorithm-problem combination is run multiple times and evaluated for:
- Solution quality (sources assigned)
- Computation time
- Reliability across different random seeds

**Note**: For fNIRS montages that can be fully solved (all sources assigned), we should measure success rate and time-to-first-complete-solution rather than just best solution quality. This is being updated to better reflect the practical use case.

## Figures in the Paper

| Figure | Description | Source |
|--------|-------------|--------|
| Fig 1 | Conflict graph with solution | `conflict_graph.pdf` |
| Fig 2 | Algorithm comparison | `algorithm_comparison.pdf` |
| Fig 3 | Scalability analysis | `scalability.pdf` |
| Fig 4 | Color distribution | `color_distribution.pdf` |
| Fig 5 | Optical imaging example | `solution_example_3d.pdf` |
| Fig 6 | Wireless example | `solution_example_2d.pdf` |

## Tables in the Paper

| Table | Description | Source |
|-------|-------------|--------|
| Table 1 | Algorithm performance | `tables/benchmark_results.tex` |

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
