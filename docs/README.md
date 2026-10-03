# NOMAD Web Edition

**Near-infrared Optode Montage Automated Designer** - Web-based fNIRS multiplexing tool

## Overview

This is a modern web-based reimplementation of the original NOMAD MATLAB toolbox (2012), designed for automated source multiplexing assignment in functional near-infrared spectroscopy (fNIRS) systems.

## Features

- **Graph Coloring Algorithms**: Monte Carlo random restart, DSATUR, and greedy approaches
- **Interactive Montage Design**: Click-to-place source and detector positions
- **Crosstalk Validation**: Automatic verification of multiplexing solutions
- **MNE-NIRS Compatibility**: Export in SNIRF-compatible JSON format
- **Multiple Export Formats**: .mtg, .gdf, and JSON workspace files

## Quick Start

1. Open `index.html` in a modern web browser
2. Load a montage (example, .elp file, or SNIRF JSON)
3. Configure distance and channel parameters
4. Design your montage in the Schematic panel
5. Run automated multiplexing assignment
6. Validate and export your solution

## File Structure

```
web/
├── index.html           # Main application HTML
├── styles.css           # NOMAD-themed styling
├── nomad.js             # Application logic and algorithms
├── export_fsaverage.py  # Python script to export MNE fsaverage model
├── fsaverage_head.glb   # (Optional) fsaverage head mesh for 3D view
├── fsaverage_brain.glb  # (Optional) fsaverage brain mesh
└── README.md            # This file
```

## 3D fsaverage Head Model

The 3D visualization can optionally use the standard fsaverage head model from FreeSurfer/MNE for realistic anatomical rendering.

### Generating the Model

Run the export script (requires MNE-Python and trimesh):

```bash
cd web/
pip install mne trimesh pygltflib
python export_fsaverage.py
```

This will:
1. Download the fsaverage dataset from MNE
2. Export the head and brain surfaces as GLB meshes
3. Create simplified JSON versions for fallback

### Manual Installation

If you have fsaverage meshes from another source:
1. Convert to GLB format (using Blender, trimesh, etc.)
2. Name the files `fsaverage_head.glb` and `fsaverage_brain.glb`
3. Place them in the `web/` directory

The app will automatically detect and load these models when switching to 3D view.

## Comparison to Original NOMAD

| Feature | Original (MATLAB) | Web Edition |
|---------|------------------|-------------|
| Platform | MATLAB GUI | Web browser |
| Algorithms | Monte Carlo | Monte Carlo, DSATUR, Greedy |
| Input formats | .elp | .elp, SNIRF JSON |
| Output formats | .mtg, .gdf | .mtg, .gdf, SNIRF JSON |
| Visualization | 2D schematic | 2D + 3D views |
| Interactive design | Click-based | Click-based |

## MNE-NIRS Integration

The web edition uses the same visualization style as MNE-NIRS and exports SNIRF-compatible JSON:

### 3D Visualization Style

Following MNE-NIRS conventions:
- **Sources**: Red spheres (colored by time slot when assigned)
- **Detectors**: Black cubes
- **Channels**: White lines with orange midpoint markers
- **Fiducials**: Nasion (green), LPA (blue), RPA (red)

This matches the output of `mne.viz.Brain.add_sensors()`.

### Exporting from NOMAD

```python
import json
import mne
from mne_nirs.io import read_raw_snirf

# Load NOMAD JSON export
with open('montage.snirf.json', 'r') as f:
    data = json.load(f)

# Access probe information
source_pos = data['nirs']['probe']['sourcePos3D']
detector_pos = data['nirs']['probe']['detectorPos3D']
time_slots = data['nomad']['coloring']

# Convert to MNE-NIRS format as needed
```

### Visualizing with MNE

```python
import mne

# Load fsaverage for visualization
subjects_dir = mne.datasets.sample.data_path() / "subjects"
mne.datasets.fetch_fsaverage(subjects_dir=subjects_dir)

# Create brain visualization
brain = mne.viz.Brain(
    "fsaverage", subjects_dir=subjects_dir, 
    alpha=0.5, cortex="low_contrast"
)
brain.add_head()
brain.add_sensors(raw.info, trans="fsaverage")
brain.show_view(azimuth=90, elevation=90, distance=500)
```

## Algorithm Details

### Random Restart Monte Carlo
The primary algorithm. Randomly orders sources and time slots, then greedily assigns colors. Multiple trials explore the solution space effectively.

### DSATUR (Degree of Saturation)
Classic graph coloring heuristic that prioritizes nodes with the most constrained color choices.

### Greedy Random
Simple baseline that assigns sources in random order to the first available slot.

## Related Tools & Pipeline Integration

NOMAD is designed to work as the **upstream** component in a complete fNIRS/DOT pipeline. It solves the multiplexing problem (crosstalk elimination) before data acquisition. For **downstream** analysis and image reconstruction, we recommend:

### NeuroDOT (Recommended for Image Reconstruction)

[NeuroDOT_py](https://github.com/WUSTL-ORL/NeuroDOT_py) from Washington University's Optical Radiology Lab is the leading toolbox for high-density diffuse optical tomography image reconstruction:

```bash
pip install neurodot_py
```

NeuroDOT provides:
- Light modeling and forward model generation
- Tikhonov-regularized image reconstruction
- Temporal/spatial transforms for preprocessing
- Visualization tools

Recent work from this lab (Markow et al., 2025) demonstrated ultra-high-density DOT with 6.5mm spacing achieving 30-50% better spatial resolution than standard HD-DOT:

> Markow, Z.E., et al. "Ultra high density imaging arrays in diffuse optical tomography for human brain mapping improve image quality and decoding performance." Scientific Reports 15, 3175 (2025). https://doi.org/10.1038/s41598-025-85858-7

**Typical Pipeline:**
```
[NOMAD: Design Montage] → [Acquire Data] → [NeuroDOT: Image Reconstruction] → [MNE-NIRS: Analysis]
         ↓                                            ↓                              ↓
   Multiplexing           DOT measurements      Hemoglobin images          GLM, Statistics
   Crosstalk-free         .snirf format         Tomographic recon          Visualization
```

### fOLD Toolbox
When designing your optode placement, consider using the [fOLD Toolbox](https://github.com/nirx/fold) for guidance based on brain regions-of-interest:

> Morais, Guilherme Augusto Zimeo, Joana Bisol Balardin, and João Ricardo Sato. "fNIRS optodes' location decider (fOLD): a toolbox for probe arrangement guided by brain regions-of-interest." Scientific Reports 8.1 (2018): 1-11.

The ROI-based montage design feature in NOMAD Web is inspired by this approach.

## References

### NOMAD
- Original NOMAD: Mathewson, K. E. (2012). NOMAD: Near-infrared Optical Montage Automated Design.
- Paper: "Automated Source Multiplexing for Functional Near-Infrared Spectroscopy: A Graph Coloring Approach"

### HD-DOT / UHD-DOT
- Markow, Z.E., et al. (2025). "Ultra high density imaging arrays in diffuse optical tomography for human brain mapping improve image quality and decoding performance." Scientific Reports 15, 3175. https://doi.org/10.1038/s41598-025-85858-7
- Eggebrecht, A.T., et al. (2014). "Mapping distributed brain function and networks with diffuse optical tomography." Nature Photonics 8, 448-454.
- White, B.R. & Culver, J.P. (2010). "Quantitative evaluation of high-density diffuse optical tomography." J. Biomed. Opt. 15, 026006.

### Software Tools
- NeuroDOT: https://github.com/WUSTL-ORL/NeuroDOT_py (Image Reconstruction)
- MNE-NIRS: https://mne.tools/mne-nirs/ (fNIRS Analysis)
- MNE-NIRS Visualization Guide: https://mne.tools/mne-nirs/stable/auto_examples/general/plot_70_visualise_brain.html
- fOLD Toolbox: https://github.com/nirx/fold (Optode Placement)

## License

MIT License - See main project LICENSE file.

