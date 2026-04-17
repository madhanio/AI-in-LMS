from PIL import Image

def crop_to_content(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    # Get the bounding box of non-transparent pixels
    bbox = img.getbbox()
    if bbox:
        # Crop to bounding box
        cropped = img.crop(bbox)
        
        # Now we want a square image with safe padding (e.g. 10%)
        # Moodle icons usually fill about 80-90% of the square
        w, h = cropped.size
        new_size = int(max(w, h) * 1.1) # 10% padding
        
        new_img = Image.new("RGBA", (new_size, new_size), (255, 255, 255, 0))
        offset_x = (new_size - w) // 2
        offset_y = (new_size - h) // 2
        
        new_img.paste(cropped, (offset_x, offset_y), cropped)
        
        # Save as the new icon
        new_img.save(output_path, format="PNG")
        print(f"✅ Successfully cropped and saved high-density icon to {output_path}")
    else:
        print("❌ Error: Image seems empty.")

if __name__ == "__main__":
    crop_to_content("assets/moodle.png", "assets/moodle_high_density.png")
