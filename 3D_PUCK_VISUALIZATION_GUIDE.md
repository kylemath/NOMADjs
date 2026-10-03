# 3D Puck Visualization Guide

## Overview

NOMAD now uses **hardware-realistic puck-shaped markers** in 3D visualization instead of simple spheres. This provides a more accurate representation of actual fNIRS optodes, which are flat disc-shaped sensors that sit tangent to the head surface.

## Puck-Shaped Optodes

### What is a Puck?

A "puck" is a **flat cylinder** - like a hockey puck - that represents the actual physical shape of fNIRS optodes:

- **Flat circular face** contacts the scalp
- **Thin profile** (2mm height typical)
- **Oriented tangent** to head surface
- **More realistic** than spheres
- **Matches hardware** appearance

### Why Pucks Instead of Spheres?

**Realism**:
- Actual fNIRS optodes are disc-shaped, not spherical
- Shows correct contact area with scalp
- Matches commercial hardware (NIRx, Artinis, ISS, etc.)

**Visual Clarity**:
- Easier to see orientation
- Shows surface contact clearly
- Better depth perception
- Distinguishes from other markers

**Professional Appearance**:
- Looks like actual equipment
- Suitable for presentations
- Matches hardware documentation
- Clinical/research credibility

## 3D Marker Types

### 1. Source Pucks (Red/Colored)

**Appearance**:
- **Size**: 6mm radius, 2mm height
- **Color**: Red (default) or time slot color
- **Orientation**: Tangent to head surface
- **Emissive**: Slight glow for visibility

**Purpose**:
- Represents LED/laser sources
- Shows source placement
- Color indicates multiplexing assignment
- Labeled with time slot number when assigned

### 2. Detector Pucks (Black)

**Appearance**:
- **Size**: 5mm radius, 2mm height
- **Color**: Black (consistent)
- **Orientation**: Tangent to head surface
- **Emissive**: Subtle glow

**Purpose**:
- Represents photodetectors
- Shows detector placement
- Slightly smaller than sources for distinction
- Always black (not colored)

### 3. Grid Position Pucks (Blue, Transparent)

**NEW FEATURE**: Grid positions now visible in 3D!

**Hierarchical Display**:

**10-20 Standard Positions**:
- **Size**: 4mm radius, 1.5mm height
- **Opacity**: 50%
- **Color**: Blue
- Most prominent grid markers

**10-10 Intermediate Positions**:
- **Size**: 3mm radius, 1mm height
- **Opacity**: 30%
- **Color**: Blue
- Medium visibility

**10-5 High Density Positions**:
- **Size**: 2mm radius, 0.8mm height
- **Opacity**: 20%
- **Color**: Blue
- Subtle background markers

**Purpose**:
- Shows available optode locations
- Indicates standardized positions
- Helps plan montage placement
- Visualizes grid structure in 3D space

### 4. Channel Markers (Orange Spheres)

**Appearance**:
- **Size**: 2.5mm radius sphere
- **Color**: Orange (default) or time slot color
- **Position**: Midpoint between source and detector

**Purpose**:
- Marks channel center
- Shows measurement location
- MNE-NIRS style visualization
- Indicates active channels

### 5. Channel Lines (White/Colored)

**Appearance**:
- **Width**: Thin lines
- **Color**: White (default) or time slot color
- **Opacity**: 60-90%

**Purpose**:
- Connects source to detector
- Shows channel path
- Visualizes measurement pairs
- Color indicates multiplexing

## Puck Orientation

### Surface-Tangent Alignment

Each puck is **automatically oriented** to be tangent to the head surface:

**Algorithm**:
```javascript
1. Compute normal vector at optode position
   - Points radially outward from head center
   
2. Calculate rotation quaternion
   - Aligns cylinder axis with normal vector
   
3. Apply rotation to puck mesh
   - Flat face perpendicular to radius
   - Puck sits flush against surface
```

**Result**:
- Pucks appear "stuck" to head
- Realistic contact appearance
- Correct physical orientation
- Follows head curvature

### Visual Effect

**From any viewing angle**:
- Pucks look like they're attached to scalp
- Circular face visible when looking straight at it
- Edge visible when viewing from side
- Natural, realistic appearance

## Grid Visualization in 3D

### Enabling Grid Display

**Automatic Sync with 2D**:
- Same controls as 2D topographic view
- ☑️ **Show Grid Visualization** checkbox
- **Grid Density Display** dropdown
- Real-time updates

**Visibility**:
- Shows when checkbox is enabled
- Respects density filter setting
- Hides occupied positions
- Updates when optodes are placed

### Hierarchical 3D Grid

**Three Levels of Detail**:

1. **10-20 Positions** (21 markers)
   - Largest pucks (4mm)
   - Most visible (50% opacity)
   - Major landmark positions
   - Best for orientation

2. **10-10 Positions** (~74 markers)
   - Medium pucks (3mm)
   - Moderate visibility (30%)
   - Extended coverage
   - Good balance

3. **10-5 Positions** (~461 markers)
   - Smallest pucks (2mm)
   - Subtle (20% opacity)
   - Complete coverage
   - Maximum detail

### Density Control

**Via Dropdown**:
- **All (10-5)**: Shows all grid positions
- **10-10**: Hides 10-5 fine detail
- **10-20**: Only major positions
- **Hide Lines**: No grid (2D only)

**Use Cases**:
- **All**: Designing dense montages, seeing all options
- **10-10**: Balanced view, less clutter
- **10-20**: Simple view, teaching, presentations
- **None**: Focus on placed optodes only

## Technical Implementation

### Puck Geometry Creation

```javascript
function createPuckGeometry(radius, height = 2) {
    // CylinderGeometry(radiusTop, radiusBottom, height, segments)
    return new THREE.CylinderGeometry(radius, radius, height, 32);
}
```

**Parameters**:
- `radius`: Puck radius in mm
- `height`: Puck thickness in mm (default 2mm)
- `32 segments`: Smooth circular appearance

### Orientation Calculation

```javascript
function getPuckOrientation(position) {
    // 1. Compute outward normal vector
    const normal = normalize(position);
    
    // 2. Create quaternion to align Y-axis with normal
    const up = Vector3(0, 1, 0);
    const quaternion = setFromUnitVectors(up, normal);
    
    return quaternion;
}
```

**Process**:
1. Normalize position vector → surface normal
2. Compute rotation from cylinder axis (Y) to normal
3. Apply quaternion rotation to mesh
4. Result: puck perpendicular to radius

### Grid Rendering

```javascript
// For each grid position:
1. Check if occupied → skip if yes
2. Classify density (10-20, 10-10, 10-5)
3. Filter by density setting
4. Create puck with appropriate size/opacity
5. Orient to surface normal
6. Add to scene as transparent marker
```

## Visual Comparison

### Before (Spheres)

```
    O  ← Source (sphere)
   /|\
  / | \
 O  O  O  ← Detectors (spheres)
```

**Issues**:
- Not realistic
- No orientation visible
- Looks like balls floating
- Doesn't match hardware

### After (Pucks)

```
    ⊙  ← Source (puck, flat face visible)
   /|\
  / | \
 ⊙  ⊙  ⊙  ← Detectors (pucks, tangent to surface)
```

**Benefits**:
- Hardware realistic
- Orientation clear
- Looks attached to head
- Matches actual optodes

## Interaction Features

### Rotation and Viewing

**Pucks adapt to viewing angle**:
- **Face-on view**: See full circular face
- **Side view**: See thin edge profile
- **Oblique view**: See 3D puck shape
- **Any angle**: Orientation remains correct

### OrbitControls

**Mouse/Touch**:
- **Left drag**: Rotate view
- **Right drag**: Pan view
- **Scroll**: Zoom in/out
- **Double-click**: Reset view

**Keyboard** (future):
- Arrow keys: Rotate
- +/- : Zoom
- R: Reset view

### View Presets

**Quick angles**:
- **Top**: Overhead view (vertex down)
- **Front**: Face view (nose forward)
- **Left**: Left side view
- **Right**: Right side view
- **Back**: Posterior view

## Best Practices

### For Presentations

1. **Use 10-20 grid** for cleaner view
2. **Rotate to best angle** for your ROI
3. **Zoom appropriately** to show detail
4. **Screenshot** at high resolution
5. **Disable grid** if too busy

### For Montage Design

1. **Enable full 10-5 grid** to see all options
2. **Rotate frequently** to check coverage
3. **Verify puck orientation** looks correct
4. **Check from multiple angles** for overlaps
5. **Use grid as placement guide**

### For Quality Control

1. **Verify all pucks tangent** to surface
2. **Check no pucks floating** or inside head
3. **Confirm sizes** are hierarchical
4. **Validate colors** match assignments
5. **Inspect from all angles**

### For Publications

1. **Capture multiple views** (top, side, 3D)
2. **Show grid for context** (10-20 level)
3. **Label major positions** if needed
4. **Use consistent colors** across figures
5. **Include scale reference**

## Troubleshooting

### "Pucks look wrong"

**Possible causes**:
- Positions not on head surface
- Orientation calculation error
- Coordinate system mismatch

**Solutions**:
- Run coregistration
- Enable grid system
- Check console for errors
- Verify positions in 2D view

### "Grid too cluttered in 3D"

**Solutions**:
- Change density to 10-10 or 10-20
- Disable grid visualization
- Zoom in to focus area
- Use view presets

### "Can't see pucks clearly"

**Solutions**:
- Adjust lighting (automatic)
- Rotate to better angle
- Zoom in closer
- Check opacity settings
- Verify colors contrast with head

### "Pucks not oriented correctly"

**Possible causes**:
- Off-surface positions
- Coordinate system error
- Zero-length position vector

**Solutions**:
- Run coregistration
- Enable surface fitting
- Check position validity
- Reload montage

## Performance

### Rendering Optimization

**Puck geometry**:
- Reuses geometry instances
- 32 segments (good balance)
- Efficient cylinder primitive
- Minimal polygon count

**Grid markers**:
- Transparent rendering
- Depth sorting
- Culling when off-screen
- LOD possible (future)

**Typical Performance**:
- 50 optodes: 60 FPS
- 100 optodes: 60 FPS
- 461 grid positions: 45-60 FPS
- Total (optodes + grid): 40-60 FPS

### Large Montages

**For 100+ optodes**:
- Consider hiding grid
- Use 10-20 density only
- Disable shadows (if added)
- Reduce anti-aliasing if needed

## Future Enhancements

Planned improvements:

1. **Realistic Optode Models**
   - Import actual CAD models
   - Brand-specific shapes (NIRx, Artinis, etc.)
   - Fiber optic bundles
   - Connector details

2. **Cap Visualization**
   - Show EEG cap mesh
   - Optode mounting holes
   - Strap/harness system
   - Realistic materials

3. **Animation**
   - Placement animation
   - Rotation transitions
   - Highlight on hover
   - Selection effects

4. **Enhanced Grid**
   - Grid lines in 3D
   - Curved grid surface
   - Region highlighting
   - Interactive selection

5. **Lighting Effects**
   - LED glow for sources
   - Realistic shadows
   - Ambient occlusion
   - Better materials

## References

1. **Three.js Cylinder**: THREE.CylinderGeometry documentation
2. **Quaternion Rotation**: THREE.Quaternion.setFromUnitVectors
3. **fNIRS Hardware**: Commercial optode specifications
4. **MNE-NIRS**: 3D visualization conventions

## Contact

For questions about 3D puck visualization:
- GitHub: https://github.com/kylemath/GraphColouring
- Email: kyle.mathewson@ualberta.ca

