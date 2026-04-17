from PIL import Image

def pad_image(input_path, output_path, scale=1.7):
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    
    new_w = int(w * scale)
    new_h = int(h * scale)
    new_size = max(new_w, new_h)
    
    new_img = Image.new("RGBA", (new_size, new_size), (255, 255, 255, 0))
    
    offset_x = (new_size - w) // 2
    offset_y = (new_size - h) // 2
    
    new_img.paste(img, (offset_x, offset_y), img)
    new_img.save(output_path, format="PNG")
    print(f"Padded image saved to {output_path}")

if __name__ == "__main__":
    pad_image("assets/moodle.png", "assets/moodle_padded_splash.png")
