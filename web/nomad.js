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

// Initialize default brain regions (will be replaced with MNE data when loaded)
BRAIN_REGIONS = {
    'Left Prefrontal Cortex': { x: -29.44, y: 83.92, z: -6.99, radius: 45, color: '#e74c3c', label: 'PFC-L' },
    'Right Prefrontal Cortex': { x: 29.87, y: 84.9, z: -7.08, radius: 45, color: '#e74c3c', label: 'PFC-R' },
    'Medial Prefrontal Cortex': { x: 0.11, y: 88.25, z: -1.71, radius: 40, color: '#9b59b6', label: 'mPFC' },
    'Left Dorsolateral Prefrontal': { x: -60.25, y: 47.79, z: 15.39, radius: 40, color: '#3498db', label: 'DLPFC-L' },
    'Right Dorsolateral Prefrontal': { x: 62.44, y: 49.36, z: 14.41, radius: 40, color: '#3498db', label: 'DLPFC-R' },
    'Left Primary Motor Cortex': { x: -65.36, y: -11.63, z: 64.36, radius: 40, color: '#2ecc71', label: 'M1-L' },
    'Right Primary Motor Cortex': { x: 67.12, y: -10.9, z: 63.58, radius: 40, color: '#2ecc71', label: 'M1-R' },
    'Supplementary Motor Area': { x: 0.4, y: -9.17, z: 100.24, radius: 35, color: '#27ae60', label: 'SMA' }
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
    for (const [key, pos] of Object.entries(FNIRS_EXAMPLE.sources)) {
        sources.push({
            id: sourceId++,
            x: pos.x,
            y: pos.y,
            z: pos.z,
            label: pos.label || key
        });
    }
    
    let detectorId = 0;
    for (const [key, pos] of Object.entries(FNIRS_EXAMPLE.detectors)) {
        // Skip duplicates (same position with different names)
        const isDuplicate = detectors.some(d => 
            Math.abs(d.x - pos.x) < 0.1 && 
            Math.abs(d.y - pos.y) < 0.1 && 
            Math.abs(d.z - pos.z) < 0.1
        );
        if (!isDuplicate) {
            detectors.push({
                id: detectorId++,
                x: pos.x,
                y: pos.y,
                z: pos.z,
                label: pos.label || key
            });
        }
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
 */
function initializeFallbackRegions() {
    BRAIN_REGIONS = {
        'Left Prefrontal Cortex': { x: -29.44, y: 83.92, z: -6.99, radius: 45, color: '#e74c3c', label: 'PFC-L' },
        'Right Prefrontal Cortex': { x: 29.87, y: 84.9, z: -7.08, radius: 45, color: '#e74c3c', label: 'PFC-R' },
        'Medial Prefrontal Cortex': { x: 0.11, y: 88.25, z: -1.71, radius: 40, color: '#9b59b6', label: 'mPFC' },
        'Left Dorsolateral Prefrontal': { x: -60.25, y: 47.79, z: 15.39, radius: 40, color: '#3498db', label: 'DLPFC-L' },
        'Right Dorsolateral Prefrontal': { x: 62.44, y: 49.36, z: 14.41, radius: 40, color: '#3498db', label: 'DLPFC-R' },
        'Left Primary Motor Cortex': { x: -65.36, y: -11.63, z: 64.36, radius: 40, color: '#2ecc71', label: 'M1-L' },
        'Right Primary Motor Cortex': { x: 67.12, y: -10.9, z: 63.58, radius: 40, color: '#2ecc71', label: 'M1-R' },
        'Supplementary Motor Area': { x: 0.4, y: -9.17, z: 100.24, radius: 35, color: '#27ae60', label: 'SMA' },
        'Left Superior Temporal': { x: -84.16, y: -16.02, z: -9.35, radius: 40, color: '#fd79a8', label: 'STG-L' },
        'Right Superior Temporal': { x: 85.08, y: -15.02, z: -9.49, radius: 40, color: '#fd79a8', label: 'STG-R' },
        'Left Inferior Parietal': { x: -53.01, y: -78.79, z: 55.94, radius: 40, color: '#f39c12', label: 'IPL-L' },
        'Right Inferior Parietal': { x: 55.67, y: -78.56, z: 56.56, radius: 40, color: '#f39c12', label: 'IPL-R' },
        'Left Visual Cortex': { x: -29.41, y: -112.45, z: 8.84, radius: 40, color: '#6c5ce7', label: 'V1-L' },
        'Right Visual Cortex': { x: 29.84, y: -112.16, z: 8.8, radius: 40, color: '#6c5ce7', label: 'V1-R' },
        'Medial Visual Cortex': { x: 0.11, y: -114.89, z: 14.66, radius: 40, color: '#00cec9', label: 'V1-M' }
    };
    console.log('Using fallback brain regions');
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
    
    return { sources, detectors };
}

/**
 * Generate example montage with realistic fNIRS positions
 * Covers frontal, parietal, temporal, and occipital regions
 */
function loadExampleMontage() {
    const nSources = parseInt(DOM.nSources.value) || 32;
    const nDetectors = parseInt(DOM.nDetectors.value) || 15;
    
    const sources = [];
    const detectors = [];
    
    // Generate positions on a realistic head model
    // Using 10-20 system-like distribution
    
    // Detector positions - spread across scalp
    const detectorPositions = generateOptodeGrid(nDetectors, 'detector');
    for (let i = 0; i < detectorPositions.length; i++) {
        detectors.push({
            id: i,
            ...detectorPositions[i],
            label: `D${i + 1}`
        });
    }
    
    // Source positions - interleaved with detectors
    const sourcePositions = generateOptodeGrid(nSources, 'source');
    for (let i = 0; i < sourcePositions.length; i++) {
        sources.push({
            id: i,
            ...sourcePositions[i],
            label: `S${i + 1}`
        });
    }
    
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
    
    // 1. Add PAIRS (white lines connecting sources to detectors)
    for (const channel of AppState.channels) {
        const source = AppState.sources.find(s => s.id === channel.sourceId);
        const detector = AppState.detectors.find(d => d.id === channel.detectorId);
        
        if (source && detector) {
            const slot = AppState.coloring[source.id] || 0;
            
            // Pair line color - white by default (MNE style), colored when time slot assigned
            let lineColor;
            if (showColors && slot > 0) {
                lineColor = new THREE.Color(getSlotColor(slot));
            } else {
                lineColor = new THREE.Color(0xffffff);  // White pairs (MNE style)
            }
            
            const points = [
                new THREE.Vector3(source.x, source.y, source.z),
                new THREE.Vector3(detector.x, detector.y, detector.z)
            ];
            
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: lineColor,
                opacity: showColors && slot > 0 ? 0.9 : 0.6,
                transparent: true
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            scene.add(line);
            optodeObjects.push(line);
            
            // 2. Add CHANNEL marker (orange dot at midpoint - MNE style)
            const midX = (source.x + detector.x) / 2;
            const midY = (source.y + detector.y) / 2;
            const midZ = (source.z + detector.z) / 2;
            
            const midGeometry = new THREE.SphereGeometry(2.5, 12, 12);
            const midMaterial = new THREE.MeshBasicMaterial({ 
                color: showColors && slot > 0 ? lineColor : 0xff8c00  // Orange (MNE style)
            });
            const midpoint = new THREE.Mesh(midGeometry, midMaterial);
            midpoint.position.set(midX, midY, midZ);
            midpoint.userData = { 
                type: 'channel', 
                sourceId: source.id, 
                detectorId: detector.id,
                distance: channel.distance
            };
            scene.add(midpoint);
            optodeObjects.push(midpoint);
        }
    }
    
    // 3. Add DETECTORS (black dots - MNE style)
    for (const det of AppState.detectors) {
        // Use sphere for consistency with MNE (which shows "black dots")
        const geometry = new THREE.SphereGeometry(5, 16, 16);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x111111,  // Black (MNE style)
            emissive: 0x111111,
            shininess: 30
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(det.x, det.y, det.z);
        mesh.userData = { type: 'detector', id: det.id, label: det.label };
        
        scene.add(mesh);
        optodeObjects.push(mesh);
    }
    
    // 4. Add SOURCES (red dots - MNE style, or colored by time slot)
    for (const src of AppState.sources) {
        const slot = AppState.coloring[src.id] || 0;
        
        let sourceColor;
        if (showColors && slot > 0) {
            sourceColor = new THREE.Color(getSlotColor(slot));
        } else {
            sourceColor = new THREE.Color(0xff0000);  // Red (MNE style for sources)
        }
        
        // Create source sphere (slightly larger than detector for distinction)
        const geometry = new THREE.SphereGeometry(6, 24, 24);
        const material = new THREE.MeshPhongMaterial({ 
            color: sourceColor,
            emissive: sourceColor.clone().multiplyScalar(0.15),
            shininess: 50
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(src.x, src.y, src.z);
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
                renderROICanvas();
            }
        });
    });
    
    // ROI canvas interactions
    const roiCanvas = document.getElementById('roi-canvas');
    if (roiCanvas) {
        roiCanvas.addEventListener('click', handleROIClick);
        roiCanvas.addEventListener('mousemove', handleROIHover);
        roiCanvas.addEventListener('mouseleave', () => {
            ROIState.hoveredRegion = null;
            renderROICanvas();
        });
    }
    
    // Show electrodes checkbox
    document.getElementById('show-electrodes')?.addEventListener('change', () => {
        renderROICanvas();
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
 *   X: right ear (+) to left ear (-)
 *   Y: back of head (-) to nose (+)
 *   Z: bottom (-) to top (+)
 * 
 * For topographic view (looking down from above):
 *   Canvas X = MNE X (right/left preserved)
 *   Canvas Y = -MNE Y (flip so nose is at top)
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
    // Scale: typical head radius is ~100mm, we map to headRadius pixels
    const scale = headRadius / MNE_SCALE;
    
    return {
        x: cx + region.x * scale,        // Right is positive
        y: cy - region.y * scale         // Nose (anterior/+Y) at top
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
 */
function electrodeToCanvas(electrode, cx, cy, headRadius) {
    const scale = headRadius / MNE_SCALE;
    return {
        x: cx + electrode.x * scale,
        y: cy - electrode.y * scale
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
    
    if (ROIState.selectedRegions.size === 0) {
        display.innerHTML = '<span class="placeholder">Click regions to select</span>';
    } else {
        const tags = Array.from(ROIState.selectedRegions).map(name => {
            const region = BRAIN_REGIONS[name];
            return `<span class="region-tag" style="background: ${region.color}">${region.label}</span>`;
        }).join('');
        display.innerHTML = tags;
    }
}

function clearROISelection() {
    ROIState.selectedRegions.clear();
    updateROISelectedDisplay();
    renderROICanvas();
}

function generateROIMontage() {
    if (ROIState.selectedRegions.size === 0) {
        alert('Please select at least one brain region!');
        return;
    }
    
    const density = document.getElementById('roi-density')?.value || 'medium';
    const priority = document.getElementById('roi-priority')?.value || 'coverage';
    
    // Get hardware limits from configuration settings
    const maxSources = parseInt(DOM.nSources?.value) || 32;
    const maxDetectors = parseInt(DOM.nDetectors?.value) || 15;
    const nRegions = ROIState.selectedRegions.size;
    
    // Density affects the SPACING between optodes, not the total count
    // Total count is determined by hardware limits distributed across regions
    const densityConfig = {
        'low': { spacing: 40, sourceDetectorRatio: 2 },      // Wide spacing
        'medium': { spacing: 30, sourceDetectorRatio: 2 },   // Standard HD-DOT spacing
        'high': { spacing: 22, sourceDetectorRatio: 2 },     // Dense spacing
        'hd': { spacing: 13, sourceDetectorRatio: 2.5 }      // UHD-DOT spacing (~6.5mm effective)
    };
    
    const config = densityConfig[density];
    
    // Distribute hardware-limited optodes across selected regions
    // Each region gets a fair share, rounded up to ensure we use available hardware
    const sourcesPerRegion = Math.ceil(maxSources / nRegions);
    const detectorsPerRegion = Math.ceil(maxDetectors / nRegions);
    
    // Use density setting to control spacing
    const spacing = config.spacing;
    
    // Generate optode positions for selected regions
    const sources = [];
    const detectors = [];
    let sourceId = 0;
    let detectorId = 0;
    
    for (const regionName of ROIState.selectedRegions) {
        const region = BRAIN_REGIONS[regionName];
        
        // Check if we've hit hardware limits
        const remainingSources = maxSources - sources.length;
        const remainingDetectors = maxDetectors - detectors.length;
        
        if (remainingSources <= 0 && remainingDetectors <= 0) {
            console.log(`Skipping region ${regionName} - hardware limits reached`);
            continue;
        }
        
        // Limit this region's optodes to what's remaining
        const regionSources = Math.min(sourcesPerRegion, remainingSources);
        const regionDetectors = Math.min(detectorsPerRegion, remainingDetectors);
        
        // Generate positions within this region
        const regionOptodes = generateOptimizedRegionOptodes(
            region, 
            regionSources, 
            regionDetectors,
            spacing,
            priority
        );
        
        // Add sources
        for (const pos of regionOptodes.sources) {
            if (sources.length >= maxSources) break;
            sources.push({
                id: sourceId++,
                x: pos.x,
                y: pos.y,
                z: pos.z,
                label: `S${sourceId}`,
                region: regionName
            });
        }
        
        // Add detectors
        for (const pos of regionOptodes.detectors) {
            if (detectors.length >= maxDetectors) break;
            detectors.push({
                id: detectorId++,
                x: pos.x,
                y: pos.y,
                z: pos.z,
                label: `D${detectorId}`,
                region: regionName
            });
        }
    }
    
    // Update app state
    AppState.sources = sources;
    AppState.detectors = detectors;
    
    // Build channels and conflict graph
    buildChannels();
    
    // Update UI - show how much of available hardware is used
    const utilizationNote = sources.length < maxSources || detectors.length < maxDetectors
        ? ` (using ${sources.length}/${maxSources}S, ${detectors.length}/${maxDetectors}D available)`
        : ' (full hardware utilization)';
    
    DOM.fileInfo.innerHTML = `<span class="text-success">✓ Generated ${sources.length}S / ${detectors.length}D from ${nRegions} region${nRegions > 1 ? 's' : ''}${utilizationNote}</span>`;
    
    updateStats();
    renderPreview();
    
    console.log(`Generated ROI montage: ${sources.length} sources, ${detectors.length} detectors (hardware: ${maxSources}S/${maxDetectors}D)`);
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
            
            // Alternate between sources and detectors for good interleaving
            const isSource = (i + j) % 2 === 0;
            
            if (isSource && placedSources < nSources) {
                sources.push(pos);
                placedSources++;
            } else if (!isSource && placedDetectors < nDetectors) {
                detectors.push(pos);
                placedDetectors++;
            } else if (placedSources < nSources) {
                sources.push(pos);
                placedSources++;
            } else if (placedDetectors < nDetectors) {
                detectors.push(pos);
                placedDetectors++;
            }
        }
    }
    
    // If we need more optodes, add them in a ring around the center
    while (placedSources < nSources) {
        const angle = (placedSources / nSources) * 2 * Math.PI;
        const ringRadius = regionRadius * 0.6;
        
        const theta = centerTheta + ringRadius * Math.sin(angle);
        const phi = Math.max(0.1, Math.min(0.85, centerPhi + ringRadius * Math.cos(angle)));
        
        sources.push(sphericalToCartesian(theta, phi, r));
        placedSources++;
    }
    
    while (placedDetectors < nDetectors) {
        const angle = (placedDetectors / nDetectors) * 2 * Math.PI + Math.PI / nDetectors;
        const ringRadius = regionRadius * 0.4;
        
        const theta = centerTheta + ringRadius * Math.sin(angle);
        const phi = Math.max(0.1, Math.min(0.85, centerPhi + ringRadius * Math.cos(angle)));
        
        detectors.push(sphericalToCartesian(theta, phi, r));
        placedDetectors++;
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
    const cx = region.x;
    const cy = region.y;
    const cz = region.z;
    const regionRadius = region.radius || 30; // mm
    
    // Calculate head surface radius at this location
    const headR = Math.sqrt(cx*cx + cy*cy + cz*cz);
    
    // Generate a grid of positions in the tangent plane at the region center
    const gridSize = Math.ceil(Math.sqrt(nSources + nDetectors));
    
    // Calculate tangent plane basis vectors
    // Normal vector pointing outward from head center
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
    
    // Generate grid in tangent plane
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
            
            // Alternate between sources and detectors
            const isSource = (i + j) % 2 === 0;
            
            if (isSource && placedSources < nSources) {
                sources.push(pos);
                placedSources++;
            } else if (!isSource && placedDetectors < nDetectors) {
                detectors.push(pos);
                placedDetectors++;
            } else if (placedSources < nSources) {
                sources.push(pos);
                placedSources++;
            } else if (placedDetectors < nDetectors) {
                detectors.push(pos);
                placedDetectors++;
            }
        }
    }
    
    // Add remaining optodes in rings around center
    while (placedSources < nSources) {
        const angle = (placedSources / nSources) * 2 * Math.PI;
        const ringRadius = regionRadius * 0.5;
        
        const offsetT = ringRadius * Math.cos(angle);
        const offsetU = ringRadius * Math.sin(angle);
        
        const px = cx + offsetT * tx + offsetU * ux;
        const py = cy + offsetT * ty + offsetU * uy;
        const pz = cz + offsetT * tz + offsetU * uz;
        
        const pLen = Math.sqrt(px*px + py*py + pz*pz);
        const scale = headR / pLen;
        
        sources.push({
            x: px * scale,
            y: py * scale,
            z: pz * scale
        });
        placedSources++;
    }
    
    while (placedDetectors < nDetectors) {
        const angle = (placedDetectors / nDetectors) * 2 * Math.PI + Math.PI / (nDetectors || 1);
        const ringRadius = regionRadius * 0.3;
        
        const offsetT = ringRadius * Math.cos(angle);
        const offsetU = ringRadius * Math.sin(angle);
        
        const px = cx + offsetT * tx + offsetU * ux;
        const py = cy + offsetT * ty + offsetU * uy;
        const pz = cz + offsetT * tz + offsetU * uz;
        
        const pLen = Math.sqrt(px*px + py*py + pz*pz);
        const scale = headR / pLen;
        
        detectors.push({
            x: px * scale,
            y: py * scale,
            z: pz * scale
        });
        placedDetectors++;
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
    
    setupNavigation();
    setupFileImport();
    setupEventHandlers();
    setupViewToggles();
    setupROIMode();
    
    renderPreview();
    
    console.log('NOMAD Web Edition v2.0 initialized');
    console.log('Features: Topographic head view, 3D brain visualization, ROI-based design, MNE-NIRS compatibility');
    console.log(`Brain regions: ${Object.keys(BRAIN_REGIONS).length}, Electrodes: ${Object.keys(ELECTRODES_1020).length}`);
});
