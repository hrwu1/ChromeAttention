#!/usr/bin/env python3
"""
Generate placeholder PNG icons for Chrome Focus Assistant
Requires: Pillow (pip install Pillow)
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow library not found.")
    print("Install it with: pip install Pillow")
    exit(1)

def create_icon(size, filename):
    """Create a simple circular gradient icon with a target symbol"""
    
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw gradient-like background circle
    center = size // 2
    radius = size // 2 - 2
    
    # Background circle with purple color
    draw.ellipse([2, 2, size-2, size-2], fill=(102, 126, 234, 255))
    
    # Draw target circles (white)
    circle_color = (255, 255, 255, 200)
    
    # Outer circle
    outer_radius = int(radius * 0.7)
    draw.ellipse(
        [center - outer_radius, center - outer_radius,
         center + outer_radius, center + outer_radius],
        outline=circle_color, width=max(1, size // 32)
    )
    
    # Middle circle
    mid_radius = int(radius * 0.5)
    draw.ellipse(
        [center - mid_radius, center - mid_radius,
         center + mid_radius, center + mid_radius],
        outline=circle_color, width=max(1, size // 32)
    )
    
    # Inner filled circle (bullseye)
    inner_radius = int(radius * 0.2)
    draw.ellipse(
        [center - inner_radius, center - inner_radius,
         center + inner_radius, center + inner_radius],
        fill=(255, 255, 255, 255)
    )
    
    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

if __name__ == '__main__':
    sizes = [
        (16, 'icon16.png'),
        (48, 'icon48.png'),
        (128, 'icon128.png')
    ]
    
    for size, filename in sizes:
        create_icon(size, filename)
    
    print("\nAll icons created successfully!")
    print("Note: These are placeholder icons. Consider creating custom icons for production.")

