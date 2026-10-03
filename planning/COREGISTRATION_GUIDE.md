# Coregistration Implementation Guide

## Overview

This document describes the 3-stage coregistration pipeline implemented in NOMAD for accurate alignment of fNIRS optode positions to anatomical models.

## Importance of Coregistration

Proper coregistration is **critical** for accurate fNIRS analysis because:

1. **Anatomical Localization**: Ensures channels are correctly mapped to brain regions
2. **Group Studies**: Enables accurate comparison across subjects
3. **Source Reconstruction**: Required for accurate forward/inverse modeling
4. **Reproducibility**: Standardizes positioning across measurement sessions

## Three-Stage Pipeline

### Stage 1: Fiducial-Based Rigid Alignment

**Purpose**: Initial alignment using anatomical landmarks

**Fiducial Markers Used**:
- **Nasion**: Bridge of nose (anterior reference)
- **Inion**: Bump at back of skull (posterior reference)  
- **LPA** (Left Pre-Auricular): Left ear canal entrance
- **RPA** (Right Pre-Auricular): Right ear canal entrance

**Method**: Procrustes analysis
- Computes optimal rotation and translation
- Minimizes sum of squared distances between measured and reference fiducials
- Preserves scale (rigid transformation)

**Quality Metric**: RMS fiducial error
- **Excellent**: < 3mm
- **Good**: 3-5mm
- **Acceptable**: 5-10mm
- **Poor**: > 10mm (indicates measurement errors)

### Stage 2: Regression-Based Error Correction

**Purpose**: Correct systematic measurement errors

**Method**: Locally Weighted Regression (LOWESS)
- Smooths measurement noise using nearby points
- Gaussian kernel weighting (20mm bandwidth)
- Light correction (70% original, 30% smoothed)
- Preserves overall montage structure while reducing noise

**Benefits**:
- Reduces random digitization errors
- Smooths out hand tremor during measurement
- Maintains spatial relationships between optodes

### Stage 3: Surface Shape Fitting

**Purpose**: Project optodes onto actual anatomical surface

**Method**: Closest-point projection
- Projects each optode to nearest point on head surface mesh
- Uses ellipsoidal model when mesh unavailable
- Accounts for non-spherical head shape:
  - Wider left-right (100%)
  - Shorter front-back (95%)
  - Taller top-bottom (105%)

**Quality Metric**: RMS surface error
- **Excellent**: < 2mm
- **Good**: 2-5mm
- **Acceptable**: 5-10mm
- **Poor**: > 10mm

## Implementation Details

### Core Functions

```javascript
// Main coregistration function
coregisterOptodes(optodes, measuredFiducials, options)

// Stage 1: Fiducial alignment
applyFiducialAlignment(positions, measuredFiducials)
computeRigidTransform(sourcePoints, targetPoints)

// Stage 2: Regression correction
applyRegressionCorrection(positions, measuredFiducials)

// Stage 3: Surface fitting
fitToSurfaceShape(positions, options)
estimateLocalRadius(pos)  // Ellipsoidal head model
```

### Configuration Options

```javascript
{
    useRigidAlignment: true,      // Enable fiducial-based alignment
    useRegression: true,          // Enable regression correction
    useSurfaceFitting: true,      // Enable surface fitting
    maxSurfaceDistance: 10,       // mm - max search distance
    smoothingIterations: 2        // Regression smoothing passes
}
```

## User Interface

### Settings Panel

Located in the Configuration section:

- ☑️ **Enable Coregistration** - Master toggle (disabled by default when grid is enabled)
- ☑️ **Fiducial Alignment** - Use nasion/inion/LPA/RPA markers
- ☑️ **Regression Correction** - Correct measurement errors
- ☑️ **Surface Fitting** - Project to anatomical surface
- 🎯 **Run Coregistration** - Apply coregistration to current montage
- 📊 **View Quality Metrics** - Show detailed alignment quality

### Quality Metrics Modal

Displays:

1. **Fiducial Alignment Error** (mm RMS)
   - Accuracy of marker-based alignment
   
2. **Surface Fitting Error** (mm RMS)
   - Average distance from surface
   
3. **Maximum Error** (mm)
   - Worst-case positioning error
   
4. **Coverage Quality** (%)
   - Percentage within 5mm threshold
   
5. **Interpretation**
   - Automated quality assessment
   - Recommendations for improvement

## Workflow

### For New Measurements

1. **Digitize Fiducials First**
   - Carefully measure nasion, inion, LPA, RPA
   - Use consistent technique across subjects
   - Record in same coordinate system as optodes

2. **Digitize Optode Positions**
   - Measure all source and detector positions
   - Include fiducials in same measurement session

3. **Import to NOMAD**
   - Load .elp file or SNIRF format
   - Ensure fiducials are included or specified

4. **Verify Coregistration**
   - Click "View Alignment Quality"
   - Check all metrics are in acceptable range
   - Review interpretation message

5. **Adjust if Needed**
   - If fiducial error > 5mm, remeasure markers
   - If surface error > 5mm, check coordinate system
   - Toggle correction stages to diagnose issues

### For Existing Data

**Option 1: Automatic (Grid System)**
1. Keep **Use 10-5 Grid Positions** enabled (default)
2. Load montage (file or example)
3. Positions automatically snap to standardized grid
4. No coregistration needed

**Option 2: Manual Coregistration**
1. Disable **Use 10-5 Grid Positions**
2. Enable **Enable Coregistration**
3. Load montage (file or example)
4. Click **Run Coregistration** button
5. Review metrics to verify quality

**Option 3: On-Demand**
1. Load montage with any settings
2. Click **Run Coregistration** button anytime
3. System will offer to disable grid if needed
4. Coregistration applied to current positions

## File Format Support

### ELP Format
```
# X Y Z Label
-29.44 83.92 -6.99 Nasion
-80.62 -29.09 -41.31 LPA
84.36 -28.50 -41.28 RPA
0.0 -85.0 0.0 Inion
... (optode positions)
```

### SNIRF Format
Fiducials stored in metadata:
```json
{
  "fiducials": {
    "nasion": [1.47, 85.07, -34.84],
    "lpa": [-80.62, -29.09, -41.31],
    "rpa": [84.36, -28.50, -41.28]
  }
}
```

## Best Practices

### Measurement Protocol

1. **Use consistent digitization device**
   - Polhemus, NDI, or structured light scanner
   - Calibrate before each session

2. **Standardize fiducial identification**
   - Nasion: Deepest point of nasal root
   - Inion: Most prominent occipital protuberance
   - LPA/RPA: Anterior to tragus, at ear canal

3. **Minimize head movement**
   - Complete digitization in single session
   - Stabilize head position

4. **Verify coordinate system**
   - Check handedness (right-handed typical)
   - Verify units (mm standard)
   - Confirm orientation (RAS convention)

### Quality Control

1. **Check fiducial error first**
   - Should be < 3mm for good alignment
   - High error indicates measurement problems

2. **Verify surface error**
   - Should be < 5mm for most applications
   - Higher errors acceptable for low-density montages

3. **Inspect coverage**
   - Should be > 90% for reliable analysis
   - Low coverage indicates systematic issues

4. **Visual inspection**
   - Use 3D view to check optode positions
   - Verify no optodes inside or far outside head

## Troubleshooting

### High Fiducial Error (> 5mm)

**Causes**:
- Incorrectly identified fiducials
- Different coordinate systems
- Measurement device calibration error

**Solutions**:
- Remeasure fiducial markers
- Check coordinate system convention
- Recalibrate digitization device

### High Surface Error (> 5mm)

**Causes**:
- Poor initial alignment
- Non-standard head shape
- Incorrect head model

**Solutions**:
- Enable fiducial alignment
- Use subject-specific head model
- Adjust surface fitting parameters

### Low Coverage (< 85%)

**Causes**:
- Outlier optodes
- Incomplete digitization
- Coordinate system mismatch

**Solutions**:
- Check for missing optodes
- Verify all positions digitized
- Confirm units and orientation

## Technical Notes

### Coordinate Systems

**MNE/NOMAD Convention (RAS)**:
- **X**: Right (+) to Left (-)
- **Y**: Anterior/Nose (+) to Posterior (-)
- **Z**: Superior/Top (+) to Inferior (-)
- **Origin**: Midpoint between LPA and RPA
- **Units**: millimeters (mm)

### Head Model

**Standard Adult Head**:
- Radius: 85mm (approximate sphere)
- Ellipsoidal correction factors:
  - Lateral (X): 1.00
  - Anterior-Posterior (Y): 0.95
  - Superior-Inferior (Z): 1.05

### Performance

- **Fiducial alignment**: O(n) - linear in number of optodes
- **Regression correction**: O(n²) - quadratic (local weighting)
- **Surface fitting**: O(n×m) - n optodes, m surface vertices

For large montages (>100 optodes), consider:
- Spatial indexing for surface fitting
- Reduced regression bandwidth
- Parallel processing

## References

1. **Procrustes Analysis**: Kabsch algorithm for optimal rotation
2. **LOWESS**: Cleveland (1979) locally weighted regression
3. **Surface Fitting**: Iterative closest point (ICP) algorithm
4. **MNE Coordinate System**: Gramfort et al. (2014) MNE-Python

## Future Enhancements

Planned improvements:

1. **Subject-Specific Models**
   - Import individual MRI/CT scans
   - Use actual cortical surface

2. **Advanced Algorithms**
   - Non-rigid deformation
   - Thin-plate spline warping
   - Iterative closest point (ICP)

3. **Batch Processing**
   - Process multiple subjects
   - Group-level quality metrics
   - Automated outlier detection

4. **Integration**
   - Export coregistration transforms
   - Import from other software (HOMER, AtlasViewer)
   - Support for more file formats

## Contact

For questions or issues with coregistration:
- GitHub: https://github.com/kylemath/GraphColouring
- Email: kyle.mathewson@ualberta.ca

