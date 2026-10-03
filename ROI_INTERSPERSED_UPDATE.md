# ROI Interspersed Optode Distribution Update

## Problem
Previously, when automatically distributing optodes into selected ROIs, the algorithm placed:
- **Detectors** in the center of each ROI
- **Sources** on the perimeter of each ROI

This created isolated "hot spots" for each ROI. When two adjacent ROIs were selected, there were no detectors in the border area between them.

## Solution
Modified the optode distribution algorithm to **intersperse sources and detectors** throughout the selected regions using a checkerboard pattern.

### Changes Made

#### 1. Grid-Based Distribution (`selectGridPositionsForRegions`)
**File:** `web/nomad.js` (lines 1882-1940)

**Key improvements:**
- **Merge overlapping regions:** Remove duplicate positions when ROIs overlap or are adjacent
- **Checkerboard pattern:** Use 3D spatial grid cells (15mm spacing) to alternate between sources and detectors
- **Ratio balancing:** Maintain the correct source/detector ratio while interspersing
- **Better coverage:** Adjacent ROIs now have detectors in border areas

**Algorithm:**
1. Collect all grid positions within selected ROIs (1.2× radius for coverage)
2. Remove duplicates (handles overlapping regions)
3. Sort by spatial hash for consistent ordering
4. Use checkerboard pattern: `(gridX + gridY + gridZ) % 2` determines if position prefers source or detector
5. Balance ratio dynamically to match desired source/detector count

#### 2. Non-Grid MNE Distribution (`generateOptimizedRegionOptodesMNE`)
**File:** `web/nomad.js` (lines 6492-6590)

**Improvements:**
- Changed from center/perimeter split to interspersed checkerboard pattern
- Ring filling alternates between sources and detectors
- Maintains target source/detector ratio throughout placement

#### 3. Legacy Spherical Distribution (`generateOptimizedRegionOptodes`)
**File:** `web/nomad.js` (lines 6384-6442)

**Improvements:**
- Same checkerboard pattern applied to spherical coordinates
- Ring filling uses ratio balancing instead of fixed patterns

## Benefits

1. **Better spatial distribution:** Sources and detectors are mixed throughout each ROI
2. **Improved coverage for adjacent ROIs:** Border areas between regions now have both sources and detectors
3. **No more hot spots:** Uniform coverage instead of concentrated centers
4. **Maintained ratio:** Algorithm still respects the configured source/detector ratio
5. **Handles overlap:** Duplicate positions are removed when ROIs overlap

## Testing

To test the changes:
1. Open `web/index.html` in a browser
2. Select "Design by ROI" mode
3. Click on 2-3 adjacent brain regions in the 3D view
4. Click "Generate Optimal Layout"
5. Observe that sources and detectors are now interspersed rather than separated

## Technical Details

**Checkerboard cell size:** 15mm (tunable)
**Ratio tolerance:** ±10% before forcing balance
**Duplicate detection:** Based on position rounded to 0.01mm precision
**ROI expansion:** 1.2× radius for edge coverage

