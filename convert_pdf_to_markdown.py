#!/usr/bin/env python3
"""
PDF to Markdown Converter with Image Extraction

Converts a PDF file to:
1. A Markdown file with embedded image references
2. Extracted images (both embedded images and figure page renders)
"""

import os
import sys
import re
import fitz  # PyMuPDF


def extract_images_from_pdf(doc, output_dir, pdf_name):
    """Extract all embedded images from the PDF."""
    image_paths = []
    image_count = 0
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        image_list = page.get_images(full=True)
        
        for img_index, img in enumerate(image_list):
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                image_count += 1
                image_filename = f"{pdf_name}_img_{image_count:03d}.{image_ext}"
                image_path = os.path.join(output_dir, image_filename)
                
                with open(image_path, "wb") as img_file:
                    img_file.write(image_bytes)
                
                image_paths.append({
                    'path': image_filename,
                    'page': page_num + 1,
                    'index': img_index
                })
                print(f"  Extracted image {image_count} from page {page_num + 1}")
            except Exception as e:
                print(f"  Warning: Could not extract image from page {page_num + 1}: {e}")
    
    return image_paths


def render_pages_as_images(doc, output_dir, pdf_name, dpi=150):
    """Render each page as an image for figures that aren't extractable."""
    page_images = []
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(matrix=mat)
        image_filename = f"{pdf_name}_page_{page_num + 1:03d}.png"
        image_path = os.path.join(output_dir, image_filename)
        pix.save(image_path)
        page_images.append({
            'path': image_filename,
            'page': page_num + 1
        })
    
    return page_images


def clean_text(text):
    """Clean and format extracted text for Markdown."""
    # Remove excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Fix common OCR/extraction issues
    text = re.sub(r'(\w)-\n(\w)', r'\1\2', text)  # Fix hyphenated line breaks
    return text.strip()


def extract_text_blocks(doc):
    """Extract text from each page with structure."""
    pages_text = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        pages_text.append({
            'page': page_num + 1,
            'text': clean_text(text)
        })
    
    return pages_text


def create_markdown(pages_text, embedded_images, page_images, output_dir, pdf_name):
    """Create a Markdown file from extracted content."""
    
    md_content = []
    
    # Process text to identify sections
    full_text = "\n\n".join([p['text'] for p in pages_text])
    
    # Try to identify title and abstract from first pages
    lines = full_text.split('\n')
    
    # Build the markdown content
    current_section = None
    in_references = False
    
    for page_info in pages_text:
        page_num = page_info['page']
        text = page_info['text']
        
        if not text.strip():
            continue
        
        # Add page separator comment for reference
        md_content.append(f"\n<!-- Page {page_num} -->\n")
        
        # Process the text line by line to identify structure
        lines = text.split('\n')
        processed_lines = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            if not line:
                processed_lines.append('')
                i += 1
                continue
            
            # Detect section headers (typically short lines with specific keywords)
            section_keywords = ['Abstract', 'Introduction', 'Methods', 'Results', 
                              'Discussion', 'Conclusion', 'Conclusions', 'References',
                              'Acknowledgements', 'Author contributions', 
                              'Competing interests', 'Additional information',
                              'Supplementary Information', 'Keywords', 'Declarations']
            
            is_section = False
            for keyword in section_keywords:
                if line.lower() == keyword.lower() or line.lower().startswith(keyword.lower() + '\n'):
                    processed_lines.append(f"\n## {line}\n")
                    is_section = True
                    if keyword.lower() == 'references':
                        in_references = True
                    break
            
            if is_section:
                i += 1
                continue
            
            # Detect subsection headers (### level)
            # Usually short lines followed by longer paragraphs
            if len(line) < 80 and not line.endswith('.') and not in_references:
                # Check if next line exists and is longer (paragraph text)
                if i + 1 < len(lines) and len(lines[i + 1].strip()) > 80:
                    # Likely a subsection header
                    processed_lines.append(f"\n### {line}\n")
                    i += 1
                    continue
            
            # Regular text
            processed_lines.append(line)
            i += 1
        
        md_content.append('\n'.join(processed_lines))
        
        # Add page images for pages that likely contain figures
        # (This is a heuristic - pages with less text often have figures)
        if len(text) < 500:  # Short text pages likely have figures
            page_img = next((p for p in page_images if p['page'] == page_num), None)
            if page_img:
                md_content.append(f"\n![Page {page_num}]({page_img['path']})\n")
    
    # Write the markdown file
    md_path = os.path.join(output_dir, f"{pdf_name}.md")
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md_content))
    
    return md_path


def convert_pdf_to_markdown(pdf_path, output_dir=None, dpi=150, render_all_pages=True):
    """
    Convert a PDF to Markdown with embedded images.
    
    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory to save output (default: creates subdirectory)
        dpi: Resolution for page rendering (default: 150)
        render_all_pages: Whether to render all pages as images (default: True)
    
    Returns:
        Path to the generated Markdown file
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    # Set up output directory
    pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
    
    if output_dir is None:
        base_dir = os.path.dirname(pdf_path) or "."
        output_dir = os.path.join(base_dir, f"{pdf_name}_markdown")
    
    # Create images subdirectory
    images_dir = os.path.join(output_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    
    # Open the PDF
    doc = fitz.open(pdf_path)
    
    print(f"Processing: {pdf_path}")
    print(f"Total pages: {len(doc)}")
    print(f"Output directory: {output_dir}")
    print("-" * 50)
    
    # Extract embedded images
    print("Extracting embedded images...")
    embedded_images = extract_images_from_pdf(doc, images_dir, pdf_name)
    print(f"  Found {len(embedded_images)} embedded images")
    
    # Render pages as images
    if render_all_pages:
        print("Rendering pages as images...")
        page_images = render_pages_as_images(doc, images_dir, pdf_name, dpi)
        print(f"  Rendered {len(page_images)} page images")
    else:
        page_images = []
    
    # Extract text
    print("Extracting text...")
    pages_text = extract_text_blocks(doc)
    print(f"  Extracted text from {len(pages_text)} pages")
    
    doc.close()
    
    # Create Markdown with relative paths to images subfolder
    print("Creating Markdown file...")
    
    # Update image paths to be relative to the markdown file
    for img in embedded_images:
        img['path'] = f"images/{img['path']}"
    for img in page_images:
        img['path'] = f"images/{img['path']}"
    
    md_path = create_markdown(pages_text, embedded_images, page_images, output_dir, pdf_name)
    
    print("-" * 50)
    print(f"Done!")
    print(f"Markdown file: {md_path}")
    print(f"Images directory: {images_dir}")
    
    return md_path


def main():
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        pdf_path = "s41598-025-85858-7.pdf"
    
    # Optional: specify DPI as second argument
    dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 150
    
    try:
        md_path = convert_pdf_to_markdown(pdf_path, dpi=dpi)
        print(f"\nSuccessfully created: {md_path}")
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error processing PDF: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

