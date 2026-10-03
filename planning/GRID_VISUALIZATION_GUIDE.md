# Grid Visualization Guide

## Overview

NOMAD's enhanced grid visualization system provides a clear, hierarchical display of the standardized 10-20/10-10/10-5 electrode positioning system. This helps users understand available optode locations and the structured organization of positions.

## Visualization Features

### Hierarchical Marker System

The grid uses **three levels of markers** to show the density hierarchy:

#### 1. 10-20 Standard Positions (21 positions)

**Visual Properties**:
- **Size**: 5px radius (largest)
- **Color**: Blue (#4a90e2)
- **Opacity**: 70% (most visible)
- **Stroke**: 2px outline
- **Labels**: Electrode name displayed

**Example Positions**:
- Frontal: Fp1, Fpz, Fp2, F7, F3, Fz, F4, F8
- Central: T3, C3, Cz, C4, T4
- Parietal: T5, P3, Pz, P4, T6
- Occipital: O1, Oz, O2

**Purpose**: 
- Original standard positions from Jasper (1958)
- Most reliable, well-documented locations
- Used in clinical applications
- Best for reproducibility across decades of research

#### 2. 10-10 Intermediate Positions (~74 total)

**Visual Properties**:
- **Size**: 3.5px radius (medium)
- **Color**: Blue (#4a90e2)
- **Opacity**: 50%
- **Stroke**: 1.5px outline
- **Labels**: Not displayed (to reduce clutter)

**Examples**:
- Extended frontal: AF3, AF4, AFz, F1, F2, F5, F6
- Extended central: FC1, FC2, FC5, FC6, CP1, CP2
- Extended parietal: P1, P2, P5, P6, POz
- Extended temporal: FT7, FT8, TP7, TP8

**Purpose**:
- Adds intermediate positions between 10-20 points
- Introduced by Chatrian et al. (1985)
- Good balance of coverage and practicality
- Standard for high-density EEG

#### 3. 10-5 High Density Positions (~461 total)

**Visual Properties**:
- **Size**: 2.5px radius (smallest)
- **Color**: Blue (#4a90e2)
- **Opacity**: 35% (subtle)
- **Stroke**: None
- **Labels**: Not displayed

**Examples**:
- Dense frontal: AF1, AF2, AF5, AF6, AF7h, AF8h
- Dense central: FC1h, FC2h, FC3, FC4, FC5h, FC6h
- Dense parietal: CP1h, CP2h, CP3, CP4, CP5, CP6
- All intermediate positions filled in

**Purpose**:
- Maximum spatial resolution
- Introduced by Oostenveld & Praamstra (2001)
- Enables very dense fNIRS montages
- Compatible with high-density EEG/MEG

### Grid Lines

**Appearance**:
- Light gray (#4a5568)
- 15% opacity
- 0.5px line width
- Connects adjacent positions

**Organization**:
- **Lateral lines**: Left-right connections (same row)
- **Anteroposterior lines**: Front-back connections (same column)
- Creates structured grid appearance
- Shows spatial relationships

**Connection Rules**:
- Only connects positions within 30mm
- Respects anatomical continuity
- Avoids crossing major anatomical boundaries
- Forms coherent grid structure

### Occupied vs Available

**Available Positions** (not yet used):
- Blue color (#4a90e2)
- Full specified opacity
- Indicates position can be selected
- Visible in all views

**Occupied Positions** (currently in use):
- Gray color (#95a5a6)
- Reduced opacity (half of normal)
- Indicates position is taken
- Prevents accidental overlap
- Still visible for reference

## Density Display Options

### User Control

Via the **Grid Density Display** dropdown:

#### Option 1: "All (10-5 High Density)"

**Shows**:
- All 461 positions
- All grid lines
- Complete hierarchical structure

**Best For**:
- Designing dense montages
- Maximum flexibility
- Seeing all available options
- High-density DOT applications

**Visual Density**: Very dense, but organized

#### Option 2: "10-10 (Intermediate)"

**Shows**:
- 10-20 positions (large markers)
- 10-10 positions (medium markers)
- Grid lines connecting them
- Total: ~74 positions

**Hides**:
- 10-5 fine-detail positions

**Best For**:
- Standard fNIRS montages
- Cleaner visualization
- When 10-5 density is excessive
- Reducing visual clutter

**Visual Density**: Moderate, well-balanced

#### Option 3: "10-20 (Standard Only)"

**Shows**:
- Only the 21 original 10-20 positions
- Large markers with labels
- Grid lines between them

**Hides**:
- All 10-10 and 10-5 positions

**Best For**:
- Simple montages
- Clinical applications
- Teaching/demonstrations
- Comparing to classic literature
- Minimal visual clutter

**Visual Density**: Sparse, very clean

#### Option 4: "Hide Grid Lines"

**Shows**:
- All selected positions (markers only)
- Based on density setting
- No connecting lines

**Hides**:
- All grid lines

**Best For**:
- Focusing on individual positions
- When lines are distracting
- Screenshot/presentation clarity
- Comparing position distributions

**Visual Density**: Points only

## Technical Implementation

### Position Classification Algorithm

```javascript
function classifyElectrodeDensity(name) {
    // Check against standard 10-20 list
    if (standard1020.includes(name)) {
        return '10-20';
    }
    
    // 10-10: Even numbers or 'z', no odd beyond 3,4
    if (name.match(/^[A-Z]+[zZ]$/) || 
        name.match(/^[A-Z]+[2468]$/)) {
        return '10-10';
    }
    
    // Everything else is 10-5
    return '10-5';
}
```

### Grid Line Generation

```javascript
// Organize by rows (same Y-coordinate ± tolerance)
// Connect adjacent positions in each row (left-right)

// Organize by columns (same X-coordinate ± tolerance)
// Connect adjacent positions in each column (front-back)

// Only connect if distance < 30mm (prevents long jumps)
```

### Marker Rendering

```javascript
// For each grid position:
1. Classify density level (10-20, 10-10, 10-5)
2. Check if occupied
3. Select size, opacity, stroke based on density
4. Project 3D coordinate to 2D canvas
5. Draw circle with appropriate styling
6. Add label if 10-20 position
```

## Visual Examples

### Full Density (All 10-5)

```
     Fpz
   /  |  \
 Fp1  |  Fp2
  |\ /|\ /|
  | X | X |     ← Dense coverage
  |/ \|/ \|     ← Many connections
  AF1  AFz  AF2 ← All positions visible
   |\ /|\ /|
   | X | X |
  / F1 Fz F2 \
```

### Intermediate (10-10)

```
     Fpz
      |
    Fp1─Fp2
      |
     AFz
      |
    F1─Fz─F2    ← Cleaner spacing
      |         ← Fewer positions
    FC1─FCz─FC2 ← Still good coverage
```

### Standard (10-20)

```
   Fp1─Fpz─Fp2
    |       |
   F3───Fz───F4   ← Classic positions only
    |       |     ← Maximum simplicity
   C3───Cz───C4   ← Well-established
    |       |
   P3───Pz───P4
```

## Best Practices

### For New Users

1. **Start with 10-20**:
   - Set density to "10-20 (Standard Only)"
   - Learn the major positions
   - Understand the basic grid structure

2. **Progress to 10-10**:
   - Switch to "10-10 (Intermediate)"
   - See how positions fill in between
   - Note the systematic naming

3. **Use Full 10-5**:
   - Switch to "All (10-5 High Density)"
   - Explore maximum resolution
   - Design dense montages

### For Dense Montages

1. **Use All (10-5)** to see every option
2. **Enable Grid Lines** to see structure
3. **Watch occupied markers** to avoid overlap
4. **Zoom 3D view** if needed for clarity

### For Presentations

1. **Use 10-20 or 10-10** for cleaner visuals
2. **Hide Grid Lines** if too busy
3. **Capture screenshots** at appropriate density
4. **Label major positions** (automatic for 10-20)

### For Clinical Applications

1. **Use 10-20 Standard** for maximum reproducibility
2. **Document exact positions** used
3. **Verify labels** in exported data
4. **Include grid setting** in methods section

## Keyboard Shortcuts (Future)

Planned keyboard shortcuts for grid control:

- `G`: Toggle grid visibility
- `1`: 10-20 view
- `2`: 10-10 view
- `3`: 10-5 view
- `L`: Toggle grid lines

## Troubleshooting

### "Grid is too cluttered"

**Solution**: Change density to "10-10" or "10-20"

### "Can't see small positions"

**Solution**: 
- Use "All (10-5)" density
- Zoom 3D view
- Use larger display
- Hide lines if needed

### "Grid lines are distracting"

**Solution**: Select "Hide Grid Lines" option

### "Need to see structure"

**Solution**: 
- Enable grid lines
- Use 10-10 density for balance
- View 3D rendering for spatial relationships

### "Positions seem wrong"

**Solution**:
- Verify density setting matches intent
- Check if looking at right positions
- Compare to literature
- Use 10-20 view to verify major landmarks

## Integration with Other Features

### With ROI Selection

Grid visualization:
- Shows available positions in selected regions
- Updates as regions are selected/deselected
- Highlights occupied positions after generation
- Helps verify coverage

### With File Import

Grid visualization:
- Shows snap targets for imported positions
- Indicates which positions will be used
- Updates in real-time as file is processed
- Verifies alignment quality

### With 3D Visualization

Grid system:
- Matches 3D marker sizes when possible
- Maintains same color scheme
- Projects correctly to 3D space
- Synchronized selection

### With Export

Grid labels:
- Included in exported files
- Documented in metadata
- Referenced in BIDS format
- Enables reproducibility

## Future Enhancements

Planned improvements:

1. **Animated Transitions**
   - Smooth density level changes
   - Fade in/out of positions
   - Highlight newly available positions

2. **Interactive Labels**
   - Hover to see electrode name
   - Click to select/deselect
   - Highlight related positions

3. **Color Coding**
   - By region (frontal, parietal, etc.)
   - By availability
   - By channel quality

4. **Custom Grids**
   - Import custom electrode sets
   - Define study-specific grids
   - Save/load grid configurations

5. **Grid Statistics**
   - Coverage metrics per density
   - Position utilization tracking
   - Recommended density suggestions

## References

1. **10-20 System**: Jasper, H.H. (1958). Report of the committee on methods of clinical examination in electroencephalography.
2. **10-10 System**: Chatrian, G.E., et al. (1985). Ten percent electrode system for topographic studies of spontaneous and evoked EEG activity.
3. **10-5 System**: Oostenveld, R., & Praamstra, P. (2001). The five percent electrode system for high-resolution EEG and ERP measurements.
4. **MNE Coordinates**: Gramfort, A., et al. (2014). MNE software for processing MEG and EEG data.

## Contact

For questions about grid visualization:
- GitHub: https://github.com/kylemath/GraphColouring
- Email: kyle.mathewson@ualberta.ca

