# Standardized Grid System for fNIRS Optode Placement

## Overview

NOMAD now implements a **standardized grid system** based on the extended 10-20 EEG electrode positioning system (10-5 density). This ensures that all optodes are placed at reproducible, anatomically standardized locations, following best practices for fNIRS neuroimaging.

## Why Use a Standardized Grid?

### Benefits

1. **Reproducibility**
   - Same positions across subjects
   - Consistent channel locations for group studies
   - Enables meta-analyses across studies

2. **Standardization**
   - Aligns with established neuroimaging conventions
   - Compatible with EEG/MEG coordinate systems
   - Facilitates multimodal integration

3. **Quality Control**
   - Prevents arbitrary optode placement
   - Ensures adequate spacing between optodes
   - Avoids overlapping positions

4. **Clinical Translation**
   - Standard positions recognized in literature
   - Easier to report and replicate
   - Regulatory compliance for clinical applications

5. **Data Sharing**
   - Standard coordinates for open science
   - Compatible with neuroimaging databases
   - Facilitates data pooling

## Grid System Specifications

### Based on 10-5 System

The grid uses **461 standardized positions** from the extended 10-20 system:

- **10-20 System**: 21 original positions (Fp1, Fp2, F3, F4, C3, C4, P3, P4, O1, O2, etc.)
- **10-10 System**: 74 positions (adds intermediate points)
- **10-5 System**: 345+ positions (maximum density for standard coverage)

### Anatomical Coverage

Positions are organized by cranial region:

| Region | Positions | Electrode Labels |
|--------|-----------|------------------|
| **Frontal** | ~120 | Fp, AF, F, FC |
| **Central** | ~80 | FC, C, CP |
| **Parietal** | ~90 | CP, P |
| **Temporal** | ~100 | FT, T, TP |
| **Occipital** | ~70 | PO, O, I |

### Coordinate System

All positions use **MNE/RAS coordinates**:
- **X**: Right (+) to Left (-) in mm
- **Y**: Anterior/Nose (+) to Posterior (-) in mm
- **Z**: Superior/Top (+) to Inferior (-) in mm
- **Origin**: Midpoint between LPA and RPA

## How It Works

### 1. Grid Initialization

On startup, NOMAD:
1. Loads all 10-5 electrode positions from `mne_anatomy.json`
2. Converts to 3D head coordinates (mm)
3. Classifies by anatomical region
4. Creates spatial index for fast lookup

### 2. Optode Selection

When designing a montage:

**ROI-Based Design**:
1. User selects brain regions (Frontal, Parietal, etc.)
2. System filters grid positions in those regions
3. Greedy algorithm selects optimal positions to maximize coverage
4. Alternates sources and detectors for good interleaving

**Example Montage**:
1. System loads example positions
2. Selects from all regions for full-head coverage
3. Uses grid positions only

**File Import**:
1. Reads optode positions from file
2. Snaps each position to nearest grid point
3. Ensures no overlaps (occupancy tracking)
4. Warns if positions can't snap to grid

### 3. Snap-to-Grid Algorithm

For each imported optode:

```javascript
1. Find nearest grid position within snap distance (15mm default)
2. Check if grid position is already occupied
3. If available: snap to grid, mark as occupied
4. If unavailable: find next nearest available position
5. If none available: warn user, use coregistered position
```

### 4. Occupancy Tracking

The system maintains a set of occupied grid positions:
- Prevents multiple optodes at same location
- Enforces minimum spacing (25mm default)
- Released when montage is cleared
- Updated when optodes are added/removed

## User Interface

### Settings Panel

**Standardized Grid System** section:

- ☑️ **Use 10-5 Grid Positions** (enabled by default)
  - When enabled: all optodes snap to grid
  - When disabled: uses coregistration instead
  
- ☑️ **Show Grid Points** (enabled by default)
  - Displays available grid positions as small dots
  - Helps visualize placement options
  - Updates as positions become occupied

- **Grid Info**: Shows count of available positions

### Visual Feedback

**Hierarchical Grid Display**:

The grid visualization shows three levels of density with different marker sizes:

1. **10-20 Standard Positions** (21 positions)
   - Largest markers (5px radius)
   - Labeled with electrode name (Fp1, Cz, etc.)
   - 70% opacity, blue color
   - Heavy stroke outline
   - These are the classic, most stable positions

2. **10-10 Intermediate Positions** (~74 total)
   - Medium markers (3.5px radius)
   - 50% opacity, blue color
   - Medium stroke outline
   - Extended coverage positions

3. **10-5 High Density Positions** (~461 total)
   - Smallest markers (2.5px radius)
   - 35% opacity, blue color
   - No stroke (subtle)
   - Maximum spatial resolution

**Grid Lines**:
- Connect adjacent positions in same row/column
- Light gray, 15% opacity
- Shows the structured organization
- Can be hidden via "Grid Density Display" setting

**Occupied Positions**:
- Gray color instead of blue
- Reduced opacity
- Indicates position is in use
- Prevents double-placement

**Density Control**:
- **All (10-5)**: Shows everything, maximum detail
- **10-10**: Hides 10-5 points, cleaner view
- **10-20**: Only major positions, simplest view
- **Hide Lines**: Points only, no grid lines

**Optode Labels**:
- Sources/detectors show standard grid label
- Example: "S1 (Fp1)" indicates source at Fp1 position
- Helps identify anatomical location
- Major (10-20) positions always labeled

## Configuration Options

### In JavaScript

```javascript
GridSystem.config = {
    enabled: true,          // Use grid system
    snapDistance: 15,       // mm - max distance to snap
    minSpacing: 25,         // mm - minimum optode spacing
    showGrid: true,         // Show grid points
    allowOffGrid: false     // Allow non-grid positions
};
```

### Adjusting Parameters

**Snap Distance** (default 15mm):
- Larger: more lenient snapping, may snap to wrong position
- Smaller: stricter snapping, more positions rejected
- Recommended: 10-20mm for typical digitization accuracy

**Minimum Spacing** (default 25mm):
- Ensures adequate separation for fNIRS channels
- Prevents crosstalk between adjacent optodes
- Typical fNIRS: 20-40mm spacing

## Best Practices

### For New Studies

1. **Enable Grid System** (default)
2. **Use ROI-Based Design**
   - Select target brain regions
   - Let system choose optimal grid positions
   - Ensures standardized coverage

3. **Verify Positions**
   - Check grid labels in visualization
   - Ensure adequate coverage of ROIs
   - Confirm channel distances are appropriate

4. **Document Grid Labels**
   - Export montage with grid labels
   - Include in methods section
   - Facilitates replication

### For Existing Data

1. **Import Digitized Positions**
   - Load from .elp or SNIRF file
   - System automatically snaps to grid

2. **Review Snap Quality**
   - Check console for snap warnings
   - Verify positions in 3D view
   - Ensure no unexpected shifts

3. **Handle Off-Grid Positions**
   - If many positions can't snap: check coordinate system
   - If systematic offset: verify fiducials
   - If random errors: increase snap distance

### For Clinical Applications

1. **Use Standard Positions Only**
   - Keep grid system enabled
   - Don't allow off-grid positions
   - Document exact grid labels used

2. **Validate Against Literature**
   - Compare with published montages
   - Use established ROI definitions
   - Follow clinical guidelines

3. **Quality Assurance**
   - Verify grid labels match expected anatomy
   - Check inter-optode distances
   - Confirm channel count matches hardware

## Grid Selection Algorithm

### Greedy Maximum Spread

The system uses a greedy algorithm to select optimal grid positions:

```
1. Start with center positions of each selected region
2. While more optodes needed:
   a. For each available grid position:
      - Calculate minimum distance to any placed optode
   b. Select position with largest minimum distance
   c. Mark as occupied
3. Split selected positions into sources and detectors
   - Interleave in 2:1 ratio (more sources than detectors)
   - Ensures good spatial coverage for both types
```

### Why This Works

- **Maximizes Coverage**: Spreads optodes across region
- **Avoids Clustering**: Prevents optodes bunching together
- **Balanced Distribution**: Sources and detectors well-mixed
- **Deterministic**: Same regions → same positions

## Technical Implementation

### Data Structures

```javascript
GridSystem = {
    positions: [          // All 461 grid positions
        {
            x, y, z,      // 3D coordinates (mm)
            label,        // Standard name (e.g., "Fp1")
            type,         // "standard" (from 10-5)
            region        // "frontal", "parietal", etc.
        },
        ...
    ],
    
    byRegion: {           // Organized by anatomy
        frontal: [...],
        central: [...],
        parietal: [...],
        temporal: [...],
        occipital: [...]
    },
    
    occupied: Set([...])  // Currently used positions
};
```

### Key Functions

```javascript
// Initialize from electrode data
initializeGridSystem()

// Find nearest grid position
snapToGrid(point, options)

// Get available positions
getAvailableGridPositions(options)

// Select optimal positions for regions
selectGridPositionsForRegions(regionNames, nSources, nDetectors)

// Manage occupancy
occupyGridPosition(label)
releaseGridPosition(label)
clearOccupiedGrid()
```

## Comparison: Grid vs. Free Placement

| Aspect | Grid System | Free Placement |
|--------|-------------|----------------|
| **Reproducibility** | ✅ Excellent | ❌ Poor |
| **Standardization** | ✅ Yes | ❌ No |
| **Flexibility** | ⚠️ Limited to grid | ✅ Unlimited |
| **Ease of Use** | ✅ Automatic | ⚠️ Manual |
| **Clinical Use** | ✅ Recommended | ❌ Not recommended |
| **Research** | ✅ Best practice | ⚠️ Acceptable with justification |
| **Digitization** | ⚠️ Requires snapping | ✅ Direct use |

## When to Disable Grid System

Consider disabling grid system when:

1. **Subject-Specific Anatomy**
   - Using individual MRI/CT scans
   - Custom head models
   - Unusual head shapes

2. **Non-Standard Applications**
   - Animal studies
   - Infant/pediatric populations
   - Special clinical cases

3. **Exact Digitization Required**
   - Validating digitization accuracy
   - Comparing measurement systems
   - Quality control studies

4. **Exploratory Studies**
   - Testing new montage designs
   - Optimizing for specific tasks
   - Research on optimal spacing

## Troubleshooting

### "Could not snap to grid" Warnings

**Cause**: Position too far from any grid point

**Solutions**:
1. Check coordinate system (should be RAS in mm)
2. Verify fiducial markers are correct
3. Increase snap distance in config
4. Enable coregistration first

### Too Few Positions Selected

**Cause**: Not enough grid positions in selected regions

**Solutions**:
1. Select more brain regions
2. Reduce requested optode count
3. Check region definitions

### Positions Seem Wrong

**Cause**: Coordinate system mismatch

**Solutions**:
1. Verify using RAS coordinates
2. Check units (should be mm)
3. Confirm fiducials are correct
4. Review MNE anatomy data

### Grid Points Not Showing

**Cause**: Checkbox disabled or rendering issue

**Solutions**:
1. Enable "Show Grid Points" checkbox
2. Refresh visualization
3. Check console for errors

## Future Enhancements

Planned improvements:

1. **Custom Grid Definitions**
   - Import custom electrode sets
   - Define study-specific grids
   - Save/load grid configurations

2. **Density Control**
   - Filter by 10-20 vs 10-10 vs 10-5
   - Adjust grid density by region
   - Create sparse/dense variants

3. **Constraint Relaxation**
   - Allow slight off-grid with warning
   - Interpolate between grid points
   - Adaptive snap distance

4. **Optimization**
   - Channel-count-aware selection
   - Optimize for specific distances
   - Balance coverage vs. sensitivity

5. **Integration**
   - Export grid labels to BIDS format
   - Import from other software
   - Validate against atlases

## References

1. **10-20 System**: Jasper (1958) - Original EEG electrode system
2. **10-10 System**: Chatrian et al. (1985) - Extended electrode positions
3. **10-5 System**: Oostenveld & Praamstra (2001) - High-density EEG
4. **MNE Coordinates**: Gramfort et al. (2014) - MNE-Python coordinate system
5. **fNIRS Best Practices**: Yücel et al. (2021) - Best practices for fNIRS

## Contact

For questions about the grid system:
- GitHub: https://github.com/kylemath/GraphColouring
- Email: kyle.mathewson@ualberta.ca

