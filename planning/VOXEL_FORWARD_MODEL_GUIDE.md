# Voxel-Based Forward Model Guide

## Overview

NOMAD now includes a complete **voxel-based forward model** that calculates how each fNIRS channel's photon migration path interacts with brain voxels. This creates a sensitivity matrix for source reconstruction, enabling you to localize brain activity in 3D space from fNIRS measurements.

## What is a Forward Model?

### The Problem

**fNIRS measures**: Changes in optical density (ΔOD) at each channel
**We want to know**: Where in the brain is activity occurring?

### The Solution

Build a model that relates brain activity to measurements:

```
ΔOD = A × Δμₐ
```

Where:
- **ΔOD**: Measured signal (channels × 1 vector)
- **A**: Sensitivity matrix (channels × voxels)
- **Δμₐ**: Change in absorption coefficient (voxels × 1 vector)

The sensitivity matrix **A[i,j]** tells us: "How much does voxel j contribute to channel i's signal?"

## Voxel Grid System

### 3D Grid Definition

**Bounds** (default):
- X: -80mm to +80mm (left to right, 160mm span)
- Y: -80mm to +80mm (posterior to anterior, 160mm span)
- Z: -20mm to +100mm (inferior to superior, 120mm span)

**Resolution options**:
- **10mm**: Coarse (~1,000 voxels inside head)
- **5mm**: Medium (~10,000 voxels) ← Default
- **3mm**: Fine (~50,000 voxels)
- **2mm**: Very fine (~170,000 voxels)

**Grid structure**:
```javascript
VoxelGrid = {
  bounds: {xMin, xMax, yMin, yMax, zMin, zMax},
  resolution: 5,  // mm
  dimensions: {nx, ny, nz},
  totalVoxels: nx × ny × nz,
  voxels: [
    {
      id: 0,
      ix, iy, iz,        // Grid indices
      x, y, z,           // 3D coordinates (mm)
      isInsideHead: true,
      sensitivity: {},   // Map: channelId -> weight
      totalSensitivity: 0.0
    },
    ...
  ]
}
```

### Inside Head Detection

Only voxels inside the head are used:
```javascript
distFromCenter = sqrt(x² + y² + z²)
isInsideHead = (distFromCenter < 95mm)
```

Approximates head as sphere with 95mm radius.

## Sensitivity Calculation

### Path Integration Algorithm

For each channel's photon migration path:

```javascript
1. Get path points (30 points along banana curve)
2. Get sensitivity profile (Gaussian, peaks in middle)
3. For each segment between points:
   a. Calculate segment length
   b. March along segment in small steps
   c. Find which voxel each step is in
   d. Accumulate contribution:
      weight = sensitivity × segment_length
   e. Add to voxel's sensitivity map
```

### Mathematical Formula

For channel `i` and voxel `j`:

```
A[i,j] = Σₖ S(k) × L(k) × δ(k ∈ j)
```

Where:
- `S(k)`: Sensitivity at path point k (from Gaussian profile)
- `L(k)`: Path segment length at k
- `δ(k ∈ j)`: 1 if point k is in voxel j, 0 otherwise

### Sensitivity Profile

Along the banana-shaped path:

```
S(t) = exp(-8 × (t - 0.5)²)

Where t ∈ [0, 1] is parameter along path
```

**Result**:
- t = 0 (source): S = 0.05 (5%)
- t = 0.5 (apex/middle): S = 1.0 (100%)
- t = 1 (detector): S = 0.05 (5%)

Peak sensitivity at deepest point of banana!

## Sparse Matrix Storage

### Why Sparse?

**Full matrix**:
- 100 channels × 10,000 voxels = 1,000,000 entries
- Most are zero (photon path doesn't go through most voxels)
- Wastes memory and computation

**Sparse matrix**:
- Store only non-zero entries
- Typical: 99% sparse (only 1% non-zero)
- 100 channels × 10,000 voxels → ~10,000 stored entries
- 100× memory savings!

### Storage Format

```javascript
sensitivityMatrix = {
  sparse: [
    {channel: 0, channelId: 'S1-D1', voxel: 1234, weight: 0.523},
    {channel: 0, channelId: 'S1-D1', voxel: 1235, weight: 0.891},
    {channel: 1, channelId: 'S1-D2', voxel: 1240, weight: 0.334},
    ...
  ],
  nChannels: 100,
  nVoxels: 10000,
  nNonZero: 10000,
  sparsity: 0.99,  // 99% sparse
  channelMaps: {
    'S1-D1': {1234: 0.523, 1235: 0.891, ...},
    'S1-D2': {1240: 0.334, ...},
    ...
  }
}
```

### Performance

**Build time**:
- 50 channels, 5mm resolution: ~100ms
- 100 channels, 5mm resolution: ~200ms
- 100 channels, 3mm resolution: ~1000ms

**Memory**:
- Sparse storage: ~20 bytes per non-zero entry
- 10,000 entries: ~200KB
- 100,000 entries: ~2MB

## 3D Visualization

### Voxel Display

**Color coding** (heat map):
- **Blue**: Low sensitivity (threshold level)
- **Cyan**: Low-medium sensitivity
- **Yellow**: Medium-high sensitivity
- **Red**: Highest sensitivity

**Opacity**:
- Proportional to sensitivity
- High sensitivity: More opaque (70%)
- Low sensitivity: More transparent (30%)

**Threshold slider**:
- Show top X% most sensitive voxels
- Default: 20% (top quintile)
- Reduces visual clutter
- Focuses on measurement volume

### Visual Interpretation

**Dense red voxels**: Core measurement region
- Highest contribution to signal
- Best localization accuracy
- Target for activation

**Yellow/cyan voxels**: Extended sensitivity
- Moderate contribution
- Broader measurement volume
- Context for activation

**Blue voxels**: Peripheral sensitivity
- Low contribution
- Boundary of measurement volume
- Less reliable localization

### Overlapping Channels

When multiple channels' paths cross:
- Voxel receives contributions from both
- `totalSensitivity` = sum of all channels
- Voxel appears brighter (higher opacity)
- Shows regions with redundant coverage
- Good: Multiple channels → better SNR
- Bad: Too much overlap → mixed signals

## Building the Sensitivity Matrix

### Workflow

1. **Design montage**: Place sources and detectors
2. **Generate channels**: Create source-detector pairs
3. **Calculate photon paths**: Banana-shaped trajectories
4. **Initialize voxel grid**: Choose resolution
5. **Build sensitivity matrix**: Click button
6. **Visualize**: See sensitive voxels in 3D
7. **Export**: Save matrix for analysis

### UI Controls

**Voxel Resolution**:
- Trade-off: Resolution vs. computation time
- 5mm recommended for most applications
- 3mm for high-resolution reconstruction

**Show Sensitive Voxels**:
- Toggle voxel visualization on/off
- Checkbox in configuration panel

**Voxel Threshold**:
- Slider: 1% to 100%
- Default: 20%
- Shows top X% most sensitive voxels

**Build Sensitivity Matrix**:
- Button to compute matrix
- Shows progress and results
- Updates voxel visualization

**Export Matrix**:
- Saves JSON file with:
  - Sparse sensitivity matrix
  - Voxel grid definition
  - Channel information
  - Metadata

## Export Format

### JSON Structure

```json
{
  "matrix": {
    "sparse": [
      {"channel": 0, "channelId": "S1-D1", "voxel": 1234, "weight": 0.523},
      ...
    ],
    "nChannels": 100,
    "nVoxels": 10000,
    "nNonZero": 10000,
    "sparsity": 0.99
  },
  "voxelGrid": {
    "bounds": {"xMin": -80, "xMax": 80, ...},
    "resolution": 5,
    "dimensions": {"nx": 32, "ny": 32, "nz": 24},
    "voxels": [
      {"id": 0, "x": -77.5, "y": -77.5, "z": -17.5, "totalSensitivity": 0.0},
      ...
    ]
  },
  "channels": [
    {
      "id": "S1-D1",
      "sourceId": "S1",
      "detectorId": "D1",
      "distance": 30.0,
      "penetrationDepth": 13.5
    },
    ...
  ],
  "metadata": {
    "exportDate": "2025-01-02T12:00:00.000Z",
    "software": "NOMAD fNIRS Montage Designer",
    "version": "2.0"
  }
}
```

### Using Exported Data

**In Python** (for analysis):

```python
import json
import numpy as np
from scipy.sparse import csr_matrix

# Load exported data
with open('sensitivity_matrix.json') as f:
    data = json.load(f)

# Build sparse matrix
sparse_data = data['matrix']['sparse']
rows = [e['channel'] for e in sparse_data]
cols = [e['voxel'] for e in sparse_data]
vals = [e['weight'] for e in sparse_data]

A = csr_matrix((vals, (rows, cols)), 
               shape=(data['matrix']['nChannels'], 
                      data['matrix']['nVoxels']))

# Now use A for source reconstruction!
```

**In MATLAB**:

```matlab
% Load exported data
data = jsondecode(fileread('sensitivity_matrix.json'));

% Build sparse matrix
sparse_data = data.matrix.sparse;
rows = [sparse_data.channel] + 1;  % MATLAB 1-indexed
cols = [sparse_data.voxel] + 1;
vals = [sparse_data.weight];

A = sparse(rows, cols, vals, ...
           data.matrix.nChannels, ...
           data.matrix.nVoxels);
```

## Source Reconstruction

### Forward Problem

Given brain activity Δμₐ, predict measurements:

```
ΔOD = A × Δμₐ
```

**Use case**: Simulate expected signals for given activation pattern

### Inverse Problem

Given measurements ΔOD, estimate brain activity:

```
Δμₐ = (AᵀA + λI)⁻¹ Aᵀ ΔOD
```

Where:
- `λ`: Regularization parameter (prevents overfitting)
- `I`: Identity matrix

**Use case**: Localize activation from fNIRS data

### Regularization

**Why needed**:
- Inverse problem is ill-posed
- More voxels than channels
- Noise amplification without regularization

**Methods**:
- **Tikhonov** (L2): `λI` penalty
- **LASSO** (L1): Sparse solutions
- **Spatial smoothness**: Neighboring voxels similar
- **Depth weighting**: Account for depth bias

### Algorithms

**Linear methods**:
- Minimum norm estimate (MNE)
- Weighted minimum norm (wMNE)
- Standardized low-resolution electromagnetic tomography (sLORETA)

**Iterative methods**:
- Conjugate gradient
- Algebraic reconstruction technique (ART)
- Simultaneous algebraic reconstruction technique (SART)

**Bayesian methods**:
- Maximum a posteriori (MAP)
- Empirical Bayes
- Hierarchical models

## Validation

### Phantom Studies

**Ground truth**: Known activation pattern
**Measure**: fNIRS signals
**Reconstruct**: Estimate activation
**Compare**: Reconstructed vs. ground truth

**Metrics**:
- Localization error (mm)
- Spatial resolution (FWHM)
- Contrast-to-noise ratio
- Dice coefficient (overlap)

### Simulation Studies

**Forward model**: Generate synthetic signals
**Add noise**: Realistic SNR
**Reconstruct**: Inverse problem
**Assess**: Recovery accuracy

### Multi-Modal Validation

**Compare to**:
- fMRI (gold standard for localization)
- EEG source localization
- Anatomical ROIs

## Best Practices

### Voxel Resolution

**5mm recommended**:
- Good balance: resolution vs. speed
- ~10,000 voxels
- Builds in ~100ms for 50 channels
- Sufficient for most applications

**3mm for high-resolution**:
- Research applications
- Detailed localization needed
- ~50,000 voxels
- Builds in ~500ms

**10mm for quick preview**:
- Fast prototyping
- Montage optimization
- ~1,000 voxels
- Builds in ~20ms

### Montage Design

**For good reconstruction**:
- **Dense coverage**: Many channels over ROI
- **Overlapping paths**: Multiple views of same voxels
- **Varied separations**: Different depths
- **Avoid gaps**: Complete spatial coverage

**Check**:
- Visualize sensitive voxels
- Ensure ROI well-covered
- Look for gaps in sensitivity
- Verify depth penetration

### Threshold Selection

**20% (default)**:
- Shows core measurement volume
- Reduces clutter
- Focus on high-sensitivity regions

**10%**:
- Extended measurement volume
- See broader coverage
- More voxels displayed

**50%**:
- Only highest sensitivity
- Very focused view
- Minimal voxels shown

## Computational Complexity

### Time Complexity

**Voxel grid initialization**: O(nx × ny × nz)
- 5mm resolution: ~10,000 voxels → ~1ms

**Path integration per channel**: O(nPath × nVoxels^(1/3))
- 30 path points, 10,000 voxels → ~1ms

**Total matrix build**: O(nChannels × nPath × nVoxels^(1/3))
- 100 channels: ~100ms

### Space Complexity

**Voxel storage**: O(nVoxels)
- 10,000 voxels × 100 bytes → ~1MB

**Sparse matrix**: O(nNonZero)
- 10,000 entries × 20 bytes → ~200KB

**Total**: ~1-2MB for typical montage

### Scalability

**Scales well**:
- ✅ 100+ channels: No problem
- ✅ 10,000 voxels: Fast
- ✅ 50,000 voxels: Acceptable
- ⚠️ 200,000 voxels: Slow (2mm resolution)

**Bottlenecks**:
- Path integration (most time)
- Voxel lookup (spatial indexing helps)
- 3D rendering (GPU-accelerated)

## Future Enhancements

### Multi-Layer Tissue Model

**Current**: Homogeneous medium
**Future**: Scalp → Skull → CSF → Gray matter

Each layer has different optical properties:
- More accurate sensitivity
- Depth-dependent weighting
- Realistic photon paths

### Anatomical Constraints

**Use MRI/atlas**:
- Constrain voxels to gray matter
- Exclude CSF, white matter, skull
- Anatomically-informed reconstruction
- Improved localization

### Depth Weighting

**Problem**: Deeper voxels less sensitive
**Solution**: Weight by depth

```
W[j] = exp(-depth[j] / λ)
```

Compensates for depth bias in reconstruction.

### Multi-Wavelength

**Current**: Single wavelength (850nm)
**Future**: 760nm + 850nm

Enables:
- Chromophore separation (HbO, HbR)
- Wavelength-specific sensitivity
- Improved contrast

### Time-Resolved

**For TD-fNIRS**:
- Time-dependent sensitivity
- Depth-resolved measurements
- Better depth discrimination

### GPU Acceleration

**Path integration on GPU**:
- Parallel processing
- 10-100× speedup
- Real-time matrix updates

## References

1. **Arridge & Schweiger (1995)**: "Photon-measurement density functions"
   - Theoretical foundation for sensitivity

2. **Boas et al. (2004)**: "Three dimensional Monte Carlo code for photon migration"
   - Validation of diffusion approximation

3. **Dehghani et al. (2009)**: "NIRFAST: A finite element based package"
   - Practical implementation

4. **Eggebrecht et al. (2014)**: "Mapping distributed brain function with high-density DOT"
   - High-density reconstruction

5. **Zeff et al. (2007)**: "Retinotopic mapping of adult human visual cortex with HD-DOT"
   - Clinical application

## Summary

NOMAD's voxel-based forward model provides:

✅ **Complete sensitivity matrix**: Channels × voxels  
✅ **Efficient sparse storage**: 99% sparsity typical  
✅ **Fast computation**: ~100ms for 50 channels  
✅ **3D visualization**: See measurement volume  
✅ **Export for analysis**: JSON format  
✅ **Scalable**: 100+ channels, 10K+ voxels  
✅ **Research-ready**: Source reconstruction enabled  

This transforms NOMAD from a montage design tool into a **complete forward modeling system** for fNIRS source reconstruction, bridging the gap between experimental design and data analysis.

