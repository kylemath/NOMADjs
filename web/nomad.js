/**
 * NOMAD - Near-infrared Optode Montage Automated Designer
 * Web Edition - JavaScript Application
 * 
 * Implements:
 * - Graph coloring algorithms (Monte Carlo, DSATUR, Greedy)
 * - Topographic head visualization (MNE-style, nose at top)
 * - 3D brain surface rendering with Three.js
 * - fNIRS montage design and crosstalk validation
 * - SNIRF/MNE-NIRS format support
 */

// ============================================================
// Application State
// ============================================================
const AppState = {
    // Montage data (positions in MNE/standard head coordinates)
    // X: right ear (+) to left ear (-)
    // Y: back of head (-) to nose (+)  
    // Z: bottom (-) to top (+)
    sources: [],          // Array of {id, x, y, z, label}
    detectors: [],        // Array of {id, x, y, z, label}
    channels: [],         // Array of {sourceId, detectorId, distance}
    
    // Configuration
    config: {
        maxDistance: 60,
        minDistance: 15,
        nTimeSlots: 8,
        capacity: 4,
        algorithm: 'monte-carlo',
        nTrials: 1000
    },
    
    // Solution
    coloring: {},         // {sourceId: timeSlot}
    conflictGraph: null,  // Adjacency list
    detectorSources: {},  // {detectorId: [sourceIds in range]}
    
    // UI State
    currentPanel: 'settings',
    currentTool: 'select',
    selectedElement: null,
    viewMode: 'topo',     // 'topo' or '3d'
    
    // Three.js objects
    three: {
        preview: null,
        schematic: null,
        assign: null
    },
    
    // File data
    loadedFile: null,
    exportLog: []
};

// Time slot colors - Extended DOIL scheme for up to 64 time slots
const TIME_SLOT_COLORS = [
    '#95a5a6',         // 0 = unassigned (gray)
    '#9b59b6',         // 1 - Purple
    '#e74c3c',         // 2 - Red  
    '#fd79a8',         // 3 - Pink
    '#f1c40f',         // 4 - Yellow
    '#636e72',         // 5 - Dark Gray
    '#8b4513',         // 6 - Brown
    '#3498db',         // 7 - Blue
    '#00cec9',         // 8 - Cyan
    '#00b894',         // 9 - Green
    '#e17055',         // 10 - Orange
    '#6c5ce7',         // 11 - Indigo
    '#d63031',         // 12 - Dark Red
    '#74b9ff',         // 13 - Light Blue
    '#55efc4',         // 14 - Mint
    '#fdcb6e',         // 15 - Gold
    '#2d3436',         // 16 - Black
    // Extended colors for slots 17-32
    '#a29bfe',         // 17 - Light Purple
    '#ff7675',         // 18 - Coral
    '#fab1a0',         // 19 - Peach
    '#ffeaa7',         // 20 - Pale Yellow
    '#b2bec3',         // 21 - Silver
    '#d35400',         // 22 - Pumpkin
    '#0984e3',         // 23 - Bright Blue
    '#81ecec',         // 24 - Light Cyan
    '#00b894',         // 25 - Mint Green
    '#e84393',         // 26 - Pink/Magenta
    '#5f27cd',         // 27 - Deep Purple
    '#ee5a24',         // 28 - Vermillion
    '#0097e6',         // 29 - Azure
    '#c7ecee',         // 30 - Powder Blue
    '#2ecc71',         // 31 - Emerald
    '#f39c12',         // 32 - Sunflower
    // Extended colors for slots 33-64
    '#8e44ad',         // 33
    '#c0392b',         // 34
    '#16a085',         // 35
    '#27ae60',         // 36
    '#2980b9',         // 37
    '#f39c12',         // 38
    '#d35400',         // 39
    '#1abc9c',         // 40
    '#3498db',         // 41
    '#9b59b6',         // 42
    '#e74c3c',         // 43
    '#2ecc71',         // 44
    '#e67e22',         // 45
    '#1abc9c',         // 46
    '#9b59b6',         // 47
    '#34495e',         // 48
    '#7f8c8d',         // 49
    '#bdc3c7',         // 50
    '#2c3e50',         // 51
    '#95a5a6',         // 52
    '#f1c40f',         // 53
    '#e74c3c',         // 54
    '#3498db',         // 55
    '#2ecc71',         // 56
    '#9b59b6',         // 57
    '#e67e22',         // 58
    '#1abc9c',         // 59
    '#e74c3c',         // 60
    '#2980b9',         // 61
    '#8e44ad',         // 62
    '#27ae60',         // 63
    '#d35400'          // 64
];

/**
 * Get color for a time slot - handles slots beyond array length
 */
function getSlotColor(slot) {
    if (slot === 0) return TIME_SLOT_COLORS[0];
    if (slot > 0 && slot < TIME_SLOT_COLORS.length) {
        return TIME_SLOT_COLORS[slot];  // Direct array access here, not recursive
    }
    // Generate a color for slots beyond our predefined list using golden angle
    const hue = (slot * 137.508) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Determine if text on a colored background should be dark or light
 * Returns '#000' for light backgrounds, '#fff' for dark backgrounds
 */
function getContrastTextColor(hexColor) {
    // Handle HSL colors
    if (hexColor.startsWith('hsl')) {
        const match = hexColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (match) {
            const lightness = parseInt(match[3]);
            return lightness > 50 ? '#000' : '#fff';
        }
        return '#fff';
    }
    
    // Handle hex colors
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance (ITU-R BT.709)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000' : '#fff';
}

// Head model constants (in mm, standard adult)
const HEAD = {
    radius: 85,           // Approximate head radius
    noseY: 95,            // Y position of nose tip
    earX: 85,             // X position of ears
    inion: -85,           // Y position of back of head
    nasion: 85            // Y position of nasion (bridge of nose)
};

// ============================================================
// MNE Anatomy Data - Real anatomical coordinates from MNE-Python
// ============================================================

// Loaded anatomy data from mne_anatomy.json
let MNE_ANATOMY = null;

// Brain region definitions for ROI selection
// Will be populated with real MNE coordinates after loading
let BRAIN_REGIONS = {};

// Standard 10-20 electrode positions (populated from MNE data)
let ELECTRODES_1020 = {};

// Fiducial markers (nasion, LPA, RPA)
let FIDUCIALS = {};

// Example fNIRS montage from MNE-NIRS
let FNIRS_EXAMPLE = null;

// MNE head coordinate scale factor (mm to normalized units)
const MNE_SCALE = 100; // Typical head radius ~100mm

// Brain surface mesh for cortical projection
let BRAIN_SURFACE = {
    vertices: [],  // Array of {x, y, z, sensitivity, region}
    faces: [],     // Array of [i, j, k] triangle indices
    mesh: null,    // THREE.Mesh object
    regions: {},   // Map of region name to vertex indices
    selectedRegions: new Set()  // Currently selected regions for ROI
};

// Initialize default brain regions (will be replaced with MNE data when loaded)
// Simplified to 8 main regions corresponding to cranial bones (4 per side)
BRAIN_REGIONS = {
    'Left Frontal': { x: -45.0, y: 60.0, z: 10.0, radius: 45, color: '#e74c3c', label: 'Frontal-L' },
    'Right Frontal': { x: 45.0, y: 60.0, z: 10.0, radius: 45, color: '#e74c3c', label: 'Frontal-R' },
    'Left Parietal': { x: -55.0, y: -40.0, z: 60.0, radius: 45, color: '#3498db', label: 'Parietal-L' },
    'Right Parietal': { x: 55.0, y: -40.0, z: 60.0, radius: 45, color: '#3498db', label: 'Parietal-R' },
    'Left Temporal': { x: -80.0, y: -10.0, z: 0.0, radius: 45, color: '#f39c12', label: 'Temporal-L' },
    'Right Temporal': { x: 80.0, y: -10.0, z: 0.0, radius: 45, color: '#f39c12', label: 'Temporal-R' },
    'Left Occipital': { x: -30.0, y: -105.0, z: 15.0, radius: 45, color: '#9b59b6', label: 'Occipital-L' },
    'Right Occipital': { x: 30.0, y: -105.0, z: 15.0, radius: 45, color: '#9b59b6', label: 'Occipital-R' }
};

/**
 * Load MNE anatomy data from JSON file
 */
async function loadMNEAnatomy() {
    try {
        const response = await fetch('mne_anatomy.json');
        if (!response.ok) {
            console.warn('Could not load mne_anatomy.json, using fallback regions');
            initializeFallbackRegions();
            return;
        }
        
        MNE_ANATOMY = await response.json();
        console.log('Loaded MNE anatomy data:', MNE_ANATOMY.version);
        
        // Initialize regions from MNE data
        initializeRegionsFromMNE();
        
        // Load electrodes
        if (MNE_ANATOMY.electrodes_1020) {
            ELECTRODES_1020 = MNE_ANATOMY.electrodes_1020;
            console.log(`Loaded ${Object.keys(ELECTRODES_1020).length} 10-20 electrode positions`);
        }
        
        // Load fiducials
        if (MNE_ANATOMY.fiducials) {
            FIDUCIALS = MNE_ANATOMY.fiducials;
        }
        
        // Load fNIRS example
        if (MNE_ANATOMY.fnirs_example) {
            FNIRS_EXAMPLE = MNE_ANATOMY.fnirs_example;
            console.log(`Loaded fNIRS example: ${Object.keys(FNIRS_EXAMPLE.sources).length} sources, ${Object.keys(FNIRS_EXAMPLE.detectors).length} detectors`);
        }
        
        // Re-render ROI canvas if it exists
        if (document.getElementById('roi-canvas')) {
            renderROICanvas();
        }
        
    } catch (error) {
        console.warn('Error loading MNE anatomy:', error);
        initializeFallbackRegions();
    }
}

/**
 * Initialize brain regions from loaded MNE data
 * Converts MNE mm coordinates to our display coordinate system
 */
function initializeRegionsFromMNE() {
    BRAIN_REGIONS = {};
    
    // Use fNIRS-optimized regions from MNE data
    if (MNE_ANATOMY.fnirs_regions) {
        for (const [key, region] of Object.entries(MNE_ANATOMY.fnirs_regions)) {
            BRAIN_REGIONS[region.name] = {
                x: region.x,
                y: region.y,
                z: region.z,
                radius: (region.radius || 30) * 1.5, // Scale up for fNIRS imaging area
                color: region.color || getRegionColor(key),
                label: key,
                anchor: region.anchor
            };
        }
    }
    
    // Also add parcellation regions if available (as secondary options)
    if (MNE_ANATOMY.parcellation_regions) {
        for (const [key, region] of Object.entries(MNE_ANATOMY.parcellation_regions)) {
            // Only add if not already defined
            const fullName = `${region.name} (${region.hemisphere === 'left' ? 'L' : 'R'})`;
            if (!BRAIN_REGIONS[fullName]) {
                BRAIN_REGIONS[fullName] = {
                    x: region.x,
                    y: region.y,
                    z: region.z,
                    radius: region.radius * 1.5,
                    color: getRegionColor(region.abbrev),
                    label: key,
                    aparc: region.aparc_label
                };
            }
        }
    }
    
    console.log(`Initialized ${Object.keys(BRAIN_REGIONS).length} brain regions from MNE data`);
}

/**
 * Get a color for a region based on its type
 */
function getRegionColor(key) {
    const colorMap = {
        'PFC': '#e74c3c',
        'DLPFC': '#3498db',
        'M1': '#2ecc71',
        'S1': '#1abc9c',
        'SMA': '#27ae60',
        'STG': '#fd79a8',
        'IPL': '#f39c12',
        'V1': '#6c5ce7',
        'mPFC': '#9b59b6',
        'A1': '#a29bfe',
        'LOC': '#00cec9',
        'FP': '#9b59b6'
    };
    
    for (const [prefix, color] of Object.entries(colorMap)) {
        if (key.includes(prefix)) return color;
    }
    
    // Generate a color based on the key
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 50%)`;
}

/**
 * Load the MNE-NIRS motor example montage
 */
function loadMNENIRSExample() {
    if (!FNIRS_EXAMPLE || !FNIRS_EXAMPLE.sources || !FNIRS_EXAMPLE.detectors) {
        alert('MNE-NIRS example data not loaded. Please refresh the page.');
        return;
    }
    
    // Convert MNE-NIRS example to app state format
    const sources = [];
    const detectors = [];
    
    let sourceId = 0;
    const sourcePositions = [];
    for (const [key, pos] of Object.entries(FNIRS_EXAMPLE.sources)) {
        sourcePositions.push(pos);
        sources.push({
            id: sourceId++,
            x: pos.x,
            y: pos.y,
            z: pos.z,
            label: pos.label || key
        });
    }
    
    let detectorId = 0;
    const detectorPositions = [];
    for (const [key, pos] of Object.entries(FNIRS_EXAMPLE.detectors)) {
        // Skip duplicates (same position with different names)
        const isDuplicate = detectorPositions.some(d => 
            Math.abs(d.x - pos.x) < 0.1 && 
            Math.abs(d.y - pos.y) < 0.1 && 
            Math.abs(d.z - pos.z) < 0.1
        );
        if (!isDuplicate) {
            detectorPositions.push(pos);
            detectors.push({
                id: detectorId++,
                x: pos.x,
                y: pos.y,
                z: pos.z,
                label: pos.label || key
            });
        }
    }
    
    // Apply proper coregistration if fiducials are available
    const allOptodes = [...sources, ...detectors];
    const measuredFids = FNIRS_EXAMPLE.fiducials || null;
    const coregistered = coregisterOptodes(allOptodes, measuredFids, {
        useRigidAlignment: !!measuredFids,
        useRegression: true,
        useSurfaceFitting: true
    });
    
    // Update positions with coregistered values
    for (let i = 0; i < sources.length; i++) {
        sources[i].x = coregistered[i].x;
        sources[i].y = coregistered[i].y;
        sources[i].z = coregistered[i].z;
    }
    for (let i = 0; i < detectors.length; i++) {
        const idx = sources.length + i;
        detectors[i].x = coregistered[idx].x;
        detectors[i].y = coregistered[idx].y;
        detectors[i].z = coregistered[idx].z;
    }
    
    // Update app state
    AppState.sources = sources;
    AppState.detectors = detectors;
    
    // Build channels and conflict graph
    buildChannels();
    
    // Update UI
    DOM.fileInfo.innerHTML = `<span class="text-success">✓ Loaded MNE-NIRS Motor Example: ${sources.length}S / ${detectors.length}D</span>`;
    
    updateStats();
    renderPreview();
    
    console.log(`Loaded MNE-NIRS example: ${sources.length} sources, ${detectors.length} detectors`);
    console.log('Description:', FNIRS_EXAMPLE.description);
}

/**
 * Fallback brain regions if MNE data is not available
 * Simplified to 8 main regions corresponding to cranial bones (4 per side)
 */
function initializeFallbackRegions() {
    BRAIN_REGIONS = {
        'Left Frontal': { x: -45.0, y: 60.0, z: 10.0, radius: 45, color: '#e74c3c', label: 'Frontal-L' },
        'Right Frontal': { x: 45.0, y: 60.0, z: 10.0, radius: 45, color: '#e74c3c', label: 'Frontal-R' },
        'Left Parietal': { x: -55.0, y: -40.0, z: 60.0, radius: 45, color: '#3498db', label: 'Parietal-L' },
        'Right Parietal': { x: 55.0, y: -40.0, z: 60.0, radius: 45, color: '#3498db', label: 'Parietal-R' },
        'Left Temporal': { x: -80.0, y: -10.0, z: 0.0, radius: 45, color: '#f39c12', label: 'Temporal-L' },
        'Right Temporal': { x: 80.0, y: -10.0, z: 0.0, radius: 45, color: '#f39c12', label: 'Temporal-R' },
        'Left Occipital': { x: -30.0, y: -105.0, z: 15.0, radius: 45, color: '#9b59b6', label: 'Occipital-L' },
        'Right Occipital': { x: 30.0, y: -105.0, z: 15.0, radius: 45, color: '#9b59b6', label: 'Occipital-R' }
    };
    console.log('Using fallback brain regions (8 main cranial regions)');
}

// ROI Selection State
const ROIState = {
    selectedRegions: new Set(),
    hoveredRegion: null
};

// ============================================================
// DOM Elements
// ============================================================
const DOM = {
    init() {
        // Navigation
        this.navBtns = document.querySelectorAll('.nav-btn');
        this.panels = document.querySelectorAll('.panel');
        
        // Settings panel
        this.snirfFile = document.getElementById('snirf-file');
        this.elpFile = document.getElementById('elp-file');
        this.loadExample = document.getElementById('load-example');
        this.fileInfo = document.getElementById('file-info');
        this.previewCanvas = document.getElementById('preview-canvas');
        this.preview3dContainer = document.getElementById('preview-3d-container');
        this.btnProceed = document.getElementById('btn-proceed');
        
        // Config inputs
        this.maxDistance = document.getElementById('max-distance');
        this.minDistance = document.getElementById('min-distance');
        this.nSources = document.getElementById('n-sources');
        this.nDetectors = document.getElementById('n-detectors');
        this.nTimeslots = document.getElementById('n-timeslots');
        this.capacity = document.getElementById('capacity');
        this.algorithm = document.getElementById('algorithm');
        this.nTrials = document.getElementById('n-trials');
        
        // Stats displays
        this.statSources = document.getElementById('stat-sources');
        this.statDetectors = document.getElementById('stat-detectors');
        this.statChannels = document.getElementById('stat-channels');
        
        // Schematic panel
        this.schematicCanvas = document.getElementById('schematic-canvas');
        this.schematic3dContainer = document.getElementById('schematic-3d-container');
        this.toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
        
        // Assign panel
        this.assignCanvas = document.getElementById('assign-canvas');
        this.assign3dContainer = document.getElementById('assign-3d-container');
        this.timeslotLegend = document.getElementById('timeslot-legend');
        this.btnColor = document.getElementById('btn-color');
        this.btnCrosstalkCheck = document.getElementById('btn-crosstalk-check');
        this.resultBox = document.getElementById('result-box');
        this.resultDetails = document.getElementById('result-details');
        this.mcTries = document.getElementById('mc-tries');
        
        // Output panel
        this.outputCanvas = document.getElementById('output-canvas');
        this.exportLog = document.getElementById('log-content');
        
        // Modals
        this.progressModal = document.getElementById('progress-modal');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.resultsModal = document.getElementById('results-modal');
        this.statsBody = document.getElementById('stats-body');
    }
};

// ============================================================
// Coordinate Transformations
// ============================================================

/**
 * Convert 3D head coordinates to 2D topographic projection
 * Standard "overhead view" with nose at top
 * Uses azimuthal equidistant projection
 */
function toTopoCoords(x, y, z, canvasSize) {
    // Convert to spherical coordinates
    const r = Math.sqrt(x*x + y*y + z*z) || 1;
    const theta = Math.atan2(x, y);  // Angle from nose direction
    const phi = Math.acos(Math.max(-1, Math.min(1, z / r)));  // Angle from top
    
    // Azimuthal equidistant projection
    // phi = 0 at top (vertex), phi = π/2 at equator (ears level)
    const rProj = phi / (Math.PI / 2);  // Normalized radius (0 at top, 1 at equator)
    
    // Convert to canvas coordinates
    const scale = (canvasSize / 2) * 0.8;  // Leave margin
    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    
    return {
        x: cx + rProj * scale * Math.sin(theta),
        y: cy - rProj * scale * Math.cos(theta)  // Negative because canvas Y is down
    };
}

/**
 * Draw grid lines and points on topographic view
 * Shows hierarchical 10-20/10-10/10-5 structure plus complete geodesic grid
 */
function drawGridPoints(ctx, cx, cy, canvasSize) {
    ctx.save();
    
    const headRadius = canvasSize * 0.35;
    const gridDensity = document.getElementById('grid-density')?.value || 'all';
    const showGeodesic = document.getElementById('show-geodesic-grid')?.checked !== false;
    
    // First, draw geodesic grid mesh (complete latitude/longitude grid)
    if (showGeodesic && GridSystem.geodesicGrid && GridSystem.geodesicGrid.length > 0) {
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 0.3;
        ctx.globalAlpha = 0.08;
        
        // Draw latitude lines (constant phi)
        const phiValues = [...new Set(GridSystem.geodesicGrid.map(p => p.phi))];
        for (const phi of phiValues) {
            const pointsAtPhi = GridSystem.geodesicGrid
                .filter(p => Math.abs(p.phi - phi) < 0.001)
                .sort((a, b) => a.theta - b.theta);
            
            if (pointsAtPhi.length > 1) {
                ctx.beginPath();
                for (let i = 0; i < pointsAtPhi.length; i++) {
                    const p = pointsAtPhi[i];
                    const pos = toTopoCoords(p.x, p.y, p.z, canvasSize);
                    const dist = Math.sqrt(Math.pow(pos.x - cx, 2) + Math.pow(pos.y - cy, 2));
                    
                    if (dist <= headRadius * 1.05) {
                        if (i === 0) {
                            ctx.moveTo(pos.x, pos.y);
                        } else {
                            ctx.lineTo(pos.x, pos.y);
                        }
                    }
                }
                // Close the loop
                if (pointsAtPhi.length > 2) {
                    const first = pointsAtPhi[0];
                    const firstPos = toTopoCoords(first.x, first.y, first.z, canvasSize);
                    ctx.lineTo(firstPos.x, firstPos.y);
                }
                ctx.stroke();
            }
        }
        
        // Draw longitude lines (constant theta, approximately)
        // Group by theta buckets
        const thetaBuckets = {};
        const thetaBucketSize = 0.1; // radians
        for (const p of GridSystem.geodesicGrid) {
            const bucket = Math.round(p.theta / thetaBucketSize);
            if (!thetaBuckets[bucket]) thetaBuckets[bucket] = [];
            thetaBuckets[bucket].push(p);
        }
        
        for (const points of Object.values(thetaBuckets)) {
            if (points.length > 1) {
                points.sort((a, b) => a.phi - b.phi);
                
                ctx.beginPath();
                for (let i = 0; i < points.length; i++) {
                    const p = points[i];
                    const pos = toTopoCoords(p.x, p.y, p.z, canvasSize);
                    const dist = Math.sqrt(Math.pow(pos.x - cx, 2) + Math.pow(pos.y - cy, 2));
                    
                    if (dist <= headRadius * 1.05) {
                        if (i === 0) {
                            ctx.moveTo(pos.x, pos.y);
                        } else {
                            ctx.lineTo(pos.x, pos.y);
                        }
                    }
                }
                ctx.stroke();
            }
        }
        
        ctx.globalAlpha = 1;
        
        // Draw small dots at grid intersections
        ctx.fillStyle = '#4a5568';
        ctx.globalAlpha = 0.15;
        for (const p of GridSystem.geodesicGrid) {
            const pos = toTopoCoords(p.x, p.y, p.z, canvasSize);
            const dist = Math.sqrt(Math.pow(pos.x - cx, 2) + Math.pow(pos.y - cy, 2));
            
            if (dist <= headRadius * 1.05) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }
    
    // Now draw standard electrode position lines
    if (gridDensity !== 'none') {
        const lines = getGridLines();
        
        ctx.strokeStyle = '#2e7bc4';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.2;
        
        for (const line of lines) {
            const pos1 = toTopoCoords(line.from.x, line.from.y, line.from.z, canvasSize);
            const pos2 = toTopoCoords(line.to.x, line.to.y, line.to.z, canvasSize);
            
            // Check both points are visible
            const dist1 = Math.sqrt(Math.pow(pos1.x - cx, 2) + Math.pow(pos1.y - cy, 2));
            const dist2 = Math.sqrt(Math.pow(pos2.x - cx, 2) + Math.pow(pos2.y - cy, 2));
            
            if (dist1 <= headRadius * 1.05 && dist2 <= headRadius * 1.05) {
                ctx.beginPath();
                ctx.moveTo(pos1.x, pos1.y);
                ctx.lineTo(pos2.x, pos2.y);
                ctx.stroke();
            }
        }
        
        ctx.globalAlpha = 1;
    }
    
    // Now draw grid points with hierarchical sizes
    for (const gridPoint of GridSystem.positions) {
        const isOccupied = GridSystem.occupied.has(gridPoint.label);
        const density = classifyElectrodeDensity(gridPoint.label);
        
        // Filter by density setting
        if (gridDensity === '10-20' && density !== '10-20') continue;
        if (gridDensity === '10-10' && density === '10-5') continue;
        
        const pos = toTopoCoords(gridPoint.x, gridPoint.y, gridPoint.z, canvasSize);
        
        // Check if within head outline
        const distFromCenter = Math.sqrt(Math.pow(pos.x - cx, 2) + Math.pow(pos.y - cy, 2));
        if (distFromCenter > headRadius * 1.1) continue;
        
        // Hierarchical sizes: 10-20 largest, 10-10 medium, 10-5 smallest
        let radius, alpha, strokeWidth;
        
        if (density === '10-20') {
            radius = 5;
            alpha = isOccupied ? 0.3 : 0.7;
            strokeWidth = 2;
        } else if (density === '10-10') {
            radius = 3.5;
            alpha = isOccupied ? 0.2 : 0.5;
            strokeWidth = 1.5;
        } else { // 10-5
            radius = 2.5;
            alpha = isOccupied ? 0.15 : 0.35;
            strokeWidth = 1;
        }
        
        // Draw point
        ctx.globalAlpha = alpha;
        
        // Fill color - different for occupied
        if (isOccupied) {
            ctx.fillStyle = '#95a5a6'; // Gray for occupied
        } else {
            ctx.fillStyle = '#4a90e2'; // Blue for available
        }
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Stroke for emphasis on major points
        if (density === '10-20' || density === '10-10') {
            ctx.strokeStyle = isOccupied ? '#7f8c8d' : '#2e7bc4';
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
        }
        
        // Label major (10-20) positions
        if (density === '10-20' && !isOccupied) {
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(gridPoint.label, pos.x, pos.y - radius - 2);
        }
    }
    
    ctx.restore();
}

/**
 * Convert spherical angles (theta, phi) to 3D cartesian
 * theta: azimuthal angle (0 = front/nose, positive = right)
 * phi: polar angle from top (0 = vertex, π/2 = equator)
 */
function sphericalToCartesian(theta, phi, radius = HEAD.radius) {
    return {
        x: radius * Math.sin(phi) * Math.sin(theta),
        y: radius * Math.sin(phi) * Math.cos(theta),
        z: radius * Math.cos(phi)
    };
}

/**
 * Create a puck-shaped geometry (flat cylinder) for optodes
 * More realistic than spheres - looks like actual fNIRS optodes
 * @param {number} radius - Puck radius
 * @param {number} height - Puck thickness (height)
 * @returns {THREE.CylinderGeometry} Puck geometry
 */
function createPuckGeometry(radius, height = 2) {
    // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
    return new THREE.CylinderGeometry(radius, radius, height, 32);
}

/**
 * Orient puck to be tangent to head surface at given position
 * Returns rotation matrix to align puck perpendicular to radius vector
 * @param {Object} position - {x, y, z} position on head
 * @returns {THREE.Quaternion} Rotation to align with surface normal
 */
function getPuckOrientation(position) {
    // Compute normal vector (pointing outward from head center)
    const len = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
    if (len === 0) return new THREE.Quaternion();
    
    const normal = new THREE.Vector3(
        position.x / len,
        position.y / len,
        position.z / len
    );
    
    // Default cylinder axis is Y-axis, we need to align it with normal
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normal);
    
    return quaternion;
}

/**
 * Calculate photon migration path for fNIRS channel
 * Models the "banana-shaped" trajectory of diffuse light through tissue
 * Based on diffusion approximation for photon transport
 * 
 * Physics:
 * - Light enters at source, travels through scattering medium (tissue)
 * - Photon cloud spreads and penetrates to depth
 * - Detected photons have curved paths (not straight line)
 * - Penetration depth ≈ 0.4-0.5 × source-detector separation
 * - Sensitivity is highest in middle of banana
 * 
 * @param {Object} source - Source position {x, y, z}
 * @param {Object} detector - Detector position {x, y, z}
 * @param {Object} options - Configuration options
 * @returns {Object} Path data with curve points and sensitivity profile
 */
function calculatePhotonMigrationPath(source, detector, options = {}) {
    const {
        wavelength = 850,           // nm (affects absorption/scattering)
        modulation = 0,             // MHz (0 = continuous wave)
        tissueType = 'gray_matter', // Tissue optical properties
        nPoints = 30                // Points along path for curve
    } = options;
    
    // Source-detector separation (mm)
    const dx = detector.x - source.x;
    const dy = detector.y - source.y;
    const dz = detector.z - source.z;
    const separation = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Penetration depth calculation
    // Rule of thumb: depth ≈ 0.4-0.5 × separation for optimal SNR
    // Shorter separations: more superficial
    // Longer separations: deeper but worse SNR
    const penetrationDepth = separation * 0.45;
    
    // Midpoint on surface
    const midX = (source.x + detector.x) / 2;
    const midY = (source.y + detector.y) / 2;
    const midZ = (source.z + detector.z) / 2;
    
    // Direction vector from surface center to head center (inward normal)
    const centerDist = Math.sqrt(midX * midX + midY * midY + midZ * midZ);
    const inwardX = -midX / centerDist;
    const inwardY = -midY / centerDist;
    const inwardZ = -midZ / centerDist;
    
    // Deepest point of banana (moves inward from surface)
    const apexX = midX + inwardX * penetrationDepth;
    const apexY = midY + inwardY * penetrationDepth;
    const apexZ = midZ + inwardZ * penetrationDepth;
    
    // Generate smooth curve using quadratic Bezier-like path
    // This approximates the diffusion equation solution
    const pathPoints = [];
    const sensitivity = []; // Sensitivity weight at each point
    
    for (let i = 0; i <= nPoints; i++) {
        const t = i / nPoints; // Parameter from 0 to 1
        
        // Quadratic curve (simplified banana shape)
        // Uses control point at apex for smooth arc
        const t1 = 1 - t;
        const w0 = t1 * t1;           // Weight for source
        const w1 = 2 * t * t1;         // Weight for apex (control point)
        const w2 = t * t;              // Weight for detector
        
        const x = w0 * source.x + w1 * apexX + w2 * detector.x;
        const y = w0 * source.y + w1 * apexY + w2 * detector.y;
        const z = w0 * source.z + w1 * apexZ + w2 * detector.z;
        
        pathPoints.push(new THREE.Vector3(x, y, z));
        
        // Sensitivity profile: Gaussian-like, peaks in middle
        // This represents relative contribution to fNIRS signal
        const distFromMid = Math.abs(t - 0.5);
        const sens = Math.exp(-8 * distFromMid * distFromMid);
        sensitivity.push(sens);
    }
    
    // Calculate optical properties (for future use in reconstruction)
    const opticalProperties = getOpticalProperties(tissueType, wavelength);
    
    return {
        pathPoints: pathPoints,
        sensitivity: sensitivity,
        penetrationDepth: penetrationDepth,
        separation: separation,
        apex: new THREE.Vector3(apexX, apexY, apexZ),
        opticalProperties: opticalProperties,
        wavelength: wavelength
    };
}

/**
 * Get optical properties for tissue type at given wavelength
 * Based on published values for fNIRS
 * 
 * @param {string} tissueType - Type of tissue
 * @param {number} wavelength - Wavelength in nm
 * @returns {Object} Optical properties (μa, μs', n, g)
 */
function getOpticalProperties(tissueType, wavelength) {
    // Simplified optical properties for common fNIRS wavelengths
    // μa: absorption coefficient (mm^-1)
    // μs': reduced scattering coefficient (mm^-1)
    // n: refractive index
    // g: anisotropy factor
    
    const properties = {
        gray_matter: {
            760: { ua: 0.025, usp: 1.1, n: 1.4, g: 0.9 },
            850: { ua: 0.020, usp: 1.0, n: 1.4, g: 0.9 }
        },
        white_matter: {
            760: { ua: 0.018, usp: 9.0, n: 1.4, g: 0.9 },
            850: { ua: 0.016, usp: 8.5, n: 1.4, g: 0.9 }
        },
        scalp: {
            760: { ua: 0.018, usp: 0.7, n: 1.4, g: 0.8 },
            850: { ua: 0.015, usp: 0.65, n: 1.4, g: 0.8 }
        },
        skull: {
            760: { ua: 0.012, usp: 1.6, n: 1.4, g: 0.9 },
            850: { ua: 0.010, usp: 1.5, n: 1.4, g: 0.9 }
        }
    };
    
    // Interpolate if exact wavelength not available
    const tissue = properties[tissueType] || properties.gray_matter;
    
    if (tissue[wavelength]) {
        return tissue[wavelength];
    }
    
    // Simple linear interpolation between 760 and 850 nm
    const w1 = 760, w2 = 850;
    const t = (wavelength - w1) / (w2 - w1);
    const p1 = tissue[w1];
    const p2 = tissue[w2];
    
    return {
        ua: p1.ua + t * (p2.ua - p1.ua),
        usp: p1.usp + t * (p2.usp - p1.usp),
        n: p1.n,
        g: p1.g
    };
}

/**
 * Generate brain cortical surface mesh
 * Creates a smoothed sphere approximating the cortical surface
 * Based on MNE's fsaverage surface, simplified for web
 */
function generateBrainSurface() {
    console.log('Generating brain cortical surface...');
    
    // Create icosphere (geodesic sphere) for smooth cortical surface
    // This is similar to MNE's inflated brain surface
    // Position at typical cortical depth: scalp (~95mm) minus typical penetration (~12-15mm)
    const radius = 82;  // Cortical surface depth (scalp at ~95mm, cortex at ~80-85mm)
    const detail = 4;   // Subdivision level (higher = more vertices)
    
    // Start with icosahedron
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;
    const vertices = [];
    const faces = [];
    
    // Initial vertices of icosahedron
    // Note: In MNE coordinates, +Z is superior (up), -Z is inferior (down)
    // We'll filter out inferior vertices later (below brainstem)
    const initialVerts = [
        [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
        [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
        [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1]
    ];
    
    for (const v of initialVerts) {
        const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        vertices.push({
            x: radius * v[0] / len,
            y: radius * v[1] / len,
            z: radius * v[2] / len,
            sensitivity: 0,
            vertexId: vertices.length
        });
    }
    
    // Initial faces of icosahedron
    const initialFaces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    
    for (const f of initialFaces) {
        faces.push([f[0], f[1], f[2]]);
    }
    
    // Subdivide for smoothness (tessellation)
    for (let i = 0; i < detail; i++) {
        const newFaces = [];
        const midpointCache = {};
        
        const getMidpoint = (i1, i2) => {
            const key = Math.min(i1, i2) + '_' + Math.max(i1, i2);
            if (midpointCache[key] !== undefined) {
                return midpointCache[key];
            }
            
            const v1 = vertices[i1];
            const v2 = vertices[i2];
            const mx = (v1.x + v2.x) / 2;
            const my = (v1.y + v2.y) / 2;
            const mz = (v1.z + v2.z) / 2;
            
            // Project to sphere
            const len = Math.sqrt(mx*mx + my*my + mz*mz);
            const newIdx = vertices.length;
            vertices.push({
                x: radius * mx / len,
                y: radius * my / len,
                z: radius * mz / len,
                sensitivity: 0,
                vertexId: newIdx
            });
            
            midpointCache[key] = newIdx;
            return newIdx;
        };
        
        for (const face of faces) {
            const a = face[0], b = face[1], c = face[2];
            const ab = getMidpoint(a, b);
            const bc = getMidpoint(b, c);
            const ca = getMidpoint(c, a);
            
            newFaces.push([a, ab, ca]);
            newFaces.push([b, bc, ab]);
            newFaces.push([c, ca, bc]);
            newFaces.push([ab, bc, ca]);
        }
        
        faces.length = 0;
        faces.push(...newFaces);
    }
    
    // Assign brain regions to vertices based on position
    // This creates a simple parcellation for ROI selection
    for (const vertex of vertices) {
        vertex.region = assignVertexToRegion(vertex);
    }
    
    // Filter out inferior vertices (below brainstem level)
    // Keep only vertices where z > -20mm (above neck/brainstem)
    const zThreshold = -20;  // mm
    const vertexMap = {};  // Old index to new index
    const filteredVertices = [];
    let newIdx = 0;
    
    for (let i = 0; i < vertices.length; i++) {
        if (vertices[i].z > zThreshold) {
            vertexMap[i] = newIdx;
            vertices[i].vertexId = newIdx;
            filteredVertices.push(vertices[i]);
            newIdx++;
        }
    }
    
    // Filter faces to only include those with all vertices above threshold
    const filteredFaces = [];
    for (const face of faces) {
        if (vertexMap[face[0]] !== undefined && 
            vertexMap[face[1]] !== undefined && 
            vertexMap[face[2]] !== undefined) {
            filteredFaces.push([
                vertexMap[face[0]],
                vertexMap[face[1]],
                vertexMap[face[2]]
            ]);
        }
    }
    
    BRAIN_SURFACE.vertices = filteredVertices;
    BRAIN_SURFACE.faces = filteredFaces;
    
    // Build region index (map region names to vertex indices)
    BRAIN_SURFACE.regions = {};
    for (let i = 0; i < filteredVertices.length; i++) {
        const region = filteredVertices[i].region;
        if (!BRAIN_SURFACE.regions[region]) {
            BRAIN_SURFACE.regions[region] = [];
        }
        BRAIN_SURFACE.regions[region].push(i);
    }
    
    console.log(`Brain surface generated: ${filteredVertices.length} vertices, ${filteredFaces.length} faces`);
    console.log(`  (Filtered out ${vertices.length - filteredVertices.length} inferior vertices)`);
    console.log(`  Regions: ${Object.keys(BRAIN_SURFACE.regions).join(', ')}`);
    
    return { vertices: filteredVertices, faces: filteredFaces };
}

/**
 * Assign a vertex to a brain region based on its 3D position
 * Creates a simple parcellation of the cortical surface
 */
function assignVertexToRegion(vertex) {
    const { x, y, z } = vertex;
    
    // Determine hemisphere
    const isLeft = x < 0;
    const hemisphere = isLeft ? 'Left' : 'Right';
    
    // Determine anterior-posterior region
    let regionName;
    if (y > 40) {
        regionName = 'Frontal';  // Front of head
    } else if (y > -20) {
        // Temporal or Central based on lateral position
        if (Math.abs(x) > 60) {
            regionName = 'Temporal';  // Sides
        } else if (z > 60) {
            regionName = 'Parietal';  // Top-middle
        } else {
            regionName = 'Temporal';  // Lower sides
        }
    } else if (y > -80) {
        regionName = 'Parietal';  // Middle-back
    } else {
        regionName = 'Occipital';  // Back
    }
    
    return `${hemisphere} ${regionName}`;
}

/**
 * Project voxel sensitivity onto brain surface vertices
 * For each vertex, find nearby voxels and interpolate sensitivity
 */
function projectSensitivityToSurface() {
    if (!VoxelGrid.sensitivityMatrix) {
        console.warn('No sensitivity matrix to project');
        return;
    }
    
    if (!BRAIN_SURFACE.vertices || BRAIN_SURFACE.vertices.length === 0) {
        generateBrainSurface();
    }
    
    console.log('Projecting sensitivity to cortical surface...');
    
    // For each surface vertex, find nearest voxels and interpolate
    for (const vertex of BRAIN_SURFACE.vertices) {
        let totalSensitivity = 0;
        let totalWeight = 0;
        
        // Search nearby voxels (within 10mm)
        const searchRadius = 10;
        
        for (const voxel of VoxelGrid.voxels) {
            if (!voxel.isInsideHead || voxel.totalSensitivity === 0) continue;
            
            const dx = voxel.x - vertex.x;
            const dy = voxel.y - vertex.y;
            const dz = voxel.z - vertex.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < searchRadius) {
                // Inverse distance weighting
                const weight = 1.0 / (dist + 1.0);  // +1 to avoid division by zero
                totalSensitivity += voxel.totalSensitivity * weight;
                totalWeight += weight;
            }
        }
        
        if (totalWeight > 0) {
            vertex.sensitivity = totalSensitivity / totalWeight;
        } else {
            vertex.sensitivity = 0;
        }
    }
    
    console.log('Sensitivity projection complete');
}

/**
 * Voxel Grid System for Brain Volume
 * Defines a 3D grid covering the brain for source reconstruction
 */
const VoxelGrid = {
    // Grid parameters
    bounds: {
        xMin: -80, xMax: 80,  // mm (left-right)
        yMin: -80, yMax: 80,  // mm (posterior-anterior)
        zMin: -20, zMax: 100  // mm (inferior-superior)
    },
    resolution: 5,  // mm (voxel size)
    
    // Computed properties
    dimensions: { nx: 0, ny: 0, nz: 0 },
    totalVoxels: 0,
    voxels: [],
    
    // Sensitivity matrix: channels × voxels
    // Sparse storage: only non-zero entries
    sensitivityMatrix: null,
    
    /**
     * Initialize voxel grid
     */
    initialize() {
        const res = this.resolution;
        const b = this.bounds;
        
        // Calculate dimensions
        this.dimensions.nx = Math.ceil((b.xMax - b.xMin) / res);
        this.dimensions.ny = Math.ceil((b.yMax - b.yMin) / res);
        this.dimensions.nz = Math.ceil((b.zMax - b.zMin) / res);
        this.totalVoxels = this.dimensions.nx * this.dimensions.ny * this.dimensions.nz;
        
        // Create voxel array
        this.voxels = [];
        let voxelId = 0;
        
        for (let ix = 0; ix < this.dimensions.nx; ix++) {
            for (let iy = 0; iy < this.dimensions.ny; iy++) {
                for (let iz = 0; iz < this.dimensions.nz; iz++) {
                    const x = b.xMin + (ix + 0.5) * res;
                    const y = b.yMin + (iy + 0.5) * res;
                    const z = b.zMin + (iz + 0.5) * res;
                    
                    // Check if voxel is inside head (approximate sphere)
                    const distFromCenter = Math.sqrt(x*x + y*y + z*z);
                    const isInsideHead = distFromCenter < 95;  // 95mm radius
                    
                    this.voxels.push({
                        id: voxelId++,
                        ix, iy, iz,
                        x, y, z,
                        isInsideHead,
                        sensitivity: {},  // Map: channelId -> sensitivity weight
                        totalSensitivity: 0
                    });
                }
            }
        }
        
        console.log(`Voxel grid initialized:`);
        console.log(`  Resolution: ${res}mm`);
        console.log(`  Dimensions: ${this.dimensions.nx} × ${this.dimensions.ny} × ${this.dimensions.nz}`);
        console.log(`  Total voxels: ${this.totalVoxels}`);
        console.log(`  Inside head: ${this.voxels.filter(v => v.isInsideHead).length}`);
    },
    
    /**
     * Get voxel containing a 3D point
     */
    getVoxelAt(x, y, z) {
        const b = this.bounds;
        const res = this.resolution;
        
        if (x < b.xMin || x > b.xMax || 
            y < b.yMin || y > b.yMax || 
            z < b.zMin || z > b.zMax) {
            return null;
        }
        
        const ix = Math.floor((x - b.xMin) / res);
        const iy = Math.floor((y - b.yMin) / res);
        const iz = Math.floor((z - b.zMin) / res);
        
        if (ix < 0 || ix >= this.dimensions.nx ||
            iy < 0 || iy >= this.dimensions.ny ||
            iz < 0 || iz >= this.dimensions.nz) {
            return null;
        }
        
        const voxelIndex = ix * this.dimensions.ny * this.dimensions.nz + 
                          iy * this.dimensions.nz + iz;
        
        return this.voxels[voxelIndex];
    }
};

/**
 * Calculate voxel-wise sensitivity for a photon migration path
 * Integrates the path through voxel grid, weighting by photon density
 * 
 * This builds the forward model: Signal = Σ(sensitivity × Δμa × path_length)
 * 
 * @param {Object} pathData - From calculatePhotonMigrationPath()
 * @param {string} channelId - Channel identifier
 * @returns {Object} Voxel sensitivity map
 */
function calculateVoxelSensitivity(pathData, channelId) {
    if (!VoxelGrid.voxels || VoxelGrid.voxels.length === 0) {
        console.warn('Voxel grid not initialized');
        return {};
    }
    
    const voxelSensitivity = {};  // voxelId -> sensitivity weight
    const pathPoints = pathData.pathPoints;
    const sensitivity = pathData.sensitivity;
    
    // Integrate along path
    for (let i = 0; i < pathPoints.length - 1; i++) {
        const p1 = pathPoints[i];
        const p2 = pathPoints[i + 1];
        
        // Average sensitivity along this segment
        const segmentSens = (sensitivity[i] + sensitivity[i + 1]) / 2;
        
        // Segment length
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        const segmentLength = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // March along segment, sampling voxels
        const nSteps = Math.ceil(segmentLength / (VoxelGrid.resolution * 0.5));
        
        for (let step = 0; step <= nSteps; step++) {
            const t = step / nSteps;
            const x = p1.x + t * dx;
            const y = p1.y + t * dy;
            const z = p1.z + t * dz;
            
            const voxel = VoxelGrid.getVoxelAt(x, y, z);
            if (voxel && voxel.isInsideHead) {
                // Weight contribution by:
                // 1. Path sensitivity (banana-shaped profile)
                // 2. Segment length
                // 3. Optical properties (future: tissue-specific)
                
                const weight = segmentSens * (segmentLength / nSteps);
                
                if (!voxelSensitivity[voxel.id]) {
                    voxelSensitivity[voxel.id] = 0;
                }
                voxelSensitivity[voxel.id] += weight;
                
                // Store in voxel for visualization
                if (!voxel.sensitivity[channelId]) {
                    voxel.sensitivity[channelId] = 0;
                }
                voxel.sensitivity[channelId] += weight;
                voxel.totalSensitivity += weight;
            }
        }
    }
    
    return voxelSensitivity;
}

/**
 * Build complete sensitivity matrix for all channels
 * Matrix A[channels × voxels] where A[i,j] = sensitivity of channel i to voxel j
 * 
 * For source reconstruction: ΔOD = A × Δμa
 * To solve: Δμa = (A^T A + λI)^-1 A^T ΔOD
 * 
 * @returns {Object} Sparse sensitivity matrix and metadata
 */
function buildSensitivityMatrix() {
    console.log('Building sensitivity matrix...');
    
    if (!VoxelGrid.voxels || VoxelGrid.voxels.length === 0) {
        VoxelGrid.initialize();
    }
    
    if (!AppState.channels || AppState.channels.length === 0) {
        console.warn('No channels available. Create a montage first.');
        return null;
    }
    
    // Reset voxel sensitivities
    for (const voxel of VoxelGrid.voxels) {
        voxel.sensitivity = {};
        voxel.totalSensitivity = 0;
    }
    
    // Sparse matrix storage: array of {channel, voxel, weight}
    const sparseEntries = [];
    const channelVoxelMaps = {};  // channelId -> {voxelId: weight}
    
    let channelIndex = 0;
    for (const channel of AppState.channels) {
        if (!channel.photonPath) {
            console.warn(`Channel ${channel.id} missing photon path`);
            continue;
        }
        
        const voxelSens = calculateVoxelSensitivity(channel.photonPath, channel.id);
        channelVoxelMaps[channel.id] = voxelSens;
        
        // Add to sparse matrix
        for (const [voxelId, weight] of Object.entries(voxelSens)) {
            if (weight > 1e-6) {  // Threshold for numerical stability
                sparseEntries.push({
                    channel: channelIndex,
                    channelId: channel.id,
                    voxel: parseInt(voxelId),
                    weight: weight
                });
            }
        }
        
        channelIndex++;
    }
    
    const matrix = {
        sparse: sparseEntries,
        nChannels: AppState.channels.length,
        nVoxels: VoxelGrid.totalVoxels,
        nNonZero: sparseEntries.length,
        sparsity: 1 - (sparseEntries.length / (AppState.channels.length * VoxelGrid.totalVoxels)),
        channelMaps: channelVoxelMaps
    };
    
    VoxelGrid.sensitivityMatrix = matrix;
    
    console.log(`Sensitivity matrix built:`);
    console.log(`  Channels: ${matrix.nChannels}`);
    console.log(`  Voxels: ${matrix.nVoxels}`);
    console.log(`  Non-zero entries: ${matrix.nNonZero}`);
    console.log(`  Sparsity: ${(matrix.sparsity * 100).toFixed(2)}%`);
    console.log(`  Avg voxels per channel: ${(matrix.nNonZero / matrix.nChannels).toFixed(1)}`);
    
    return matrix;
}

/**
 * Project a 3D position onto the standard head surface
 * Ensures all optodes sit on a consistent spherical surface
 * NOTE: This is a simplified projection. For accurate coregistration,
 * use the coregisterOptodes() function which implements fiducial-based
 * alignment and surface fitting.
 */
function projectToHeadSurface(pos, radius = HEAD.radius) {
    const len = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
    if (len === 0) {
        // Handle zero-length vector (shouldn't happen, but be safe)
        return { x: 0, y: radius, z: 0 };
    }
    const scale = radius / len;
    return {
        x: pos.x * scale,
        y: pos.y * scale,
        z: pos.z * scale
    };
}

// ============================================================
// Standardized Grid System (10-20/10-10/10-5 Based)
// ============================================================

/**
 * Grid system state - standardized optode placement positions
 * Based on extended 10-20 system (10-5 density) for fNIRS best practices
 */
const GridSystem = {
    // All available grid positions (from 10-5 electrode system)
    positions: [],
    
    // Grid positions organized by region
    byRegion: {},
    
    // Occupied positions (to prevent overlap)
    occupied: new Set(),
    
    // Configuration
    config: {
        enabled: true,
        snapDistance: 15,  // mm - max distance to snap to grid point
        minSpacing: 25,    // mm - minimum distance between optodes
        showGrid: true,    // Show grid points in visualization
        allowOffGrid: false // Allow placement off-grid (with warning)
    }
};

/**
 * Generate complete geodesic grid covering entire head surface
 * Uses surface distance (arc length) like measuring tape, not angular spacing
 * This matches how the 10-20 system is actually measured (e.g., 10% from inion, 20% intervals)
 * 
 * In the 10-20 system, measurements are made with a tape measure along the curved surface:
 * - Nasion to inion over vertex (anterior-posterior)
 * - Left to right preauricular points over vertex (lateral)
 * - Positions are defined as percentages of these curved distances
 * 
 * @param {number} surfaceSpacing - Spacing in mm along surface (default 15mm)
 * @returns {Array} Array of grid positions
 */
function generateGeodesicGrid(surfaceSpacing = 15) {
    const grid = [];
    
    // Use actual head measurements from anatomical data
    // The 10-20 system measures surface distances (like using a cloth tape measure)
    // Typical adult head: nasion-inion distance along scalp is ~350-360mm
    
    // For our spherical approximation, use the radius that matches real electrode positions
    // Most electrodes are positioned at ~100mm from origin (not 85mm)
    const radius = 100;  // Use larger radius to match actual electrode positions
    
    // Calculate phi range to cover from front (nasion area) to back (inion area)
    // In spherical coords: phi = 0 is top (z-axis), phi = π/2 is equator
    // We want to cover approximately from phi ≈ 0.4 rad (front, ~20°) to phi ≈ 2.3 rad (back, ~130°)
    
    const phiFront = 0.4;   // Front of head (includes forehead)
    const phiBack = 2.3;    // Back of head (includes occipital)
    
    // Total arc length from front to back along midline
    const arcLengthAP = radius * (phiBack - phiFront);
    
    // Calculate number of divisions based on surface spacing
    const nDivisionsAP = Math.ceil(arcLengthAP / surfaceSpacing);
    const phiStep = (phiBack - phiFront) / nDivisionsAP;
    
    let gridId = 0;
    
    // Generate grid using surface-distance-based spacing
    for (let i = 0; i <= nDivisionsAP; i++) {
        const phi = phiFront + i * phiStep;
        
        // At this latitude, calculate circumference
        const circumference = 2 * Math.PI * radius * Math.sin(phi);
        
        // Number of points around this latitude based on surface spacing
        // Ensure we have at least 4 points even near poles
        const nPointsInRing = Math.max(4, Math.round(circumference / surfaceSpacing));
        const thetaStep = (2 * Math.PI) / nPointsInRing;
        
        for (let j = 0; j < nPointsInRing; j++) {
            const theta = j * thetaStep;
            
            // Convert to Cartesian coordinates
            const pos = sphericalToCartesian(theta, phi, radius);
            
            // Calculate percentage distances for 10-20 style labeling
            const arcFromFront = radius * (phi - phiFront);
            const percentAP = (arcFromFront / arcLengthAP) * 100;
            
            grid.push({
                id: gridId++,
                x: pos.x,
                y: pos.y,
                z: pos.z,
                theta: theta,
                phi: phi,
                type: 'geodesic',
                label: `G${gridId}`,
                arcDistance: arcFromFront,
                percentAP: percentAP  // Anterior-posterior percentage (0=front, 100=back)
            });
        }
    }
    
    console.log(`Generated geodesic grid:`);
    console.log(`  Surface spacing: ${surfaceSpacing}mm`);
    console.log(`  Effective radius: ${radius}mm`);
    console.log(`  Arc length (front-back): ${arcLengthAP.toFixed(1)}mm`);
    console.log(`  AP divisions: ${nDivisionsAP}`);
    console.log(`  Total grid points: ${grid.length}`);
    
    return grid;
}

/**
 * Initialize grid system with both standard positions and geodesic grid
 * Uses all available 10-5 positions as potential optode locations
 * Plus generates complete geodesic mesh
 */
function initializeGridSystem() {
    // Standard electrode positions (for snapping and selection)
    GridSystem.positions = [];
    GridSystem.byRegion = {
        frontal: [],
        central: [],
        parietal: [],
        occipital: [],
        temporal: [],
        other: []
    };
    
    // Convert all electrode positions to grid points
    for (const [name, electrode] of Object.entries(ELECTRODES_1020)) {
        const gridPoint = {
            x: electrode.x,
            y: electrode.y,
            z: electrode.z,
            label: name,
            type: 'standard',
            region: classifyElectrodeRegion(name),
            density: classifyElectrodeDensity(name)
        };
        
        GridSystem.positions.push(gridPoint);
        GridSystem.byRegion[gridPoint.region].push(gridPoint);
    }
    
    // Generate complete geodesic grid mesh (surface distance based)
    const gridSpacing = document.getElementById('geodesic-spacing')?.value || 15;
    GridSystem.geodesicGrid = generateGeodesicGrid(parseFloat(gridSpacing));
    
    // Initialize voxel grid for source reconstruction
    VoxelGrid.initialize();
    
    console.log(`Grid system initialized:`);
    console.log(`  Standard positions: ${GridSystem.positions.length}`);
    console.log(`  Geodesic grid: ${GridSystem.geodesicGrid.length} positions`);
    console.log(`  Frontal: ${GridSystem.byRegion.frontal.length}`);
    console.log(`  Central: ${GridSystem.byRegion.central.length}`);
    console.log(`  Parietal: ${GridSystem.byRegion.parietal.length}`);
    console.log(`  Temporal: ${GridSystem.byRegion.temporal.length}`);
    console.log(`  Occipital: ${GridSystem.byRegion.occipital.length}`);
}

/**
 * Classify electrode into anatomical region based on standard naming
 */
function classifyElectrodeRegion(name) {
    if (name.match(/^(Fp|AF|F)/)) return 'frontal';
    if (name.match(/^(FC|C|CP)/)) return 'central';
    if (name.match(/^P/)) return 'parietal';
    if (name.match(/^O/)) return 'occipital';
    if (name.match(/^(FT|T|TP)/)) return 'temporal';
    return 'other';
}

/**
 * Classify electrode by density level (10-20, 10-10, or 10-5)
 * Based on standard electrode naming conventions
 */
function classifyElectrodeDensity(name) {
    // 10-20 System: Original 21 positions
    const standard1020 = [
        'Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8',
        'T3', 'C3', 'Cz', 'C4', 'T4',
        'T5', 'P3', 'Pz', 'P4', 'T6',
        'O1', 'Oz', 'O2',
        'A1', 'A2'  // Reference electrodes
    ];
    
    if (standard1020.includes(name)) {
        return '10-20';
    }
    
    // 10-10 System: Intermediate positions (no odd numbers beyond 3,4)
    // Pattern: Letters with even numbers or z, but not 5,7,9
    if (name.match(/^[A-Z]+[zZ]$/) || 
        name.match(/^[A-Z]+[2468]$/) ||
        name.match(/^[A-Z]+[246]h?$/)) {
        return '10-10';
    }
    
    // Everything else is 10-5 (high density)
    return '10-5';
}

/**
 * Get grid lines connecting positions in same row/column
 * Creates the visible grid structure
 */
function getGridLines() {
    const lines = [];
    
    // Organize positions by anterior-posterior rows (same Y approximately)
    const rowTolerance = 15; // mm
    const rows = {};
    
    for (const pos of GridSystem.positions) {
        // Round Y coordinate to nearest 15mm to group into rows
        const rowKey = Math.round(pos.y / rowTolerance) * rowTolerance;
        if (!rows[rowKey]) rows[rowKey] = [];
        rows[rowKey].push(pos);
    }
    
    // Create lines within each row (left-right connections)
    for (const rowPositions of Object.values(rows)) {
        // Sort by X coordinate (left to right)
        rowPositions.sort((a, b) => a.x - b.x);
        
        // Connect adjacent positions
        for (let i = 0; i < rowPositions.length - 1; i++) {
            const pos1 = rowPositions[i];
            const pos2 = rowPositions[i + 1];
            
            // Only connect if reasonably close in X
            const dx = Math.abs(pos2.x - pos1.x);
            if (dx < 30) { // mm
                lines.push({
                    from: pos1,
                    to: pos2,
                    type: 'lateral'
                });
            }
        }
    }
    
    // Organize by lateral columns (same X approximately)
    const colTolerance = 15; // mm
    const cols = {};
    
    for (const pos of GridSystem.positions) {
        const colKey = Math.round(pos.x / colTolerance) * colTolerance;
        if (!cols[colKey]) cols[colKey] = [];
        cols[colKey].push(pos);
    }
    
    // Create lines within each column (front-back connections)
    for (const colPositions of Object.values(cols)) {
        // Sort by Y coordinate (front to back)
        colPositions.sort((a, b) => b.y - a.y); // Higher Y = more anterior
        
        // Connect adjacent positions
        for (let i = 0; i < colPositions.length - 1; i++) {
            const pos1 = colPositions[i];
            const pos2 = colPositions[i + 1];
            
            // Only connect if reasonably close in Y
            const dy = Math.abs(pos2.y - pos1.y);
            if (dy < 30) { // mm
                lines.push({
                    from: pos1,
                    to: pos2,
                    type: 'anteroposterior'
                });
            }
        }
    }
    
    return lines;
}

/**
 * Find nearest grid position to a given point
 * @param {Object} point - {x, y, z} position to snap
 * @param {Object} options - Filtering options
 * @returns {Object} Nearest grid point or null if none within snapDistance
 */
function snapToGrid(point, options = {}) {
    const opts = {
        region: null,           // Filter by region
        excludeOccupied: true,  // Skip already occupied positions
        maxDistance: GridSystem.config.snapDistance,
        ...options
    };
    
    let positions = GridSystem.positions;
    
    // Filter by region if specified
    if (opts.region) {
        positions = GridSystem.byRegion[opts.region] || [];
    }
    
    let nearestDist = Infinity;
    let nearest = null;
    
    for (const gridPoint of positions) {
        // Skip occupied positions if requested
        if (opts.excludeOccupied && GridSystem.occupied.has(gridPoint.label)) {
            continue;
        }
        
        const dist = distance3D(point, gridPoint);
        
        if (dist < nearestDist && dist <= opts.maxDistance) {
            nearestDist = dist;
            nearest = gridPoint;
        }
    }
    
    return nearest;
}

/**
 * Get available (unoccupied) grid positions
 * @param {Object} options - Filter options
 * @returns {Array} Array of available grid positions
 */
function getAvailableGridPositions(options = {}) {
    const opts = {
        region: null,
        minSpacing: GridSystem.config.minSpacing,
        ...options
    };
    
    let positions = GridSystem.positions;
    
    // Filter by region
    if (opts.region) {
        positions = GridSystem.byRegion[opts.region] || [];
    }
    
    // Filter out occupied positions
    const available = positions.filter(p => !GridSystem.occupied.has(p.label));
    
    // If minSpacing specified, ensure spacing from occupied positions
    if (opts.minSpacing > 0 && GridSystem.occupied.size > 0) {
        return available.filter(gridPoint => {
            // Check distance to all occupied positions
            for (const occupiedLabel of GridSystem.occupied) {
                const occupied = GridSystem.positions.find(p => p.label === occupiedLabel);
                if (occupied && distance3D(gridPoint, occupied) < opts.minSpacing) {
                    return false;
                }
            }
            return true;
        });
    }
    
    return available;
}

/**
 * Mark grid position as occupied
 */
function occupyGridPosition(label) {
    GridSystem.occupied.add(label);
}

/**
 * Release grid position
 */
function releaseGridPosition(label) {
    GridSystem.occupied.delete(label);
}

/**
 * Clear all occupied positions
 */
function clearOccupiedGrid() {
    GridSystem.occupied.clear();
}

/**
 * Select optimal grid positions for a region-based montage
 * Uses greedy selection to maximize coverage within region
 * 
 * @param {Array} regionNames - Array of region names from BRAIN_REGIONS
 * @param {Number} nSources - Target number of sources
 * @param {Number} nDetectors - Target number of detectors
 * @returns {Object} {sources: [...], detectors: [...]}
 */
function selectGridPositionsForRegions(regionNames, nSources, nDetectors) {
    const sources = [];
    const detectors = [];
    
    // If no regions selected, distribute evenly over whole head
    if (regionNames.length === 0) {
        return distributeOptodesEvenlyOverHead(nSources, nDetectors);
    }
    
    // Get grid positions within selected ROIs
    // For each ROI, classify positions by distance from center
    const roiPositions = [];  // Array of {region, pos, distFromCenter}
    
    for (const regionName of regionNames) {
        const region = BRAIN_REGIONS[regionName];
        if (!region) continue;
        
        const cx = region.x;
        const cy = region.y;
        const cz = region.z;
        const regionRadius = region.radius;
        
        // Find all grid positions within this ROI
        for (const pos of GridSystem.positions) {
            const dx = pos.x - cx;
            const dy = pos.y - cy;
            const dz = pos.z - cz;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            // Include positions within 1.2× radius for good coverage
            if (dist < regionRadius * 1.2) {
                roiPositions.push({
                    region: regionName,
                    pos: pos,
                    distFromCenter: dist,
                    regionRadius: regionRadius
                });
            }
        }
    }
    
    if (roiPositions.length === 0) {
        console.warn('No grid positions found in selected ROIs, using whole head');
        return distributeOptodesEvenlyOverHead(nSources, nDetectors);
    }
    
    // Remove duplicates (positions might be in multiple overlapping ROIs)
    const uniquePositions = [];
    const seenKeys = new Set();
    for (const item of roiPositions) {
        const key = `${item.pos.x.toFixed(2)},${item.pos.y.toFixed(2)},${item.pos.z.toFixed(2)}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniquePositions.push(item);
        }
    }
    
    // Intersperse sources and detectors using a checkerboard pattern
    // Sort positions by a spatial hash to create consistent checkerboard pattern
    uniquePositions.sort((a, b) => {
        // Create spatial grid cells for consistent ordering
        const cellSize = 20; // mm
        const ax = Math.floor(a.pos.x / cellSize);
        const ay = Math.floor(a.pos.y / cellSize);
        const az = Math.floor(a.pos.z / cellSize);
        const bx = Math.floor(b.pos.x / cellSize);
        const by = Math.floor(b.pos.y / cellSize);
        const bz = Math.floor(b.pos.z / cellSize);
        
        // Sort by z, then y, then x for consistent ordering
        if (az !== bz) return az - bz;
        if (ay !== by) return ay - by;
        return ax - bx;
    });
    
    // Calculate target source/detector ratio
    const totalOptodes = nSources + nDetectors;
    const sourceRatio = nSources / totalOptodes;
    
    // Distribute optodes with interspersed pattern
    let sourceId = 1;
    let detectorId = 1;
    let sourcesPlaced = 0;
    let detectorsPlaced = 0;
    
    for (let i = 0; i < uniquePositions.length && (sourcesPlaced < nSources || detectorsPlaced < nDetectors); i++) {
        const item = uniquePositions[i];
        
        // Use checkerboard pattern based on position in 3D space
        // This ensures adjacent positions alternate between sources and detectors
        const gridX = Math.floor(item.pos.x / 15); // ~15mm grid spacing
        const gridY = Math.floor(item.pos.y / 15);
        const gridZ = Math.floor(item.pos.z / 15);
        const isSourceCell = (gridX + gridY + gridZ) % 2 === 0;
        
        // Also check if we need to balance the ratio
        const currentSourceRatio = sourcesPlaced / Math.max(1, sourcesPlaced + detectorsPlaced);
        const needMoreSources = currentSourceRatio < sourceRatio - 0.1;
        const needMoreDetectors = currentSourceRatio > sourceRatio + 0.1;
        
        // Decide whether to place source or detector
        let placeSource;
        if (sourcesPlaced >= nSources) {
            placeSource = false;
        } else if (detectorsPlaced >= nDetectors) {
            placeSource = true;
        } else if (needMoreSources) {
            placeSource = true;
        } else if (needMoreDetectors) {
            placeSource = false;
        } else {
            placeSource = isSourceCell;
        }
        
        if (placeSource) {
            sources.push({
                id: sourceId - 1,
                x: item.pos.x,
                y: item.pos.y,
                z: item.pos.z,
                label: `S${sourceId}`,
                gridLabel: item.pos.label
            });
            sourceId++;
            sourcesPlaced++;
        } else {
            detectors.push({
                id: detectorId - 1,
                x: item.pos.x,
                y: item.pos.y,
                z: item.pos.z,
                label: `D${detectorId}`,
                gridLabel: item.pos.label
            });
            detectorId++;
            detectorsPlaced++;
        }
    }
    
    console.log(`Selected ${sources.length} sources and ${detectors.length} detectors interspersed across ${regionNames.length} ROI(s)`);
    
    return { sources, detectors };
}

/**
 * Distribute optodes evenly over the entire head
 * Used when no specific ROI is selected
 */
function distributeOptodesEvenlyOverHead(nSources, nDetectors) {
    const sources = [];
    const detectors = [];
    
    // Use a stratified sampling approach
    const allPositions = [...GridSystem.positions];
    
    // Shuffle for random distribution
    for (let i = allPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
    }
    
    // Select positions with maximum separation
    const selected = [];
    const minSeparation = 25;  // mm
    
    for (const pos of allPositions) {
        if (selected.length >= nSources + nDetectors) break;
        
        // Check if far enough from existing
        let tooClose = false;
        for (const existing of selected) {
            const dx = pos.x - existing.x;
            const dy = pos.y - existing.y;
            const dz = pos.z - existing.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < minSeparation) {
                tooClose = true;
                break;
            }
        }
        
        if (!tooClose) {
            selected.push(pos);
        }
    }
    
    // Split into sources and detectors (2:1 ratio typically)
    let sourceId = 1;
    let detectorId = 1;
    
    for (let i = 0; i < selected.length; i++) {
        const pos = selected[i];
        
        // Allocate more to sources (2:1 ratio)
        const isSource = (i % 3 !== 2) && sources.length < nSources;
        
        if (isSource || detectors.length >= nDetectors) {
            if (sources.length < nSources) {
                sources.push({
                    id: sourceId - 1,
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    label: `S${sourceId}`,
                    gridLabel: pos.label
                });
                sourceId++;
            }
        } else {
            if (detectors.length < nDetectors) {
                detectors.push({
                    id: detectorId - 1,
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    label: `D${detectorId}`,
                    gridLabel: pos.label
                });
                detectorId++;
            }
        }
    }
    
    console.log(`Distributed ${sources.length} sources and ${detectors.length} detectors evenly over head`);
    
    return { sources, detectors };
}

/**
 * Get center (most representative) positions for regions
 */
function getCenterPositionsForRegions(regionNames) {
    const centers = [];
    
    for (const region of regionNames) {
        const positions = GridSystem.byRegion[region];
        if (positions.length === 0) continue;
        
        // Find centroid
        const centroid = {x: 0, y: 0, z: 0};
        for (const pos of positions) {
            centroid.x += pos.x;
            centroid.y += pos.y;
            centroid.z += pos.z;
        }
        centroid.x /= positions.length;
        centroid.y /= positions.length;
        centroid.z /= positions.length;
        
        // Find position closest to centroid
        let nearest = positions[0];
        let nearestDist = distance3D(centroid, nearest);
        
        for (const pos of positions) {
            const dist = distance3D(centroid, pos);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = pos;
            }
        }
        
        centers.push(nearest);
    }
    
    return centers;
}

// ============================================================
// Coregistration Module
// ============================================================

/**
 * Coregistration state and surface data
 */
const CoregistrationState = {
    // Digitized fiducials from measurement (if available)
    measuredFiducials: null,  // {nasion, lpa, rpa, inion}
    
    // Reference fiducials from anatomical model
    referenceFiducials: null,
    
    // Transformation matrix from measured to reference space
    transformMatrix: null,
    
    // Surface mesh vertices for closest-point projection
    surfaceMesh: null,
    
    // Coregistration quality metrics
    metrics: {
        fiducialError: null,    // RMS error after fiducial alignment (mm)
        surfaceError: null,     // RMS error after surface fitting (mm)
        maxError: null,         // Maximum error across all optodes (mm)
        coverage: null          // Percentage of optodes within acceptable error
    }
};

/**
 * Complete coregistration pipeline for optode positions
 * Implements 3-stage process: fiducial alignment -> regression -> surface fitting
 * 
 * @param {Array} optodes - Array of optode positions {x, y, z}
 * @param {Object} measuredFiducials - Digitized fiducials {nasion, lpa, rpa, inion?}
 * @param {Object} options - Coregistration options
 * @returns {Array} Coregistered optode positions
 */
function coregisterOptodes(optodes, measuredFiducials = null, options = {}) {
    const opts = {
        useRigidAlignment: true,
        useRegression: true,
        useSurfaceFitting: true,
        maxSurfaceDistance: 10,  // mm - max distance to search for surface
        smoothingIterations: 2,   // iterations of surface smoothing
        ...options
    };
    
    let positions = optodes.map(o => ({x: o.x, y: o.y, z: o.z}));
    
    // Stage 1: Fiducial-based rigid alignment
    if (opts.useRigidAlignment && measuredFiducials) {
        positions = applyFiducialAlignment(positions, measuredFiducials);
        CoregistrationState.measuredFiducials = measuredFiducials;
        console.log('Stage 1: Fiducial alignment complete');
    }
    
    // Stage 2: Regression-based error correction
    if (opts.useRegression) {
        positions = applyRegressionCorrection(positions, measuredFiducials);
        console.log('Stage 2: Regression correction complete');
    }
    
    // Stage 3: Surface shape fitting
    if (opts.useSurfaceFitting) {
        positions = fitToSurfaceShape(positions, opts);
        console.log('Stage 3: Surface fitting complete');
    }
    
    // Calculate quality metrics
    calculateCoregistrationMetrics(optodes, positions);
    
    return positions;
}

/**
 * Stage 1: Rigid alignment using fiducial markers (nasion, inion, LPA, RPA)
 * Computes optimal rotation and translation to align measured fiducials
 * with reference anatomical fiducials
 */
function applyFiducialAlignment(positions, measuredFiducials) {
    // Get reference fiducials from anatomical model
    const refFiducials = getReferenceFiducials();
    
    // Extract fiducial points
    const measuredPoints = [];
    const referencePoints = [];
    
    if (measuredFiducials.nasion && refFiducials.nasion) {
        measuredPoints.push(measuredFiducials.nasion);
        referencePoints.push(refFiducials.nasion);
    }
    if (measuredFiducials.lpa && refFiducials.lpa) {
        measuredPoints.push(measuredFiducials.lpa);
        referencePoints.push(refFiducials.lpa);
    }
    if (measuredFiducials.rpa && refFiducials.rpa) {
        measuredPoints.push(measuredFiducials.rpa);
        referencePoints.push(refFiducials.rpa);
    }
    if (measuredFiducials.inion && refFiducials.inion) {
        measuredPoints.push(measuredFiducials.inion);
        referencePoints.push(refFiducials.inion);
    }
    
    if (measuredPoints.length < 3) {
        console.warn('Need at least 3 fiducials for rigid alignment. Using simple spherical projection.');
        return positions.map(p => projectToHeadSurface(p));
    }
    
    // Compute rigid transformation using Procrustes analysis
    const transform = computeRigidTransform(measuredPoints, referencePoints);
    CoregistrationState.transformMatrix = transform;
    
    // Calculate fiducial alignment error
    let errorSum = 0;
    for (let i = 0; i < measuredPoints.length; i++) {
        const transformed = applyTransform(measuredPoints[i], transform);
        const error = distance3D(transformed, referencePoints[i]);
        errorSum += error * error;
    }
    CoregistrationState.metrics.fiducialError = Math.sqrt(errorSum / measuredPoints.length);
    
    console.log(`Fiducial alignment: RMS error = ${CoregistrationState.metrics.fiducialError.toFixed(2)} mm`);
    
    // Apply transformation to all positions
    return positions.map(pos => applyTransform(pos, transform));
}

/**
 * Compute rigid transformation (rotation + translation) using Procrustes analysis
 * Minimizes sum of squared distances between corresponding points
 */
function computeRigidTransform(sourcePoints, targetPoints) {
    // Compute centroids
    const sourceCentroid = {x: 0, y: 0, z: 0};
    const targetCentroid = {x: 0, y: 0, z: 0};
    
    for (let i = 0; i < sourcePoints.length; i++) {
        sourceCentroid.x += sourcePoints[i].x;
        sourceCentroid.y += sourcePoints[i].y;
        sourceCentroid.z += sourcePoints[i].z;
        targetCentroid.x += targetPoints[i].x;
        targetCentroid.y += targetPoints[i].y;
        targetCentroid.z += targetPoints[i].z;
    }
    
    const n = sourcePoints.length;
    sourceCentroid.x /= n; sourceCentroid.y /= n; sourceCentroid.z /= n;
    targetCentroid.x /= n; targetCentroid.y /= n; targetCentroid.z /= n;
    
    // Center the points
    const sourceCentered = sourcePoints.map(p => ({
        x: p.x - sourceCentroid.x,
        y: p.y - sourceCentroid.y,
        z: p.z - sourceCentroid.z
    }));
    
    const targetCentered = targetPoints.map(p => ({
        x: p.x - targetCentroid.x,
        y: p.y - targetCentroid.y,
        z: p.z - targetCentroid.z
    }));
    
    // Compute covariance matrix H = sum(target * source^T)
    let H = [[0,0,0], [0,0,0], [0,0,0]];
    for (let i = 0; i < n; i++) {
        const s = sourceCentered[i];
        const t = targetCentered[i];
        H[0][0] += t.x * s.x; H[0][1] += t.x * s.y; H[0][2] += t.x * s.z;
        H[1][0] += t.y * s.x; H[1][1] += t.y * s.y; H[1][2] += t.y * s.z;
        H[2][0] += t.z * s.x; H[2][1] += t.z * s.y; H[2][2] += t.z * s.z;
    }
    
    // Use SVD to find optimal rotation (simplified - for production use proper SVD library)
    // For now, compute a good approximation using quaternions
    const R = computeRotationMatrix(H);
    
    return {
        rotation: R,
        translation: {
            x: targetCentroid.x - (R[0][0]*sourceCentroid.x + R[0][1]*sourceCentroid.y + R[0][2]*sourceCentroid.z),
            y: targetCentroid.y - (R[1][0]*sourceCentroid.x + R[1][1]*sourceCentroid.y + R[1][2]*sourceCentroid.z),
            z: targetCentroid.z - (R[2][0]*sourceCentroid.x + R[2][1]*sourceCentroid.y + R[2][2]*sourceCentroid.z)
        },
        scale: 1.0  // Rigid transformation preserves scale
    };
}

/**
 * Compute rotation matrix from covariance matrix (simplified Kabsch algorithm)
 */
function computeRotationMatrix(H) {
    // For simplicity, if points are well-aligned, use identity + small corrections
    // In production, this should use proper SVD
    
    // Compute trace and determinant
    const trace = H[0][0] + H[1][1] + H[2][2];
    
    // If trace is large enough, points are already well-aligned
    if (trace > 2.9) {
        return [[1,0,0], [0,1,0], [0,0,1]];  // Identity matrix
    }
    
    // Otherwise, compute approximate rotation using cross-covariance
    // This is a simplified approach - full implementation would use SVD
    const scale = Math.sqrt(trace + 1) / 2;
    
    return [
        [H[0][0]/scale, H[0][1]/scale, H[0][2]/scale],
        [H[1][0]/scale, H[1][1]/scale, H[1][2]/scale],
        [H[2][0]/scale, H[2][1]/scale, H[2][2]/scale]
    ];
}

/**
 * Apply rigid transformation to a point
 */
function applyTransform(point, transform) {
    const R = transform.rotation;
    const t = transform.translation;
    
    return {
        x: R[0][0]*point.x + R[0][1]*point.y + R[0][2]*point.z + t.x,
        y: R[1][0]*point.x + R[1][1]*point.y + R[1][2]*point.z + t.y,
        z: R[2][0]*point.x + R[2][1]*point.y + R[2][2]*point.z + t.z
    };
}

/**
 * Stage 2: Regression-based error correction
 * Corrects systematic measurement errors using statistical regression
 */
function applyRegressionCorrection(positions, measuredFiducials) {
    // Implement locally weighted regression (LOWESS) to smooth out measurement noise
    // For each position, compute weighted average based on nearby points
    
    const corrected = [];
    const bandwidth = 20; // mm - size of local neighborhood
    
    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        let weightedSum = {x: 0, y: 0, z: 0};
        let totalWeight = 0;
        
        // Find nearby points and apply Gaussian weighting
        for (let j = 0; j < positions.length; j++) {
            const other = positions[j];
            const dist = distance3D(pos, other);
            
            // Gaussian kernel weight
            const weight = Math.exp(-(dist * dist) / (2 * bandwidth * bandwidth));
            
            weightedSum.x += other.x * weight;
            weightedSum.y += other.y * weight;
            weightedSum.z += other.z * weight;
            totalWeight += weight;
        }
        
        // Apply light correction (70% original, 30% smoothed)
        corrected.push({
            x: 0.7 * pos.x + 0.3 * (weightedSum.x / totalWeight),
            y: 0.7 * pos.y + 0.3 * (weightedSum.y / totalWeight),
            z: 0.7 * pos.z + 0.3 * (weightedSum.z / totalWeight)
        });
    }
    
    return corrected;
}

/**
 * Stage 3: Fit positions to anatomical surface shape
 * Projects each point to nearest point on the actual head surface mesh
 */
function fitToSurfaceShape(positions, options) {
    // If we have a surface mesh loaded, project to closest points
    if (CoregistrationState.surfaceMesh && CoregistrationState.surfaceMesh.vertices) {
        return positions.map(pos => projectToClosestSurfacePoint(pos, options));
    }
    
    // Fallback: use spherical projection with local radius estimation
    return positions.map(pos => {
        // Estimate local head radius based on position
        const localRadius = estimateLocalRadius(pos);
        return projectToHeadSurface(pos, localRadius);
    });
}

/**
 * Project point to closest vertex on surface mesh
 */
function projectToClosestSurfacePoint(point, options) {
    const vertices = CoregistrationState.surfaceMesh.vertices;
    let minDist = Infinity;
    let closest = point;
    
    // Find closest vertex (in production, use spatial indexing for speed)
    for (let i = 0; i < vertices.length; i += 3) {
        const v = {x: vertices[i], y: vertices[i+1], z: vertices[i+2]};
        const dist = distance3D(point, v);
        
        if (dist < minDist) {
            minDist = dist;
            closest = v;
        }
    }
    
    // If point is too far from surface, use interpolation
    if (minDist > options.maxSurfaceDistance) {
        const t = options.maxSurfaceDistance / minDist;
        return {
            x: point.x * (1-t) + closest.x * t,
            y: point.y * (1-t) + closest.y * t,
            z: point.z * (1-t) + closest.z * t
        };
    }
    
    return closest;
}

/**
 * Estimate local head radius based on angular position
 * Head is not perfectly spherical - radius varies by location
 */
function estimateLocalRadius(pos) {
    const len = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
    if (len === 0) return HEAD.radius;
    
    // Normalized direction
    const nx = pos.x / len;
    const ny = pos.y / len;
    const nz = pos.z / len;
    
    // Head is ellipsoidal: wider left-right, shorter front-back, taller top-bottom
    // Approximate with ellipsoid: (x/a)^2 + (y/b)^2 + (z/c)^2 = 1
    const a = HEAD.radius * 1.0;   // Left-right (standard)
    const b = HEAD.radius * 0.95;  // Front-back (slightly shorter)
    const c = HEAD.radius * 1.05;  // Top-bottom (slightly taller)
    
    // Compute radius along this direction
    const denom = Math.sqrt((nx*nx)/(a*a) + (ny*ny)/(b*b) + (nz*nz)/(c*c));
    return 1.0 / denom;
}

/**
 * Get reference fiducials from anatomical model
 */
function getReferenceFiducials() {
    if (FIDUCIALS && Object.keys(FIDUCIALS).length > 0) {
        // Convert MNE format [x,y,z] arrays to objects
        return {
            nasion: FIDUCIALS.nasion ? 
                {x: FIDUCIALS.nasion[0], y: FIDUCIALS.nasion[1], z: FIDUCIALS.nasion[2]} : null,
            lpa: FIDUCIALS.lpa ? 
                {x: FIDUCIALS.lpa[0], y: FIDUCIALS.lpa[1], z: FIDUCIALS.lpa[2]} : null,
            rpa: FIDUCIALS.rpa ? 
                {x: FIDUCIALS.rpa[0], y: FIDUCIALS.rpa[1], z: FIDUCIALS.rpa[2]} : null,
            inion: FIDUCIALS.inion ? 
                {x: FIDUCIALS.inion[0], y: FIDUCIALS.inion[1], z: FIDUCIALS.inion[2]} : null
        };
    }
    
    // Default fiducials based on HEAD model
    return {
        nasion: {x: 0, y: HEAD.nasion, z: -10},
        lpa: {x: -HEAD.earX, y: 0, z: -15},
        rpa: {x: HEAD.earX, y: 0, z: -15},
        inion: {x: 0, y: HEAD.inion, z: 0}
    };
}

/**
 * Calculate quality metrics for coregistration
 */
function calculateCoregistrationMetrics(original, coregistered) {
    let sumSquaredError = 0;
    let maxError = 0;
    let withinThreshold = 0;
    const threshold = 5; // mm - acceptable error threshold
    
    for (let i = 0; i < original.length; i++) {
        const error = distance3D(original[i], coregistered[i]);
        sumSquaredError += error * error;
        maxError = Math.max(maxError, error);
        if (error <= threshold) withinThreshold++;
    }
    
    CoregistrationState.metrics.surfaceError = Math.sqrt(sumSquaredError / original.length);
    CoregistrationState.metrics.maxError = maxError;
    CoregistrationState.metrics.coverage = (withinThreshold / original.length) * 100;
    
    console.log(`Coregistration metrics:
  RMS surface error: ${CoregistrationState.metrics.surfaceError.toFixed(2)} mm
  Max error: ${CoregistrationState.metrics.maxError.toFixed(2)} mm
  Coverage: ${CoregistrationState.metrics.coverage.toFixed(1)}% within ${threshold}mm`);
}

/**
 * Helper: 3D Euclidean distance
 */
function distance3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

// ============================================================
// Navigation
// ============================================================
function setupNavigation() {
    DOM.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = btn.dataset.panel;
            switchPanel(panel);
        });
    });
    
    // Panel navigation buttons
    document.getElementById('btn-proceed')?.addEventListener('click', () => switchPanel('schematic'));
    document.getElementById('btn-to-assign')?.addEventListener('click', () => switchPanel('assign'));
    document.getElementById('btn-to-output')?.addEventListener('click', () => switchPanel('output'));
    document.getElementById('btn-back-settings')?.addEventListener('click', () => switchPanel('settings'));
    document.getElementById('btn-back-schematic')?.addEventListener('click', () => switchPanel('schematic'));
    document.getElementById('btn-back-assign')?.addEventListener('click', () => switchPanel('assign'));
    document.getElementById('btn-new-session')?.addEventListener('click', () => location.reload());
}

function switchPanel(panelName) {
    AppState.currentPanel = panelName;
    
    DOM.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === panelName);
    });
    
    DOM.panels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `${panelName}-panel`);
    });
    
    // Render appropriate view
    if (panelName === 'settings') {
        renderPreview();
    } else if (panelName === 'schematic') {
        renderSchematic();
    } else if (panelName === 'assign') {
        renderAssignCanvas();
        updateTimeslotLegend();
    } else if (panelName === 'output') {
        renderOutputCanvas();
    }
}

// ============================================================
// File Import
// ============================================================
function setupFileImport() {
    DOM.snirfFile?.addEventListener('change', handleSnirfFile);
    DOM.elpFile?.addEventListener('change', handleElpFile);
    DOM.loadExample?.addEventListener('click', loadExampleMontage);
}

async function handleSnirfFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    AppState.loadedFile = file;
    DOM.fileInfo.innerHTML = `<span class="text-success">✓ ${file.name}</span>`;
    
    try {
        const data = await parseSnirfFile(file);
        if (data) {
            AppState.sources = data.sources;
            AppState.detectors = data.detectors;
            buildChannels();
            updateStats();
            renderPreview();
        }
    } catch (err) {
        console.error('Error parsing SNIRF file:', err);
        DOM.fileInfo.innerHTML = `<span class="text-error">Error: ${err.message}</span>`;
    }
}

async function parseSnirfFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (extension === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        return normalizeMontageData(data);
    }
    
    throw new Error('SNIRF (HDF5) requires Python conversion. Use JSON export from MNE-Python.');
}

async function handleElpFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = parseElpFormat(text);
        
        AppState.sources = data.sources;
        AppState.detectors = data.detectors;
        
        DOM.fileInfo.innerHTML = `<span class="text-success">✓ ${file.name}</span>`;
        buildChannels();
        updateStats();
        renderPreview();
    } catch (err) {
        console.error('Error parsing ELP file:', err);
        DOM.fileInfo.innerHTML = `<span class="text-error">Error: ${err.message}</span>`;
    }
}

function parseElpFormat(text) {
    const lines = text.trim().split('\n');
    const sources = [];
    const detectors = [];
    
    let sourceCount = 0;
    let detectorCount = 0;
    
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;
        
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const z = parts.length > 2 ? parseFloat(parts[2]) : 0;
        
        if (isNaN(x) || isNaN(y)) continue;
        
        const label = parts.length > 3 ? parts[3] : null;
        
        // Store raw positions first
        if (label && (label.startsWith('S') || label.toLowerCase().includes('source'))) {
            sources.push({ id: sourceCount++, x, y, z, label: label || `S${sourceCount}` });
        } else if (label && (label.startsWith('D') || label.toLowerCase().includes('detector'))) {
            detectors.push({ id: detectorCount++, x, y, z, label: label || `D${detectorCount}` });
        } else {
            if (sourceCount <= detectorCount) {
                sources.push({ id: sourceCount++, x, y, z, label: `S${sourceCount}` });
            } else {
                detectors.push({ id: detectorCount++, x, y, z, label: `D${detectorCount}` });
            }
        }
    }
    
    // Apply grid snapping if enabled
    const useGrid = GridSystem.config.enabled;
    if (useGrid) {
        // Snap sources to grid
        for (let i = 0; i < sources.length; i++) {
            const gridPos = snapToGrid(sources[i], { excludeOccupied: true });
            if (gridPos) {
                sources[i].x = gridPos.x;
                sources[i].y = gridPos.y;
                sources[i].z = gridPos.z;
                sources[i].gridLabel = gridPos.label;
                occupyGridPosition(gridPos.label);
            } else {
                console.warn(`Source ${sources[i].label} could not snap to grid, using coregistered position`);
            }
        }
        
        // Snap detectors to grid
        for (let i = 0; i < detectors.length; i++) {
            const gridPos = snapToGrid(detectors[i], { excludeOccupied: true });
            if (gridPos) {
                detectors[i].x = gridPos.x;
                detectors[i].y = gridPos.y;
                detectors[i].z = gridPos.z;
                detectors[i].gridLabel = gridPos.label;
                occupyGridPosition(gridPos.label);
            } else {
                console.warn(`Detector ${detectors[i].label} could not snap to grid, using coregistered position`);
            }
        }
    } else {
        // Apply coregistration to all optodes
        const useCoreg = document.getElementById('use-coregistration')?.checked !== false;
        if (useCoreg) {
            const allOptodes = [...sources, ...detectors];
            const coregOptions = {
                useRigidAlignment: document.getElementById('use-fiducial-alignment')?.checked !== false,
                useRegression: document.getElementById('use-regression')?.checked !== false,
                useSurfaceFitting: document.getElementById('use-surface-fitting')?.checked !== false
            };
            
            const coregistered = coregisterOptodes(allOptodes, null, coregOptions);
            
            // Update positions
            for (let i = 0; i < sources.length; i++) {
                sources[i].x = coregistered[i].x;
                sources[i].y = coregistered[i].y;
                sources[i].z = coregistered[i].z;
            }
            for (let i = 0; i < detectors.length; i++) {
                const idx = sources.length + i;
                detectors[i].x = coregistered[idx].x;
                detectors[i].y = coregistered[idx].y;
                detectors[i].z = coregistered[idx].z;
            }
        }
    }
    
    return { sources, detectors };
}

/**
 * Generate example montage with realistic fNIRS positions
 * Covers frontal, parietal, temporal, and occipital regions
 */
function loadExampleMontage() {
    const nSources = parseInt(DOM.nSources.value) || 32;
    const nDetectors = parseInt(DOM.nDetectors.value) || 15;
    
    // Initialize voxel grid if not already done
    if (!VoxelGrid.voxels || VoxelGrid.voxels.length === 0) {
        VoxelGrid.initialize();
    }
    
    // Use grid-based selection for standardized positions
    // Select from all regions for a full-head montage
    const allRegions = Object.keys(BRAIN_REGIONS);
    const result = selectGridPositionsForRegions(allRegions, nSources, nDetectors);
    
    const sources = result.sources;
    const detectors = result.detectors;
    
    AppState.sources = sources;
    AppState.detectors = detectors;
    
    DOM.fileInfo.innerHTML = `<span class="text-success">✓ Example montage loaded (${nSources}S/${nDetectors}D)</span>`;
    
    buildChannels();
    updateStats();
    renderPreview();
}

/**
 * Generate optode positions on head surface
 * Creates realistic fNIRS coverage pattern
 */
function generateOptodeGrid(count, type) {
    const positions = [];
    const r = HEAD.radius;
    
    // Different offset for sources vs detectors to interleave them
    const phaseOffset = type === 'source' ? 0.15 : 0;
    
    // Generate positions in concentric rings from vertex
    let placed = 0;
    let ring = 0;
    
    while (placed < count) {
        ring++;
        const phi = ring * 0.25;  // Polar angle from vertex (radians)
        
        if (phi > Math.PI * 0.6) break;  // Don't go below ears
        
        // Number of optodes in this ring
        const circumference = 2 * Math.PI * Math.sin(phi);
        const nInRing = Math.max(1, Math.floor(circumference * 2 + 0.5));
        
        for (let i = 0; i < nInRing && placed < count; i++) {
            const theta = (i / nInRing) * 2 * Math.PI + phaseOffset + ring * 0.3;
            
            // Add some jitter for realism
            const jitterPhi = phi + (Math.random() - 0.5) * 0.1;
            const jitterTheta = theta + (Math.random() - 0.5) * 0.1;
            
            const pos = sphericalToCartesian(jitterTheta, jitterPhi, r);
            positions.push(pos);
            placed++;
        }
    }
    
    return positions;
}

function normalizeMontageData(data) {
    if (data.sources && data.detectors) {
        return {
            sources: data.sources.map((s, i) => ({
                id: s.id ?? i,
                x: s.x ?? s.pos?.[0] ?? 0,
                y: s.y ?? s.pos?.[1] ?? 0,
                z: s.z ?? s.pos?.[2] ?? 0,
                label: s.label ?? `S${i + 1}`
            })),
            detectors: data.detectors.map((d, i) => ({
                id: d.id ?? i,
                x: d.x ?? d.pos?.[0] ?? 0,
                y: d.y ?? d.pos?.[1] ?? 0,
                z: d.z ?? d.pos?.[2] ?? 0,
                label: d.label ?? `D${i + 1}`
            }))
        };
    }
    
    // Handle MNE-NIRS SNIRF-like format
    if (data.nirs?.probe) {
        const probe = data.nirs.probe;
        const pos3d = probe.sourcePos3D || probe.sourcePos2D;
        const detPos3d = probe.detectorPos3D || probe.detectorPos2D;
        
        return {
            sources: pos3d.map((p, i) => ({
                id: i,
                x: p[0], y: p[1], z: p[2] || 0,
                label: probe.sourceLabels?.[i] || `S${i + 1}`
            })),
            detectors: detPos3d.map((p, i) => ({
                id: i,
                x: p[0], y: p[1], z: p[2] || 0,
                label: probe.detectorLabels?.[i] || `D${i + 1}`
            }))
        };
    }
    
    throw new Error('Invalid data format');
}

// ============================================================
// Channel Building & Conflict Graph
// ============================================================
function buildChannels() {
    const maxDist = parseFloat(DOM.maxDistance?.value) || 60;
    const minDist = parseFloat(DOM.minDistance?.value) || 15;
    
    AppState.channels = [];
    
    for (const source of AppState.sources) {
        for (const detector of AppState.detectors) {
            const dist = distance3D(source, detector);
            
            if (dist >= minDist && dist <= maxDist) {
                AppState.channels.push({
                    sourceId: source.id,
                    detectorId: detector.id,
                    distance: dist
                });
            }
        }
    }
    
    buildConflictGraph();
    updateStats();
    updateConflictStats();
}

function buildConflictGraph() {
    const maxDist = parseFloat(DOM.maxDistance?.value) || 60;
    
    // Map detectors to sources that can reach them
    AppState.detectorSources = {};
    
    for (const detector of AppState.detectors) {
        AppState.detectorSources[detector.id] = [];
        
        for (const source of AppState.sources) {
            const dist = distance3D(source, detector);
            if (dist <= maxDist) {
                AppState.detectorSources[detector.id].push(source.id);
            }
        }
    }
    
    // Build adjacency list
    AppState.conflictGraph = {};
    
    for (const source of AppState.sources) {
        AppState.conflictGraph[source.id] = new Set();
    }
    
    for (const detector of AppState.detectors) {
        const sourcesInRange = AppState.detectorSources[detector.id];
        
        for (let i = 0; i < sourcesInRange.length; i++) {
            for (let j = i + 1; j < sourcesInRange.length; j++) {
                AppState.conflictGraph[sourcesInRange[i]].add(sourcesInRange[j]);
                AppState.conflictGraph[sourcesInRange[j]].add(sourcesInRange[i]);
            }
        }
    }
}

function distance3D(a, b) {
    return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2) +
        Math.pow(a.z - b.z, 2)
    );
}

// ============================================================
// Topographic Head Visualization
// ============================================================

/**
 * Draw the standard topographic head outline
 * Nose at top, ears on sides (MNE/EEGLAB style)
 */
function drawHeadOutline(ctx, cx, cy, radius) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Main head circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Nose (at top)
    const noseSize = radius * 0.12;
    ctx.beginPath();
    ctx.moveTo(cx - noseSize * 0.5, cy - radius);
    ctx.lineTo(cx, cy - radius - noseSize);
    ctx.lineTo(cx + noseSize * 0.5, cy - radius);
    ctx.stroke();
    
    // Left ear
    const earWidth = radius * 0.08;
    const earHeight = radius * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx - radius - earWidth * 0.3, cy, earWidth, earHeight, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Right ear
    ctx.beginPath();
    ctx.ellipse(cx + radius + earWidth * 0.3, cy, earWidth, earHeight, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Reference points text
    ctx.fillStyle = '#666';
    ctx.font = '11px Source Sans 3';
    ctx.textAlign = 'center';
    ctx.fillText('Nasion', cx, cy - radius - noseSize - 8);
    ctx.fillText('Inion', cx, cy + radius + 16);
    ctx.fillText('L', cx - radius - earWidth - 10, cy + 4);
    ctx.fillText('R', cx + radius + earWidth + 10, cy + 4);
}

/**
 * Render the topographic (overhead) view of the montage
 */
function renderTopoView(canvas, showChannels = true, showColors = true) {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = Math.min(canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const headRadius = size * 0.35;
    
    // Dark background (like MNE plots)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw head outline
    drawHeadOutline(ctx, cx, cy, headRadius);
    
    // Draw grid points if enabled
    const showGrid = document.getElementById('show-grid-points')?.checked !== false;
    if (showGrid && GridSystem.positions.length > 0) {
        drawGridPoints(ctx, cx, cy, size);
    }
    
    if (AppState.sources.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '14px Source Sans 3';
        ctx.textAlign = 'center';
        ctx.fillText('Load a montage to visualize', cx, cy);
        return;
    }
    
    // Draw channels (lines connecting sources to detectors)
    if (showChannels) {
        for (const channel of AppState.channels) {
            const source = AppState.sources.find(s => s.id === channel.sourceId);
            const detector = AppState.detectors.find(d => d.id === channel.detectorId);
            
            if (source && detector) {
                const sp = toTopoCoords(source.x, source.y, source.z, size);
                const dp = toTopoCoords(detector.x, detector.y, detector.z, size);
                
                // Color based on source's time slot if assigned
                const slot = AppState.coloring[source.id] || 0;
                if (showColors && slot > 0) {
                    ctx.strokeStyle = getSlotColor(slot);
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.7;
                } else {
                    ctx.strokeStyle = '#4a5568';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.4;
                }
                
                ctx.beginPath();
                ctx.moveTo(sp.x, sp.y);
                ctx.lineTo(dp.x, dp.y);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }
    }
    
    // Draw detectors (red triangles)
    for (const det of AppState.detectors) {
        const p = toTopoCoords(det.x, det.y, det.z, size);
        
        const isSelected = AppState.selectedElement?.type === 'detector' && 
                          AppState.selectedElement?.data.id === det.id;
        
        ctx.fillStyle = isSelected ? '#ff6b6b' : '#e74c3c';
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = isSelected ? 3 : 1.5;
        
        const triSize = isSelected ? 12 : 10;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - triSize);
        ctx.lineTo(p.x - triSize * 0.866, p.y + triSize * 0.5);
        ctx.lineTo(p.x + triSize * 0.866, p.y + triSize * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Label
        ctx.fillStyle = '#aaa';
        ctx.font = '9px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText(det.label, p.x, p.y + triSize + 12);
    }
    
    // Draw sources (circles)
    for (const src of AppState.sources) {
        const p = toTopoCoords(src.x, src.y, src.z, size);
        
        const isSelected = AppState.selectedElement?.type === 'source' && 
                          AppState.selectedElement?.data.id === src.id;
        
        const slot = AppState.coloring[src.id] || 0;
        const color = showColors && slot > 0 ? getSlotColor(slot) : '#3498db';
        
        const radius = isSelected ? 12 : 10;
        
        // Outer ring
        ctx.strokeStyle = isSelected ? '#fff' : '#2980b9';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner fill
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius - 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Time slot number if assigned
        if (showColors && slot > 0) {
            ctx.fillStyle = getContrastTextColor(color);
            ctx.font = 'bold 9px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(slot.toString(), p.x, p.y);
            ctx.textBaseline = 'alphabetic';
        }
        
        // Label (only on hover/select or if no slot)
        if (isSelected || slot === 0) {
            ctx.fillStyle = '#aaa';
            ctx.font = '9px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText(src.label, p.x, p.y + radius + 12);
        }
    }
}

// ============================================================
// Three.js 3D Head Visualization
// ============================================================

// fsaverage model state
const FsAverageModel = {
    headMesh: null,
    brainMesh: null,
    cortexMesh: null,
    loaded: false,
    loading: false
};

/**
 * Load the fsaverage head model (GLB format exported from MNE)
 * Falls back to simple sphere if model not available
 */
async function loadFsAverageModel(scene, sceneData) {
    // Check if GLTFLoader is available
    if (!THREE.GLTFLoader) {
        console.warn('GLTFLoader not available, using sphere fallback');
        return createFallbackHead(scene, sceneData);
    }
    
    const loader = new THREE.GLTFLoader();
    
    // Try to load fsaverage head model
    try {
        // First try the local GLB file
        const headGlb = await new Promise((resolve, reject) => {
            loader.load(
                'fsaverage_head.glb',
                (gltf) => resolve(gltf),
                (progress) => console.log('Loading head:', (progress.loaded / progress.total * 100).toFixed(1) + '%'),
                (error) => reject(error)
            );
        });
        
        console.log('✓ Loaded fsaverage head model');
        
        // Extract and configure the mesh
        headGlb.scene.traverse((child) => {
            if (child.isMesh) {
                // Flip normals by inverting geometry scale (fixes inside-out meshes)
                child.geometry.computeVertexNormals();
                
                // Use MeshBasicMaterial - doesn't require lighting, always visible
                child.material = new THREE.MeshBasicMaterial({
                    color: 0xf5d0b5,  // Warm skin tone
                    transparent: true,
                    opacity: 0.4,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    wireframe: false
                });
                
                // Scale and position to match our coordinate system
                // fsaverage is in mm, centered at origin
                child.scale.set(1, 1, 1);
                
                FsAverageModel.headMesh = child;
            }
        });
        
        scene.add(headGlb.scene);
        sceneData.headMesh = headGlb.scene;
        FsAverageModel.loaded = true;
        
        // Also try to load brain mesh
        try {
            const brainGlb = await new Promise((resolve, reject) => {
                loader.load(
                    'fsaverage_brain.glb',
                    (gltf) => resolve(gltf),
                    undefined,
                    (error) => reject(error)
                );
            });
            
            console.log('✓ Loaded fsaverage brain model');
            
            brainGlb.scene.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.computeVertexNormals();
                    child.material = new THREE.MeshBasicMaterial({
                        color: 0xe8d0c8,  // Pinkish brain color
                        transparent: true,
                        opacity: 0.6,
                        side: THREE.DoubleSide
                    });
                    FsAverageModel.brainMesh = child;
                }
            });
            
            scene.add(brainGlb.scene);
            
        } catch (brainErr) {
            console.log('Brain model not available, using head only');
        }
        
        // Also try to load the detailed cortex
        try {
            const cortexGlb = await new Promise((resolve, reject) => {
                loader.load(
                    'fsaverage_cortex.glb',
                    (gltf) => resolve(gltf),
                    undefined,
                    (error) => reject(error)
                );
            });
            
            console.log('✓ Loaded fsaverage cortex model');
            
            cortexGlb.scene.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.computeVertexNormals();
                    // Use Lambert for cortex - responds to light but simpler
                    child.material = new THREE.MeshLambertMaterial({
                        color: 0xf0e0d8,  // Light pinkish cortex
                        emissive: 0x442222,  // Strong emissive so always visible
                        transparent: true,
                        opacity: 0.85,
                        side: THREE.DoubleSide
                    });
                    FsAverageModel.cortexMesh = child;
                }
            });
            
            scene.add(cortexGlb.scene);
            sceneData.cortexMesh = cortexGlb.scene;
            
        } catch (cortexErr) {
            console.log('Cortex model not available');
        }
        
    } catch (headErr) {
        console.log('fsaverage model not found, using fallback sphere');
        console.log('Run: python export_fsaverage.py to generate the model');
        return createFallbackHead(scene, sceneData);
    }
}

/**
 * Create fallback head model (realistic ellipsoid shape)
 */
function createFallbackHead(scene, sceneData) {
    // Create a more realistic head shape using an ellipsoid
    const headGeometry = createHeadGeometry();
    
    const headMaterial = new THREE.MeshBasicMaterial({
        color: 0xf5d0b5,  // Warm skin tone
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    scene.add(headMesh);
    sceneData.headMesh = headMesh;
    
    // Add nose indicator (points toward +Y in MNE coordinates)
    const noseGeometry = new THREE.ConeGeometry(8, 20, 8);
    const noseMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffdbac, 
        opacity: 0.5, 
        transparent: true 
    });
    const noseMesh = new THREE.Mesh(noseGeometry, noseMaterial);
    noseMesh.position.set(0, HEAD.radius + 5, 0);
    noseMesh.rotation.x = -Math.PI / 2;
    scene.add(noseMesh);
    
    // Add ears
    const earGeometry = new THREE.SphereGeometry(8, 16, 16);
    earGeometry.scale(0.5, 1, 0.8);
    const earMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffdbac, 
        opacity: 0.5, 
        transparent: true 
    });
    
    // Left ear
    const leftEar = new THREE.Mesh(earGeometry, earMaterial);
    leftEar.position.set(-HEAD.radius - 2, 0, 0);
    scene.add(leftEar);
    
    // Right ear
    const rightEar = new THREE.Mesh(earGeometry, earMaterial);
    rightEar.position.set(HEAD.radius + 2, 0, 0);
    scene.add(rightEar);
}

/**
 * Create realistic head geometry (ellipsoid)
 */
function createHeadGeometry() {
    const segments = 64;
    const geometry = new THREE.SphereGeometry(1, segments, segments);
    
    // Scale to head proportions (slightly taller than wide, with forehead)
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        let x = positions.getX(i);
        let y = positions.getY(i);
        let z = positions.getZ(i);
        
        // Head dimensions: 
        // X (left-right): ~85mm
        // Y (front-back): ~95mm (slightly elongated front-back)
        // Z (bottom-top): ~90mm
        x *= 85;
        y *= 95;
        z *= 90;
        
        // Add slight flattening at back
        if (y < 0) {
            y *= 0.95;
        }
        
        // Slightly wider at ears level
        if (z < 10 && z > -40) {
            x *= 1.02;
        }
        
        positions.setXYZ(i, x, y, z);
    }
    
    geometry.computeVertexNormals();
    return geometry;
}

function init3DScene(container, sceneKey) {
    if (!container || !window.THREE) return null;
    
    // Clean up existing
    if (AppState.three[sceneKey]) {
        container.innerHTML = '';
    }
    
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);  // Dark blue (MNE-style)
    
    // Camera - positioned for overhead view (looking down on head)
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(0, 0, 280);  // Looking from above
    camera.up.set(0, 1, 0);  // Y is "up" in view (nose direction)
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x1a1a2e, 1);
    container.appendChild(renderer.domElement);
    
    // Controls - orbit around head
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 150;
    controls.maxDistance = 500;
    controls.target.set(0, 0, 0);  // Orbit around head center
    
    // Click handler for brain region selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    renderer.domElement.addEventListener('click', (event) => {
        // Only handle clicks when in ROI mode or when brain parcellation is enabled
        const isROIMode = sceneKey === 'roi';
        const showParcellation = document.getElementById('show-brain-parcellation')?.checked || isROIMode;
        if (!showParcellation) return;
        if (!BRAIN_SURFACE.mesh) return;
        
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster
        raycaster.setFromCamera(mouse, camera);
        
        // Check intersection with brain surface
        const intersects = raycaster.intersectObject(BRAIN_SURFACE.mesh, false);
        
        if (intersects.length > 0) {
            // Get the clicked face
            const faceIndex = intersects[0].faceIndex;
            if (faceIndex !== undefined) {
                // Get vertices of the face
                const face = BRAIN_SURFACE.faces[faceIndex];
                if (face) {
                    // Get region from first vertex of face
                    const vertexIndex = face[0];
                    const vertex = BRAIN_SURFACE.vertices[vertexIndex];
                    const regionName = vertex.region;
                    
                    // Toggle region selection
                    if (BRAIN_SURFACE.selectedRegions.has(regionName)) {
                        BRAIN_SURFACE.selectedRegions.delete(regionName);
                        console.log(`Deselected region: ${regionName}`);
                    } else {
                        BRAIN_SURFACE.selectedRegions.add(regionName);
                        console.log(`Selected region: ${regionName}`);
                    }
                    
                    // Update ROI state to sync with brain surface selection
                    ROIState.selectedRegions = new Set(BRAIN_SURFACE.selectedRegions);
                    
                    // Update visualization
                    colorBrainByParcellation();
                    update3DOptodes(sceneKey, true);
                    
                    // Update UI display
                    updateSelectedROIsDisplay();
                }
            }
        }
    });
    
    // Lighting - bright ambient + multiple directional for good visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Key light (from top-front) - brighter
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(50, 100, 150);
    scene.add(keyLight);
    
    // Fill light (from side) - brighter
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-100, 50, 100);
    scene.add(fillLight);
    
    // Back light - to illuminate rear of head
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(0, -50, -150);
    scene.add(backLight);
    
    // Top light - illuminate top of head
    const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
    topLight.position.set(0, 50, 200);
    scene.add(topLight);
    
    // Store reference
    const sceneData = {
        scene, camera, renderer, controls,
        headMesh: null,
        labelsGroup: new THREE.Group(),
        optodeObjects: [],
        fiducials: null
    };
    
    scene.add(sceneData.labelsGroup);
    
    // Add coordinate system reference (MNE standard)
    addCoordinateAxes(scene);
    
    // Add fiducial markers (nasion, LPA, RPA)
    addFiducialMarkers(scene, sceneData);
    
    // Load fsaverage model or create fallback
    loadFsAverageModel(scene, sceneData);
    
    AppState.three[sceneKey] = sceneData;
    
    // Animation loop
    function animate() {
        if (!AppState.three[sceneKey]) return;
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    
    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w > 0 && h > 0) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    });
    resizeObserver.observe(container);
    
    return sceneData;
}

/**
 * Add MNE-style coordinate axes indicator
 */
function addCoordinateAxes(scene) {
    const axesGroup = new THREE.Group();
    
    // Position in corner
    axesGroup.position.set(-100, -100, -60);
    
    // Create colored axes
    const axisLength = 25;
    const arrowSize = 5;
    
    // X axis (red) - points right
    const xGeom = new THREE.CylinderGeometry(1, 1, axisLength, 8);
    const xMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const xAxis = new THREE.Mesh(xGeom, xMat);
    xAxis.rotation.z = -Math.PI / 2;
    xAxis.position.x = axisLength / 2;
    axesGroup.add(xAxis);
    
    // Y axis (green) - points front (nose)
    const yGeom = new THREE.CylinderGeometry(1, 1, axisLength, 8);
    const yMat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
    const yAxis = new THREE.Mesh(yGeom, yMat);
    yAxis.rotation.x = -Math.PI / 2;
    yAxis.position.y = axisLength / 2;
    axesGroup.add(yAxis);
    
    // Z axis (blue) - points up
    const zGeom = new THREE.CylinderGeometry(1, 1, axisLength, 8);
    const zMat = new THREE.MeshBasicMaterial({ color: 0x4444ff });
    const zAxis = new THREE.Mesh(zGeom, zMat);
    zAxis.position.z = axisLength / 2;
    axesGroup.add(zAxis);
    
    scene.add(axesGroup);
}

/**
 * Add fiducial markers (nasion, LPA, RPA) as in MNE
 */
function addFiducialMarkers(scene, sceneData) {
    const fiducials = new THREE.Group();
    
    // Nasion (green) - front of head
    const nasionGeom = new THREE.SphereGeometry(4, 16, 16);
    const nasionMat = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const nasion = new THREE.Mesh(nasionGeom, nasionMat);
    nasion.position.set(0, HEAD.nasion, 0);
    nasion.userData = { name: 'Nasion', fiducial: true };
    fiducials.add(nasion);
    
    // LPA (blue) - left preauricular point
    const lpaGeom = new THREE.SphereGeometry(4, 16, 16);
    const lpaMat = new THREE.MeshPhongMaterial({ color: 0x0066ff });
    const lpa = new THREE.Mesh(lpaGeom, lpaMat);
    lpa.position.set(-HEAD.earX, 0, -10);
    lpa.userData = { name: 'LPA', fiducial: true };
    fiducials.add(lpa);
    
    // RPA (red) - right preauricular point
    const rpaGeom = new THREE.SphereGeometry(4, 16, 16);
    const rpaMat = new THREE.MeshPhongMaterial({ color: 0xff0066 });
    const rpa = new THREE.Mesh(rpaGeom, rpaMat);
    rpa.position.set(HEAD.earX, 0, -10);
    rpa.userData = { name: 'RPA', fiducial: true };
    fiducials.add(rpa);
    
    scene.add(fiducials);
    sceneData.fiducials = fiducials;
}

/**
 * Update 3D optode visualization
 * 
 * Follows MNE-NIRS visualization conventions:
 * - Sources: Red spheres (or colored by time slot when assigned)
 * - Detectors: Black dots/cubes
 * - Pairs: White lines connecting source-detector
 * - Channels: Orange dots at midpoint of each pair
 * 
 * Reference: https://mne.tools/mne-nirs/stable/auto_examples/general/plot_70_visualise_brain.html
 * "The sources are represented as red dots, the detectors are represented as black dots,
 *  the white lines represent source-detector pairs, and the orange dots represent channel locations."
 */
function update3DOptodes(sceneKey, showColors = true) {
    const sceneData = AppState.three[sceneKey];
    if (!sceneData) return;
    
    const { scene, optodeObjects } = sceneData;
    
    // Remove existing optodes
    optodeObjects.forEach(obj => scene.remove(obj));
    optodeObjects.length = 0;
    
    // MNE-NIRS visualization style:
    // fnirs=["channels", "pairs", "sources", "detectors"]
    
    // 1. Add PHOTON MIGRATION PATHS (banana-shaped light trajectories through tissue)
    const showPhotonPaths = document.getElementById('show-photon-paths')?.checked !== false;
    const pathOpacityScale = parseFloat(document.getElementById('path-opacity')?.value || 60) / 100;
    
    if (showPhotonPaths) {
        for (const channel of AppState.channels) {
            const source = AppState.sources.find(s => s.id === channel.sourceId);
            const detector = AppState.detectors.find(d => d.id === channel.detectorId);
            
            if (source && detector) {
            const slot = AppState.coloring[source.id] || 0;
            
            // Calculate photon migration path (banana shape)
            const wavelength = 850; // nm (could be channel-specific)
            const pathData = calculatePhotonMigrationPath(source, detector, {
                wavelength: wavelength,
                nPoints: 30
            });
            
            // Store sensitivity profile for source reconstruction
            channel.photonPath = pathData;
            
            // Calculate voxel-wise sensitivity for this channel
            if (VoxelGrid.voxels && VoxelGrid.voxels.length > 0) {
                channel.voxelSensitivity = calculateVoxelSensitivity(pathData, channel.id);
            }
            
            // Color based on slot assignment or default
            let pathColor;
            if (showColors && slot > 0) {
                pathColor = new THREE.Color(getSlotColor(slot));
            } else {
                pathColor = new THREE.Color(0xff6b35);  // Orange-red for light path
            }
            
            // Create smooth curve from path points
            const curve = new THREE.CatmullRomCurve3(pathData.pathPoints);
            
            // Banana-shaped photon density: Variable radius along path
            // Narrow at source (3mm fiber) → Wide in middle (diffuse cloud) → Narrow at detector (1mm fiber)
            const radialSegments = 16;
            const tubularSegments = 30;
            
            // Create custom tube geometry with variable radius
            const path = curve;
            const frames = path.computeFrenetFrames(tubularSegments, false);
            
            const vertices = [];
            const normals = [];
            const uvs = [];
            
            for (let i = 0; i <= tubularSegments; i++) {
                const u = i / tubularSegments;
                const point = path.getPointAt(u);
                const normal = frames.normals[i];
                const binormal = frames.binormals[i];
                
                // Variable radius: banana profile
                // Narrow at ends (fiber tips), wide in middle (photon spread)
                const distFromMid = Math.abs(u - 0.5) * 2;  // 0 at middle, 1 at ends
                
                // Radius profile: starts at 1.5mm (source fiber)
                //                 expands to 8mm at middle
                //                 tapers to 0.5mm (detector fiber)
                let radius;
                if (u < 0.5) {
                    // Source to middle: 1.5mm → 8mm
                    const t = u / 0.5;  // 0 to 1
                    // Smooth expansion: quadratic easing
                    const expansion = Math.sin(t * Math.PI / 2);  // 0 to 1, smooth
                    radius = 1.5 + (8.0 - 1.5) * expansion;
                } else {
                    // Middle to detector: 8mm → 0.5mm
                    const t = (u - 0.5) / 0.5;  // 0 to 1
                    // Smooth contraction: quadratic easing
                    const contraction = Math.cos(t * Math.PI / 2);  // 1 to 0, smooth
                    radius = 0.5 + (8.0 - 0.5) * contraction;
                }
                
                // Create ring of vertices at this point
                for (let j = 0; j <= radialSegments; j++) {
                    const v = j / radialSegments * Math.PI * 2;
                    
                    const cx = -radius * Math.cos(v);
                    const cy = radius * Math.sin(v);
                    
                    const pos = point.clone();
                    pos.add(normal.clone().multiplyScalar(cx));
                    pos.add(binormal.clone().multiplyScalar(cy));
                    
                    vertices.push(pos.x, pos.y, pos.z);
                    
                    const norm = normal.clone().multiplyScalar(Math.cos(v))
                        .add(binormal.clone().multiplyScalar(Math.sin(v)));
                    normals.push(norm.x, norm.y, norm.z);
                    
                    uvs.push(u, v / (Math.PI * 2));
                }
            }
            
            // Create faces
            const indices = [];
            for (let i = 0; i < tubularSegments; i++) {
                for (let j = 0; j < radialSegments; j++) {
                    const a = i * (radialSegments + 1) + j;
                    const b = a + radialSegments + 1;
                    const c = a + radialSegments + 2;
                    const d = a + 1;
                    
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                }
            }
            
            const tubeGeometry = new THREE.BufferGeometry();
            tubeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            tubeGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            tubeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            tubeGeometry.setIndex(indices);
            
            // Custom shader material for radial transparency gradient
            // Shows photon density: highest in center, lowest at edges
            const baseOpacity = showColors && slot > 0 ? 0.8 : 0.6;
            const tubeMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    color: { value: pathColor },
                    maxOpacity: { value: baseOpacity * pathOpacityScale },
                    minOpacity: { value: 0.0 }  // Fully transparent at edges
                },
                vertexShader: `
                    varying vec2 vUv;
                    varying vec3 vNormal;
                    varying vec3 vViewPosition;
                    
                    void main() {
                        vUv = uv;
                        vNormal = normalize(normalMatrix * normal);
                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                        vViewPosition = -mvPosition.xyz;
                        gl_Position = projectionMatrix * mvPosition;
                    }
                `,
                fragmentShader: `
                    uniform vec3 color;
                    uniform float maxOpacity;
                    uniform float minOpacity;
                    
                    varying vec2 vUv;
                    varying vec3 vNormal;
                    varying vec3 vViewPosition;
                    
                    void main() {
                        // vUv.x goes along tube (0 to 1)
                        // vUv.y goes around tube (0 to 1)
                        
                        // Calculate radial distance from center of tube
                        // vUv.y = 0.5 is center, 0.0 and 1.0 are edges
                        float radialDist = abs(vUv.y - 0.5) * 2.0;  // 0 at center, 1 at edge
                        
                        // Gaussian-like falloff for photon density
                        // Dense in center, diffuse at edges
                        float densityFalloff = exp(-3.0 * radialDist * radialDist);
                        float alpha = mix(minOpacity, maxOpacity, densityFalloff);
                        
                        // Lighting (simple Lambert)
                        vec3 viewDir = normalize(vViewPosition);
                        float lightIntensity = abs(dot(vNormal, viewDir));
                        lightIntensity = 0.4 + 0.6 * lightIntensity;  // Ambient + diffuse
                        
                        vec3 finalColor = color * lightIntensity;
                        
                        // Add slight emissive glow in center
                        float centerGlow = 1.0 - radialDist;
                        finalColor += color * 0.2 * centerGlow;
                        
                        gl_FragColor = vec4(finalColor, alpha);
                    }
                `,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false  // Important for transparency sorting
            });
            
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            tube.userData = {
                type: 'photon_path',
                sourceId: source.id, 
                detectorId: detector.id,
                distance: channel.distance,
                penetrationDepth: pathData.penetrationDepth,
                wavelength: wavelength
            };
            scene.add(tube);
            optodeObjects.push(tube);
            
            // Optional: Add surface connection line (thin, subtle)
            const surfaceLineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(source.x, source.y, source.z),
                new THREE.Vector3(detector.x, detector.y, detector.z)
            ]);
            const surfaceLineMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.15 * pathOpacityScale
            });
            const surfaceLine = new THREE.Line(surfaceLineGeometry, surfaceLineMaterial);
            scene.add(surfaceLine);
            optodeObjects.push(surfaceLine);
            }
        }
    }
    
    // 3. Add DETECTORS (fiber optic tips - 1mm diameter)
    for (const det of AppState.detectors) {
        // Fiber optic detector tip: Small cylinder (1mm diameter)
        const fiberRadius = 0.5;  // 0.5mm radius = 1mm diameter
        const fiberLength = 2;    // 2mm length visible
        
        const geometry = new THREE.CylinderGeometry(fiberRadius, fiberRadius, fiberLength, 8);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x111111,  // Black fiber
            emissive: 0x222222,
            shininess: 30
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(det.x, det.y, det.z);
        
        // Orient fiber perpendicular to head surface (pointing inward slightly)
        const orientation = getPuckOrientation(det);
        mesh.quaternion.copy(orientation);
        
        mesh.userData = { type: 'detector', id: det.id, label: det.label };
        
        scene.add(mesh);
        optodeObjects.push(mesh);
    }
    
    // 4. Add SOURCES (fiber optic tips - 3mm diameter, with glow)
    for (const src of AppState.sources) {
        const slot = AppState.coloring[src.id] || 0;
        
        let sourceColor;
        if (showColors && slot > 0) {
            sourceColor = new THREE.Color(getSlotColor(slot));
        } else {
            sourceColor = new THREE.Color(0xff0000);  // Red default for LED
        }
        
        // Fiber optic source tip: Larger cylinder (3mm diameter)
        const fiberRadius = 1.5;  // 1.5mm radius = 3mm diameter
        const fiberLength = 2;    // 2mm length visible
        
        const geometry = new THREE.CylinderGeometry(fiberRadius, fiberRadius, fiberLength, 12);
        const material = new THREE.MeshPhongMaterial({ 
            color: sourceColor,
            emissive: sourceColor.clone().multiplyScalar(0.4),  // Glowing LED
            shininess: 60
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(src.x, src.y, src.z);
        
        // Orient fiber perpendicular to head surface
        const orientation = getPuckOrientation(src);
        mesh.quaternion.copy(orientation);
        
        mesh.userData = { type: 'source', id: src.id, label: src.label, slot };
        
        scene.add(mesh);
        optodeObjects.push(mesh);
        
        // Add slot number as text sprite for assigned sources
        if (showColors && slot > 0) {
            const sprite = createTextSprite(slot.toString(), {
                fontSize: 48,
                textColor: getContrastTextColor(getSlotColor(slot)),
                backgroundColor: 'transparent'
            });
            sprite.position.set(src.x, src.y, src.z);
            sprite.scale.set(12, 12, 1);
            scene.add(sprite);
            optodeObjects.push(sprite);
        }
    }
    
    // 5. Add GEODESIC GRID (complete latitude/longitude mesh)
    const showGeodesicIn3D = document.getElementById('show-geodesic-grid')?.checked !== false;
    
    if (showGeodesicIn3D && GridSystem.geodesicGrid && GridSystem.geodesicGrid.length > 0) {
        // Draw tiny markers at each grid point
        for (const gridPoint of GridSystem.geodesicGrid) {
            const geometry = createPuckGeometry(0.8, 0.3);  // Tiny markers
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x4a5568,
                transparent: true,
                opacity: 0.15
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(gridPoint.x, gridPoint.y, gridPoint.z);
            
            const orientation = getPuckOrientation(gridPoint);
            mesh.quaternion.copy(orientation);
            
            mesh.userData = { type: 'geodesic-grid' };
            
            scene.add(mesh);
            optodeObjects.push(mesh);
        }
        
        // Draw latitude lines (constant phi)
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x4a5568,
            transparent: true,
            opacity: 0.15
        });
        
        const phiValues = [...new Set(GridSystem.geodesicGrid.map(p => Math.round(p.phi * 1000) / 1000))];
        for (const phi of phiValues) {
            const pointsAtPhi = GridSystem.geodesicGrid
                .filter(p => Math.abs(p.phi - phi) < 0.001)
                .sort((a, b) => a.theta - b.theta);
            
            if (pointsAtPhi.length > 2) {
                const points = pointsAtPhi.map(p => new THREE.Vector3(p.x, p.y, p.z));
                points.push(points[0].clone()); // Close the loop
                
                const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(lineGeometry, lineMaterial);
                scene.add(line);
                optodeObjects.push(line);
            }
        }
    }
    
    // 6. Add STANDARD GRID POSITIONS (10-20/10-10/10-5 highlighted positions)
    const showStandardGrid = document.getElementById('show-grid-points')?.checked !== false;
    const gridDensity = document.getElementById('grid-density')?.value || 'all';
    
    if (showStandardGrid && GridSystem.positions && GridSystem.positions.length > 0) {
        for (const gridPoint of GridSystem.positions) {
            // Skip occupied positions
            if (GridSystem.occupied.has(gridPoint.label)) continue;
            
            // Get density classification
            const density = classifyElectrodeDensity(gridPoint.label);
            
            // Filter by density setting
            if (gridDensity === '10-20' && density !== '10-20') continue;
            if (gridDensity === '10-10' && density === '10-5') continue;
            if (gridDensity === 'none') continue;
            
            // Hierarchical sizing
            let radius, height, alpha;
            if (density === '10-20') {
                radius = 4;
                height = 1.5;
                alpha = 0.6;
            } else if (density === '10-10') {
                radius = 3;
                height = 1;
                alpha = 0.4;
            } else { // 10-5
                radius = 2;
                height = 0.8;
                alpha = 0.25;
            }
            
            // Create grid marker puck (highlighted in blue)
            const geometry = createPuckGeometry(radius, height);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x2e7bc4,  // Brighter blue for standard positions
                transparent: true,
                opacity: alpha,
                shininess: 20,
                flatShading: false
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(gridPoint.x, gridPoint.y, gridPoint.z);
            
            // Orient puck to be tangent to head surface
            const orientation = getPuckOrientation(gridPoint);
            mesh.quaternion.copy(orientation);
            
            mesh.userData = { 
                type: 'grid',
                label: gridPoint.label,
                density: density
            };
            
            scene.add(mesh);
            optodeObjects.push(mesh);
        }
    }
    
    // 7. Add brain surface visualization
    const showBrainSurface = document.getElementById('show-voxels')?.checked === true;
    // Always show brain parcellation in ROI mode, otherwise check the checkbox
    const isROIMode = sceneKey === 'roi';
    const showBrainParcellation = isROIMode || (document.getElementById('show-brain-parcellation')?.checked === true);
    const voxelThreshold = parseFloat(document.getElementById('voxel-threshold')?.value || 20) / 100;
    const voxelBrightness = parseFloat(document.getElementById('voxel-brightness')?.value || 100) / 100;
    
    // Show parcellation for ROI selection
    if (showBrainParcellation) {
        if (!BRAIN_SURFACE.mesh) {
            if (!BRAIN_SURFACE.vertices || BRAIN_SURFACE.vertices.length === 0) {
                generateBrainSurface();
            }
            colorBrainByParcellation();
        }
        
        if (BRAIN_SURFACE.mesh && !scene.children.includes(BRAIN_SURFACE.mesh)) {
            scene.add(BRAIN_SURFACE.mesh);
            optodeObjects.push(BRAIN_SURFACE.mesh);
        }
        
        // Update colors if selection changed
        colorBrainByParcellation();
    }
    
    // Show sensitivity overlay (if montage exists)
    if (showBrainSurface && FsAverageModel.brainMesh && AppState.channels.length > 0) {
        // Auto-build sensitivity matrix if not yet built
        if (!VoxelGrid.sensitivityMatrix) {
            console.log('Auto-building sensitivity matrix...');
            buildSensitivityMatrix();
        }
        
        if (VoxelGrid.sensitivityMatrix) {
            // Color the existing brain mesh vertices
            colorExistingBrainMesh(FsAverageModel.brainMesh, voxelThreshold, voxelBrightness);
        }
    }
}

/**
 * Color brain surface by parcellation regions
 * Shows anatomical regions in different colors for ROI selection
 */
function colorBrainByParcellation() {
    if (!BRAIN_SURFACE.vertices || BRAIN_SURFACE.vertices.length === 0) {
        generateBrainSurface();
    }
    
    // Region colors (matching BRAIN_REGIONS)
    const regionColors = {
        'Left Frontal': { r: 0.91, g: 0.30, b: 0.24 },    // Red
        'Right Frontal': { r: 0.91, g: 0.30, b: 0.24 },
        'Left Parietal': { r: 0.20, g: 0.60, b: 0.86 },   // Blue
        'Right Parietal': { r: 0.20, g: 0.60, b: 0.86 },
        'Left Temporal': { r: 0.95, g: 0.61, b: 0.07 },   // Orange
        'Right Temporal': { r: 0.95, g: 0.61, b: 0.07 },
        'Left Occipital': { r: 0.61, g: 0.35, b: 0.71 },  // Purple
        'Right Occipital': { r: 0.61, g: 0.35, b: 0.71 }
    };
    
    // Create geometry
    const positions = [];
    const colors = [];
    const indices = [];
    
    for (const vertex of BRAIN_SURFACE.vertices) {
        positions.push(vertex.x, vertex.y, vertex.z);
        
        const regionColor = regionColors[vertex.region] || { r: 0.8, g: 0.8, b: 0.8 };
        
        // If region is selected, make it brighter
        if (BRAIN_SURFACE.selectedRegions.has(vertex.region)) {
            colors.push(
                Math.min(1.0, regionColor.r * 1.3),
                Math.min(1.0, regionColor.g * 1.3),
                Math.min(1.0, regionColor.b * 1.3)
            );
        } else {
            // Slightly desaturated when not selected
            colors.push(
                regionColor.r * 0.7 + 0.2,
                regionColor.g * 0.7 + 0.2,
                regionColor.b * 0.7 + 0.2
            );
        }
    }
    
    for (const face of BRAIN_SURFACE.faces) {
        indices.push(face[0], face[1], face[2]);
    }
    
    // Create or update mesh
    if (BRAIN_SURFACE.mesh) {
        // Update existing mesh
        const geometry = BRAIN_SURFACE.mesh.geometry;
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
    } else {
        // Create new mesh
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            shininess: 30,
            flatShading: false
        });
        
        BRAIN_SURFACE.mesh = new THREE.Mesh(geometry, material);
        BRAIN_SURFACE.mesh.userData = { type: 'brain_surface_parcellation' };
    }
    
    console.log('Brain colored by parcellation');
}

/**
 * Color the existing brain mesh based on sensitivity
 * Modifies vertex colors of the loaded brain surface in place
 */
function colorExistingBrainMesh(brainMesh, threshold, brightness) {
    if (!brainMesh || !brainMesh.geometry) {
        console.warn('Brain mesh not available for coloring');
        return;
    }
    
    const geometry = brainMesh.geometry;
    const positionAttr = geometry.attributes.position;
    
    if (!positionAttr) {
        console.warn('Brain mesh has no position attribute');
        return;
    }
    
    const vertexCount = positionAttr.count;
    
    // Get voxel selection parameters
    const selectionMode = document.getElementById('voxel-selection-mode')?.value || 'moderate';
    const minChannels = parseInt(document.getElementById('voxel-min-channels')?.value || 2);
    const minWeightPct = parseFloat(document.getElementById('voxel-min-weight')?.value || 5);
    
    // Find maximum sensitivity for normalization
    let maxVoxelSensitivity = 0;
    for (const voxel of VoxelGrid.voxels) {
        if (voxel.isInsideHead && voxel.totalSensitivity > maxVoxelSensitivity) {
            maxVoxelSensitivity = voxel.totalSensitivity;
        }
    }
    
    // Prepare filter parameters
    const filterParams = {
        mode: selectionMode,
        minChannels: minChannels,
        minWeightPct: minWeightPct,
        maxSensitivity: maxVoxelSensitivity
    };
    
    // Project sensitivity onto each vertex
    const vertexSensitivities = new Float32Array(vertexCount);
    let maxSensitivity = 0;
    
    for (let i = 0; i < vertexCount; i++) {
        const x = positionAttr.getX(i);
        const y = positionAttr.getY(i);
        const z = positionAttr.getZ(i);
        
        // Find nearby voxels and interpolate sensitivity
        let totalSensitivity = 0;
        let totalWeight = 0;
        const searchRadius = 10;  // mm
        
        for (const voxel of VoxelGrid.voxels) {
            // Apply new filtering criteria
            if (!shouldShowVoxel(voxel, filterParams)) continue;
            if (voxel.totalSensitivity === 0) continue;
            
            const dx = voxel.x - x;
            const dy = voxel.y - y;
            const dz = voxel.z - z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < searchRadius) {
                const weight = 1.0 / (dist + 1.0);
                totalSensitivity += voxel.totalSensitivity * weight;
                totalWeight += weight;
            }
        }
        
        if (totalWeight > 0) {
            vertexSensitivities[i] = totalSensitivity / totalWeight;
            maxSensitivity = Math.max(maxSensitivity, vertexSensitivities[i]);
        } else {
            vertexSensitivities[i] = 0;
        }
    }
    
    if (maxSensitivity === 0) {
        console.warn('No sensitivity projected onto brain surface');
        return;
    }
    
    const thresholdValue = maxSensitivity * threshold;
    
    // Create color attribute
    const colors = new Float32Array(vertexCount * 3);
    
    for (let i = 0; i < vertexCount; i++) {
        const sensitivity = vertexSensitivities[i];
        const normSens = sensitivity / maxSensitivity;
        
        if (sensitivity < thresholdValue || sensitivity === 0) {
            // Below threshold or no data: keep original brain color (pinkish-gray)
            colors[i * 3 + 0] = 0.91;  // R
            colors[i * 3 + 1] = 0.82;  // G
            colors[i * 3 + 2] = 0.78;  // B
        } else {
            // Above threshold: heat map (blue -> cyan -> yellow -> red)
            const gamma = 1.5;
            const scaledSens = Math.pow(normSens, 1 / gamma) * brightness;
            const displaySens = Math.min(1.0, scaledSens);
            
            let r, g, b;
            if (displaySens < 0.33) {
                // Blue to cyan
                const t = displaySens / 0.33;
                r = 0;
                g = t;
                b = 1;
            } else if (displaySens < 0.67) {
                // Cyan to yellow
                const t = (displaySens - 0.33) / 0.34;
                r = t;
                g = 1;
                b = 1 - t;
            } else {
                // Yellow to red
                const t = (displaySens - 0.67) / 0.33;
                r = 1;
                g = 1 - t;
                b = 0;
            }
            
            colors[i * 3 + 0] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }
    }
    
    // Update or create color attribute
    if (geometry.attributes.color) {
        geometry.attributes.color.array = colors;
        geometry.attributes.color.needsUpdate = true;
    } else {
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    // Update material to use vertex colors
    if (!brainMesh.material.vertexColors) {
        brainMesh.material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            shininess: 30,
            flatShading: false
        });
    }
    
    brainMesh.material.needsUpdate = true;
    geometry.computeVertexNormals();
    
    console.log(`Colored ${vertexCount} vertices on brain surface`);
}

// Keep old voxel visualization as fallback (not used by default)
/**
 * Determine if a voxel should be displayed based on selection criteria
 * @param {Object} voxel - Voxel object with sensitivity data
 * @param {Object} params - Filter parameters
 * @returns {boolean} True if voxel should be shown
 */
function shouldShowVoxel(voxel, params) {
    const { mode, minChannels, minWeightPct, maxSensitivity } = params;
    
    if (!voxel.isInsideHead) return false;
    
    // Count channels contributing to this voxel
    const channelCount = Object.keys(voxel.sensitivity || {}).length;
    
    // Get normalized weighted sum
    const normalizedSens = maxSensitivity > 0 ? voxel.totalSensitivity / maxSensitivity : 0;
    
    // Apply criteria based on mode
    switch (mode) {
        case 'lenient':
            // Show any voxel with any light penetration (any channel contribution)
            return channelCount > 0 && voxel.totalSensitivity > 1e-9;
        
        case 'moderate':
            // Show voxels with either: 2+ channels OR moderate sensitivity (>10% of max)
            return (channelCount >= 2) || (normalizedSens > 0.1);
        
        case 'strict':
            // Show voxels with many channels (3+) AND high sensitivity (>20% of max)
            return (channelCount >= 3) && (normalizedSens > 0.2);
        
        case 'custom':
            // Use user-specified thresholds
            const meetsChannelReq = channelCount >= minChannels;
            const meetsWeightReq = normalizedSens >= (minWeightPct / 100);
            return meetsChannelReq && meetsWeightReq;
        
        default:
            return false;
    }
}

function addVoxelCubes(scene, optodeObjects, voxelThreshold, voxelBrightness) {
    if (VoxelGrid.voxels && VoxelGrid.voxels.length > 0 && VoxelGrid.sensitivityMatrix) {
        // Get voxel selection parameters
        const selectionMode = document.getElementById('voxel-selection-mode')?.value || 'moderate';
        const minChannels = parseInt(document.getElementById('voxel-min-channels')?.value || 2);
        const minWeightPct = parseFloat(document.getElementById('voxel-min-weight')?.value || 5);
        
        // Find maximum sensitivity for normalization
        let maxSensitivity = 0;
        for (const voxel of VoxelGrid.voxels) {
            if (voxel.isInsideHead && voxel.totalSensitivity > maxSensitivity) {
                maxSensitivity = voxel.totalSensitivity;
            }
        }
        
        if (maxSensitivity > 0) {
            // Prepare filter parameters
            const filterParams = {
                mode: selectionMode,
                minChannels: minChannels,
                minWeightPct: minWeightPct,
                maxSensitivity: maxSensitivity
            };
            
            // Also apply legacy threshold for additional filtering if needed
            const legacyThreshold = maxSensitivity * voxelThreshold;
            
            for (const voxel of VoxelGrid.voxels) {
                // Use new filtering criteria
                if (!shouldShowVoxel(voxel, filterParams)) continue;
                
                // Optional: also check legacy threshold (for backward compatibility)
                // Comment out this line to use only new filtering
                if (voxel.totalSensitivity < legacyThreshold) continue;
                
                // Normalize sensitivity (0 to 1)
                const normSens = voxel.totalSensitivity / maxSensitivity;
                
                // Apply brightness scaling with gamma correction for better dynamic range
                const gamma = 1.5;  // Increase contrast
                const scaledSens = Math.pow(normSens, 1 / gamma) * voxelBrightness;
                const displaySens = Math.min(1.0, scaledSens);
                
                // Color gradient: blue (low) -> cyan -> yellow -> red (high)
                let color;
                if (displaySens < 0.33) {
                    // Blue to cyan
                    const t = displaySens / 0.33;
                    color = new THREE.Color(0, t, 1);
                } else if (displaySens < 0.67) {
                    // Cyan to yellow
                    const t = (displaySens - 0.33) / 0.34;
                    color = new THREE.Color(t, 1, 1 - t);
                } else {
                    // Yellow to red
                    const t = (displaySens - 0.67) / 0.33;
                    color = new THREE.Color(1, 1 - t, 0);
                }
                
                // Small cube at voxel center
                const voxelSize = VoxelGrid.resolution * 0.8;
                const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
                
                // Base opacity + sensitivity-weighted boost, scaled by brightness
                const baseOpacity = 0.3 * voxelBrightness;
                const sensOpacity = 0.5 * displaySens;
                const finalOpacity = Math.min(0.9, baseOpacity + sensOpacity);
                
                const material = new THREE.MeshPhongMaterial({
                    color: color,
                    transparent: true,
                    opacity: finalOpacity,
                    shininess: 10,
                    emissive: color.clone().multiplyScalar(0.2 * displaySens)  // Subtle glow for high sensitivity
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(voxel.x, voxel.y, voxel.z);
                mesh.userData = {
                    type: 'voxel',
                    voxelId: voxel.id,
                    sensitivity: voxel.totalSensitivity,
                    normSensitivity: normSens
                };
                
                scene.add(mesh);
                optodeObjects.push(mesh);
            }
        }
    }
}

/**
 * Update voxel statistics display based on current filter settings
 */
function updateVoxelStats() {
    if (!VoxelGrid.voxels || VoxelGrid.voxels.length === 0) {
        return;
    }
    
    // Get voxel selection parameters
    const selectionMode = document.getElementById('voxel-selection-mode')?.value || 'moderate';
    const minChannels = parseInt(document.getElementById('voxel-min-channels')?.value || 2);
    const minWeightPct = parseFloat(document.getElementById('voxel-min-weight')?.value || 5);
    
    // Find maximum sensitivity
    let maxSensitivity = 0;
    for (const voxel of VoxelGrid.voxels) {
        if (voxel.isInsideHead && voxel.totalSensitivity > maxSensitivity) {
            maxSensitivity = voxel.totalSensitivity;
        }
    }
    
    // Prepare filter parameters
    const filterParams = {
        mode: selectionMode,
        minChannels: minChannels,
        minWeightPct: minWeightPct,
        maxSensitivity: maxSensitivity
    };
    
    // Count shown voxels and compute statistics
    let shownCount = 0;
    let totalChannelCount = 0;
    
    for (const voxel of VoxelGrid.voxels) {
        if (shouldShowVoxel(voxel, filterParams)) {
            shownCount++;
            const channelCount = Object.keys(voxel.sensitivity || {}).length;
            totalChannelCount += channelCount;
        }
    }
    
    const avgChannels = shownCount > 0 ? (totalChannelCount / shownCount).toFixed(1) : 0;
    
    // Update display
    const totalVoxels = VoxelGrid.voxels.filter(v => v.isInsideHead).length;
    document.getElementById('voxel-count').textContent = totalVoxels;
    document.getElementById('voxel-shown-count').textContent = `${shownCount} (${(100 * shownCount / totalVoxels).toFixed(1)}%)`;
    document.getElementById('voxel-avg-channels').textContent = avgChannels;
    
    console.log(`Voxel filter: showing ${shownCount}/${totalVoxels} voxels (avg ${avgChannels} channels/voxel)`);
}

/**
 * Create a text sprite for 3D labels
 */
function createTextSprite(text, options = {}) {
    const {
        fontSize = 32,
        textColor = '#ffffff',
        backgroundColor = 'rgba(0,0,0,0.5)'
    } = options;
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = 64;
    canvas.height = 64;
    
    // Background
    if (backgroundColor !== 'transparent') {
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Text
    context.font = `bold ${fontSize}px JetBrains Mono, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = textColor;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: false
    });
    
    return new THREE.Sprite(material);
}

// ============================================================
// View Toggle Handlers
// ============================================================

// View preset camera positions (MNE-style views)
// MNE coordinate system: X=right, Y=front (nose), Z=up
// Camera positions are in the same coordinate system
const VIEW_PRESETS = {
    // Top view - camera above head looking down (like 2D topo)
    top: { 
        position: [0, 0, 280],
        up: [0, 1, 0]  // Y (nose) is "up" in the view
    },
    // Front view - camera in front of face
    front: { 
        position: [0, 280, 0],
        up: [0, 0, 1]  // Z is "up"
    },
    // Back view - camera behind head
    back: { 
        position: [0, -280, 0],
        up: [0, 0, 1]
    },
    // Left side view
    left: { 
        position: [-280, 0, 0],
        up: [0, 0, 1]
    },
    // Right side view
    right: { 
        position: [280, 0, 0],
        up: [0, 0, 1]
    }
};

/**
 * Set camera to a preset view (like MNE's brain.show_view())
 * Animates smoothly to the new position
 */
function setCameraPreset(sceneKey, preset) {
    const sceneData = AppState.three[sceneKey];
    if (!sceneData) return;
    
    const { camera, controls } = sceneData;
    const view = VIEW_PRESETS[preset];
    if (!view) return;
    
    // Target position and up vector
    const endPos = new THREE.Vector3(...view.position);
    const endUp = new THREE.Vector3(...view.up);
    
    // Current values
    const startPos = camera.position.clone();
    const startUp = camera.up.clone();
    
    const duration = 500;
    const startTime = Date.now();
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(1, elapsed / duration);
        
        // Smooth easing (ease-out cubic)
        const eased = 1 - Math.pow(1 - t, 3);
        
        // Interpolate position
        camera.position.lerpVectors(startPos, endPos, eased);
        
        // Interpolate up vector
        camera.up.lerpVectors(startUp, endUp, eased);
        camera.up.normalize();
        
        // Look at center
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
        
        if (t < 1) {
            requestAnimationFrame(animateCamera);
        }
    }
    
    animateCamera();
}

function setupViewToggles() {
    // Preview toggles
    document.querySelectorAll('#settings-panel .view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#settings-panel .view-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const view = btn.dataset.view;
            const canvas = DOM.previewCanvas;
            const container3d = DOM.preview3dContainer;
            
            if (view === '3d') {
                canvas.style.display = 'none';
                container3d.classList.remove('hidden');
                if (!AppState.three.preview) {
                    init3DScene(container3d, 'preview');
                }
                update3DOptodes('preview', false);
            } else {
                canvas.style.display = 'block';
                container3d.classList.add('hidden');
                renderPreview();
            }
        });
    });
    
    // Schematic toggles
    document.querySelectorAll('#schematic-panel .view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#schematic-panel .view-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const view = btn.dataset.view;
            const topoContainer = document.querySelector('.topo-canvas-container');
            const container3d = DOM.schematic3dContainer;
            const presets = document.getElementById('schematic-view-presets');
            
            if (view === '3d') {
                topoContainer.style.display = 'none';
                container3d.classList.remove('hidden');
                presets?.classList.remove('hidden');
                if (!AppState.three.schematic) {
                    init3DScene(container3d, 'schematic');
                }
                update3DOptodes('schematic', true);
            } else {
                topoContainer.style.display = 'block';
                container3d.classList.add('hidden');
                presets?.classList.add('hidden');
                renderSchematic();
            }
        });
    });
    
    // Assign toggles
    document.querySelectorAll('#assign-panel .view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#assign-panel .view-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const view = btn.dataset.view;
            const canvas = DOM.assignCanvas;
            const container3d = DOM.assign3dContainer;
            const presets = document.getElementById('assign-view-presets');
            
            if (view === '3d') {
                canvas.style.display = 'none';
                container3d.classList.remove('hidden');
                presets?.classList.remove('hidden');
                if (!AppState.three.assign) {
                    init3DScene(container3d, 'assign');
                }
                update3DOptodes('assign', true);
            } else {
                canvas.style.display = 'block';
                container3d.classList.add('hidden');
                presets?.classList.add('hidden');
                renderAssignCanvas();
            }
        });
    });
    
    // View preset buttons
    setupViewPresets();
}

/**
 * Setup view preset button handlers
 */
function setupViewPresets() {
    // Schematic presets
    document.querySelectorAll('#schematic-view-presets .preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.viewPreset;
            setCameraPreset('schematic', preset);
        });
    });
    
    // Assign presets
    document.querySelectorAll('#assign-view-presets .preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.viewPreset;
            setCameraPreset('assign', preset);
        });
    });
}

// ============================================================
// Render Functions
// ============================================================
function renderPreview() {
    renderTopoView(DOM.previewCanvas, true, false);
}

function renderSchematic() {
    renderTopoView(DOM.schematicCanvas, true, true);
    if (AppState.three.schematic) {
        update3DOptodes('schematic', true);
    }
}

function renderAssignCanvas() {
    renderTopoView(DOM.assignCanvas, true, true);
    if (AppState.three.assign) {
        update3DOptodes('assign', true);
    }
}

function renderOutputCanvas() {
    const canvas = DOM.outputCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, width, height);
    
    // Border
    ctx.strokeStyle = '#b8a68a';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    // Title
    ctx.fillStyle = '#2d3436';
    ctx.font = 'bold 20px Instrument Serif';
    ctx.textAlign = 'center';
    ctx.fillText('NOMAD Multiplexing Solution', width / 2, 40);
    
    // Stats
    const nColored = Object.values(AppState.coloring).filter(c => c > 0).length;
    ctx.font = '14px Source Sans 3';
    ctx.fillText(`${nColored}/${AppState.sources.length} sources assigned`, width / 2, 65);
    
    // Draw mini topographic view
    if (AppState.sources.length > 0) {
        ctx.save();
        ctx.translate(width / 2 - 200, 90);
        
        // Create mini canvas for topo view
        const miniSize = 400;
        const miniCx = miniSize / 2;
        const miniCy = miniSize / 2;
        const miniRadius = miniSize * 0.35;
        
        // Mini head outline
        ctx.strokeStyle = '#2d3436';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(miniCx, miniCy, miniRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Mini nose
        const noseSize = miniRadius * 0.12;
        ctx.beginPath();
        ctx.moveTo(miniCx - noseSize * 0.5, miniCy - miniRadius);
        ctx.lineTo(miniCx, miniCy - miniRadius - noseSize);
        ctx.lineTo(miniCx + noseSize * 0.5, miniCy - miniRadius);
        ctx.stroke();
        
        // Draw channels and optodes
        for (const channel of AppState.channels) {
            const source = AppState.sources.find(s => s.id === channel.sourceId);
            const detector = AppState.detectors.find(d => d.id === channel.detectorId);
            
            if (source && detector) {
                const sp = toTopoCoords(source.x, source.y, source.z, miniSize);
                const dp = toTopoCoords(detector.x, detector.y, detector.z, miniSize);
                
                const slot = AppState.coloring[source.id] || 0;
                ctx.strokeStyle = slot > 0 ? getSlotColor(slot) : '#ccc';
                ctx.lineWidth = slot > 0 ? 1.5 : 0.5;
                
                ctx.beginPath();
                ctx.moveTo(sp.x, sp.y);
                ctx.lineTo(dp.x, dp.y);
                ctx.stroke();
            }
        }
        
        // Detectors
        for (const det of AppState.detectors) {
            const p = toTopoCoords(det.x, det.y, det.z, miniSize);
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 6);
            ctx.lineTo(p.x - 5, p.y + 4);
            ctx.lineTo(p.x + 5, p.y + 4);
            ctx.closePath();
            ctx.fill();
        }
        
        // Sources
        for (const src of AppState.sources) {
            const p = toTopoCoords(src.x, src.y, src.z, miniSize);
            const slot = AppState.coloring[src.id] || 0;
            ctx.fillStyle = slot > 0 ? getSlotColor(slot) : '#95a5a6';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// ============================================================
// Statistics Updates
// ============================================================
function updateStats() {
    if (DOM.statSources) DOM.statSources.textContent = AppState.sources.length;
    if (DOM.statDetectors) DOM.statDetectors.textContent = AppState.detectors.length;
    if (DOM.statChannels) DOM.statChannels.textContent = AppState.channels.length;
    
    const remaining = document.getElementById('stat-remaining');
    const placed = document.getElementById('stat-placed');
    const validCh = document.getElementById('stat-valid-ch');
    
    if (remaining) remaining.textContent = AppState.sources.length;
    if (placed) placed.textContent = AppState.detectors.length;
    if (validCh) validCh.textContent = AppState.channels.length;
}

function updateConflictStats() {
    const edgesEl = document.getElementById('conflict-edges');
    const degreeEl = document.getElementById('conflict-degree');
    
    if (!AppState.conflictGraph) return;
    
    const nEdges = Object.values(AppState.conflictGraph).reduce((sum, neighbors) => sum + neighbors.size, 0) / 2;
    const avgDegree = AppState.sources.length > 0 
        ? (nEdges * 2 / AppState.sources.length).toFixed(1) 
        : 0;
    
    if (edgesEl) edgesEl.textContent = Math.round(nEdges);
    if (degreeEl) degreeEl.textContent = avgDegree;
}

function updateTimeslotLegend() {
    const legend = DOM.timeslotLegend;
    if (!legend) return;
    
    const nSlots = parseInt(DOM.nTimeslots?.value) || 8;
    
    let html = '';
    for (let i = 1; i <= nSlots; i++) {
        const count = Object.values(AppState.coloring).filter(c => c === i).length;
        const color = getSlotColor(i);
        
        html += `
            <div class="timeslot-item">
                <span class="timeslot-color" style="background-color: ${color}"></span>
                <span>Slot ${i}: ${count}</span>
            </div>
        `;
    }
    
    legend.innerHTML = html;
}

// ============================================================
// Graph Coloring Algorithms
// ============================================================

async function randomRestartMonteCarlo(nTrials, progressCallback) {
    const nColors = parseInt(DOM.nTimeslots?.value) || 8;
    const capacity = parseInt(DOM.capacity?.value) || 4;
    
    let bestColoring = null;
    let bestUncolored = AppState.sources.length + 1;
    
    for (let trial = 0; trial < nTrials; trial++) {
        const coloring = singleMonteCarloTrial(nColors, capacity);
        const uncolored = Object.values(coloring).filter(c => c === 0).length;
        
        if (uncolored < bestUncolored) {
            bestUncolored = uncolored;
            bestColoring = { ...coloring };
            
            if (uncolored === 0) {
                if (progressCallback) progressCallback(trial + 1, nTrials, true);
                break;
            }
        }
        
        if (progressCallback && trial % 10 === 0) {
            progressCallback(trial + 1, nTrials, false);
            await new Promise(r => setTimeout(r, 0));
        }
    }
    
    return {
        coloring: bestColoring,
        nColored: AppState.sources.length - bestUncolored,
        nUncolored: bestUncolored,
        isComplete: bestUncolored === 0
    };
}

function singleMonteCarloTrial(nColors, capacity) {
    const coloring = {};
    for (const source of AppState.sources) {
        coloring[source.id] = 0;
    }
    
    let availableSlots = [];
    for (let color = 1; color <= nColors; color++) {
        for (let i = 0; i < capacity; i++) {
            availableSlots.push(color);
        }
    }
    shuffleArray(availableSlots);
    
    const sourceOrder = [...AppState.sources];
    shuffleArray(sourceOrder);
    
    for (const source of sourceOrder) {
        if (coloring[source.id] !== 0) continue;
        
        const neighbors = AppState.conflictGraph[source.id] || new Set();
        const neighborColors = new Set();
        
        for (const neighborId of neighbors) {
            if (coloring[neighborId] > 0) {
                neighborColors.add(coloring[neighborId]);
            }
        }
        
        for (let i = 0; i < availableSlots.length; i++) {
            const color = availableSlots[i];
            if (!neighborColors.has(color)) {
                coloring[source.id] = color;
                availableSlots.splice(i, 1);
                break;
            }
        }
    }
    
    return coloring;
}

async function dsaturAlgorithm(nTrials, progressCallback) {
    const nColors = parseInt(DOM.nTimeslots?.value) || 8;
    const capacity = parseInt(DOM.capacity?.value) || 4;
    
    let bestColoring = null;
    let bestUncolored = AppState.sources.length + 1;
    
    for (let trial = 0; trial < nTrials; trial++) {
        const coloring = singleDsaturTrial(nColors, capacity);
        const uncolored = Object.values(coloring).filter(c => c === 0).length;
        
        if (uncolored < bestUncolored) {
            bestUncolored = uncolored;
            bestColoring = { ...coloring };
            if (uncolored === 0) {
                if (progressCallback) progressCallback(trial + 1, nTrials, true);
                break;
            }
        }
        
        if (progressCallback && trial % 10 === 0) {
            progressCallback(trial + 1, nTrials, false);
            await new Promise(r => setTimeout(r, 0));
        }
    }
    
    return {
        coloring: bestColoring,
        nColored: AppState.sources.length - bestUncolored,
        nUncolored: bestUncolored,
        isComplete: bestUncolored === 0
    };
}

function singleDsaturTrial(nColors, capacity) {
    const coloring = {};
    const saturation = {};
    const colorUsage = {};
    
    for (const source of AppState.sources) {
        coloring[source.id] = 0;
        saturation[source.id] = 0;
    }
    
    for (let c = 1; c <= nColors; c++) {
        colorUsage[c] = 0;
    }
    
    const degrees = {};
    for (const source of AppState.sources) {
        degrees[source.id] = (AppState.conflictGraph[source.id] || new Set()).size;
    }
    
    for (let i = 0; i < AppState.sources.length; i++) {
        let bestNode = null;
        let bestSat = -1;
        let bestDeg = -1;
        
        for (const source of AppState.sources) {
            if (coloring[source.id] !== 0) continue;
            
            const sat = saturation[source.id];
            const deg = degrees[source.id];
            
            if (sat > bestSat || (sat === bestSat && deg > bestDeg) || 
                (sat === bestSat && deg === bestDeg && Math.random() > 0.5)) {
                bestSat = sat;
                bestDeg = deg;
                bestNode = source;
            }
        }
        
        if (!bestNode) break;
        
        const neighbors = AppState.conflictGraph[bestNode.id] || new Set();
        const neighborColors = new Set();
        
        for (const neighborId of neighbors) {
            if (coloring[neighborId] > 0) {
                neighborColors.add(coloring[neighborId]);
            }
        }
        
        const colorOrder = Array.from({ length: nColors }, (_, i) => i + 1);
        shuffleArray(colorOrder);
        
        for (const color of colorOrder) {
            if (!neighborColors.has(color) && colorUsage[color] < capacity) {
                coloring[bestNode.id] = color;
                colorUsage[color]++;
                
                for (const neighborId of neighbors) {
                    if (coloring[neighborId] === 0) {
                        const nNeighborColors = new Set();
                        for (const nnId of (AppState.conflictGraph[neighborId] || [])) {
                            if (coloring[nnId] > 0) {
                                nNeighborColors.add(coloring[nnId]);
                            }
                        }
                        saturation[neighborId] = nNeighborColors.size;
                    }
                }
                break;
            }
        }
    }
    
    return coloring;
}

async function greedyAlgorithm(nTrials, progressCallback) {
    const nColors = parseInt(DOM.nTimeslots?.value) || 8;
    const capacity = parseInt(DOM.capacity?.value) || 4;
    
    let bestColoring = null;
    let bestUncolored = AppState.sources.length + 1;
    
    for (let trial = 0; trial < nTrials; trial++) {
        const coloring = singleGreedyTrial(nColors, capacity);
        const uncolored = Object.values(coloring).filter(c => c === 0).length;
        
        if (uncolored < bestUncolored) {
            bestUncolored = uncolored;
            bestColoring = { ...coloring };
            if (uncolored === 0) {
                if (progressCallback) progressCallback(trial + 1, nTrials, true);
                break;
            }
        }
        
        if (progressCallback && trial % 10 === 0) {
            progressCallback(trial + 1, nTrials, false);
            await new Promise(r => setTimeout(r, 0));
        }
    }
    
    return {
        coloring: bestColoring,
        nColored: AppState.sources.length - bestUncolored,
        nUncolored: bestUncolored,
        isComplete: bestUncolored === 0
    };
}

function singleGreedyTrial(nColors, capacity) {
    const coloring = {};
    const colorUsage = {};
    
    for (const source of AppState.sources) {
        coloring[source.id] = 0;
    }
    
    for (let c = 1; c <= nColors; c++) {
        colorUsage[c] = 0;
    }
    
    const sourceOrder = [...AppState.sources];
    shuffleArray(sourceOrder);
    
    for (const source of sourceOrder) {
        const neighbors = AppState.conflictGraph[source.id] || new Set();
        const neighborColors = new Set();
        
        for (const neighborId of neighbors) {
            if (coloring[neighborId] > 0) {
                neighborColors.add(coloring[neighborId]);
            }
        }
        
        for (let color = 1; color <= nColors; color++) {
            if (!neighborColors.has(color) && colorUsage[color] < capacity) {
                coloring[source.id] = color;
                colorUsage[color]++;
                break;
            }
        }
    }
    
    return coloring;
}

// ============================================================
// Validation
// ============================================================
function validateColoring(coloring) {
    const maxDist = parseFloat(DOM.maxDistance?.value) || 60;
    const conflicts = [];
    
    for (const detector of AppState.detectors) {
        const slotSources = {};
        
        for (const source of AppState.sources) {
            const slot = coloring[source.id];
            if (slot === 0) continue;
            
            const dist = distance3D(source, detector);
            if (dist <= maxDist) {
                if (!slotSources[slot]) {
                    slotSources[slot] = [];
                }
                slotSources[slot].push(source);
            }
        }
        
        for (const [slot, sources] of Object.entries(slotSources)) {
            if (sources.length > 1) {
                conflicts.push({
                    detector: detector,
                    slot: parseInt(slot),
                    sources: sources
                });
            }
        }
    }
    
    return {
        isValid: conflicts.length === 0,
        conflicts: conflicts
    };
}

// ============================================================
// Event Handlers
// ============================================================
function setupEventHandlers() {
    DOM.maxDistance?.addEventListener('change', buildChannels);
    DOM.minDistance?.addEventListener('change', buildChannels);
    
    DOM.toolBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.currentTool = btn.dataset.tool;
        });
    });
    
    DOM.btnColor?.addEventListener('click', runColoring);
    DOM.btnCrosstalkCheck?.addEventListener('click', runCrosstalkCheck);
    
    document.getElementById('btn-channel-stats')?.addEventListener('click', showChannelStats);
    document.getElementById('btn-close-stats')?.addEventListener('click', () => {
        DOM.resultsModal.classList.remove('active');
    });
    
    document.getElementById('btn-run-coregistration')?.addEventListener('click', runCoregistrationOnCurrentMontage);
    document.getElementById('btn-show-coreg-metrics')?.addEventListener('click', showCoregistrationMetrics);
    document.getElementById('btn-close-coreg')?.addEventListener('click', () => {
        document.getElementById('coreg-modal')?.classList.remove('active');
    });
    
    // Grid system event handlers
    document.getElementById('use-grid-system')?.addEventListener('change', (e) => {
        GridSystem.config.enabled = e.target.checked;
        console.log(`Grid system ${GridSystem.config.enabled ? 'enabled' : 'disabled'}`);
        renderPreview();
        renderSchematic();
    });
    
    document.getElementById('show-grid-points')?.addEventListener('change', () => {
        renderPreview();
        renderSchematic();
        renderAssignCanvas();
    });
    
    document.getElementById('grid-density')?.addEventListener('change', () => {
        renderPreview();
        renderSchematic();
        renderAssignCanvas();
    });
    
    document.getElementById('show-geodesic-grid')?.addEventListener('change', () => {
        renderPreview();
        renderSchematic();
        renderAssignCanvas();
        // Update 3D views
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('geodesic-spacing')?.addEventListener('change', () => {
        // Regenerate geodesic grid with new spacing
        const spacing = parseFloat(document.getElementById('geodesic-spacing')?.value || 15);
        GridSystem.geodesicGrid = generateGeodesicGrid(spacing);
        document.getElementById('geodesic-count').textContent = `~${GridSystem.geodesicGrid.length}`;
        console.log(`Geodesic grid regenerated: ${GridSystem.geodesicGrid.length} positions at ${spacing}mm surface spacing`);
        
        // Update all views
        renderPreview();
        renderSchematic();
        renderAssignCanvas();
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    // Voxel system event handlers
    document.getElementById('voxel-resolution')?.addEventListener('change', () => {
        const resolution = parseFloat(document.getElementById('voxel-resolution')?.value || 5);
        VoxelGrid.resolution = resolution;
        VoxelGrid.initialize();
        document.getElementById('voxel-count').textContent = `${VoxelGrid.voxels.filter(v => v.isInsideHead).length}`;
        console.log(`Voxel grid regenerated at ${resolution}mm resolution`);
    });
    
    document.getElementById('show-photon-paths')?.addEventListener('change', () => {
        // Update 3D visualization
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('path-opacity')?.addEventListener('input', (e) => {
        document.getElementById('path-opacity-value').textContent = e.target.value;
        // Update 3D visualization
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    // Voxel selection mode
    document.getElementById('voxel-selection-mode')?.addEventListener('change', (e) => {
        const mode = e.target.value;
        const customSettings = document.getElementById('voxel-custom-settings');
        const weightedSettings = document.getElementById('voxel-weighted-settings');
        
        // Show/hide custom settings
        if (mode === 'custom') {
            customSettings.style.display = 'block';
            weightedSettings.style.display = 'block';
        } else {
            customSettings.style.display = 'none';
            weightedSettings.style.display = 'none';
        }
        
        // Update statistics and 3D visualization
        updateVoxelStats();
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('voxel-min-channels')?.addEventListener('input', () => {
        // Update statistics and 3D visualization
        updateVoxelStats();
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('voxel-min-weight')?.addEventListener('input', (e) => {
        document.getElementById('voxel-min-weight-value').textContent = e.target.value;
        // Update statistics and 3D visualization
        updateVoxelStats();
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('voxel-threshold')?.addEventListener('input', (e) => {
        document.getElementById('voxel-threshold-value').textContent = e.target.value;
        // Update statistics and 3D visualization
        updateVoxelStats();
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('voxel-brightness')?.addEventListener('input', (e) => {
        document.getElementById('voxel-brightness-value').textContent = e.target.value;
        // Update 3D visualization
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('show-voxels')?.addEventListener('change', () => {
        // Update 3D visualization
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('btn-build-sensitivity')?.addEventListener('click', () => {
        const matrix = buildSensitivityMatrix();
        
        if (!matrix) {
            alert('Cannot build sensitivity matrix. Please create a montage with sources, detectors, and channels first.');
            return;
        }
        
        // Update UI
        document.getElementById('matrix-size').textContent = `${matrix.nNonZero.toLocaleString()} (${(matrix.sparsity * 100).toFixed(1)}% sparse)`;
        
        // Update voxel statistics with filter criteria
        updateVoxelStats();
        
        // Auto-enable voxel display
        document.getElementById('show-voxels').checked = true;
        
        // Update 3D visualization
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
        
        alert(`Sensitivity matrix built!\n\nChannels: ${matrix.nChannels}\nVoxels: ${matrix.nVoxels}\nNon-zero entries: ${matrix.nNonZero.toLocaleString()}\nSparsity: ${(matrix.sparsity * 100).toFixed(2)}%\n\nVoxel visualization enabled.\nReady for source reconstruction.`);
    });
    
    // Note: show-brain-parcellation checkbox removed from UI, but kept for backward compatibility
    // Brain parcellation is now automatically enabled in ROI mode
    document.getElementById('show-brain-parcellation')?.addEventListener('change', () => {
        // Update 3D visualization (except ROI mode which always has parcellation)
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
    });
    
    document.getElementById('btn-export-matrix')?.addEventListener('click', () => {
        if (!VoxelGrid.sensitivityMatrix) {
            alert('Please build sensitivity matrix first (click "Build Sensitivity Matrix")');
            return;
        }
        
        const data = {
            matrix: VoxelGrid.sensitivityMatrix,
            voxelGrid: {
                bounds: VoxelGrid.bounds,
                resolution: VoxelGrid.resolution,
                dimensions: VoxelGrid.dimensions,
                voxels: VoxelGrid.voxels.filter(v => v.isInsideHead).map(v => ({
                    id: v.id,
                    x: v.x,
                    y: v.y,
                    z: v.z,
                    totalSensitivity: v.totalSensitivity
                }))
            },
            channels: AppState.channels.map(ch => ({
                id: ch.id,
                sourceId: ch.sourceId,
                detectorId: ch.detectorId,
                distance: ch.distance,
                penetrationDepth: ch.photonPath?.penetrationDepth
            })),
            metadata: {
                exportDate: new Date().toISOString(),
                software: 'NOMAD fNIRS Montage Designer',
                version: '2.0'
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sensitivity_matrix_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('Sensitivity matrix exported');
    });
    
    document.getElementById('btn-save-schematic')?.addEventListener('click', saveSchematic);
    document.getElementById('btn-create-mtg')?.addEventListener('click', exportMtgFile);
    document.getElementById('btn-create-snirf')?.addEventListener('click', exportSnirfJson);
    document.getElementById('btn-create-neurodot')?.addEventListener('click', exportNeuroDOT);
    document.getElementById('btn-create-gdf')?.addEventListener('click', exportGdfFile);
    document.getElementById('btn-save-workspace')?.addEventListener('click', saveWorkspace);
    document.getElementById('btn-generate-grid')?.addEventListener('click', loadExampleMontage);
    
    // Canvas click handling
    DOM.schematicCanvas?.addEventListener('click', handleCanvasClick);
    DOM.assignCanvas?.addEventListener('click', handleCanvasClick);
}

function handleCanvasClick(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    const clicked = findElementAtTopo(canvasX, canvasY, canvas.width);
    
    if (clicked) {
        AppState.selectedElement = clicked;
        renderSchematic();
        renderAssignCanvas();
        updateSelectionInfo(clicked);
    }
}

function findElementAtTopo(x, y, canvasSize) {
    const threshold = 15;
    
    // Check sources
    for (const source of AppState.sources) {
        const p = toTopoCoords(source.x, source.y, source.z, canvasSize);
        if (Math.abs(p.x - x) < threshold && Math.abs(p.y - y) < threshold) {
            return { type: 'source', data: source };
        }
    }
    
    // Check detectors
    for (const detector of AppState.detectors) {
        const p = toTopoCoords(detector.x, detector.y, detector.z, canvasSize);
        if (Math.abs(p.x - x) < threshold && Math.abs(p.y - y) < threshold) {
            return { type: 'detector', data: detector };
        }
    }
    
    return null;
}

function updateSelectionInfo(element) {
    const info = document.getElementById('selection-info');
    if (!info) return;
    
    if (!element) {
        info.innerHTML = '<span class="placeholder">Click on head to select optode</span>';
        return;
    }
    
    if (element.type === 'source') {
        const s = element.data;
        const slot = AppState.coloring[s.id] || 0;
        info.innerHTML = `
            <strong style="color: ${slot > 0 ? getSlotColor(slot) : '#3498db'}">${s.label}</strong><br>
            Position: (${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)}) mm<br>
            Time Slot: ${slot === 0 ? '<em>Unassigned</em>' : `<strong>${slot}</strong>`}<br>
            Conflicts: ${(AppState.conflictGraph[s.id] || new Set()).size} sources
        `;
    } else if (element.type === 'detector') {
        const d = element.data;
        const sourcesInRange = (AppState.detectorSources?.[d.id] || []).length;
        info.innerHTML = `
            <strong style="color: #e74c3c">${d.label}</strong><br>
            Position: (${d.x.toFixed(1)}, ${d.y.toFixed(1)}, ${d.z.toFixed(1)}) mm<br>
            Sources in range: ${sourcesInRange}
        `;
    }
}

// ============================================================
// Coloring Execution
// ============================================================
async function runColoring() {
    if (AppState.sources.length === 0) {
        alert('Please load a montage first!');
        return;
    }
    
    buildChannels();
    
    const algorithm = DOM.algorithm?.value || 'monte-carlo';
    const nTrials = parseInt(DOM.mcTries?.value) || 1000;
    
    DOM.progressModal.classList.add('active');
    DOM.progressFill.style.width = '0%';
    DOM.progressText.textContent = 'Starting algorithm...';
    
    const progressCallback = (current, total, complete) => {
        const pct = (current / total) * 100;
        DOM.progressFill.style.width = `${pct}%`;
        DOM.progressText.textContent = complete 
            ? `Complete! Found solution at trial ${current}`
            : `Trial ${current} / ${total}`;
    };
    
    let result;
    
    try {
        if (algorithm === 'monte-carlo') {
            result = await randomRestartMonteCarlo(nTrials, progressCallback);
        } else if (algorithm === 'dsatur') {
            result = await dsaturAlgorithm(nTrials, progressCallback);
        } else {
            result = await greedyAlgorithm(nTrials, progressCallback);
        }
        
        AppState.coloring = result.coloring;
        
        updateResultBox(result);
        renderSchematic();
        renderAssignCanvas();
        updateTimeslotLegend();
        
        // Update 3D views if visible
        if (AppState.three.schematic) update3DOptodes('schematic', true);
        if (AppState.three.assign) update3DOptodes('assign', true);
        
    } catch (err) {
        console.error('Algorithm error:', err);
        updateResultBox({
            isComplete: false,
            nColored: 0,
            nUncolored: AppState.sources.length,
            error: err.message
        });
    }
    
    setTimeout(() => {
        DOM.progressModal.classList.remove('active');
    }, 500);
}

function updateResultBox(result) {
    const box = DOM.resultBox;
    const details = DOM.resultDetails;
    
    if (result.isComplete) {
        box.className = 'result-box success';
        box.querySelector('.result-icon').textContent = '✅';
        box.querySelector('.result-text').textContent = 'Solution Found!';
        details.innerHTML = `
            All <strong>${result.nColored}</strong> sources assigned to time slots.<br>
            No crosstalk conflicts detected.
        `;
    } else if (result.error) {
        box.className = 'result-box error';
        box.querySelector('.result-icon').textContent = '❌';
        box.querySelector('.result-text').textContent = 'Error';
        details.innerHTML = result.error;
    } else {
        box.className = 'result-box';
        box.querySelector('.result-icon').textContent = '⚠️';
        box.querySelector('.result-text').textContent = 'Partial Solution';
        details.innerHTML = `
            ${result.nColored} / ${result.nColored + result.nUncolored} sources assigned.<br>
            ${result.nUncolored} sources could not be colored.
        `;
    }
}

function runCrosstalkCheck() {
    if (!AppState.coloring || Object.keys(AppState.coloring).length === 0) {
        alert('Please run coloring first!');
        return;
    }
    
    const validation = validateColoring(AppState.coloring);
    
    if (validation.isValid) {
        DOM.resultBox.className = 'result-box success';
        DOM.resultBox.querySelector('.result-icon').textContent = '✅';
        DOM.resultBox.querySelector('.result-text').textContent = 'Valid!';
        DOM.resultDetails.innerHTML = 'No crosstalk conflicts detected. Solution is safe to use.';
    } else {
        DOM.resultBox.className = 'result-box error';
        DOM.resultBox.querySelector('.result-icon').textContent = '❌';
        DOM.resultBox.querySelector('.result-text').textContent = 'Invalid!';
        
        const conflictHtml = validation.conflicts.map(c => 
            `• ${c.detector.label}: Sources ${c.sources.map(s => s.label).join(', ')} in slot ${c.slot}`
        ).join('<br>');
        
        DOM.resultDetails.innerHTML = `
            Found ${validation.conflicts.length} crosstalk conflicts:<br>
            ${conflictHtml}
        `;
    }
}

/**
 * Run coregistration on currently loaded montage
 */
function runCoregistrationOnCurrentMontage() {
    if (AppState.sources.length === 0 && AppState.detectors.length === 0) {
        alert('Please load a montage first!');
        return;
    }
    
    // Check if grid system is enabled - warn user
    if (GridSystem.config.enabled) {
        const proceed = confirm(
            'Grid system is currently enabled. Coregistration works best with grid disabled.\n\n' +
            'Disable grid system and run coregistration?'
        );
        if (!proceed) return;
        
        // Disable grid system
        GridSystem.config.enabled = false;
        const gridCheckbox = document.getElementById('use-grid-system');
        if (gridCheckbox) gridCheckbox.checked = false;
    }
    
    // Gather all optodes
    const allOptodes = [
        ...AppState.sources.map(s => ({x: s.x, y: s.y, z: s.z, id: s.id, type: 'source', label: s.label})),
        ...AppState.detectors.map(d => ({x: d.x, y: d.y, z: d.z, id: d.id, type: 'detector', label: d.label}))
    ];
    
    // Get coregistration options from UI
    const coregOptions = {
        useRigidAlignment: document.getElementById('use-fiducial-alignment')?.checked !== false,
        useRegression: document.getElementById('use-regression')?.checked !== false,
        useSurfaceFitting: document.getElementById('use-surface-fitting')?.checked !== false
    };
    
    // Check if we have any fiducials for alignment
    let measuredFiducials = null;
    if (coregOptions.useRigidAlignment && AppState.loadedFile && AppState.loadedFile.fiducials) {
        measuredFiducials = AppState.loadedFile.fiducials;
    }
    
    console.log('Running coregistration on current montage...');
    console.log(`Options: Fiducial=${coregOptions.useRigidAlignment}, Regression=${coregOptions.useRegression}, Surface=${coregOptions.useSurfaceFitting}`);
    
    // Run coregistration
    const coregistered = coregisterOptodes(allOptodes, measuredFiducials, coregOptions);
    
    // Update positions in AppState
    for (let i = 0; i < AppState.sources.length; i++) {
        AppState.sources[i].x = coregistered[i].x;
        AppState.sources[i].y = coregistered[i].y;
        AppState.sources[i].z = coregistered[i].z;
    }
    
    for (let i = 0; i < AppState.detectors.length; i++) {
        const idx = AppState.sources.length + i;
        AppState.detectors[i].x = coregistered[idx].x;
        AppState.detectors[i].y = coregistered[idx].y;
        AppState.detectors[i].z = coregistered[idx].z;
    }
    
    // Rebuild channels with new positions
    buildChannels();
    
    // Update visualizations
    updateStats();
    renderPreview();
    renderSchematic();
    if (AppState.viewMode === '3d') {
        if (AppState.three.preview) update3DOptodes('preview', false);
        if (AppState.three.schematic) update3DOptodes('schematic', true);
    }
    
    // Show success message with metrics
    const metrics = CoregistrationState.metrics;
    let message = '✅ Coregistration complete!\n\n';
    
    if (metrics.fiducialError !== null) {
        message += `Fiducial alignment: ${metrics.fiducialError.toFixed(2)}mm RMS\n`;
    }
    if (metrics.surfaceError !== null) {
        message += `Surface fitting: ${metrics.surfaceError.toFixed(2)}mm RMS\n`;
    }
    if (metrics.maxError !== null) {
        message += `Maximum error: ${metrics.maxError.toFixed(2)}mm\n`;
    }
    if (metrics.coverage !== null) {
        message += `Coverage: ${metrics.coverage.toFixed(1)}% within 5mm\n`;
    }
    
    message += '\nClick "View Quality Metrics" for detailed analysis.';
    
    alert(message);
    
    console.log('Coregistration complete. Updated positions for all optodes.');
}

/**
 * Display coregistration quality metrics
 */
function showCoregistrationMetrics() {
    const modal = document.getElementById('coreg-modal');
    if (!modal) return;
    
    const metrics = CoregistrationState.metrics;
    
    // Update metric values
    const fiducialEl = document.querySelector('#metric-fiducial .value');
    const surfaceEl = document.querySelector('#metric-surface .value');
    const maxEl = document.querySelector('#metric-max .value');
    const coverageEl = document.querySelector('#metric-coverage .value');
    const interpretEl = document.getElementById('interpretation-text');
    
    if (metrics.fiducialError !== null) {
        fiducialEl.textContent = metrics.fiducialError.toFixed(2);
        fiducialEl.style.color = metrics.fiducialError < 3 ? '#2ecc71' : 
                                 metrics.fiducialError < 5 ? '#f39c12' : '#e74c3c';
    } else {
        fiducialEl.textContent = 'N/A';
        fiducialEl.style.color = '#95a5a6';
    }
    
    if (metrics.surfaceError !== null) {
        surfaceEl.textContent = metrics.surfaceError.toFixed(2);
        surfaceEl.style.color = metrics.surfaceError < 2 ? '#2ecc71' : 
                                metrics.surfaceError < 5 ? '#f39c12' : '#e74c3c';
    } else {
        surfaceEl.textContent = 'N/A';
        surfaceEl.style.color = '#95a5a6';
    }
    
    if (metrics.maxError !== null) {
        maxEl.textContent = metrics.maxError.toFixed(2);
        maxEl.style.color = metrics.maxError < 5 ? '#2ecc71' : 
                            metrics.maxError < 10 ? '#f39c12' : '#e74c3c';
    } else {
        maxEl.textContent = 'N/A';
        maxEl.style.color = '#95a5a6';
    }
    
    if (metrics.coverage !== null) {
        coverageEl.textContent = metrics.coverage.toFixed(1);
        coverageEl.style.color = metrics.coverage > 95 ? '#2ecc71' : 
                                 metrics.coverage > 85 ? '#f39c12' : '#e74c3c';
    } else {
        coverageEl.textContent = 'N/A';
        coverageEl.style.color = '#95a5a6';
    }
    
    // Generate interpretation
    let interpretation = '';
    if (metrics.surfaceError === null) {
        interpretation = 'No coregistration has been performed yet. Load a montage to see alignment quality.';
    } else if (metrics.surfaceError < 2 && metrics.coverage > 95) {
        interpretation = '✅ Excellent coregistration! Optodes are well-aligned to the anatomical model.';
    } else if (metrics.surfaceError < 5 && metrics.coverage > 85) {
        interpretation = '✓ Good coregistration. Minor positioning errors are within acceptable range for fNIRS.';
    } else if (metrics.surfaceError < 10) {
        interpretation = '⚠️ Moderate coregistration quality. Consider checking fiducial marker positions.';
    } else {
        interpretation = '❌ Poor coregistration. Fiducial markers may be incorrectly digitized. Manual adjustment recommended.';
    }
    
    if (metrics.fiducialError !== null && metrics.fiducialError > 5) {
        interpretation += ' High fiducial error suggests measurement issues with nasion/inion/LPA/RPA markers.';
    }
    
    interpretEl.textContent = interpretation;
    
    modal.classList.add('active');
}

function showChannelStats() {
    const body = DOM.statsBody;
    if (!body) return;
    
    const nSources = AppState.sources.length;
    const nDetectors = AppState.detectors.length;
    const nChannels = AppState.channels.length;
    const nSlots = parseInt(DOM.nTimeslots?.value) || 8;
    const capacity = parseInt(DOM.capacity?.value) || 4;
    
    const nColored = Object.values(AppState.coloring).filter(c => c > 0).length;
    
    const slotCounts = {};
    for (let i = 1; i <= nSlots; i++) {
        slotCounts[i] = Object.values(AppState.coloring).filter(c => c === i).length;
    }
    
    const distances = AppState.channels.map(c => c.distance);
    const avgDist = distances.length > 0 ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1) : 0;
    const minDist = distances.length > 0 ? Math.min(...distances).toFixed(1) : 0;
    const maxDist = distances.length > 0 ? Math.max(...distances).toFixed(1) : 0;
    
    const nConflicts = AppState.conflictGraph ? 
        Object.values(AppState.conflictGraph).reduce((sum, neighbors) => sum + neighbors.size, 0) / 2 : 0;
    
    body.innerHTML = `
        <h4>Montage Configuration</h4>
        <table style="width: 100%; margin-bottom: 20px;">
            <tr><td>Sources</td><td><strong>${nSources}</strong></td></tr>
            <tr><td>Detectors</td><td><strong>${nDetectors}</strong></td></tr>
            <tr><td>Valid Channels</td><td><strong>${nChannels}</strong></td></tr>
            <tr><td>Time Slots</td><td><strong>${nSlots}</strong></td></tr>
            <tr><td>Capacity per Slot</td><td><strong>${capacity}</strong></td></tr>
        </table>
        
        <h4>Channel Distances</h4>
        <table style="width: 100%; margin-bottom: 20px;">
            <tr><td>Minimum</td><td><strong>${minDist} mm</strong></td></tr>
            <tr><td>Maximum</td><td><strong>${maxDist} mm</strong></td></tr>
            <tr><td>Average</td><td><strong>${avgDist} mm</strong></td></tr>
        </table>
        
        <h4>Conflict Graph</h4>
        <table style="width: 100%; margin-bottom: 20px;">
            <tr><td>Conflict Pairs</td><td><strong>${Math.round(nConflicts)}</strong></td></tr>
        </table>
        
        <h4>Sources per Time Slot</h4>
        <table style="width: 100%;">
            ${Object.entries(slotCounts).map(([slot, count]) => `
                <tr>
                    <td>
                        <span style="display: inline-block; width: 16px; height: 16px; 
                                     background: ${getSlotColor(slot)}; border-radius: 3px; 
                                     vertical-align: middle; margin-right: 8px;"></span>
                        Slot ${slot}
                    </td>
                    <td><strong>${count}</strong></td>
                </tr>
            `).join('')}
        </table>
    `;
    
    DOM.resultsModal.classList.add('active');
}

// ============================================================
// Export Functions
// ============================================================
function saveSchematic() {
    const canvas = DOM.assignCanvas;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = 'nomad_schematic.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    addToExportLog('Saved schematic as PNG');
}

function exportMtgFile() {
    const lines = [];
    
    lines.push(`% NOMAD Montage File`);
    lines.push(`% Generated: ${new Date().toISOString()}`);
    lines.push(`% Sources: ${AppState.sources.length}`);
    lines.push(`% Detectors: ${AppState.detectors.length}`);
    lines.push('');
    
    lines.push('% Source ID, X, Y, Z, TimeSlot, Label');
    for (const src of AppState.sources) {
        const slot = AppState.coloring[src.id] || 0;
        lines.push(`S ${src.id} ${src.x.toFixed(3)} ${src.y.toFixed(3)} ${src.z.toFixed(3)} ${slot} ${src.label}`);
    }
    
    lines.push('');
    lines.push('% Detector ID, X, Y, Z, Label');
    for (const det of AppState.detectors) {
        lines.push(`D ${det.id} ${det.x.toFixed(3)} ${det.y.toFixed(3)} ${det.z.toFixed(3)} ${det.label}`);
    }
    
    downloadFile(lines.join('\n'), 'montage.mtg', 'text/plain');
    addToExportLog('Created .mtg file');
}

function exportSnirfJson() {
    const data = {
        format: 'nomad-snirf-json',
        version: '1.0',
        created: new Date().toISOString(),
        
        nirs: {
            probe: {
                sourcePos3D: AppState.sources.map(s => [s.x, s.y, s.z]),
                detectorPos3D: AppState.detectors.map(d => [d.x, d.y, d.z]),
                sourceLabels: AppState.sources.map(s => s.label),
                detectorLabels: AppState.detectors.map(d => d.label),
                wavelengths: [parseInt(document.getElementById('wavelength')?.value) || 830],
                sourceTimeSlots: AppState.sources.map(s => AppState.coloring[s.id] || 0)
            },
            
            data: AppState.channels.map(ch => ({
                sourceIndex: ch.sourceId,
                detectorIndex: ch.detectorId,
                wavelengthIndex: 0,
                distance: ch.distance
            }))
        },
        
        nomad: {
            config: {
                maxDistance: parseFloat(DOM.maxDistance?.value),
                minDistance: parseFloat(DOM.minDistance?.value),
                nTimeSlots: parseInt(DOM.nTimeslots?.value),
                capacity: parseInt(DOM.capacity?.value),
                algorithm: DOM.algorithm?.value
            },
            coloring: AppState.coloring
        }
    };
    
    downloadFile(JSON.stringify(data, null, 2), 'montage.snirf.json', 'application/json');
    addToExportLog('Created SNIRF-compatible JSON');
}

/**
 * Export montage in NeuroDOT-compatible format
 * 
 * NeuroDOT (https://github.com/WUSTL-ORL/NeuroDOT_py) is the leading 
 * toolbox for HD-DOT image reconstruction from WUSTL-ORL.
 * 
 * Reference: Markow et al. (2025) "Ultra high density imaging arrays in 
 * diffuse optical tomography" Scientific Reports 15, 3175
 */
function exportNeuroDOT() {
    const wavelengths = [685, 830];  // Standard DOT wavelengths (nm)
    
    // Build SD pair matrix (source-detector measurements)
    // NeuroDOT expects: [nMeasurements x 4] with [srcIdx, detIdx, wavelengthIdx, isGood]
    const sdPairs = [];
    for (const ch of AppState.channels) {
        for (let wl = 0; wl < wavelengths.length; wl++) {
            sdPairs.push({
                srcIdx: ch.sourceId + 1,  // 1-indexed for MATLAB compatibility
                detIdx: ch.detectorId + 1,
                wavelengthIdx: wl + 1,
                distance: ch.distance,
                isGood: 1
            });
        }
    }
    
    // Build source/detector position matrices
    // NeuroDOT expects positions in [N x 3] format, typically in mm
    const srcPos = AppState.sources.map(s => [s.x, s.y, s.z]);
    const detPos = AppState.detectors.map(d => [d.x, d.y, d.z]);
    
    // Build encoding matrix (time-division multiplexing schedule)
    // This encodes which sources are on during each time slot
    const nSlots = parseInt(DOM.nTimeslots?.value) || 8;
    const encodingMatrix = [];
    
    for (let slot = 1; slot <= nSlots; slot++) {
        const slotSources = AppState.sources
            .filter(s => AppState.coloring[s.id] === slot)
            .map(s => s.id + 1);  // 1-indexed
        encodingMatrix.push({
            slot: slot,
            sources: slotSources,
            duty_cycle: 0.5  // 50% duty cycle as in UHD-DOT paper
        });
    }
    
    const data = {
        format: 'neurodot-compatible',
        version: '1.0',
        created: new Date().toISOString(),
        generator: 'NOMAD Web v2.0',
        
        // Probe geometry (compatible with NeuroDOT info structure)
        info: {
            system: {
                framerate: 7.33,  // Hz, typical for HD-DOT
                wavelengths: wavelengths
            },
            optodes: {
                nSrc: AppState.sources.length,
                nDet: AppState.detectors.length,
                srcPos3D: srcPos,
                detPos3D: detPos,
                srcLabels: AppState.sources.map(s => s.label),
                detLabels: AppState.detectors.map(d => d.label)
            },
            pairs: {
                nPairs: sdPairs.length,
                srcIdx: sdPairs.map(p => p.srcIdx),
                detIdx: sdPairs.map(p => p.detIdx),
                wavelengthIdx: sdPairs.map(p => p.wavelengthIdx),
                distances: sdPairs.map(p => p.distance),
                isGood: sdPairs.map(p => p.isGood)
            }
        },
        
        // NOMAD-specific multiplexing information
        multiplexing: {
            nTimeSlots: nSlots,
            capacity: parseInt(DOM.capacity?.value) || 4,
            maxCrosstalkDistance: parseFloat(DOM.maxDistance?.value) || 60,
            encoding: encodingMatrix,
            coloring: AppState.coloring,
            algorithm: DOM.algorithm?.value || 'monte-carlo'
        },
        
        // Grid characteristics
        grid: {
            nearestNeighborSpacing: estimateGridSpacing(),
            coverage: calculateCoverage()
        },
        
        // Conflict graph (for validation/debugging)
        conflictGraph: {
            nEdges: AppState.conflictGraph ? 
                Object.values(AppState.conflictGraph).reduce((sum, n) => sum + n.size, 0) / 2 : 0,
            adjacency: serializeConflictGraph()
        }
    };
    
    downloadFile(JSON.stringify(data, null, 2), 'montage_neurodot.json', 'application/json');
    addToExportLog('Created NeuroDOT-compatible JSON');
}

/**
 * Estimate the grid nearest-neighbor spacing from optode positions
 */
function estimateGridSpacing() {
    if (AppState.sources.length < 2) return 0;
    
    let minDist = Infinity;
    for (let i = 0; i < AppState.sources.length; i++) {
        for (let j = i + 1; j < AppState.sources.length; j++) {
            const d = distance3D(AppState.sources[i], AppState.sources[j]);
            if (d < minDist) minDist = d;
        }
    }
    return minDist === Infinity ? 0 : Math.round(minDist * 10) / 10;
}

/**
 * Calculate grid coverage area
 */
function calculateCoverage() {
    if (AppState.sources.length === 0) return { width: 0, height: 0, area: 0 };
    
    const allOptodes = [...AppState.sources, ...AppState.detectors];
    const xs = allOptodes.map(o => o.x);
    const ys = allOptodes.map(o => o.y);
    
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    
    return {
        width: Math.round(width),
        height: Math.round(height),
        area: Math.round(width * height)
    };
}

/**
 * Serialize conflict graph for export
 */
function serializeConflictGraph() {
    if (!AppState.conflictGraph) return {};
    
    const result = {};
    for (const [nodeId, neighbors] of Object.entries(AppState.conflictGraph)) {
        result[nodeId] = Array.from(neighbors);
    }
    return result;
}

function exportGdfFile() {
    const lines = [];
    
    lines.push(`# NOMAD Graph Definition File`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`# Nodes: ${AppState.sources.length}`);
    lines.push('');
    
    if (AppState.conflictGraph) {
        const seen = new Set();
        
        for (const [sourceId, neighbors] of Object.entries(AppState.conflictGraph)) {
            for (const neighborId of neighbors) {
                const key = [parseInt(sourceId), neighborId].sort().join('-');
                if (!seen.has(key)) {
                    lines.push(`${sourceId} ${neighborId}`);
                    seen.add(key);
                }
            }
        }
    }
    
    downloadFile(lines.join('\n'), 'conflict_graph.gdf', 'text/plain');
    addToExportLog('Created graph definition file');
}

function saveWorkspace() {
    const workspace = {
        version: '2.0',
        created: new Date().toISOString(),
        sources: AppState.sources,
        detectors: AppState.detectors,
        channels: AppState.channels,
        coloring: AppState.coloring,
        config: {
            maxDistance: parseFloat(DOM.maxDistance?.value),
            minDistance: parseFloat(DOM.minDistance?.value),
            nTimeSlots: parseInt(DOM.nTimeslots?.value),
            capacity: parseInt(DOM.capacity?.value),
            algorithm: DOM.algorithm?.value,
            nTrials: parseInt(DOM.nTrials?.value)
        }
    };
    
    downloadFile(JSON.stringify(workspace, null, 2), 'nomad_workspace.json', 'application/json');
    addToExportLog('Saved workspace data');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function addToExportLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    AppState.exportLog.push({ time: timestamp, message });
    
    if (DOM.exportLog) {
        DOM.exportLog.innerHTML = AppState.exportLog
            .slice(-10)
            .reverse()
            .map(entry => `<div class="log-entry success">[${entry.time}] ${entry.message}</div>`)
            .join('');
    }
}

// ============================================================
// Utilities
// ============================================================
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ============================================================
// ROI-Based Montage Design
// ============================================================

function setupROIMode() {
    // Mode toggle buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.dataset.mode;
            document.querySelectorAll('.mode-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${mode}-mode`)?.classList.add('active');
            
            if (mode === 'roi') {
                // Initialize 3D brain viewer if not already initialized
                const roi3dContainer = document.getElementById('roi-3d-container');
                if (roi3dContainer && !AppState.three.roi) {
                    init3DScene(roi3dContainer, 'roi');
                    // Always enable brain parcellation for ROI mode
                    // Force update the view to show brain regions
                    setTimeout(() => {
                        if (AppState.three.roi) {
                            update3DOptodes('roi', false);
                        }
                    }, 100);
                }
            }
        });
    });
    
    // Load MNE-NIRS example button
    document.getElementById('load-mne-example')?.addEventListener('click', loadMNENIRSExample);
    
    // Generate button
    document.getElementById('btn-generate-roi')?.addEventListener('click', generateROIMontage);
    document.getElementById('btn-clear-roi')?.addEventListener('click', clearROISelection);
}

function renderROICanvas() {
    const canvas = document.getElementById('roi-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = Math.min(canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const headRadius = size * 0.38;
    
    // Scale factor from MNE mm to canvas pixels
    const scale = headRadius / MNE_SCALE;
    
    // Clear and draw background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw head outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, headRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw nose
    const noseSize = headRadius * 0.12;
    ctx.beginPath();
    ctx.moveTo(cx - noseSize * 0.5, cy - headRadius);
    ctx.lineTo(cx, cy - headRadius - noseSize);
    ctx.lineTo(cx + noseSize * 0.5, cy - headRadius);
    ctx.stroke();
    
    // Draw ears
    const earWidth = headRadius * 0.08;
    const earHeight = headRadius * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx - headRadius - earWidth * 0.3, cy, earWidth, earHeight, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + headRadius + earWidth * 0.3, cy, earWidth, earHeight, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw 10-20 electrode positions (if available and checkbox is checked)
    const showElectrodes = document.getElementById('show-electrodes')?.checked;
    if (showElectrodes && Object.keys(ELECTRODES_1020).length > 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#888';
        ctx.font = '8px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (const [name, electrode] of Object.entries(ELECTRODES_1020)) {
            // Only show main 10-20 positions (not extended 10-10)
            if (name.length <= 3 || name.match(/^(Fp|F|C|P|O|T|A|M)[zpz]?[1-8]?$/i)) {
                const pos = electrodeToCanvas(electrode, cx, cy, headRadius);
                
                // Check if position is within head outline
                const distFromCenter = Math.sqrt(Math.pow(pos.x - cx, 2) + Math.pow(pos.y - cy, 2));
                if (distFromCenter <= headRadius * 1.1) {
                    // Draw electrode marker
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Draw label
                    ctx.fillText(name, pos.x, pos.y - 8);
                }
            }
        }
        ctx.globalAlpha = 1;
    }
    
    // Draw brain regions
    // Regions are sized large because only the center area is effectively imaged by fNIRS
    for (const [name, region] of Object.entries(BRAIN_REGIONS)) {
        const pos = regionToCanvas(region, cx, cy, headRadius);
        
        // Convert region radius from mm to canvas pixels
        const regionRadius = region.radius * scale;
        
        const isSelected = ROIState.selectedRegions.has(name);
        const isHovered = ROIState.hoveredRegion === name;
        
        // Skip regions that are outside the visible area
        const distFromCenter = Math.sqrt(Math.pow(pos.x - cx, 2) + Math.pow(pos.y - cy, 2));
        if (distFromCenter > headRadius * 1.5) continue;
        
        // Region fill
        ctx.globalAlpha = isSelected ? 0.7 : (isHovered ? 0.5 : 0.25);
        ctx.fillStyle = region.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, regionRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Region border
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isSelected ? '#fff' : (isHovered ? '#fff' : region.color);
        ctx.lineWidth = isSelected ? 3 : (isHovered ? 2 : 1);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, regionRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Label
        if (isSelected || isHovered) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(region.label, pos.x, pos.y);
        }
    }
    
    // Draw fiducials if available
    if (FIDUCIALS.nasion) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#00ff00';  // Green for nasion
        const nasPos = electrodeToCanvas({x: FIDUCIALS.nasion[0], y: FIDUCIALS.nasion[1]}, cx, cy, headRadius);
        ctx.beginPath();
        ctx.arc(nasPos.x, nasPos.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Labels
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#666';
    ctx.font = '10px Source Sans 3';
    ctx.textAlign = 'center';
    ctx.fillText('Anterior (Nose)', cx, cy - headRadius - noseSize - 12);
    ctx.fillText('Posterior', cx, cy + headRadius + 14);
    ctx.fillText('L', cx - headRadius - earWidth - 12, cy);
    ctx.fillText('R', cx + headRadius + earWidth + 12, cy);
    
    // Instructions
    ctx.fillStyle = '#888';
    ctx.font = '11px Source Sans 3';
    ctx.fillText('Click regions to select coverage area', cx, canvas.height - 10);
}

/**
 * Convert MNE head coordinates to canvas position
 * MNE uses RAS coordinate system:
 *   X: left ear (-) to right ear (+)
 *   Y: back of head (-) to nose (+) [anterior-posterior]
 *   Z: bottom/neck (-) to top of head (+) [inferior-superior]
 * 
 * For standard top-down view (looking down at head from above):
 *   Canvas X = MNE X (left/right preserved)
 *   Canvas Y = -MNE Y (flip so nose/anterior is at top of canvas)
 *   
 * @param {Object} region - Region with x, y, z coordinates in mm
 * @param {number} cx - Canvas center X
 * @param {number} cy - Canvas center Y  
 * @param {number} headRadius - Head radius on canvas in pixels
 */
function regionToCanvas(region, cx, cy, headRadius) {
    // Check if this is old spherical format or new MNE format
    if (region.theta !== undefined && region.phi !== undefined) {
        // Old spherical format - convert to canvas
        const rProj = region.phi / (Math.PI / 2);
        return {
            x: cx + rProj * headRadius * Math.sin(region.theta),
            y: cy - rProj * headRadius * Math.cos(region.theta)
        };
    }
    
    // New MNE format - convert 3D coordinates to 2D topographic view
    // MNE/MNI coordinates: X=left(-)/right(+), Y=posterior(-)/anterior(+), Z=inferior(-)/superior(+)
    // For standard top-down view (looking down at head from above, nose at top):
    //   Canvas X: maps to MNI X (left/right)
    //   Canvas Y: maps to MNI Y (anterior/posterior, with anterior/nose at top)
    // Scale: typical head radius is ~100mm, we map to headRadius pixels
    const scale = headRadius / MNE_SCALE;
    
    return {
        x: cx + region.x * scale,        // Left(-) on left, Right(+) on right
        y: cy - region.y * scale         // Anterior(+Y/nose) at top (negative canvas Y), Posterior(-Y) at bottom
    };
}

/**
 * Convert MNE coordinates to 3D position for Three.js
 * Returns position in Three.js coordinate system
 */
function mneToThreeJS(x, y, z) {
    // MNE: X=right, Y=anterior, Z=superior
    // Three.js: X=right, Y=up, Z=forward
    return {
        x: x / 1000,   // Convert mm to meters
        y: z / 1000,   // MNE Z becomes Three.js Y (up)
        z: y / 1000    // MNE Y becomes Three.js Z (forward)
    };
}

/**
 * Get electrode position on canvas
 * Uses same coordinate transformation as regionToCanvas for consistency
 */
function electrodeToCanvas(electrode, cx, cy, headRadius) {
    const scale = headRadius / MNE_SCALE;
    return {
        x: cx + electrode.x * scale,        // Left(-) on left, Right(+) on right
        y: cy - electrode.y * scale         // Anterior(+Y/nose) at top, Posterior(-Y) at bottom
    };
}

function canvasToRegion(x, y, canvas) {
    const size = Math.min(canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const headRadius = size * 0.38;
    
    // Scale factor from MNE mm to canvas pixels
    const scale = headRadius / MNE_SCALE;
    
    // Check each region (check smaller regions first for better hit detection)
    const sortedRegions = Object.entries(BRAIN_REGIONS)
        .sort((a, b) => a[1].radius - b[1].radius);
    
    for (const [name, region] of sortedRegions) {
        const pos = regionToCanvas(region, cx, cy, headRadius);
        
        // Convert region radius from mm to canvas pixels
        const regionRadius = region.radius * scale;
        
        const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
        if (dist <= regionRadius) {
            return name;
        }
    }
    
    return null;
}

function handleROIClick(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    const region = canvasToRegion(x, y, canvas);
    
    if (region) {
        if (ROIState.selectedRegions.has(region)) {
            ROIState.selectedRegions.delete(region);
        } else {
            ROIState.selectedRegions.add(region);
        }
        
        updateROISelectedDisplay();
        renderROICanvas();
    }
}

function handleROIHover(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    const region = canvasToRegion(x, y, canvas);
    
    if (region !== ROIState.hoveredRegion) {
        ROIState.hoveredRegion = region;
        renderROICanvas();
    }
}

function updateROISelectedDisplay() {
    const display = document.getElementById('roi-selected');
    if (!display) return;
    
    // Use brain surface regions if available, otherwise fallback to old ROI system
    const selectedRegions = BRAIN_SURFACE.selectedRegions.size > 0 
        ? BRAIN_SURFACE.selectedRegions 
        : ROIState.selectedRegions;
    
    if (selectedRegions.size === 0) {
        display.innerHTML = '<span class="placeholder">Click regions on 3D brain to select</span>';
    } else {
        const tags = Array.from(selectedRegions).map(name => {
            // Try to get region info from BRAIN_REGIONS, or just show the name
            const region = BRAIN_REGIONS[name];
            const color = region ? region.color : '#3498db';
            const label = region ? region.label : name;
            return `<span class="region-tag" style="background: ${color}; padding: 4px 8px; margin: 2px; border-radius: 3px; display: inline-block; color: white; font-size: 11px;">${label}</span>`;
        }).join('');
        display.innerHTML = tags;
    }
}

function clearROISelection() {
    ROIState.selectedRegions.clear();
    BRAIN_SURFACE.selectedRegions.clear();
    updateROISelectedDisplay();
    
    // Update 3D brain visualization in all views
    if (AppState.three.roi) {
        colorBrainByParcellation();
        update3DOptodes('roi', false);
    }
    if (AppState.three.preview) update3DOptodes('preview', false);
    if (AppState.three.schematic) update3DOptodes('schematic', true);
    if (AppState.three.assign) update3DOptodes('assign', true);
    
    console.log('Cleared ROI selection');
}

function generateROIMontage() {
    // Get hardware limits from configuration settings
    const maxSources = parseInt(DOM.nSources?.value) || 32;
    const maxDetectors = parseInt(DOM.nDetectors?.value) || 15;
    
    // Use brain surface selection if available, otherwise fall back to old ROI system
    let regionNames;
    if (BRAIN_SURFACE.selectedRegions && BRAIN_SURFACE.selectedRegions.size > 0) {
        regionNames = Array.from(BRAIN_SURFACE.selectedRegions);
        // Sync to old ROI state for compatibility
        ROIState.selectedRegions = new Set(regionNames);
    } else {
        regionNames = Array.from(ROIState.selectedRegions);
    }
    
    // If no regions selected, distribute over whole head
    if (regionNames.length === 0) {
        console.log('No ROI selected, distributing evenly over whole head');
    }
    
    const result = selectGridPositionsForRegions(regionNames, maxSources, maxDetectors);
    
    const sources = result.sources;
    const detectors = result.detectors;
    
    // Update app state
    AppState.sources = sources;
    AppState.detectors = detectors;
    
    // Build channels and conflict graph
    buildChannels();
    
    // Update UI
    const nRegions = regionNames.length;
    const regionText = nRegions === 0 ? 'whole head' : 
                      `${nRegions} region${nRegions > 1 ? 's' : ''}`;
    const utilizationNote = sources.length < maxSources || detectors.length < maxDetectors
        ? ` (using ${sources.length}/${maxSources}S, ${detectors.length}/${maxDetectors}D available)`
        : ' (full hardware utilization)';
    
    DOM.fileInfo.innerHTML = `<span class="text-success">✓ Generated ${sources.length}S / ${detectors.length}D from ${regionText}${utilizationNote}</span>`;
    
    updateStats();
    renderPreview();
    renderSchematic();
    renderAssignCanvas();
    
    console.log(`Generated ROI montage: ${sources.length} sources, ${detectors.length} detectors from ${regionText}`);
}

/**
 * Update the display of selected ROIs in the UI
 * Note: selected-rois-display element removed from main settings panel
 * This function now only logs to console for backward compatibility
 */
function updateSelectedROIsDisplay() {
    const display = document.getElementById('selected-rois-display');
    const selected = Array.from(BRAIN_SURFACE.selectedRegions);
    
    // Update display if it exists (for backward compatibility)
    if (display) {
        if (selected.length === 0) {
            display.textContent = 'No regions selected';
            display.style.color = '#999';
        } else {
            display.textContent = `Selected: ${selected.join(', ')}`;
            display.style.color = '#27ae60';
        }
    }
    
    // Log for debugging
    if (selected.length > 0) {
        console.log('Selected ROIs:', selected.join(', '));
    }
}

function generateOptimizedRegionOptodes(region, nSources, nDetectors, spacing, priority) {
    const sources = [];
    const detectors = [];
    
    // Check if region uses MNE coordinates (x,y,z) or old spherical (theta,phi)
    if (region.x !== undefined && region.y !== undefined) {
        // MNE format - coordinates in mm
        return generateOptimizedRegionOptodesMNE(region, nSources, nDetectors, spacing, priority);
    }
    
    // Legacy spherical format
    const r = HEAD.radius;
    const centerTheta = region.theta;
    const centerPhi = region.phi;
    const regionRadius = region.radius;
    
    // Spacing in radians (approximate conversion from mm to radians on head surface)
    const spacingRad = spacing / r;
    
    // Generate source positions in a grid pattern within the region
    const gridSize = Math.ceil(Math.sqrt(nSources + nDetectors));
    
    let placedSources = 0;
    let placedDetectors = 0;
    
    // Calculate target source/detector ratio
    const totalOptodes = nSources + nDetectors;
    const sourceRatio = nSources / totalOptodes;
    
    for (let i = 0; i < gridSize && (placedSources < nSources || placedDetectors < nDetectors); i++) {
        for (let j = 0; j < gridSize && (placedSources < nSources || placedDetectors < nDetectors); j++) {
            // Offset from center
            const offsetTheta = (i - gridSize/2 + 0.5) * spacingRad * 0.8;
            const offsetPhi = (j - gridSize/2 + 0.5) * spacingRad * 0.8;
            
            const theta = centerTheta + offsetTheta;
            const phi = Math.max(0.1, Math.min(0.85, centerPhi + offsetPhi)); // Clamp to valid range
            
            // Check if within region bounds (roughly)
            const distFromCenter = Math.sqrt(offsetTheta*offsetTheta + offsetPhi*offsetPhi);
            if (distFromCenter > regionRadius * 1.2) continue;
            
            // Convert to cartesian
            const pos = sphericalToCartesian(theta, phi, r);
            
            // Use checkerboard pattern to intersperse sources and detectors
            const isSourceCell = (i + j) % 2 === 0;
            
            // Balance the ratio
            const currentSourceRatio = placedSources / Math.max(1, placedSources + placedDetectors);
            const needMoreSources = currentSourceRatio < sourceRatio - 0.1;
            const needMoreDetectors = currentSourceRatio > sourceRatio + 0.1;
            
            // Decide whether to place source or detector
            let placeSource;
            if (placedSources >= nSources) {
                placeSource = false;
            } else if (placedDetectors >= nDetectors) {
                placeSource = true;
            } else if (needMoreSources) {
                placeSource = true;
            } else if (needMoreDetectors) {
                placeSource = false;
            } else {
                placeSource = isSourceCell;
            }
            
            if (placeSource) {
                sources.push(pos);
                placedSources++;
            } else {
                detectors.push(pos);
                placedDetectors++;
            }
        }
    }
    
    // Add remaining optodes in rings, alternating between sources and detectors
    let ringIndex = 0;
    while (placedSources < nSources || placedDetectors < nDetectors) {
        const angle = ringIndex * (2 * Math.PI / 8);
        const ringRadius = regionRadius * (0.4 + 0.2 * (ringIndex % 3));
        
        const theta = centerTheta + ringRadius * Math.sin(angle);
        const phi = Math.max(0.1, Math.min(0.85, centerPhi + ringRadius * Math.cos(angle)));
        
        const pos = sphericalToCartesian(theta, phi, r);
        
        // Alternate based on current ratio
        const currentSourceRatio = placedSources / Math.max(1, placedSources + placedDetectors);
        const shouldPlaceSource = currentSourceRatio < sourceRatio;
        
        if (shouldPlaceSource && placedSources < nSources) {
            sources.push(pos);
            placedSources++;
        } else if (placedDetectors < nDetectors) {
            detectors.push(pos);
            placedDetectors++;
        } else if (placedSources < nSources) {
            sources.push(pos);
            placedSources++;
        }
        
        ringIndex++;
    }
    
    return { sources, detectors };
}

/**
 * Generate optodes for a region using MNE coordinates (x, y, z in mm)
 */
function generateOptimizedRegionOptodesMNE(region, nSources, nDetectors, spacing, priority) {
    const sources = [];
    const detectors = [];
    
    // Region center in MNE coordinates (mm)
    // Project region center onto standard head surface
    const centerLen = Math.sqrt(region.x*region.x + region.y*region.y + region.z*region.z);
    const headR = HEAD.radius;
    const cx = (region.x / centerLen) * headR;
    const cy = (region.y / centerLen) * headR;
    const cz = (region.z / centerLen) * headR;
    const regionRadius = region.radius || 30; // mm
    
    // Generate a grid of positions in the tangent plane at the region center
    const gridSize = Math.ceil(Math.sqrt(nSources + nDetectors));
    
    // Calculate tangent plane basis vectors
    // Normal vector pointing outward from head center (already normalized)
    const nx = cx / headR;
    const ny = cy / headR;
    const nz = cz / headR;
    
    // Find two perpendicular tangent vectors
    // Use cross product with a non-parallel vector
    let tx, ty, tz;
    if (Math.abs(nz) < 0.9) {
        // Cross with Z axis
        tx = -ny;
        ty = nx;
        tz = 0;
    } else {
        // Cross with X axis  
        tx = 0;
        ty = -nz;
        tz = ny;
    }
    const tLen = Math.sqrt(tx*tx + ty*ty + tz*tz);
    tx /= tLen; ty /= tLen; tz /= tLen;
    
    // Second tangent vector (cross of normal and first tangent)
    const ux = ny * tz - nz * ty;
    const uy = nz * tx - nx * tz;
    const uz = nx * ty - ny * tx;
    
    let placedSources = 0;
    let placedDetectors = 0;
    
    // Calculate target source/detector ratio
    const totalOptodes = nSources + nDetectors;
    const sourceRatio = nSources / totalOptodes;
    
    // Generate grid in tangent plane with interspersed sources and detectors
    for (let i = 0; i < gridSize && (placedSources < nSources || placedDetectors < nDetectors); i++) {
        for (let j = 0; j < gridSize && (placedSources < nSources || placedDetectors < nDetectors); j++) {
            // Offset from center in tangent plane (mm)
            const offsetT = (i - gridSize/2 + 0.5) * spacing * 0.8;
            const offsetU = (j - gridSize/2 + 0.5) * spacing * 0.8;
            
            // Check if within region bounds
            const distFromCenter = Math.sqrt(offsetT*offsetT + offsetU*offsetU);
            if (distFromCenter > regionRadius * 0.8) continue;
            
            // Position in tangent plane
            const px = cx + offsetT * tx + offsetU * ux;
            const py = cy + offsetT * ty + offsetU * uy;
            const pz = cz + offsetT * tz + offsetU * uz;
            
            // Project onto head surface (scale to same radius as head)
            const pLen = Math.sqrt(px*px + py*py + pz*pz);
            const scale = headR / pLen;
            
            const pos = {
                x: px * scale,
                y: py * scale,
                z: pz * scale
            };
            
            // Use checkerboard pattern to intersperse sources and detectors
            const isSourceCell = (i + j) % 2 === 0;
            
            // Also balance the ratio
            const currentSourceRatio = placedSources / Math.max(1, placedSources + placedDetectors);
            const needMoreSources = currentSourceRatio < sourceRatio - 0.1;
            const needMoreDetectors = currentSourceRatio > sourceRatio + 0.1;
            
            // Decide whether to place source or detector
            let placeSource;
            if (placedSources >= nSources) {
                placeSource = false;
            } else if (placedDetectors >= nDetectors) {
                placeSource = true;
            } else if (needMoreSources) {
                placeSource = true;
            } else if (needMoreDetectors) {
                placeSource = false;
            } else {
                placeSource = isSourceCell;
            }
            
            if (placeSource) {
                sources.push(pos);
                placedSources++;
            } else {
                detectors.push(pos);
                placedDetectors++;
            }
        }
    }
    
    // Add remaining optodes in concentric rings, alternating between sources and detectors
    let ringIndex = 0;
    const totalRemaining = (nSources - placedSources) + (nDetectors - placedDetectors);
    
    while (placedSources < nSources || placedDetectors < nDetectors) {
        // Alternate rings between sources and detectors for good interleaving
        const ringRadius = regionRadius * (0.4 + 0.3 * (ringIndex % 3) / 2);
        const optodesInRing = Math.min(8, totalRemaining - ringIndex);
        
        for (let k = 0; k < optodesInRing && (placedSources < nSources || placedDetectors < nDetectors); k++) {
            const angle = (k / optodesInRing) * 2 * Math.PI + (ringIndex * Math.PI / optodesInRing);
            
            const offsetT = ringRadius * Math.cos(angle);
            const offsetU = ringRadius * Math.sin(angle);
            
            const px = cx + offsetT * tx + offsetU * ux;
            const py = cy + offsetT * ty + offsetU * uy;
            const pz = cz + offsetT * tz + offsetU * uz;
            
            const pLen = Math.sqrt(px*px + py*py + pz*pz);
            const scale = headR / pLen;
            
            const pos = {
                x: px * scale,
                y: py * scale,
                z: pz * scale
            };
            
            // Alternate based on position in ring
            const currentSourceRatio = placedSources / Math.max(1, placedSources + placedDetectors);
            const shouldPlaceSource = (k % 2 === 0) ? 
                (currentSourceRatio < sourceRatio) : 
                (currentSourceRatio <= sourceRatio);
            
            if (shouldPlaceSource && placedSources < nSources) {
                sources.push(pos);
                placedSources++;
            } else if (placedDetectors < nDetectors) {
                detectors.push(pos);
                placedDetectors++;
            } else if (placedSources < nSources) {
                sources.push(pos);
                placedSources++;
            }
            
            ringIndex++;
        }
    }
    
    return { sources, detectors };
}

// ============================================================
// Initialization
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    DOM.init();
    
    // Load MNE anatomy data first (before rendering)
    await loadMNEAnatomy();
    
    // Initialize grid system from electrode positions
    initializeGridSystem();
    
    setupNavigation();
    setupFileImport();
    setupEventHandlers();
    setupViewToggles();
    setupROIMode();
    
    renderPreview();
    
    console.log('NOMAD Web Edition v2.0 initialized');
    console.log('Features: Topographic head view, 3D brain visualization, ROI-based design, MNE-NIRS compatibility');
    console.log(`Brain regions: ${Object.keys(BRAIN_REGIONS).length}, Electrodes: ${Object.keys(ELECTRODES_1020).length}`);
    console.log(`Grid system: ${GridSystem.positions.length} standardized positions available`);
});
