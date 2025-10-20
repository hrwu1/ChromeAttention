# Extension Icons

This directory contains the extension icons in various sizes.

## Required Sizes

- `icon16.png` - 16x16 pixels (toolbar)
- `icon48.png` - 48x48 pixels (extensions page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Creating Icons

A placeholder SVG file (`icon.svg`) is provided. You can:

1. **Use the SVG directly** (for development):
   - Most modern browsers support SVG in extensions
   
2. **Convert to PNG** (for production):
   - Use an online tool like [CloudConvert](https://cloudconvert.com/svg-to-png)
   - Or use ImageMagick: `convert -background none icon.svg -resize 16x16 icon16.png`
   - Create all three sizes: 16x16, 48x48, and 128x128

3. **Create custom icons**:
   - Replace with your own design
   - Use a design tool like Figma, Sketch, or Adobe Illustrator
   - Export as PNG in the required sizes

## Temporary Workaround

For testing, you can temporarily modify `manifest.json` to remove the icon references, or create simple colored PNG files.

## Design Guidelines

- Use simple, recognizable imagery
- Ensure good contrast and visibility at small sizes
- Follow Chrome Web Store icon guidelines
- Consider both light and dark browser themes

