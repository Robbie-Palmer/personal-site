#!/usr/bin/env python3
"""
Generate themed featured images for blog posts
"""
from PIL import Image, ImageDraw, ImageFilter
import os

# Image specifications
TARGET_WIDTH = 1200
TARGET_HEIGHT = 675
MAX_FILE_SIZE = 200 * 1024  # 200KB

# Post configurations with color themes
POSTS = [
    {
        "slug": "why-you-should-not-buy-a-house",
        "alt": "House keys on a wooden table representing real estate decisions",
        "colors": [(44, 62, 80), (52, 73, 94), (127, 140, 141)]  # Dark blue/gray
    },
    {
        "slug": "how-to-build-wealth",
        "alt": "Upward trending financial growth chart symbolizing wealth building",
        "colors": [(39, 174, 96), (46, 204, 113), (22, 160, 133)]  # Green for growth
    },
    {
        "slug": "just-right-engineering",
        "alt": "Clean code on a computer screen representing balanced software engineering",
        "colors": [(52, 73, 94), (44, 62, 80), (127, 140, 141)]  # Tech blue/gray
    },
    {
        "slug": "post-modern-management",
        "alt": "Team collaboration workspace showing modern management practices",
        "colors": [(155, 89, 182), (142, 68, 173), (155, 89, 182)]  # Purple for leadership
    },
    {
        "slug": "enabling-multi-omic-data-management",
        "alt": "DNA helix and molecular structures representing multi-omic data",
        "colors": [(41, 128, 185), (52, 152, 219), (26, 188, 156)]  # Blue/cyan for science
    },
    {
        "slug": "the-philosophy-of-data-science",
        "alt": "Data visualization and analytics dashboard illustrating data science concepts",
        "colors": [(230, 126, 34), (231, 76, 60), (192, 57, 43)]  # Orange/red for analytics
    },
    {
        "slug": "quasi-experiments",
        "alt": "Laboratory equipment and experiments representing statistical experimentation",
        "colors": [(149, 165, 166), (127, 140, 141), (189, 195, 199)]  # Gray for lab
    },
    {
        "slug": "navigating-titles-in-the-ml-market",
        "alt": "Career pathway intersection representing ML career navigation",
        "colors": [(241, 196, 15), (243, 156, 18), (211, 84, 0)]  # Gold/orange for career
    },
    {
        "slug": "effective-ethical-data-science-study-design",
        "alt": "Balanced scales representing ethical considerations in data science",
        "colors": [(52, 152, 219), (41, 128, 185), (142, 68, 173)]  # Blue/purple for ethics
    },
    {
        "slug": "uniting-machine-learning-data-streaming-1",
        "alt": "Abstract data streams and network connections representing ML data streaming",
        "colors": [(26, 188, 156), (22, 160, 133), (52, 73, 94)]  # Teal for data flow
    },
    {
        "slug": "uniting-machine-learning-data-streaming-2",
        "alt": "Real-time data processing visualization showing streaming architecture",
        "colors": [(22, 160, 133), (26, 188, 156), (46, 204, 113)]  # Teal/green for streaming
    },
    {
        "slug": "automatically-detect-pii-real-time-cyber-defense",
        "alt": "Digital security shield and lock representing cybersecurity and data protection",
        "colors": [(231, 76, 60), (192, 57, 43), (44, 62, 80)]  # Red/dark for security
    }
]

def create_gradient_image(colors, width, height):
    """Create a smooth gradient image with multiple colors"""
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)

    # Create vertical gradient
    for y in range(height):
        # Calculate which color segment we're in
        progress = y / height

        if progress < 0.5:
            # First half: blend between color 0 and 1
            local_progress = progress * 2
            r = int(colors[0][0] + (colors[1][0] - colors[0][0]) * local_progress)
            g = int(colors[0][1] + (colors[1][1] - colors[0][1]) * local_progress)
            b = int(colors[0][2] + (colors[1][2] - colors[0][2]) * local_progress)
        else:
            # Second half: blend between color 1 and 2
            local_progress = (progress - 0.5) * 2
            r = int(colors[1][0] + (colors[2][0] - colors[1][0]) * local_progress)
            g = int(colors[1][1] + (colors[2][1] - colors[1][1]) * local_progress)
            b = int(colors[1][2] + (colors[2][2] - colors[1][2]) * local_progress)

        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Add subtle texture with blur
    img = img.filter(ImageFilter.GaussianBlur(radius=2))

    # Add some geometric shapes for visual interest
    overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    # Add semi-transparent circles
    for i in range(3):
        x = width * (0.2 + i * 0.3)
        y = height * (0.3 + i * 0.2)
        size = 200 + i * 100
        overlay_draw.ellipse(
            [(x - size/2, y - size/2), (x + size/2, y + size/2)],
            fill=(255, 255, 255, 15)
        )

    # Composite the overlay
    img = img.convert('RGBA')
    img = Image.alpha_composite(img, overlay)
    img = img.convert('RGB')

    return img

def optimize_image(img, target_size=MAX_FILE_SIZE):
    """Optimize image to meet size requirements"""
    from io import BytesIO

    quality = 85
    while quality > 40:
        output = BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        size = output.tell()

        if size <= target_size:
            return output.getvalue()

        quality -= 5

    # If still too large, return best effort
    output = BytesIO()
    img.save(output, format='JPEG', quality=40, optimize=True)
    return output.getvalue()

def generate_images():
    """Generate all images"""
    output_dir = "public/blog-images"
    os.makedirs(output_dir, exist_ok=True)

    for post in POSTS:
        slug = post["slug"]
        colors = post["colors"]

        print(f"\nGenerating: {slug}")

        # Create gradient image
        img = create_gradient_image(colors, TARGET_WIDTH, TARGET_HEIGHT)

        # Optimize image
        optimized_data = optimize_image(img)

        # Save to file
        output_path = os.path.join(output_dir, f"{slug}-featured.jpg")
        with open(output_path, 'wb') as f:
            f.write(optimized_data)

        file_size = len(optimized_data) / 1024
        print(f"Saved: {output_path} ({file_size:.1f}KB)")

if __name__ == "__main__":
    generate_images()
    print("\nAll images generated successfully!")
