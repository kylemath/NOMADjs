#!/usr/bin/env python3
"""
Export fsaverage head and brain surfaces for NOMAD web app.

Creates GLB/JSON meshes compatible with Three.js visualization.
"""

import os
import sys
import json
import numpy as np

def check_dependencies():
    """Check required dependencies."""
    missing = []
    
    try:
        import mne
        print(f"✓ MNE-Python version: {mne.__version__}")
    except ImportError:
        missing.append("mne")
    
    try:
        import trimesh
        print(f"✓ trimesh version: {trimesh.__version__}")
    except ImportError:
        missing.append("trimesh")
    
    if missing:
        print(f"Missing: {missing}")
        print("Install with: pip install mne trimesh")
        return False
    return True

if not check_dependencies():
    sys.exit(1)

import mne
import trimesh


def export_surfaces():
    """Export fsaverage head and brain surfaces."""
    
    print("\n" + "="*60)
    print("Exporting fsaverage surfaces for NOMAD web app")
    print("="*60)
    
    # Fetch fsaverage
    fs_dir = mne.datasets.fetch_fsaverage(verbose=True)
    subjects_dir = os.path.dirname(fs_dir)
    
    print(f"\nfsaverage location: {fs_dir}")
    
    # Define file paths
    bem_dir = os.path.join(fs_dir, 'bem')
    surf_dir = os.path.join(fs_dir, 'surf')
    
    output_files = []
    
    # 1. Export outer skin (head surface)
    outer_skin = os.path.join(bem_dir, 'outer_skin.surf')
    if os.path.exists(outer_skin):
        print(f"\nLoading outer skin surface...")
        verts, faces = mne.read_surface(outer_skin)
        print(f"  Vertices: {len(verts)}, Faces: {len(faces)}")
        
        # Create mesh
        mesh = trimesh.Trimesh(vertices=verts, faces=faces)
        
        # Mesh is already reasonable size for web (10K-20K vertices is fine)
        
        # Export to GLB
        mesh.export('fsaverage_head.glb', file_type='glb')
        print(f"  ✓ Exported: fsaverage_head.glb")
        output_files.append('fsaverage_head.glb')
        
        # Also export as JSON for fallback
        export_mesh_json(mesh, 'fsaverage_head.json', 'outer_skin')
        output_files.append('fsaverage_head.json')
    
    # 2. Export brain (inner skull is simpler, or use pial surfaces)
    brain_surf = os.path.join(bem_dir, 'brain.surf')
    if os.path.exists(brain_surf):
        print(f"\nLoading brain surface...")
        verts, faces = mne.read_surface(brain_surf)
        print(f"  Vertices: {len(verts)}, Faces: {len(faces)}")
        
        mesh = trimesh.Trimesh(vertices=verts, faces=faces)
        
        mesh.export('fsaverage_brain.glb', file_type='glb')
        print(f"  ✓ Exported: fsaverage_brain.glb")
        output_files.append('fsaverage_brain.glb')
        
        export_mesh_json(mesh, 'fsaverage_brain.json', 'brain')
        output_files.append('fsaverage_brain.json')
    
    # 3. Export pial surfaces (cortical surface for detail)
    lh_pial = os.path.join(surf_dir, 'lh.pial')
    rh_pial = os.path.join(surf_dir, 'rh.pial')
    
    if os.path.exists(lh_pial) and os.path.exists(rh_pial):
        print(f"\nLoading pial surfaces...")
        
        lh_verts, lh_faces = mne.read_surface(lh_pial)
        rh_verts, rh_faces = mne.read_surface(rh_pial)
        
        print(f"  Left hemisphere: {len(lh_verts)} vertices")
        print(f"  Right hemisphere: {len(rh_verts)} vertices")
        
        # Create meshes
        lh_mesh = trimesh.Trimesh(vertices=lh_verts, faces=lh_faces)
        rh_mesh = trimesh.Trimesh(vertices=rh_verts, faces=rh_faces)
        
        # Combine hemispheres
        cortex = trimesh.util.concatenate([lh_mesh, rh_mesh])
        print(f"  Combined mesh: {len(cortex.faces)} faces")
        
        cortex.export('fsaverage_cortex.glb', file_type='glb')
        print(f"  ✓ Exported: fsaverage_cortex.glb")
        output_files.append('fsaverage_cortex.glb')
        
        export_mesh_json(cortex, 'fsaverage_cortex.json', 'cortex')
        output_files.append('fsaverage_cortex.json')
    
    # 4. Export inflated brain for flatmap-style visualization
    lh_inflated = os.path.join(surf_dir, 'lh.inflated')
    rh_inflated = os.path.join(surf_dir, 'rh.inflated')
    
    if os.path.exists(lh_inflated) and os.path.exists(rh_inflated):
        print(f"\nLoading inflated surfaces...")
        
        lh_verts, lh_faces = mne.read_surface(lh_inflated)
        rh_verts, rh_faces = mne.read_surface(rh_inflated)
        
        lh_mesh = trimesh.Trimesh(vertices=lh_verts, faces=lh_faces)
        rh_mesh = trimesh.Trimesh(vertices=rh_verts, faces=rh_faces)
        
        inflated = trimesh.util.concatenate([lh_mesh, rh_mesh])
        print(f"  Combined mesh: {len(inflated.faces)} faces")
        
        inflated.export('fsaverage_inflated.glb', file_type='glb')
        print(f"  ✓ Exported: fsaverage_inflated.glb")
        output_files.append('fsaverage_inflated.glb')
    
    print("\n" + "="*60)
    print("Export complete!")
    print("="*60)
    print(f"\nGenerated files: {', '.join(output_files)}")
    print("\nThese files use the MNE coordinate system:")
    print("  X: right (+) to left (-)")
    print("  Y: back (-) to nose (+)")
    print("  Z: bottom (-) to top (+)")
    print("  Units: mm")
    
    return output_files


def export_mesh_json(mesh, filename, name):
    """Export mesh as JSON for easy loading in JavaScript."""
    
    vertices = mesh.vertices.flatten().tolist()
    indices = mesh.faces.flatten().tolist()
    
    # Compute vertex normals
    normals = mesh.vertex_normals.flatten().tolist()
    
    data = {
        'name': name,
        'format': 'indexed_triangles',
        'units': 'mm',
        'coordinate_system': 'MNE_head_RAS',
        'vertices': vertices,  # Flat array [x0,y0,z0,x1,y1,z1,...]
        'indices': indices,    # Flat array [i0,i1,i2,i3,i4,i5,...] (triangles)
        'normals': normals,    # Flat array [nx0,ny0,nz0,...]
        'vertex_count': len(mesh.vertices),
        'face_count': len(mesh.faces)
    }
    
    with open(filename, 'w') as f:
        json.dump(data, f)
    
    print(f"  ✓ Exported: {filename}")


if __name__ == '__main__':
    export_surfaces()
