# Advanced Voxel Filtering Feature

## Overview
This feature provides sophisticated control over which voxels are displayed in the 3D visualization based on both the number of channels contributing to each voxel and the weighted photon proportion (sensitivity).

## Problem Solved
Previously, voxels were filtered only by total sensitivity (showing the top X% most sensitive voxels). This didn't account for:
- How many channels contribute to a voxel
- Whether a voxel has broad coverage (many channels) vs. narrow coverage (high sensitivity from few channels)
- Different research needs (lenient exploration vs. strict reconstruction)

## New Features

### 1. Voxel Selection Criteria Modes

**Location in UI:** Settings Panel → Voxel-Based Forward Model → Voxel Selection Criteria

Four modes are available:

#### Lenient - Any Light Penetration
- **Use case:** Exploratory analysis, maximum coverage visualization
- **Criteria:** Shows any voxel that receives light from at least one channel
- **Formula:** `channelCount > 0 && totalSensitivity > 1e-9`
- **Example:** Use this to see the maximum extent of your montage's coverage

#### Moderate - Multiple Channels or Moderate Sensitivity (Default)
- **Use case:** Standard fNIRS analysis, balanced view
- **Criteria:** Shows voxels with either 2+ channels OR sensitivity >10% of maximum
- **Formula:** `(channelCount >= 2) || (normalizedSensitivity > 0.1)`
- **Example:** Good balance between coverage and reconstruction quality

#### Strict - Many Channels with High Sensitivity
- **Use case:** Source reconstruction, high-confidence regions only
- **Criteria:** Shows only voxels with 3+ channels AND sensitivity >20% of maximum
- **Formula:** `(channelCount >= 3) && (normalizedSensitivity > 0.2)`
- **Example:** Use this for inverse problem solving where you need well-constrained voxels

#### Custom - Manual Settings
- **Use case:** Research-specific requirements
- **Criteria:** User-defined thresholds for both channel count and weighted sensitivity
- **Controls:**
  - Min Channels: Minimum number of channels (1-20)
  - Min Weighted Sum: Minimum normalized sensitivity (0-100%)
- **Example:** Set "Min Channels = 4" and "Min Weighted Sum = 15%" for custom quality threshold

### 2. Real-Time Statistics Display

**Location in UI:** Settings Panel → Voxel-Based Forward Model → Info Display

Shows:
- **Total voxels:** Number of voxels inside the head
- **Shown:** Number passing filter (with percentage)
- **Avg channels:** Average channels per displayed voxel

Example: `1847 total voxels | 423 (22.9%) shown | 3.2 avg channels`

### 3. Integrated with Both Visualization Types

The filtering applies to:
1. **Voxel cubes** in 3D view (when "Show Brain Surface Activity" is enabled)
2. **Brain mesh coloring** for cortical surface projection

## Technical Implementation

### Core Function: `shouldShowVoxel(voxel, params)`

```javascript
function shouldShowVoxel(voxel, params) {
    const { mode, minChannels, minWeightPct, maxSensitivity } = params;
    
    // Count channels contributing to this voxel
    const channelCount = Object.keys(voxel.sensitivity || {}).length;
    
    // Get normalized weighted sum (0-1)
    const normalizedSens = maxSensitivity > 0 ? 
        voxel.totalSensitivity / maxSensitivity : 0;
    
    // Apply mode-specific criteria
    // ... (see code for details)
}
```

### Voxel Data Structure

Each voxel maintains:
- `voxel.sensitivity[channelId]`: Sensitivity contribution from each channel
- `voxel.totalSensitivity`: Sum of all channel contributions
- `voxel.isInsideHead`: Boolean flag for head masking

### Sensitivity Calculation

Channel sensitivity is computed by:
1. Integrating along the photon migration path (banana-shaped trajectory)
2. Weighting by path sensitivity profile (highest in center of banana)
3. Accumulating contributions from all path segments through the voxel

Formula: `weight = pathSensitivity × segmentLength`

## Usage Examples

### Example 1: Maximum Coverage Exploration
**Goal:** See all brain regions that could potentially be measured

**Settings:**
- Voxel Selection Criteria: **Lenient**
- Voxel Brightness: 100%
- Show Brain Surface Activity: ✓

**Result:** All voxels with any light penetration are shown

### Example 2: Source Reconstruction Setup
**Goal:** Identify voxels suitable for inverse problem solving

**Settings:**
- Voxel Selection Criteria: **Strict**
- Voxel Threshold: 30%
- Show Brain Surface Activity: ✓

**Result:** Only well-constrained voxels (3+ channels, high sensitivity) are shown

### Example 3: Custom Quality Threshold
**Goal:** Show voxels with at least 5 channels and 10% sensitivity

**Settings:**
- Voxel Selection Criteria: **Custom**
- Min Channels: 5
- Min Weighted Sum: 10%

**Result:** Voxels meeting both criteria are displayed

### Example 4: Adjacent ROI Border Analysis
**Goal:** Check if border region between two ROIs has adequate coverage

**Settings:**
- Select two adjacent ROIs
- Voxel Selection Criteria: **Moderate**
- Use 3D View with rotation to examine border

**Result:** With new interspersed optode placement and moderate filtering, border regions should show coverage from multiple channels

## Interaction with Other Settings

### Legacy Voxel Threshold
The "Voxel Threshold (%)" slider still works as an additional filter:
- First, voxels are filtered by the new criteria (channel count + weighted sensitivity)
- Then, the legacy threshold removes the bottom X% of remaining voxels

**Recommendation:** Use new filtering modes instead of relying on legacy threshold

### Voxel Brightness
- Does not affect which voxels are shown
- Only adjusts opacity/contrast of displayed voxels
- Range: 10-200%

### Grid Spacing
- Coarser spacing (10mm) = fewer voxels = faster computation
- Finer spacing (2mm) = more voxels = better resolution

## Performance Considerations

### Computational Cost
- **Lenient mode:** Most voxels shown → slower rendering
- **Strict mode:** Fewest voxels shown → fastest rendering
- **Custom mode:** Cost depends on your thresholds

### Memory Usage
Voxel count by resolution:
- 10mm: ~1,000 voxels
- 5mm: ~10,000 voxels
- 3mm: ~50,000 voxels
- 2mm: ~170,000 voxels

**Tip:** Use coarser resolution for exploration, finer for final analysis

## Validation

### How to Check Filter Quality

1. **Build sensitivity matrix** (button in UI)
2. **Enable voxel display**
3. **Examine statistics:**
   - Low avg channels (<2): May need more optodes or different placement
   - High percentage shown (>50%): Consider stricter filtering
   - Low percentage shown (<5%): Consider more lenient filtering

### Quality Metrics by Mode

| Mode | Expected % Shown | Expected Avg Channels | Use Case |
|------|------------------|----------------------|----------|
| Lenient | 40-70% | 1.5-2.5 | Exploration |
| Moderate | 15-40% | 2.5-4.0 | Standard analysis |
| Strict | 5-20% | 4.0-6.0 | Reconstruction |

## Known Limitations

1. **Assumes homogeneous tissue:** Actual sensitivity depends on tissue optical properties
2. **Spherical head model:** Real heads have complex geometry
3. **Simplified photon migration:** Uses banana-shaped paths, not full diffusion equation
4. **No depth weighting:** All voxels at same depth treated equally

## Future Enhancements

Potential improvements:
- [ ] Depth-weighted filtering (favor superficial cortex)
- [ ] Region-specific thresholds (stricter for deep regions)
- [ ] Channel redundancy analysis (which channels contribute uniquely)
- [ ] Interactive voxel selection (click to see contributing channels)
- [ ] Export filtered voxel set for external reconstruction tools

## References

- NOMAD: Near-infrared Optode Montage Automated Designer
- MNE-NIRS: fNIRS analysis in Python
- NeuroDOT: High-density diffuse optical tomography

## Change Log

**2026-01-01:** Initial implementation
- Added 4 filtering modes (lenient, moderate, strict, custom)
- Integrated with both voxel cubes and brain mesh coloring
- Added real-time statistics display
- Updated event handlers for live updates

