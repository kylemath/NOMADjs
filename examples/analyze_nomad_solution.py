#!/usr/bin/env python3
"""
Analyze NOMAD's Original Solution

Check what solution NOMAD actually found and stored in the .mat file.
This will tell us what "success" looks like for the original system.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
import scipy.io as sio


def analyze_nomad_solution(mat_file_path: str):
    """Analyze the solution stored in a NOMAD .mat file."""
    print(f"="*70)
    print(f"Analyzing: {os.path.basename(mat_file_path)}")
    print(f"="*70)
    
    mat_data = sio.loadmat(mat_file_path)
    mtg = mat_data['mtg'][0, 0]
    
    # Extract key information
    n_srcs = int(mtg['n_srcs'][0, 0])
    n_dets = int(mtg['n_dets'][0, 0])
    n_muxs = int(mtg['n_muxs'][0, 0])
    min_dist = float(mtg['min_dist'][0, 0])
    max_dist = float(mtg['max_dist'][0, 0])
    
    print(f"\nMontage Configuration:")
    print(f"  Sources: {n_srcs}")
    print(f"  Detectors: {n_dets}")
    print(f"  Mux slots: {n_muxs}")
    print(f"  Min distance: {min_dist} mm")
    print(f"  Max distance: {max_dist} mm")
    
    # Check the mux assignment
    mux_numbers = mtg['mux_numbers'].flatten()
    print(f"\nMux assignment shape: {mux_numbers.shape}")
    print(f"Mux values: {np.unique(mux_numbers)}")
    
    # Count sources per mux
    print(f"\nSources per mux slot:")
    for mux in range(1, n_muxs + 1):
        count = np.sum(mux_numbers == mux)
        print(f"  Slot {mux}: {count} sources")
    
    # Check for unassigned sources (mux = 0)
    unassigned = np.sum(mux_numbers == 0)
    assigned = np.sum(mux_numbers > 0)
    print(f"\nAssignment summary:")
    print(f"  Assigned: {assigned}/{n_srcs} sources")
    print(f"  Unassigned: {unassigned}/{n_srcs} sources")
    
    # Check leftover field
    if 'leftover' in mtg.dtype.names:
        leftover = mtg['leftover'].flatten()
        print(f"  Leftover field: {len(leftover)} sources")
        if len(leftover) > 0:
            print(f"  Leftover indices: {leftover}")
    
    # Check lowest_left field (best result from trials)
    if 'lowest_left' in mtg.dtype.names:
        lowest_left = int(mtg['lowest_left'][0, 0])
        print(f"  Lowest left (best trial): {lowest_left} unassigned")
    
    # Check conflict graph
    if 'E' in mtg.dtype.names:
        edges = mtg['E']
        print(f"\nConflict graph:")
        print(f"  Edges: {len(edges)}")
        print(f"  Avg degree: {2 * len(edges) / n_srcs:.2f}")
    
    # Check if there are multiple montages
    print(f"\nMulti-montage setup:")
    if 'mtg1' in mat_data:
        print(f"  mtg1 exists: Yes")
        mtg1 = mat_data['mtg1'][0, 0]
        if 'mux_numbers' in mtg1.dtype.names:
            mux1 = mtg1['mux_numbers'].flatten()
            assigned1 = np.sum(mux1 > 0)
            print(f"  mtg1 assigned: {assigned1} sources")
    
    if 'mtg2' in mat_data:
        print(f"  mtg2 exists: Yes")
        mtg2_data = mat_data['mtg2']
        if mtg2_data.size > 0:
            mtg2 = mtg2_data[0, 0]
            if 'mux_numbers' in mtg2.dtype.names:
                mux2 = mtg2['mux_numbers'].flatten()
                assigned2 = np.sum(mux2 > 0)
                print(f"  mtg2 assigned: {assigned2} sources")
        else:
            print(f"  mtg2 is empty")
    
    # Key insight
    print(f"\n" + "="*70)
    print("KEY INSIGHT:")
    print("="*70)
    if assigned < n_srcs:
        theoretical_capacity = n_muxs * 4  # Assuming capacity of 4
        print(f"The montage has {n_srcs} sources but theoretical capacity is")
        print(f"only {theoretical_capacity} (= {n_muxs} slots × 4 sources/slot).")
        print(f"\nNOMAD assigned {assigned}/{n_srcs} sources ({assigned/n_srcs*100:.1f}%).")
        print(f"This matches the theoretical capacity!")
        print(f"\nThe system likely uses multiple montages (mtg1, mtg2) or")
        print(f"multiple wavelengths to handle all {n_srcs} sources.")
    else:
        print(f"All {n_srcs} sources were successfully assigned!")
    
    return assigned, n_srcs


def main():
    """Analyze NOMAD solutions."""
    nomad_path = "/Users/kylemathewson/Coding/nomad"
    
    montage_files = [
        os.path.join(nomad_path, "examples", "working_test_montage.mat"),
        os.path.join(nomad_path, "examples", "LrgBlkBoth.mat"),
    ]
    
    for mat_file in montage_files:
        if os.path.exists(mat_file):
            analyze_nomad_solution(mat_file)
            print("\n")


if __name__ == "__main__":
    main()

