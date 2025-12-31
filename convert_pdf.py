#!/usr/bin/env python3
"""
PDF to Images and Text Converter

Converts a PDF file to:
1. Individual PNG images (one per page)
2. A text file with extracted text from all pages
"""

import os
import sys
import fitz  # PyMuPDF


def convert_pdf_to_images_and_text(pdf_path, output_dir=None, dpi=200):
    """
    Convert a PDF to images and extract text.
    
    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory to save output (default: same directory as PDF)
        dpi: Resolution for image output (default: 200)
    
    Returns:
        Tuple of (list of image paths, text file path)
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    # Set up output directory
    if output_dir is None:
        output_dir = os.path.dirname(pdf_path) or "."
    
    # Create output subdirectory based on PDF name
    pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
    output_subdir = os.path.join(output_dir, f"{pdf_name}_extracted")
    os.makedirs(output_subdir, exist_ok=True)
    
    # Open the PDF
    doc = fitz.open(pdf_path)
    
    print(f"Processing: {pdf_path}")
    print(f"Total pages: {len(doc)}")
    print(f"Output directory: {output_subdir}")
    print("-" * 50)
    
    image_paths = []
    all_text = []
    
    # Calculate zoom factor for desired DPI (default PDF is 72 DPI)
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Extract image
        pix = page.get_pixmap(matrix=mat)
        image_path = os.path.join(output_subdir, f"page_{page_num + 1:03d}.png")
        pix.save(image_path)
        image_paths.append(image_path)
        
        # Extract text
        text = page.get_text()
        all_text.append(f"{'='*60}\nPAGE {page_num + 1}\n{'='*60}\n\n{text}")
        
        print(f"  Page {page_num + 1}/{len(doc)}: Extracted image and text")
    
    doc.close()
    
    # Save combined text file
    text_path = os.path.join(output_subdir, f"{pdf_name}_text.txt")
    with open(text_path, 'w', encoding='utf-8') as f:
        f.write("\n\n".join(all_text))
    
    print("-" * 50)
    print(f"Done! Extracted {len(image_paths)} images and text.")
    print(f"Images saved to: {output_subdir}")
    print(f"Text saved to: {text_path}")
    
    return image_paths, text_path


def main():
    # Default to the NOMAD PDF if no argument provided
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        # Use the NOMAD PDF in the current directory
        pdf_path = "NOMAD-OpticalImagingSummerSchool_2015_UIllinoisRemote2.pdf"
    
    # Optional: specify DPI as second argument
    dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    
    try:
        image_paths, text_path = convert_pdf_to_images_and_text(pdf_path, dpi=dpi)
        
        print("\n" + "="*60)
        print("SUMMARY")
        print("="*60)
        print(f"Total images: {len(image_paths)}")
        print(f"Text file: {text_path}")
        
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error processing PDF: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

