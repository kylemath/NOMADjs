#!/usr/bin/env python3
"""
Extract real anatomical data from MNE for NOMAD web app.

This script extracts:
1. Standard 10-20 electrode positions
2. fNIRS optode positions from MNE-NIRS example datasets
3. Brain region coordinates based on fsaverage parcellation
4. Channel/montage information

Requirements:
    pip install mne mne-nirs numpy

Usage:
    python extract_mne_anatomy.py

Output:
    - mne_anatomy.json - Real anatomical coordinates for NOMAD web
"""

import json
import numpy as np

def check_dependencies():
    """Check required packages."""
    missing = []
    
    try:
        import mne
        print(f"✓ MNE-Python version: {mne.__version__}")
    except ImportError:
        missing.append("mne")
    
    try:
        import mne_nirs
        print(f"✓ MNE-NIRS version: {mne_nirs.__version__}")
    except ImportError:
        print("○ MNE-NIRS not installed (optional, for fNIRS examples)")
    
    if missing:
        print(f"\nMissing: {missing}")
        print("Install with: pip install mne mne-nirs")
        return False
    return True


def get_standard_1020_positions():
    """
    Get standard 10-20 electrode positions from MNE.
    These are well-validated positions used across neuroimaging.
    """
    import mne
    
    # Get standard 10-20 montage
    montage = mne.channels.make_standard_montage('standard_1020')
    
    # Get positions (in meters, convert to mm)
    positions = montage.get_positions()
    ch_pos = positions['ch_pos']
    
    # Extract relevant positions
    electrode_positions = {}
    for name, pos in ch_pos.items():
        # Convert to mm and round
        pos_mm = (pos * 1000).tolist()
        electrode_positions[name] = {
            'x': round(pos_mm[0], 2),
            'y': round(pos_mm[1], 2),
            'z': round(pos_mm[2], 2),
            'label': name
        }
    
    # Also get fiducials
    fiducials = {}
    if positions['nasion'] is not None:
        fiducials['nasion'] = (positions['nasion'] * 1000).tolist()
    if positions['lpa'] is not None:
        fiducials['lpa'] = (positions['lpa'] * 1000).tolist()
    if positions['rpa'] is not None:
        fiducials['rpa'] = (positions['rpa'] * 1000).tolist()
    
    return electrode_positions, fiducials


def get_1010_positions():
    """
    Get extended 10-10 system positions for higher density coverage.
    """
    import mne
    
    montage = mne.channels.make_standard_montage('standard_1005')  # 10-05 includes 10-10
    positions = montage.get_positions()
    ch_pos = positions['ch_pos']
    
    electrode_positions = {}
    for name, pos in ch_pos.items():
        pos_mm = (pos * 1000).tolist()
        electrode_positions[name] = {
            'x': round(pos_mm[0], 2),
            'y': round(pos_mm[1], 2),
            'z': round(pos_mm[2], 2),
            'label': name
        }
    
    return electrode_positions


def get_fnirs_example_positions():
    """
    Get optode positions from MNE-NIRS example datasets.
    These are real fNIRS montages used in research.
    """
    try:
        import mne_nirs
        from mne_nirs.datasets import fnirs_motor_group
        from mne_bids import BIDSPath, read_raw_bids
        import os
        
        print("Downloading fNIRS motor example dataset...")
        
        # Get the dataset path
        root = fnirs_motor_group.data_path()
        
        # Load one subject's data to get optode positions
        bids_path = BIDSPath(
            root=root,
            task="tapping",
            datatype="nirs",
            suffix="nirs",
            extension=".snirf",
            subject="01"
        )
        
        raw = read_raw_bids(bids_path=bids_path, verbose=False)
        
        # Extract source and detector positions
        sources = {}
        detectors = {}
        channels = []
        
        # Get channel info
        for ch_name in raw.ch_names:
            ch_info = raw.info['chs'][raw.ch_names.index(ch_name)]
            loc = ch_info['loc']
            
            # Parse channel name (format: S1_D1 hbo)
            parts = ch_name.split()
            if len(parts) >= 1:
                sd_pair = parts[0]
                if '_' in sd_pair:
                    src, det = sd_pair.split('_')
                    
                    # Source position (first 3 values of loc)
                    if src not in sources and not np.allclose(loc[:3], 0):
                        sources[src] = {
                            'x': round(loc[0] * 1000, 2),
                            'y': round(loc[1] * 1000, 2),
                            'z': round(loc[2] * 1000, 2),
                            'label': src
                        }
                    
                    # Detector position (values 3-6 of loc)
                    if det not in detectors and not np.allclose(loc[3:6], 0):
                        detectors[det] = {
                            'x': round(loc[3] * 1000, 2),
                            'y': round(loc[4] * 1000, 2),
                            'z': round(loc[5] * 1000, 2),
                            'label': det
                        }
                    
                    # Channel info
                    if 'hbo' in ch_name.lower():
                        channels.append({
                            'source': src,
                            'detector': det,
                            'type': 'hbo'
                        })
        
        return {
            'sources': sources,
            'detectors': detectors,
            'channels': channels,
            'dataset': 'fnirs_motor_group',
            'description': 'Motor cortex tapping task - bilateral motor coverage'
        }
        
    except Exception as e:
        print(f"Could not load fNIRS example: {e}")
        return None


def get_brain_regions_from_labels():
    """
    Get brain region center coordinates from fsaverage parcellation.
    Uses the Desikan-Killiany atlas which is standard in FreeSurfer/MNE.
    """
    import mne
    import os
    
    try:
        # Fetch fsaverage
        fs_dir = mne.datasets.fetch_fsaverage(verbose=True)
        subjects_dir = os.path.dirname(fs_dir)
        
        # Read labels from the aparc (Desikan-Killiany) atlas
        labels = mne.read_labels_from_annot(
            'fsaverage', 'aparc', 'both', 
            subjects_dir=subjects_dir
        )
        
        # Define regions of interest for fNIRS
        # Map aparc labels to fNIRS-relevant brain regions
        fnirs_regions = {
            # Frontal regions
            'superiorfrontal': {'fnirs_name': 'Dorsolateral Prefrontal', 'abbrev': 'DLPFC'},
            'rostralmiddlefrontal': {'fnirs_name': 'Rostral Middle Frontal', 'abbrev': 'rMFG'},
            'caudalmiddlefrontal': {'fnirs_name': 'Caudal Middle Frontal', 'abbrev': 'cMFG'},
            'parsopercularis': {'fnirs_name': 'Pars Opercularis (Broca)', 'abbrev': 'IFGop'},
            'parstriangularis': {'fnirs_name': 'Pars Triangularis', 'abbrev': 'IFGtri'},
            'parsorbitalis': {'fnirs_name': 'Pars Orbitalis', 'abbrev': 'IFGorb'},
            'lateralorbitofrontal': {'fnirs_name': 'Lateral Orbitofrontal', 'abbrev': 'lOFC'},
            'medialorbitofrontal': {'fnirs_name': 'Medial Orbitofrontal', 'abbrev': 'mOFC'},
            'frontalpole': {'fnirs_name': 'Frontal Pole', 'abbrev': 'FP'},
            
            # Motor/Sensory regions
            'precentral': {'fnirs_name': 'Primary Motor Cortex', 'abbrev': 'M1'},
            'postcentral': {'fnirs_name': 'Primary Somatosensory', 'abbrev': 'S1'},
            'paracentral': {'fnirs_name': 'Paracentral Lobule', 'abbrev': 'PCL'},
            
            # Parietal regions
            'superiorparietal': {'fnirs_name': 'Superior Parietal', 'abbrev': 'SPL'},
            'inferiorparietal': {'fnirs_name': 'Inferior Parietal', 'abbrev': 'IPL'},
            'supramarginal': {'fnirs_name': 'Supramarginal Gyrus', 'abbrev': 'SMG'},
            'precuneus': {'fnirs_name': 'Precuneus', 'abbrev': 'PCu'},
            
            # Temporal regions
            'superiortemporal': {'fnirs_name': 'Superior Temporal', 'abbrev': 'STG'},
            'middletemporal': {'fnirs_name': 'Middle Temporal', 'abbrev': 'MTG'},
            'inferiortemporal': {'fnirs_name': 'Inferior Temporal', 'abbrev': 'ITG'},
            'bankssts': {'fnirs_name': 'Banks of STS', 'abbrev': 'STS'},
            'fusiform': {'fnirs_name': 'Fusiform Gyrus', 'abbrev': 'FuG'},
            'transversetemporal': {'fnirs_name': 'Auditory Cortex', 'abbrev': 'A1'},
            
            # Occipital regions
            'lateraloccipital': {'fnirs_name': 'Lateral Occipital', 'abbrev': 'LOC'},
            'lingual': {'fnirs_name': 'Lingual Gyrus', 'abbrev': 'LiG'},
            'cuneus': {'fnirs_name': 'Cuneus', 'abbrev': 'Cu'},
            'pericalcarine': {'fnirs_name': 'Primary Visual (V1)', 'abbrev': 'V1'},
        }
        
        regions = {}
        
        for label in labels:
            # Get the base name without hemisphere
            base_name = label.name.replace('-lh', '').replace('-rh', '')
            
            if base_name in fnirs_regions:
                # Get label center of mass
                # For surface labels, we need to get the vertex positions
                hemi = 'lh' if '-lh' in label.name else 'rh'
                
                # Read the surface
                surf_path = os.path.join(fs_dir, 'surf', f'{hemi}.pial')
                verts, _ = mne.read_surface(surf_path)
                
                # Get vertices in this label
                label_verts = verts[label.vertices]
                
                # Calculate center of mass (in mm)
                center = label_verts.mean(axis=0)
                
                # Create region entry
                region_key = f"{fnirs_regions[base_name]['abbrev']}-{hemi[0].upper()}"
                
                regions[region_key] = {
                    'name': fnirs_regions[base_name]['fnirs_name'],
                    'hemisphere': 'left' if hemi == 'lh' else 'right',
                    'x': round(float(center[0]), 2),
                    'y': round(float(center[1]), 2),
                    'z': round(float(center[2]), 2),
                    'aparc_label': label.name,
                    'abbrev': fnirs_regions[base_name]['abbrev'],
                    # Estimate region radius based on label extent
                    'radius': round(float(np.sqrt(len(label.vertices) / np.pi)), 2)
                }
        
        return regions
        
    except Exception as e:
        print(f"Could not load brain regions: {e}")
        return None


def create_fnirs_optimized_regions():
    """
    Create brain regions optimized for fNIRS imaging.
    Based on common fNIRS target areas and 10-20 positions.
    Coordinates are in MNE head coordinate system (RAS, mm).
    """
    import mne
    
    # Get standard 10-20 positions as reference
    montage = mne.channels.make_standard_montage('standard_1020')
    positions = montage.get_positions()
    ch_pos = positions['ch_pos']
    
    def get_pos(name):
        """Get position in mm."""
        if name in ch_pos:
            return (ch_pos[name] * 1000).tolist()
        return None
    
    # Define fNIRS-relevant regions using nearby 10-20 electrodes as anchors
    regions = {}
    
    # Prefrontal regions (commonly studied in fNIRS)
    fp1 = get_pos('Fp1')
    fp2 = get_pos('Fp2')
    fpz = get_pos('Fpz')
    f7 = get_pos('F7')
    f8 = get_pos('F8')
    f3 = get_pos('F3')
    f4 = get_pos('F4')
    fz = get_pos('Fz')
    
    if fp1:
        regions['PFC-L'] = {
            'name': 'Left Prefrontal Cortex',
            'x': round(fp1[0], 2),
            'y': round(fp1[1], 2),
            'z': round(fp1[2], 2),
            'anchor': 'Fp1',
            'radius': 35,
            'color': '#e74c3c'
        }
    
    if fp2:
        regions['PFC-R'] = {
            'name': 'Right Prefrontal Cortex',
            'x': round(fp2[0], 2),
            'y': round(fp2[1], 2),
            'z': round(fp2[2], 2),
            'anchor': 'Fp2',
            'radius': 35,
            'color': '#e74c3c'
        }
    
    if fpz:
        regions['mPFC'] = {
            'name': 'Medial Prefrontal Cortex',
            'x': round(fpz[0], 2),
            'y': round(fpz[1], 2),
            'z': round(fpz[2], 2),
            'anchor': 'Fpz',
            'radius': 30,
            'color': '#9b59b6'
        }
    
    # Dorsolateral prefrontal (between F3/F7 and F4/F8)
    if f3 and f7:
        dlpfc_l = [(f3[i] + f7[i]) / 2 for i in range(3)]
        regions['DLPFC-L'] = {
            'name': 'Left Dorsolateral Prefrontal',
            'x': round(dlpfc_l[0], 2),
            'y': round(dlpfc_l[1], 2),
            'z': round(dlpfc_l[2], 2),
            'anchor': 'F3/F7',
            'radius': 30,
            'color': '#3498db'
        }
    
    if f4 and f8:
        dlpfc_r = [(f4[i] + f8[i]) / 2 for i in range(3)]
        regions['DLPFC-R'] = {
            'name': 'Right Dorsolateral Prefrontal',
            'x': round(dlpfc_r[0], 2),
            'y': round(dlpfc_r[1], 2),
            'z': round(dlpfc_r[2], 2),
            'anchor': 'F4/F8',
            'radius': 30,
            'color': '#3498db'
        }
    
    # Motor cortex
    c3 = get_pos('C3')
    c4 = get_pos('C4')
    cz = get_pos('Cz')
    
    if c3:
        regions['M1-L'] = {
            'name': 'Left Primary Motor Cortex',
            'x': round(c3[0], 2),
            'y': round(c3[1], 2),
            'z': round(c3[2], 2),
            'anchor': 'C3',
            'radius': 30,
            'color': '#2ecc71'
        }
    
    if c4:
        regions['M1-R'] = {
            'name': 'Right Primary Motor Cortex',
            'x': round(c4[0], 2),
            'y': round(c4[1], 2),
            'z': round(c4[2], 2),
            'anchor': 'C4',
            'radius': 30,
            'color': '#2ecc71'
        }
    
    if cz:
        regions['SMA'] = {
            'name': 'Supplementary Motor Area',
            'x': round(cz[0], 2),
            'y': round(cz[1], 2),
            'z': round(cz[2], 2),
            'anchor': 'Cz',
            'radius': 25,
            'color': '#27ae60'
        }
    
    # Temporal (auditory/language)
    t3 = get_pos('T3') or get_pos('T7')
    t4 = get_pos('T4') or get_pos('T8')
    t5 = get_pos('T5') or get_pos('P7')
    t6 = get_pos('T6') or get_pos('P8')
    
    if t3:
        regions['STG-L'] = {
            'name': 'Left Superior Temporal (Wernicke)',
            'x': round(t3[0], 2),
            'y': round(t3[1], 2),
            'z': round(t3[2], 2),
            'anchor': 'T3/T7',
            'radius': 30,
            'color': '#fd79a8'
        }
    
    if t4:
        regions['STG-R'] = {
            'name': 'Right Superior Temporal',
            'x': round(t4[0], 2),
            'y': round(t4[1], 2),
            'z': round(t4[2], 2),
            'anchor': 'T4/T8',
            'radius': 30,
            'color': '#fd79a8'
        }
    
    # Parietal
    p3 = get_pos('P3')
    p4 = get_pos('P4')
    pz = get_pos('Pz')
    
    if p3:
        regions['IPL-L'] = {
            'name': 'Left Inferior Parietal',
            'x': round(p3[0], 2),
            'y': round(p3[1], 2),
            'z': round(p3[2], 2),
            'anchor': 'P3',
            'radius': 30,
            'color': '#f39c12'
        }
    
    if p4:
        regions['IPL-R'] = {
            'name': 'Right Inferior Parietal',
            'x': round(p4[0], 2),
            'y': round(p4[1], 2),
            'z': round(p4[2], 2),
            'anchor': 'P4',
            'radius': 30,
            'color': '#f39c12'
        }
    
    # Occipital (visual)
    o1 = get_pos('O1')
    o2 = get_pos('O2')
    oz = get_pos('Oz')
    
    if o1:
        regions['V1-L'] = {
            'name': 'Left Visual Cortex',
            'x': round(o1[0], 2),
            'y': round(o1[1], 2),
            'z': round(o1[2], 2),
            'anchor': 'O1',
            'radius': 30,
            'color': '#6c5ce7'
        }
    
    if o2:
        regions['V1-R'] = {
            'name': 'Right Visual Cortex',
            'x': round(o2[0], 2),
            'y': round(o2[1], 2),
            'z': round(o2[2], 2),
            'anchor': 'O2',
            'radius': 30,
            'color': '#6c5ce7'
        }
    
    if oz:
        regions['V1-M'] = {
            'name': 'Medial Visual Cortex',
            'x': round(oz[0], 2),
            'y': round(oz[1], 2),
            'z': round(oz[2], 2),
            'anchor': 'Oz',
            'radius': 30,
            'color': '#00cec9'
        }
    
    return regions


def main():
    """Main function to extract and save all anatomical data."""
    
    print("="*60)
    print("MNE Anatomy Extraction for NOMAD")
    print("="*60)
    print()
    
    if not check_dependencies():
        return
    
    output = {
        'version': '1.0',
        'coordinate_system': {
            'name': 'MNE Head',
            'description': 'RAS coordinate system (Right-Anterior-Superior)',
            'units': 'mm',
            'origin': 'Between ears, level with nasion'
        }
    }
    
    # 1. Get standard 10-20 positions
    print("\n1. Extracting 10-20 electrode positions...")
    electrodes_1020, fiducials = get_standard_1020_positions()
    output['electrodes_1020'] = electrodes_1020
    output['fiducials'] = fiducials
    print(f"   ✓ {len(electrodes_1020)} electrodes")
    
    # 2. Get extended 10-10 positions
    print("\n2. Extracting 10-10 electrode positions...")
    electrodes_1010 = get_1010_positions()
    output['electrodes_1010'] = electrodes_1010
    print(f"   ✓ {len(electrodes_1010)} electrodes")
    
    # 3. Get fNIRS example positions
    print("\n3. Extracting fNIRS example montage...")
    fnirs_example = get_fnirs_example_positions()
    if fnirs_example:
        output['fnirs_example'] = fnirs_example
        print(f"   ✓ {len(fnirs_example['sources'])} sources, {len(fnirs_example['detectors'])} detectors")
    else:
        print("   ○ Skipped (MNE-NIRS not available)")
    
    # 4. Get brain regions from parcellation
    print("\n4. Extracting brain regions from fsaverage...")
    parcellation_regions = get_brain_regions_from_labels()
    if parcellation_regions:
        output['parcellation_regions'] = parcellation_regions
        print(f"   ✓ {len(parcellation_regions)} regions")
    else:
        print("   ○ Skipped")
    
    # 5. Create fNIRS-optimized regions
    print("\n5. Creating fNIRS-optimized regions...")
    fnirs_regions = create_fnirs_optimized_regions()
    output['fnirs_regions'] = fnirs_regions
    print(f"   ✓ {len(fnirs_regions)} regions")
    
    # Save output
    output_file = 'mne_anatomy.json'
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print()
    print("="*60)
    print(f"✓ Saved to: {output_file}")
    print("="*60)
    print()
    print("Next steps:")
    print("1. Copy mne_anatomy.json to the web/ directory")
    print("2. Refresh the NOMAD web app")
    print("3. ROI regions will now use real MNE coordinates")


if __name__ == '__main__':
    main()

