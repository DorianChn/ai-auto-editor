from PIL import Image, ImageDraw, ImageFont
import os, math

base = "C:/Users/36712/Documents/GitHub/ai-auto-editor/public"
icons_dir = os.path.join(base, "icons")
os.makedirs(icons_dir, exist_ok=True)

def draw_icon(filename, size, draw_fn):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_fn(draw, size)
    img.save(os.path.join(icons_dir, filename))
    print(f"  {filename}")

S = 512

# === Design A: 电影胶片 + 播放键 ===
def design_a(draw, s):
    m = int(s * 0.06)
    draw.rounded_rectangle([m, m, s-m, s-m], radius=int(s*0.20), fill=(124, 92, 252))
    # Film strip holes
    hole_r = int(s * 0.028)
    for i in range(6):
        y = int(s * 0.18 + i * s * 0.115)
        draw.ellipse([s*0.12-hole_r, y-hole_r, s*0.12+hole_r, y+hole_r], fill=(90, 70, 200))
        draw.ellipse([s*0.88-hole_r, y-hole_r, s*0.88+hole_r, y+hole_r], fill=(90, 70, 200))
    # Center play
    cx, cy = s//2, s//2
    r = int(s * 0.22)
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(255,255,255,40))
    r2 = int(s * 0.18)
    draw.ellipse([cx-r2, cy-r2, cx+r2, cy+r2], fill=(255,255,255))
    ts = int(s * 0.12)
    draw.polygon([(cx-ts//3, cy-ts), (cx-ts//3, cy+ts), (cx+ts, cy)], fill=(124, 92, 252))

draw_icon("design_a.png", S, design_a)

# === Design B: 渐变 + 剪刀 ===
def design_b(draw, s):
    m = int(s * 0.06)
    for i in range(40):
        t = i / 40
        r = int(124 * (1-t) + 59 * t)
        g = int(92 * (1-t) + 130 * t)
        b = int(252 * (1-t) + 246 * t)
        x = int(m + (s - 2*m) * t)
        w = max(2, int((s - 2*m) / 40) + 1)
        draw.rectangle([x, m, x+w, s-m], fill=(r, g, b))
    draw.rounded_rectangle([m, m, s-m, s-m], radius=int(s*0.20), fill=None, outline=(255,255,255,80), width=3)
    cx, cy = s//2, s//2
    cr = int(s * 0.08)
    draw.line([(cx-int(s*0.2), cy+int(s*0.15)), (cx+int(s*0.15), cy-int(s*0.1))], fill="white", width=int(s*0.04))
    draw.line([(cx-int(s*0.2), cy-int(s*0.15)), (cx+int(s*0.15), cy+int(s*0.1))], fill="white", width=int(s*0.04))
    for dx, dy in [(-0.22, 0.17), (-0.22, -0.17)]:
        px, py = int(cx + dx*s), int(cy + dy*s)
        draw.ellipse([px-cr, py-cr, px+cr, py+cr], fill="white")

draw_icon("design_b.png", S, design_b)

# === Design C: 光流波纹 + FC ===
def design_c(draw, s):
    m = int(s * 0.06)
    draw.rounded_rectangle([m, m, s-m, s-m], radius=int(s*0.20), fill=(15, 15, 30))
    cx, cy = s//2, s//2
    for i in range(6):
        r = int(s * (0.10 + i * 0.065))
        alpha = 200 - i * 28
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(124, 92, 252, max(40, alpha)), width=2)
    try:
        font = ImageFont.truetype("arial.ttf", int(s * 0.28))
    except:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0,0), "FC", font=font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    draw.text((cx - tw//2, cy - th//2 - int(s*0.02)), "FC", fill="white", font=font)
    draw.ellipse([cx+int(s*0.14), cy-int(s*0.18), cx+int(s*0.19), cy-int(s*0.13)], fill=(124, 92, 252))

draw_icon("design_c.png", S, design_c)

# === Design D: 播放 + 光流线 ===
def design_d(draw, s):
    m = int(s * 0.06)
    draw.rounded_rectangle([m, m, s-m, s-m], radius=int(s*0.20), fill=(20, 16, 48))
    for i in range(10):
        x0 = int(s * (0.08 + i * 0.1))
        draw.line([(x0, s*0.72), (x0 + s*0.14, s*0.28)], fill=(124, 92, 252, 25 + i*12), width=3)
    cx, cy = s//2, s//2
    ts = int(s * 0.22)
    draw.polygon([(cx-ts//2, cy-ts), (cx-ts//2, cy+ts), (cx+ts, cy)], fill=(124, 92, 252))
    for i in range(3):
        r = int(ts * (1.3 + i * 0.15))
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(124, 92, 252, 40 - i*12), width=2)

draw_icon("design_d.png", S, design_d)

print("\nAll 4 designs done!")
