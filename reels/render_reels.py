#!/usr/bin/env python3
"""Premium motion-design Reels renderer (9:16, 1080x1920, 30 fps).

Renders a fully procedural, voiceover-synced vertical video from a word-level
timestamp file (words.json) using Pillow + numpy, then muxes with ffmpeg.

Usage:
    python3 reels/render_reels.py --audio vo.mp3 --words words.json --fonts fonts/ --out reels.mp4
"""
import argparse, json, math, os, random, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H, FPS = 1080, 1920, 30
DURATION = 106.5

# ---------------------------------------------------------------- palette
BG = (7, 9, 15)
WHITE = (255, 255, 255)
VIOLET = (124, 92, 255)
CYAN = (34, 211, 238)
GOLD = (255, 176, 32)
RED = (255, 77, 109)
GREEN = (34, 229, 138)
GREY = (120, 128, 150)
WB = (203, 17, 171)  # Wildberries magenta

# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0): return a if x < a else b if x > b else x
def lerp(a, b, t): return a + (b - a) * t
def prog(t, a, b): return clamp((t - a) / max(1e-6, (b - a)))
def ease_out_expo(x): return 1 if x >= 1 else 1 - 2 ** (-10 * x)
def ease_out_cubic(x): return 1 - (1 - x) ** 3
def ease_in_cubic(x): return x ** 3
def ease_in_out(x): return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
def ease_out_back(x, s=1.70158): return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2
def ease_out_elastic(x):
    if x <= 0: return 0
    if x >= 1: return 1
    return 2 ** (-10 * x) * math.sin((x * 10 - 0.75) * (2 * math.pi / 3)) + 1
def pulse(t, f=2.0): return 0.5 + 0.5 * math.sin(t * f * math.tau)

def rgba(c, a=1.0): return (c[0], c[1], c[2], int(255 * clamp(a)))
def mix(c1, c2, t): return tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))

# ---------------------------------------------------------------- fonts
FONT_DIR = "fonts"
@lru_cache(maxsize=None)
def font(kind, size):
    names = {"black": "InterDisplay-Black.ttf", "xbold": "InterDisplay-ExtraBold.ttf",
             "bold": "InterDisplay-Bold.ttf", "semi": "Inter-SemiBold.ttf",
             "med": "Inter-Medium.ttf", "dmed": "InterDisplay-Medium.ttf", "tbold": "Inter-Bold.ttf"}
    return ImageFont.truetype(os.path.join(FONT_DIR, names[kind]), int(size))

def fmt_rub(n):
    n = int(n)
    return f"{n:,}".replace(",", " ") + " ₽"

# ---------------------------------------------------------------- layers
def new_layer(): return Image.new("RGBA", (W, H), (0, 0, 0, 0))

def glow(layer, radius=24, gain=1.0, scale=4):
    """Cheap bloom: downscale, blur, upscale, boost alpha."""
    small = layer.resize((W // scale, H // scale), Image.BILINEAR).filter(ImageFilter.GaussianBlur(radius / scale))
    g = small.resize((W, H), Image.BILINEAR)
    if gain != 1.0:
        a = g.getchannel("A").point(lambda v: min(255, int(v * gain)))
        g.putalpha(a)
    return g

def composite_glow(base, layer, radius=24, gain=0.9):
    base.alpha_composite(glow(layer, radius, gain))
    base.alpha_composite(layer)

def set_alpha(layer, a):
    if a >= 1: return layer
    ch = layer.getchannel("A").point(lambda v: int(v * a))
    out = layer.copy(); out.putalpha(ch); return out

def scaled(layer, s, cx=W / 2, cy=H / 2):
    if abs(s - 1) < 1e-3: return layer
    nw, nh = max(1, int(W * s)), max(1, int(H * s))
    r = layer.resize((nw, nh), Image.BILINEAR)
    out = new_layer()
    out.paste(r, (int(cx - nw * cx / W), int(cy - nh * cy / H)), r)
    return out

def shifted(layer, dx, dy):
    if abs(dx) < 1 and abs(dy) < 1: return layer
    out = new_layer(); out.paste(layer, (int(dx), int(dy)), layer); return out

def rotated(layer, deg, center):
    if abs(deg) < 0.05: return layer
    return layer.rotate(deg, resample=Image.BILINEAR, center=center)

def iris(layer, r, cx=W / 2, cy=H / 2, feather=30):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    if feather: m = m.filter(ImageFilter.GaussianBlur(feather))
    out = layer.copy(); out.putalpha(ImageChops.multiply(layer.getchannel("A"), m)); return out

# ---------------------------------------------------------------- text
def text_img(s, kind, size, color, alpha=1.0, pad=40, tracking=0):
    f = font(kind, size)
    if tracking:
        widths = [f.getlength(ch) for ch in s]
        tw = int(sum(widths) + tracking * (len(s) - 1))
    else:
        tw = int(f.getlength(s))
    asc, desc = f.getmetrics()
    im = Image.new("RGBA", (tw + pad * 2, asc + desc + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if tracking:
        x = pad
        for ch, wdt in zip(s, widths):
            d.text((x, pad), ch, font=f, fill=rgba(color, alpha)); x += wdt + tracking
    else:
        d.text((pad, pad), s, font=f, fill=rgba(color, alpha))
    return im

def paste_center(layer, im, cx, cy, scale=1.0, rot=0.0):
    if abs(scale - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if abs(rot) > 0.05:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    layer.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))

def draw_text(layer, s, cx, cy, kind="black", size=90, color=WHITE, alpha=1.0, scale=1.0, rot=0.0, tracking=0):
    if alpha <= 0.005 or scale <= 0.005: return
    paste_center(layer, text_img(s, kind, size, color, alpha, tracking=tracking), cx, cy, scale, rot)

def slam(layer, s, cx, cy, t, t0, dur=0.35, kind="black", size=110, color=WHITE, **kw):
    """Text slams in: from 2.2x + transparent to 1.0x."""
    p = prog(t, t0, t0 + dur)
    if p <= 0: return
    e = ease_out_expo(p)
    draw_text(layer, s, cx, cy, kind, size, color, alpha=min(1, p * 3), scale=lerp(2.2, 1.0, e), **kw)

def rise(layer, s, cx, cy, t, t0, dur=0.45, kind="black", size=90, color=WHITE, dist=80, **kw):
    p = prog(t, t0, t0 + dur)
    if p <= 0: return
    e = ease_out_cubic(p)
    draw_text(layer, s, cx, cy + dist * (1 - e), kind, size, color, alpha=e, **kw)

def letters(layer, s, cx, cy, t, t0, kind="black", size=120, color=WHITE, stagger=0.045, dur=0.32, mode="drop"):
    f = font(kind, size)
    widths = [f.getlength(ch) for ch in s]
    total = sum(widths); x = cx - total / 2
    for i, (ch, wdt) in enumerate(zip(s, widths)):
        p = prog(t, t0 + i * stagger, t0 + i * stagger + dur)
        if p > 0 and ch != " ":
            e = ease_out_back(p)
            if mode == "drop":
                draw_text(layer, ch, x + wdt / 2, cy - 120 * (1 - e), kind, size, color, alpha=min(1, p * 2), scale=lerp(1.6, 1, e))
            else:
                draw_text(layer, ch, x + wdt / 2, cy, kind, size, color, alpha=min(1, p * 2), scale=lerp(0.2, 1, e))
        x += wdt

# ---------------------------------------------------------------- shapes
def rrect(layer, box, r, fill=None, outline=None, width=2):
    ImageDraw.Draw(layer).rounded_rectangle(box, r, fill=fill, outline=outline, width=width)

def glass_card(layer, box, r=36, alpha=1.0, tint=(255, 255, 255), fill_a=0.07, border_a=0.22):
    rrect(layer, box, r, fill=rgba(tint, fill_a * alpha), outline=rgba(WHITE, border_a * alpha), width=2)

def pill(layer, cx, cy, s, color, t_alpha=1.0, size=34, kind="bold", fg=WHITE, padx=34, pady=18, scale=1.0):
    f = font(kind, size); tw = f.getlength(s)
    w, h = (tw + padx * 2) * scale, (size + pady * 2) * scale
    rrect(layer, [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], h / 2, fill=rgba(color, t_alpha))
    draw_text(layer, s, cx, cy, kind, size, fg, alpha=t_alpha, scale=scale)

def arrow(layer, p0, p1, color, width=10, head=34, alpha=1.0):
    d = ImageDraw.Draw(layer)
    d.line([p0, p1], fill=rgba(color, alpha), width=width)
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    a1 = (p1[0] - head * math.cos(ang - 0.5), p1[1] - head * math.sin(ang - 0.5))
    a2 = (p1[0] - head * math.cos(ang + 0.5), p1[1] - head * math.sin(ang + 0.5))
    d.polygon([p1, a1, a2], fill=rgba(color, alpha))

def polyline_progress(layer, pts, p, color, width=10, alpha=1.0, dot=True):
    """Draw polyline up to fraction p of its length."""
    if p <= 0: return None
    segs = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total = sum(segs); target = total * clamp(p); acc = 0; out = [pts[0]]
    for i, sl in enumerate(segs):
        if acc + sl >= target:
            f = (target - acc) / sl
            out.append((lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f))); break
        acc += sl; out.append(pts[i + 1])
    d = ImageDraw.Draw(layer)
    d.line(out, fill=rgba(color, alpha), width=width, joint="curve")
    if dot:
        x, y = out[-1]; r = width * 1.3
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(WHITE, alpha))
    return out[-1]

def person(layer, cx, cy, r, color, alpha=1.0):
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - r * .45, cy - r, cx + r * .45, cy - r * .1], fill=rgba(color, alpha))
    d.rounded_rectangle([cx - r, cy + r * .05, cx + r, cy + r * 1.1], r * .5, fill=rgba(color, alpha))

def icon(layer, name, cx, cy, s, color, alpha=1.0):
    """Minimal geometric icons."""
    d = ImageDraw.Draw(layer); c = rgba(color, alpha); w = max(3, int(s * 0.11))
    if name == "percent":
        d.line([(cx - s * .4, cy + s * .4), (cx + s * .4, cy - s * .4)], fill=c, width=w)
        d.ellipse([cx - s * .5, cy - s * .5, cx - s * .1, cy - s * .1], outline=c, width=w)
        d.ellipse([cx + s * .1, cy + s * .1, cx + s * .5, cy + s * .5], outline=c, width=w)
    elif name == "truck":
        d.rounded_rectangle([cx - s * .55, cy - s * .3, cx + s * .1, cy + s * .2], s * .08, outline=c, width=w)
        d.rounded_rectangle([cx + s * .1, cy - s * .1, cx + s * .5, cy + s * .2], s * .06, outline=c, width=w)
        for x in (cx - s * .3, cx + s * .3): d.ellipse([x - s * .12, cy + s * .2, x + s * .12, cy + s * .44], fill=c)
    elif name == "box":
        d.rounded_rectangle([cx - s * .45, cy - s * .35, cx + s * .45, cy + s * .45], s * .08, outline=c, width=w)
        d.line([(cx - s * .45, cy - s * .05), (cx + s * .45, cy - s * .05)], fill=c, width=w)
        d.line([(cx, cy - s * .35), (cx, cy - s * .05)], fill=c, width=w)
    elif name == "warehouse":
        d.polygon([(cx - s * .5, cy), (cx, cy - s * .45), (cx + s * .5, cy)], outline=c, width=w)
        d.rectangle([cx - s * .5, cy, cx + s * .5, cy + s * .45], outline=c, width=w)
        d.rectangle([cx - s * .18, cy + s * .1, cx + s * .18, cy + s * .45], fill=c)
    elif name == "megaphone":
        d.polygon([(cx - s * .5, cy - s * .15), (cx + s * .35, cy - s * .45), (cx + s * .35, cy + s * .45), (cx - s * .5, cy + s * .15)], outline=c, width=w)
        d.line([(cx - s * .3, cy + s * .15), (cx - s * .2, cy + s * .5)], fill=c, width=w)
    elif name == "tag":
        d.polygon([(cx - s * .5, cy - s * .35), (cx + s * .15, cy - s * .35), (cx + s * .5, cy), (cx + s * .15, cy + s * .35), (cx - s * .5, cy + s * .35)], outline=c, width=w)
        d.ellipse([cx - s * .35, cy - s * .1, cx - s * .15, cy + s * .1], fill=c)
    elif name == "return":
        d.arc([cx - s * .45, cy - s * .45, cx + s * .45, cy + s * .45], 200, 500, fill=c, width=w)
        d.polygon([(cx - s * .55, cy - s * .2), (cx - s * .15, cy - s * .3), (cx - s * .3, cy + s * .1)], fill=c)
    elif name == "tax":
        d.rounded_rectangle([cx - s * .35, cy - s * .45, cx + s * .35, cy + s * .45], s * .06, outline=c, width=w)
        for i in range(3): d.line([(cx - s * .2, cy - s * .2 + i * s * .2), (cx + s * .2, cy - s * .2 + i * s * .2)], fill=c, width=w)
    elif name == "cart":
        d.line([(cx - s * .55, cy - s * .4), (cx - s * .35, cy - s * .4), (cx - s * .15, cy + s * .15), (cx + s * .4, cy + s * .15), (cx + s * .5, cy - s * .2), (cx - s * .3, cy - s * .2)], fill=c, width=w, joint="curve")
        for x in (cx - s * .1, cx + s * .35): d.ellipse([x - s * .08, cy + s * .3, x + s * .08, cy + s * .46], fill=c)
    elif name == "eye":
        d.ellipse([cx - s * .6, cy - s * .32, cx + s * .6, cy + s * .32], outline=c, width=w)
        d.ellipse([cx - s * .2, cy - s * .2, cx + s * .2, cy + s * .2], fill=c)
    elif name == "doc":
        d.rounded_rectangle([cx - s * .38, cy - s * .5, cx + s * .38, cy + s * .5], s * .06, outline=c, width=w)
        for i in range(4): d.line([(cx - s * .22, cy - s * .25 + i * s * .17), (cx + (s * .22 if i < 3 else s * .02), cy - s * .25 + i * s * .17)], fill=c, width=max(2, w // 2))
    elif name == "check":
        d.line([(cx - s * .4, cy), (cx - s * .1, cy + s * .3), (cx + s * .45, cy - s * .35)], fill=c, width=w, joint="curve")
    elif name == "coin":
        d.ellipse([cx - s * .5, cy - s * .5, cx + s * .5, cy + s * .5], fill=c)
        d.ellipse([cx - s * .36, cy - s * .36, cx + s * .36, cy + s * .36], outline=rgba(BG, alpha * .55), width=max(2, w // 2))

def glitch(layer, t, strength=1.0, seed=1):
    """RGB split + horizontal slice offsets."""
    if strength <= 0: return layer
    rnd = random.Random(int(t * 60) + seed)
    out = layer.copy()
    for _ in range(int(6 * strength)):
        y = rnd.randint(0, H - 40); h = rnd.randint(8, 70); dx = rnd.randint(-40, 40) * strength
        sl = layer.crop((0, y, W, y + h)); out.paste(sl, (int(dx), y))
    r, g, b, a = out.split()
    off = int(8 * strength)
    rr = ImageChops.offset(r, off, 0); bb = ImageChops.offset(b, -off, 0)
    return Image.merge("RGBA", (rr, g, bb, a))

# ---------------------------------------------------------------- background
def radial_blob(r, color, peak=0.55):
    y, x = np.ogrid[-r:r, -r:r]
    d = np.sqrt(x * x + y * y) / r
    a = np.clip(1 - d, 0, 1) ** 2.2 * peak * 255
    im = np.zeros((2 * r, 2 * r, 4), np.uint8)
    im[..., 0], im[..., 1], im[..., 2] = color; im[..., 3] = a.astype(np.uint8)
    return Image.fromarray(im, "RGBA")

def make_base():
    y = np.linspace(0, 1, H)[:, None]; x = np.linspace(0, 1, W)[None, :]
    top = np.array([12, 14, 26]); bot = np.array([5, 6, 10])
    img = top * (1 - y) + bot * y
    img = np.repeat(img[:, None, :], W, axis=1)
    # subtle grid
    gx = ((np.arange(W) % 120) == 0).astype(float)[None, :, None]
    gy = ((np.arange(H) % 120) == 0).astype(float)[:, None, None]
    img = img + (gx + gy) * 9
    # vignette
    vx = (x - 0.5) * 2; vy = (y - 0.5) * 2
    v = 1 - 0.45 * np.clip(np.sqrt(vx * vx + vy * vy) - 0.5, 0, 1)
    img = img * v[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

BASE = None; BLOB_V = None; BLOB_C = None; BLOB_R = None; BLOB_G = None; BLOB_A = None
def init_globals():
    global BASE, BLOB_V, BLOB_C, BLOB_R, BLOB_G, BLOB_A
    BASE = make_base()
    BLOB_V = radial_blob(700, VIOLET, 0.42); BLOB_C = radial_blob(600, CYAN, 0.30)
    BLOB_R = radial_blob(800, RED, 0.35); BLOB_G = radial_blob(700, GREEN, 0.30); BLOB_A = radial_blob(800, GOLD, 0.32)

PARTS = [(random.Random(i).random(), random.Random(i + 1).random(), random.Random(i + 2).random()) for i in range(90)]
STREAKS = [(random.Random(300 + i).random(), random.Random(400 + i).random()) for i in range(14)]

def background(t, mood="violet", energy=1.0):
    bg = BASE.copy()
    ox = math.sin(t * 0.25) * 120; oy = math.cos(t * 0.19) * 90
    if mood in ("violet", "mixed"):
        bg.alpha_composite(BLOB_V, (int(-350 + ox), int(-200 + oy)))
        bg.alpha_composite(BLOB_C, (int(500 - ox), int(1200 - oy)))
    if mood == "red":
        bg.alpha_composite(BLOB_R, (int(-300 + ox), int(300 + oy)))
        bg.alpha_composite(BLOB_V, (int(500 - ox), int(1100 - oy)))
    if mood == "green":
        bg.alpha_composite(BLOB_G, (int(-250 + ox), int(200 + oy)))
        bg.alpha_composite(BLOB_C, (int(450 - ox), int(1150 - oy)))
    if mood == "gold":
        bg.alpha_composite(BLOB_A, (int(-300 + ox), int(200 + oy)))
        bg.alpha_composite(BLOB_V, (int(450 - ox), int(1200 - oy)))
    if mood == "dark":
        bg.alpha_composite(set_alpha(BLOB_V, 0.35), (int(-350 + ox), int(300 + oy)))
    # particles (slow parallax dust)
    pl = new_layer(); d = ImageDraw.Draw(pl)
    for i, (px, py, pz) in enumerate(PARTS):
        depth = 0.4 + pz
        x = (px * W + t * 12 * depth * energy + math.sin(t * .7 + i) * 8) % W
        y = (py * H - t * 40 * depth * energy) % H
        r = 1.2 + pz * 3.2; a = 0.25 + pz * 0.5
        col = CYAN if i % 3 == 0 else WHITE if i % 3 == 1 else VIOLET
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(col, a))
    bg.alpha_composite(pl)
    return bg

def light_streaks(layer, t, alpha=1.0, speed=1.0):
    d = ImageDraw.Draw(layer)
    for i, (sx, sy) in enumerate(STREAKS):
        y = (sy * H + math.sin(i) * 60)
        x = (sx * W * 2 + t * 2600 * speed * (0.6 + sx)) % (W * 2) - W * 0.5
        ln = 180 + sx * 260
        col = CYAN if i % 2 else VIOLET
        d.line([(x, y), (x + ln, y)], fill=rgba(col, alpha * 0.55), width=3)

def sparkles(layer, t, cx, cy, n=18, r=260, seed=5, alpha=1.0, color=GOLD):
    d = ImageDraw.Draw(layer); rnd = random.Random(seed)
    for i in range(n):
        a0 = rnd.random() * math.tau; sp = 0.4 + rnd.random(); ph = rnd.random()
        life = (t * 0.9 * sp + ph) % 1.0
        rr = r * (0.3 + life * 0.9)
        x, y = cx + math.cos(a0) * rr, cy + math.sin(a0) * rr * 0.6
        s = (1 - life) * 7 + 1; a = (1 - life) * alpha
        d.polygon([(x, y - s), (x + s * .35, y), (x, y + s), (x - s * .35, y)], fill=rgba(color, a))

# ---------------------------------------------------------------- subtitles
SUB_Y = 1530
SUB_SIZE, SUB_GAP, SUB_MAXW = 56, 22, 940
def build_sub_chunks(words):
    f = font("xbold", SUB_SIZE)
    chunks, cur = [], []
    def width(ws): return sum(f.getlength(x["w"]) for x in ws) + SUB_GAP * (len(ws) - 1)
    for wd in words:
        if wd["w"] in ("-", "—"):
            continue
        if cur and (len(cur) >= 4 or width(cur + [wd]) > SUB_MAXW):
            chunks.append(cur); cur = []
        cur.append(wd)
        end_punct = wd["w"][-1] in ".,?!:" if wd["w"] else False
        if end_punct and len(cur) >= 2:
            chunks.append(cur); cur = []
    if cur: chunks.append(cur)
    return chunks

def subtitles(layer, chunks, t, accent=GOLD):
    for ch in chunks:
        s, e = ch[0]["s"], ch[-1]["e"] + 0.15
        if not (s - 0.12 <= t <= e): continue
        p_in = ease_out_back(prog(t, s - 0.12, s + 0.14))
        f = font("xbold", SUB_SIZE)
        toks = [w["w"].replace("Wildberries", "Wildberries") for w in ch]
        widths = [f.getlength(tk) for tk in toks]; gap = SUB_GAP
        total = sum(widths) + gap * (len(toks) - 1)
        x = W / 2 - total / 2
        y = SUB_Y + 40 * (1 - p_in)
        for wd, tk, wdt in zip(ch, toks, widths):
            active = wd["s"] <= t < wd["e"] + 0.05
            done = t >= wd["e"] + 0.05
            col = accent if active else WHITE if done else (200, 205, 220)
            sc = 1.0 + (0.08 * ease_out_back(prog(t, wd["s"], wd["s"] + 0.16)) if active else 0)
            if active:
                rrect(layer, [x - 14, y - 44, x + wdt + 14, y + 44], 22, fill=rgba(accent, 0.16 * p_in))
            draw_text(layer, tk, x + wdt / 2, y, "xbold", SUB_SIZE, col, alpha=p_in, scale=sc)
            x += wdt + gap
        break

# ---------------------------------------------------------------- scenes
# Each scene: (start, end, in_type, out_type, mood, fn)
# fn(layer, t, lt) draws on an RGBA layer; lt = local time.

def s01_hook(L, t, lt):
    # counter explosion
    light_streaks(L, t, alpha=min(1, lt * 2) * (1 - prog(lt, 2.6, 3.4)), speed=1.4)
    p = ease_out_expo(prog(lt, 0.0, 2.6))
    n = 100 + (900_000 - 100) * p
    rise(L, "ПРОДАЖИ НА", W / 2, 640, t, 0.0, dur=0.4, kind="semi", size=52, color=(200, 205, 220))
    pill(L, W / 2, 740, "WILDBERRIES", WB, t_alpha=ease_out_back(prog(lt, 0.95, 1.3)), size=44, scale=lerp(1.4, 1, ease_out_back(prog(lt, 0.95, 1.3))))
    sc = 1 + 0.06 * math.sin(lt * 18) * (1 - p)
    draw_text(L, fmt_rub(n), W / 2, 930, "black", 150, WHITE, scale=sc * min(1, lt * 4))
    if lt > 2.0:
        e = ease_out_back(prog(lt, 2.0, 2.4))
        draw_text(L, "СОТНИ ТЫСЯЧ", W / 2, 1110, "black", 96, GOLD, alpha=e, scale=lerp(1.5, 1, e))
    sparkles(L, t, W / 2, 930, r=420, alpha=p, color=GOLD)

def s02_zero(L, t, lt):
    # number cracks and drops to ~0
    p = prog(lt, 0.2, 1.9)
    e = ease_in_cubic(p)
    n = 900_000 * (1 - e)
    col = mix(WHITE, RED, p)
    rise(L, "А ЗАРАБАТЫВАЕШЬ", W / 2, 640, t, 3.4, dur=0.4, kind="semi", size=52, color=(200, 205, 220))
    if p < 1:
        draw_text(L, fmt_rub(n), W / 2, 930, "black", 150, col, scale=lerp(1, 0.75, e))
    else:
        b = ease_out_elastic(prog(lt, 1.9, 2.6))
        draw_text(L, "≈ 0 ₽", W / 2, 930, "black", 220, RED, scale=lerp(0.4, 1, b))
        # cracks
        d = ImageDraw.Draw(L); rnd = random.Random(9)
        for i in range(4):
            pts = [(W / 2 + rnd.randint(-300, 300), 930 + rnd.randint(-160, 160))]
            for k in range(4):
                pts.append((pts[-1][0] + rnd.randint(-120, 120), pts[-1][1] + rnd.randint(-120, 120)))
            d.line(pts, fill=rgba(RED, 0.5 * b), width=3)
    # coins falling away
    d = ImageDraw.Draw(L); rnd = random.Random(3)
    for i in range(26):
        x0 = W / 2 + rnd.randint(-400, 400); dl = rnd.random() * 1.2
        pp = prog(lt, 0.3 + dl, 1.8 + dl)
        if 0 < pp < 1:
            y = 930 + pp * pp * 900; a = 1 - pp
            icon(L, "coin", x0 + math.sin(pp * 6 + i) * 30, y, 34, GOLD, alpha=a)
    slam(L, "ПОЧТИ НИЧЕГО", W / 2, 1140, t, 4.75, kind="black", size=88, color=WHITE)

def s03_sellers(L, t, lt):
    # crowd grid of sellers
    cols, rows = 6, 8; gx, gy = 150, 120; x0 = W / 2 - (cols - 1) * gx / 2; y0 = 520
    rnd = random.Random(2)
    stamp_t = 4.25  # 11.0s
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            dl = rnd.random() * 1.6
            pp = ease_out_back(prog(lt, 0.05 + dl, 0.35 + dl))
            if pp <= 0: continue
            red = prog(lt, 2.6 + rnd.random() * 1.4, 3.0 + rnd.random() * 1.4)
            col = mix((150, 158, 190), RED, red)
            x = x0 + c * gx; y = y0 + r * gy + 8 * math.sin(t * 2 + i)
            person(L, x, y, 34 * pp, col, alpha=0.5 + 0.5 * red)
    slam(L, "ЗВУЧИТ СТРАННО", W / 2, 380, t, 6.75, kind="black", size=84)
    if lt > stamp_t:
        e = ease_out_expo(prog(lt, stamp_t, stamp_t + 0.25))
        st = new_layer()
        rrect(st, [W / 2 - 460, 1000 - 120, W / 2 + 460, 1000 + 120], 28, fill=rgba(BG, 0.85), outline=rgba(RED, 1), width=10)
        draw_text(st, "ГЛАВНАЯ ОШИБКА", W / 2, 1000, "black", 92, RED)
        L.alpha_composite(scaled(rotated(st, -6, (W / 2, 1000)), lerp(2.4, 1, e)))

def chart_pts(y_base=1150, x0=200, x1=880, up=True, k=0):
    pts = []
    for i in range(7):
        f = i / 6
        y = y_base - (f ** 1.4 * 560 if up else 0) - 40 * math.sin(i * 1.7 + k)
        pts.append((x0 + f * (x1 - x0), y))
    return pts

def s04_revenue(L, t, lt):
    card = new_layer()
    e = ease_out_expo(prog(lt, 0, 0.45))
    box = [110, 500, 970, 1330]
    glass_card(card, box, 40, alpha=e)
    icon(card, "eye", 220, 600, 70, CYAN, alpha=e)
    draw_text(card, "ВЫРУЧКА", 560, 600, "xbold", 56, WHITE, alpha=e)
    p = prog(lt, 0.3, 2.0)
    polyline_progress(card, chart_pts(1240, 170, 900), ease_in_out(p), GREEN, width=12)
    if p > 0.2:
        draw_text(card, fmt_rub(1_000_000 * ease_in_out(p)), 560, 760, "black", 82, GREEN, alpha=min(1, (p - .2) * 4))
    L.alpha_composite(shifted(card, 0, 300 * (1 - e)))
    slam(L, "СМОТРЯТ НА", W / 2, 380, t, 12.95, kind="black", size=72, color=(200, 205, 220))

def s05_numbers(L, t, lt):
    vals = [(16.5, "100 000 ₽", 110, WHITE), (17.65, "500 000 ₽", 140, CYAN), (18.85, "1 000 000 ₽", 168, GOLD)]
    rise(L, "КРАСИВЫЕ ЦИФРЫ", W / 2, 420, t, 14.75, dur=0.4, kind="black", size=78)
    ys = [700, 920, 1180]
    for i, (t0, s, size, col) in enumerate(vals):
        p = prog(t, t0, t0 + 0.4)
        if p <= 0: continue
        e = ease_out_back(p)
        later = sum(1 for v in vals if v[0] > t0 and t >= v[0])
        shrink = 1 - 0.18 * later
        draw_text(L, s, W / 2, ys[i], "black", size, col, alpha=min(1, p * 2) * (1 - 0.35 * later), scale=lerp(2.0, 1, e) * shrink)
        if i == 2 and t > t0 + 0.3: sparkles(L, t, W / 2, ys[i], n=26, r=520, alpha=1, color=GOLD)
    # arrow-up connector
    p = prog(t, 17.9, 19.3)
    if p > 0: arrow(L, (150, 1120), (150, 1120 - 500 * ease_out_cubic(p)), GREEN, width=10, alpha=0.8)

def s06_grows(L, t, lt):
    p = ease_out_cubic(prog(lt, 0.0, 1.2))
    pts = [(160, 1250), (360, 1150), (520, 1180), (720, 900), (930, 700)]
    end = polyline_progress(L, pts, p, GREEN, width=16)
    if end and p > 0.9:
        arrow(L, (end[0] - 60, end[1] + 60), end, GREEN, width=16, head=54)
    slam(L, "БИЗНЕС", W / 2, 480, t, 21.3, kind="black", size=96)
    e = ease_out_elastic(prog(lt, 1.35, 2.0))
    draw_text(L, "РАСТЁТ", W / 2, 640, "black", 150, GREEN, alpha=min(1, e * 2), scale=lerp(0.4, 1, e))

def s07_report(L, t, lt):
    # the chart collapses in the background while a report slides in
    fall = ease_in_cubic(prog(lt, 2.6, 4.2))
    pts = [(160, 1250), (360, 1150), (520, 1180), (720, 900 + 400 * fall), (930, 700 + 700 * fall)]
    polyline_progress(L, pts, 1, mix(GREEN, RED, fall), width=14, alpha=0.6 * (1 - 0.5 * fall), dot=False)
    doc = new_layer()
    e = ease_out_expo(prog(lt, 0.5, 1.0))
    box = [140, 470, 940, 1370]
    rrect(doc, box, 34, fill=rgba((16, 19, 32), 0.96 * e), outline=rgba(WHITE, 0.25 * e), width=2)
    icon(doc, "doc", 230, 560, 70, CYAN, alpha=e)
    draw_text(doc, "ФИНАНСОВЫЙ ОТЧЁТ", 600, 560, "xbold", 46, WHITE, alpha=e)
    rows = [("Выручка", "1 000 000 ₽", WHITE), ("Комиссия", "− 250 000 ₽", RED), ("Логистика", "− 180 000 ₽", RED),
            ("Реклама", "− 220 000 ₽", RED), ("Закупка", "− 330 000 ₽", RED)]
    for i, (a, b, col) in enumerate(rows):
        rp = prog(lt, 1.1 + i * 0.22, 1.35 + i * 0.22)
        if rp <= 0: continue
        y = 680 + i * 100
        draw_text(doc, a, 320, y, "med", 38, (200, 205, 220), alpha=rp)
        draw_text(doc, b, 770, y, "bold", 40, col, alpha=rp, scale=lerp(1.3, 1, ease_out_cubic(rp)))
        ImageDraw.Draw(doc).line([(200, y + 50), (880, y + 50)], fill=rgba(WHITE, 0.08 * rp), width=2)
    rp = prog(lt, 2.7, 3.0)
    if rp > 0:
        rrect(doc, [190, 1190, 890, 1310], 24, fill=rgba(RED, 0.18 * rp), outline=rgba(RED, rp), width=3)
        draw_text(doc, "ОСТАЛОСЬ", 340, 1250, "xbold", 40, WHITE, alpha=rp)
        n = 20_000 * (1 - ease_out_cubic(prog(lt, 3.0, 4.2)))
        draw_text(doc, f"≈ {fmt_rub(n)}", 690, 1250, "black", 56, RED, alpha=rp)
    L.alpha_composite(shifted(doc, 500 * (1 - e), 0))
    slam(L, "НО ПОТОМ...", W / 2, 360, t, 22.75, kind="black", size=80)

def s08_why(L, t, lt):
    letters(L, "ПОЧЕМУ?", W / 2, 900, t, 28.3, kind="black", size=190, color=WHITE, stagger=0.05, dur=0.35, mode="drop")
    d = ImageDraw.Draw(L); p = prog(lt, 0.5, 1.2)
    if p > 0:
        r = 60 + 900 * p
        d.ellipse([W / 2 - r, 900 - r, W / 2 + r, 900 + r], outline=rgba(VIOLET, (1 - p) * 0.9), width=6)

def s09_bars(L, t, lt):
    base_y = 1300
    slam(L, "ВЫРУЧКА", 330, 520, t, 30.2, kind="black", size=72, color=CYAN)
    p1 = ease_out_expo(prog(lt, 0.5, 1.3))
    rrect(L, [190, base_y - 620 * p1, 470, base_y], 28, fill=rgba(CYAN, 0.9))
    draw_text(L, "1 000 000 ₽", 330, base_y + 60, "bold", 40, WHITE, alpha=p1)
    e = ease_out_elastic(prog(lt, 1.25, 1.9))
    draw_text(L, "≠", W / 2, 950, "black", 200, WHITE, alpha=min(1, e * 2), scale=lerp(0.3, 1, e))
    p2 = ease_out_expo(prog(lt, 1.95, 2.6))
    slam(L, "ПРИБЫЛЬ", 750, 520, t, 31.6, kind="black", size=72, color=GREEN)
    rrect(L, [610, base_y - 70 * p2, 890, base_y], 20, fill=rgba(GREEN, 0.95))
    draw_text(L, "?", 750, base_y - 160, "black", 110, GREEN, alpha=p2, scale=lerp(2, 1, p2))
    ImageDraw.Draw(L).line([(140, base_y), (940, base_y)], fill=rgba(WHITE, 0.3), width=3)

def s10_leak(L, t, lt):
    rise(L, "ИЗ КАЖДОЙ ПРОДАЖИ", W / 2, 420, t, 32.75, dur=0.4, kind="black", size=68)
    cx, cy = W / 2, 900
    e = ease_out_back(prog(lt, 0.05, 0.5))
    # a big coin stack that loses chips
    p = prog(lt, 0.9, 3.0)
    d = ImageDraw.Draw(L)
    for i in range(6):
        gone = prog(p, i / 6, (i + 1) / 6)
        y = cy + 150 - i * 62
        if gone < 1:
            d.rounded_rectangle([cx - 200 * e, y - 26, cx + 200 * e, y + 26], 26, fill=rgba(mix(GOLD, (140, 100, 40), i / 6), 1 - gone))
        # flying chunk
        if 0 < gone < 1:
            fx = cx + 200 + gone * 500; fy = y + gone * gone * 600
            d.rounded_rectangle([fx - 60, fy - 22, fx + 60, fy + 22], 20, fill=rgba(RED, 1 - gone))
    icon(L, "coin", cx, cy - 300, 70 * e, GOLD)
    sparkles(L, t, cx, cy, n=22, r=380, seed=11, alpha=p, color=RED)
    slam(L, "ИСЧЕЗАЮТ ДЕНЬГИ", W / 2, 1300, t, 34.65, kind="black", size=78, color=RED)

COSTS = [(36.24, "Комиссия WB", "percent", 22), (38.0, "Логистика", "truck", 14), (38.96, "Хранение", "warehouse", 6),
         (40.4, "Реклама", "megaphone", 18), (41.36, "Скидки", "tag", 10), (42.32, "Возвраты", "return", 6),
         (43.36, "Налоги", "tax", 7), (44.32, "Закупка", "cart", 12)]

def s11_waterfall(L, t, lt):
    top, bot = 520, 1340; bx0, bx1 = 130, 330
    pct = 100.0
    d = ImageDraw.Draw(L)
    e0 = ease_out_expo(prog(lt, 0, 0.4))
    # bar background
    rrect(L, [bx0, top, bx1, bot], 26, fill=rgba(WHITE, 0.06 * e0), outline=rgba(WHITE, 0.2 * e0), width=2)
    for i, (t0, name, ic, share) in enumerate(COSTS):
        p = prog(t, t0, t0 + 0.45)
        if p <= 0: break
        pe = ease_out_cubic(p)
        pct -= share * pe
        # sliced chunk flying right
        y_top = top + (bot - top) * (1 - (pct + share * pe) / 100)
        h = (bot - top) * share / 100 * pe
        fx = bx1 + 60 + 120 * pe
        d.rounded_rectangle([fx, y_top, fx + 120, y_top + h], 12, fill=rgba(RED, 0.9 * (1 - pe * 0.5)))
        # chip
        y = 560 + i * 98
        cx = 700 + 400 * (1 - ease_out_back(p))
        chip = new_layer()
        rrect(chip, [cx - 240, y - 40, cx + 240, y + 40], 40, fill=rgba(RED, 0.16), outline=rgba(RED, 0.7), width=2)
        icon(chip, ic, cx - 190, y, 44, RED)
        draw_text(chip, name, cx + 20, y, "bold", 40, WHITE)
        L.alpha_composite(set_alpha(chip, min(1, p * 2)))
    fill_h = (bot - top) * pct / 100
    col = mix(GREEN, RED, prog(100 - pct, 30, 90))
    rrect(L, [bx0, bot - fill_h, bx1, bot], 26, fill=rgba(col, 0.95 * e0))
    draw_text(L, f"{int(pct)}%", 230, bot - fill_h - 50, "black", 60, WHITE, alpha=e0)
    rise(L, "ЧТО ОСТАЁТСЯ?", 230, 440, t, 36.2, dur=0.4, kind="xbold", size=40, color=(200, 205, 220))

def s12_unnoticed(L, t, lt):
    a = 0.35 + 0.25 * pulse(t, 0.8)
    e = ease_out_cubic(prog(lt, 0.1, 1.2))
    draw_text(L, "САМОЕ ОПАСНОЕ", W / 2, 820, "black", 84, WHITE, alpha=e)
    p = prog(lt, 1.7, 2.6)
    draw_text(L, "НЕЗАМЕТНО", W / 2, 990, "black", 132, VIOLET, alpha=p * a + p * 0.4, scale=lerp(1.25, 1, ease_out_cubic(p)), tracking=int(30 * (1 - p)))
    # eyelids closing
    d = ImageDraw.Draw(L); lid = ease_in_out(prog(lt, 1.4, 2.8)) * 0.55
    d.rectangle([0, 0, W, H * lid], fill=rgba(BG, 0.92))
    d.rectangle([0, H * (1 - lid), W, H], fill=rgba(BG, 0.92))

def s13_treadmill(L, t, lt):
    light_streaks(L, t, alpha=min(1, lt) * 0.7, speed=1.8)
    # steep turnover line
    p = ease_in_out(prog(lt, 0.2, 7.0))
    pts = [(120, 1250), (300, 1180), (440, 1120), (600, 950), (760, 760), (940, 520)]
    polyline_progress(L, pts, p, CYAN, width=14)
    draw_text(L, "ОБОРОТ", 260, 1330, "xbold", 44, CYAN, alpha=min(1, lt * 2))
    n = 1_000_000 + 4_000_000 * p
    draw_text(L, fmt_rub(n), 640, 1330, "black", 56, WHITE, alpha=min(1, lt * 2))
    chips = [(50.85, "БОЛЬШЕ ПРОДАЖ"), (52.6, "БОЛЬШЕ РЕКЛАМЫ"), (55.4, "НОВЫЕ ПАРТИИ"), (56.8, "БОЛЬШЕ ОБОРОТА")]
    for i, (t0, s) in enumerate(chips):
        pp = prog(t, t0, t0 + 0.35)
        if pp <= 0: continue
        e = ease_out_back(pp)
        y = 470 + i * 96; x = 560 + 500 * (1 - e) * (1 if i % 2 else -1)
        pill(L, x, y, s, VIOLET if i % 2 == 0 else CYAN, t_alpha=min(1, pp * 2), size=40, scale=lerp(1.3, 1, e))
    # multiplying boxes
    for i in range(9):
        pp = prog(t, 54.3 + i * 0.16, 54.6 + i * 0.16)
        if pp > 0:
            icon(L, "box", 180 + (i % 3) * 110, 700 + (i // 3) * 110, 70 * ease_out_back(pp), GOLD, alpha=min(1, pp * 2))
    pp = prog(t, 51.5, 52.2)
    if pp > 0:
        icon(L, "megaphone", 830, 1000, 110 * ease_out_back(pp), RED, alpha=min(1, pp * 2))
        draw_text(L, "+ РЕКЛАМА", 830, 1100, "bold", 36, RED, alpha=pp)

def s14_flat(L, t, lt):
    pts = [(120, 1250), (300, 1180), (440, 1120), (600, 950), (760, 760), (940, 520)]
    polyline_progress(L, pts, 1, CYAN, width=14, alpha=0.8, dot=False)
    draw_text(L, "ОБОРОТ", 260, 1330, "xbold", 44, CYAN, alpha=0.8)
    p = ease_in_out(prog(lt, 1.1, 2.6))
    flat = [(120, 1230), (400, 1225), (700, 1235), (940, 1228)]
    end = polyline_progress(L, flat, p, GREEN, width=14)
    slam(L, "НО ПРИБЫЛЬ", W / 2, 420, t, 58.8, kind="black", size=84)
    draw_text(L, "НЕ РАСТЁТ", W / 2, 560, "black", 120, RED, alpha=ease_out_cubic(prog(lt, 2.4, 2.8)), scale=lerp(1.6, 1, ease_out_expo(prog(lt, 2.4, 2.8))))
    if p > 0.5:
        # gap bracket
        d = ImageDraw.Draw(L); a = (p - .5) * 2
        d.line([(940, 540), (940, 1210)], fill=rgba(RED, 0.8 * a), width=6)
        for y in (540, 1210): d.line([(915, y), (965, y)], fill=rgba(RED, 0.8 * a), width=6)
        draw_text(L, "РАЗРЫВ", 860, 880, "xbold", 40, RED, alpha=a, rot=90)

def s15_more_less(L, t, lt):
    items = [(63.15, "РАБОТАЕТ"), (64.35, "РИСКУЕТ"), (65.8, "ПРОДАЁТ")]
    for i, (t0, s) in enumerate(items):
        p = prog(t, t0, t0 + 0.4)
        if p <= 0: continue
        e = ease_out_back(p)
        x = 200 + i * 340; y = 760
        draw_text(L, s, x, y + 120, "xbold", 46, WHITE, alpha=p)
        arrow(L, (x, y + 30), (x, y - 160 * e), GREEN, width=16, head=50, alpha=p)
        draw_text(L, "БОЛЬШЕ", x, y - 240, "black", 54, GREEN, alpha=ease_out_cubic(prog(t, t0 + 0.4, t0 + 0.7)))
    p = prog(t, 67.4, 67.9)
    if p > 0:
        e = ease_out_expo(p)
        draw_text(L, "А ЗАРАБАТЫВАЕТ", W / 2, 1050, "xbold", 52, (200, 205, 220), alpha=p)
        arrow(L, (W / 2, 1120), (W / 2, 1120 + 200 * e), RED, width=22, head=70, alpha=p)
        b = ease_out_elastic(prog(t, 68.2, 68.9))
        draw_text(L, "МЕНЬШЕ", W / 2, 1420, "black", 130, RED, alpha=min(1, b * 2), scale=lerp(0.3, 1, b))

def s16_not_sales(L, t, lt):
    rise(L, "УСПЕШНЫЙ БИЗНЕС", W / 2, 560, t, 69.7, dur=0.45, kind="black", size=70)
    pill(L, W / 2, 700, "НА WILDBERRIES", WB, t_alpha=ease_out_back(prog(lt, 1.5, 1.85)), size=40, scale=lerp(1.3, 1, ease_out_back(prog(lt, 1.5, 1.85))))
    slam(L, "ЭТО НЕ ПРОСТО", W / 2, 880, t, 72.15, kind="xbold", size=60, color=(200, 205, 220))
    e = ease_out_expo(prog(lt, 3.15, 3.55))
    draw_text(L, "БОЛЬШИЕ", W / 2, 1020, "black", 120, WHITE, alpha=e, scale=lerp(1.8, 1, e))
    draw_text(L, "ПРОДАЖИ", W / 2, 1150, "black", 120, WHITE, alpha=e, scale=lerp(1.8, 1, e))
    p = ease_out_cubic(prog(lt, 3.75, 4.2))
    if p > 0:
        d = ImageDraw.Draw(L)
        d.line([(150, 980), (150 + 780 * p, 1190)], fill=rgba(RED, 1), width=22)
        d.line([(930, 980), (930 - 780 * p, 1190)], fill=rgba(RED, 1), width=22)

def s17_left(L, t, lt):
    e = ease_out_expo(prog(lt, 0, 0.5))
    glass_card(L, [120, 480, 960, 1380], 44, alpha=e)
    draw_text(L, "1 ПРОДАЖА", W / 2, 570, "xbold", 50, (200, 205, 220), alpha=e)
    draw_text(L, "2 490 ₽", W / 2, 660, "black", 92, WHITE, alpha=e)
    minus = [("комиссия", 550), ("логистика", 180), ("реклама", 420), ("налог", 150), ("закупка", 700)]
    x0 = 190
    for i, (nm, v) in enumerate(minus):
        p = prog(lt, 0.6 + i * 0.2, 0.85 + i * 0.2)
        if p <= 0: continue
        x = x0 + i * 170
        rrect(L, [x - 70, 760, x + 70, 850], 20, fill=rgba(RED, 0.18 * p), outline=rgba(RED, 0.6 * p), width=2)
        draw_text(L, f"−{v}", x, 790, "bold", 34, RED, alpha=p)
        draw_text(L, nm, x, 830, "med", 24, (200, 205, 220), alpha=p)
    p = prog(lt, 2.3, 2.8)
    if p > 0:
        e2 = ease_out_expo(p)
        arrow(L, (W / 2, 900), (W / 2, 900 + 120 * e2), GREEN, width=12, head=40, alpha=p)
        draw_text(L, "ОСТАЁТСЯ У ТЕБЯ", W / 2, 1090, "xbold", 52, WHITE, alpha=p)
        b = ease_out_elastic(prog(lt, 3.2, 3.9))
        n = 490 * ease_out_cubic(prog(lt, 3.2, 4.4))
        draw_text(L, fmt_rub(n), W / 2, 1230, "black", 130, GREEN, alpha=min(1, b * 2), scale=lerp(0.5, 1, b))
        sparkles(L, t, W / 2, 1230, n=24, r=420, seed=21, alpha=p, color=GREEN)
    slam(L, "ГЛАВНЫЙ ВОПРОС", W / 2, 370, t, 74.3, kind="black", size=76, color=GOLD)

def checklist_card(L, y, s, t, t0, checked=None, color=CYAN, ic="check"):
    p = prog(t, t0, t0 + 0.45)
    if p <= 0: return
    e = ease_out_back(p)
    card = new_layer()
    glass_card(card, [120, y - 90, 960, y + 90], 34, alpha=1)
    rrect(card, [170, y - 40, 250, y + 40], 18, fill=rgba(color, 0.2), outline=rgba(color, 0.9), width=3)
    if checked == "q":
        draw_text(card, "?", 210, y, "black", 52, color)
    elif checked == "x":
        icon(card, "eye", 210, y, 40, RED)
    draw_text(card, s, 600, y, "xbold", 46, WHITE)
    L.alpha_composite(shifted(set_alpha(card, min(1, p * 2)), 600 * (1 - e) * (1 if int(t0) % 2 else -1), 0))

def s18_questions(L, t, lt):
    slam(L, "ТЫ ЗНАЕШЬ?", W / 2, 440, t, 80.1, kind="black", size=90)
    checklist_card(L, 700, "Настоящую себестоимость", t, 80.9, "q", CYAN)
    checklist_card(L, 900, "Все расходы", t, 83.4, "q", CYAN)
    checklist_card(L, 1100, "Или только выручку?", t, 85.3, "x", RED)
    p = prog(t, 86.2, 86.7)
    if p > 0:
        rrect(L, [110, 1000, 970, 1200], 40, outline=rgba(RED, p), width=6)
        draw_text(L, "КРАСИВАЯ ЦИФРА", W / 2, 1300, "black", 70, RED, alpha=p, scale=lerp(1.5, 1, ease_out_expo(p)))

def s19_million(L, t, lt):
    e = ease_out_expo(prog(lt, 0.1, 0.6))
    sparkles(L, t, W / 2, 900, n=40, r=560, seed=31, alpha=e, color=GOLD)
    rise(L, "МИЛЛИОН ОБОРОТА", W / 2, 620, t, 88.1, dur=0.45, kind="xbold", size=60, color=(200, 205, 220))
    # shiny number with sweep
    im = text_img("1 000 000 ₽", "black", 150, GOLD)
    sweep = new_layer(); d = ImageDraw.Draw(sweep)
    sx = -300 + ((lt * 900) % 1600)
    tmp = Image.new("RGBA", im.size, (0, 0, 0, 0)); dd = ImageDraw.Draw(tmp)
    dd.polygon([(sx, 0), (sx + 120, 0), (sx - 60, im.height), (sx - 180, im.height)], fill=(255, 255, 255, 150))
    tmp.putalpha(ImageChops.multiply(tmp.getchannel("A"), im.getchannel("A")))
    im.alpha_composite(tmp)
    paste_center(L, set_alpha(im, e), W / 2, 900, scale=lerp(1.6, 1, e))
    p = prog(lt, 2.9, 3.3)
    draw_text(L, "= УСПЕХ?", W / 2, 1150, "black", 110, WHITE, alpha=p, scale=lerp(2, 1, ease_out_expo(p)))

def s20_through(L, t, lt):
    fade = ease_in_out(prog(lt, 0.3, 1.5))
    col = mix(GOLD, GREY, fade)
    draw_text(L, "1 000 000 ₽", W / 2, 700 - 60 * fade, "black", 150, col, alpha=1 - 0.4 * fade, scale=1 - 0.15 * fade)
    # particle stream draining through a funnel
    d = ImageDraw.Draw(L); rnd = random.Random(77)
    p = prog(lt, 0.8, 4.6)
    # funnel (hands abstraction)
    fa = ease_out_cubic(prog(lt, 0.5, 1.1))
    d.line([(300, 900), (470, 1150), (470, 1400)], fill=rgba(WHITE, 0.35 * fa), width=6)
    d.line([(780, 900), (610, 1150), (610, 1400)], fill=rgba(WHITE, 0.35 * fa), width=6)
    for i in range(140):
        ph = rnd.random(); x0 = rnd.random(); sz = 3 + rnd.random() * 6
        life = (lt * 0.7 + ph) % 1.0
        if lt < 0.8: continue
        y = 800 + life * 900
        spread = 1 - clamp((y - 900) / 250) * 0.72
        x = W / 2 + (x0 - .5) * 380 * spread + math.sin(life * 12 + i) * 8 * spread
        a = (1 - life) * 0.9 * min(1, (lt - 0.8) * 2)
        c = mix(GOLD, GREY, life)
        d.ellipse([x - sz, y - sz, x + sz, y + sz], fill=rgba(c, a))
    slam(L, "БЕЗ ПРИБЫЛИ", W / 2, 460, t, 92.3, kind="black", size=84, color=RED)
    rise(L, "ПРОШЛИ ЧЕРЕЗ РУКИ", W / 2, 1520 - 80, t, 95.7, dur=0.45, kind="xbold", size=52, color=(200, 205, 220))

def s21_cta(L, t, lt):
    e = ease_out_expo(prog(lt, 0.05, 0.45))
    slam(L, "ПРОВЕРЬ", W / 2, 760, t, 97.55, kind="black", size=130)
    slam(L, "СВОЮ ЭКОНОМИКУ", W / 2, 900, t, 98.05, kind="black", size=88, color=GOLD)
    b = ease_out_back(prog(lt, 0.9, 1.3))
    if b > 0:
        btn = new_layer()
        rrect(btn, [W / 2 - 330, 1040, W / 2 + 330, 1170], 65, fill=rgba(VIOLET, 1))
        draw_text(btn, "ПОСЧИТАТЬ ЮНИТ-ЭКОНОМИКУ", W / 2, 1105, "bold", 36, WHITE)
        L.alpha_composite(scaled(btn, lerp(0.6, 1, b), W / 2, 1105))
    light_streaks(L, t, alpha=e * 0.6, speed=1.2)

def s22_final(L, t, lt):
    # everything assembles: two-line chart + cost chips orbit + counters
    e = ease_out_expo(prog(lt, 0, 0.8))
    pts = [(160, 1060), (340, 980), (520, 860), (700, 700), (900, 520)]
    polyline_progress(L, pts, ease_in_out(prog(lt, 0.2, 2.0)), CYAN, width=14)
    flat = [(160, 1070), (420, 1065), (680, 1075), (900, 1068)]
    polyline_progress(L, flat, ease_in_out(prog(lt, 0.6, 2.4)), GREEN, width=14)
    draw_text(L, "ОБОРОТ", 900, 460, "xbold", 40, CYAN, alpha=ease_out_cubic(prog(lt, 1.8, 2.2)))
    draw_text(L, "ПРИБЫЛЬ", 900, 1130, "xbold", 40, GREEN, alpha=ease_out_cubic(prog(lt, 2.2, 2.6)))
    # orbiting cost chips
    for i, (_, name, ic, _) in enumerate(COSTS):
        p = prog(lt, 0.3 + i * 0.12, 0.7 + i * 0.12)
        if p <= 0: continue
        ang = i / len(COSTS) * math.tau + t * 0.25
        cx = W / 2 + math.cos(ang) * 420; cy = 800 + math.sin(ang) * 420
        icon(L, ic, cx, cy, 40 * ease_out_back(p), RED, alpha=0.7 * p)
    p = prog(t, 101.0, 101.5)
    draw_text(L, "БИЗНЕС РАСТЁТ", W / 2, 400, "black", 86, CYAN, alpha=p, scale=lerp(1.6, 1, ease_out_expo(p)))
    p2 = prog(t, 102.5, 103.0)
    draw_text(L, "РЕАЛЬНЫЕ ДЕНЬГИ", W / 2, 1240, "black", 72, WHITE, alpha=p2)
    b = ease_out_elastic(prog(t, 103.7, 104.4))
    draw_text(L, "НЕТ.", W / 2, 1375, "black", 150, RED, alpha=min(1, b * 2), scale=lerp(0.3, 1, b))

def s23_end(L, t, lt):
    e = ease_out_expo(prog(lt, 0, 0.6))
    draw_text(L, "IBRX", W / 2, 860, "black", 170, WHITE, alpha=e, tracking=14, scale=lerp(1.3, 1, e))
    draw_text(L, "калькулятор юнит-экономики", W / 2, 990, "med", 44, (200, 205, 220), alpha=ease_out_cubic(prog(lt, 0.3, 0.8)))
    pill(L, W / 2, 1120, "СЧИТАЙ ПРИБЫЛЬ, А НЕ ВЫРУЧКУ", VIOLET, t_alpha=ease_out_back(prog(lt, 0.6, 1.0)), size=36)
    d = ImageDraw.Draw(L); p = prog(lt, 0.2, 1.0)
    r = 100 + 700 * p
    d.ellipse([W / 2 - r, 860 - r, W / 2 + r, 860 + r], outline=rgba(VIOLET, (1 - p) * 0.8), width=6)

SCENES = [
    # start, end, in, out, mood, fn
    (0.0, 3.45, "none", "zoom", "violet", s01_hook),
    (3.45, 6.65, "cut", "iris", "red", s02_zero),
    (6.65, 12.45, "iris", "zoom", "violet", s03_sellers),
    (12.45, 14.65, "zoom", "push", "mixed", s04_revenue),
    (14.65, 20.25, "push", "flash", "gold", s05_numbers),
    (20.25, 22.65, "flash", "zoom", "green", s06_grows),
    (22.65, 28.25, "zoom", "cut", "red", s07_report),
    (28.25, 29.55, "glitch", "iris", "dark", s08_why),
    (29.55, 32.65, "iris", "push", "violet", s09_bars),
    (32.65, 36.15, "push", "zoom", "red", s10_leak),
    (36.15, 46.25, "zoom", "flash", "red", s11_waterfall),
    (46.25, 49.15, "flash", "iris", "dark", s12_unnoticed),
    (49.15, 58.5, "iris", "zoom", "violet", s13_treadmill),
    (58.5, 61.95, "zoomout", "push", "red", s14_flat),
    (61.95, 69.5, "push", "flash", "mixed", s15_more_less),
    (69.5, 74.15, "flash", "zoom", "violet", s16_not_sales),
    (74.15, 79.95, "zoom", "push", "green", s17_left),
    (79.95, 87.95, "push", "iris", "violet", s18_questions),
    (87.95, 91.85, "iris", "cut", "gold", s19_million),
    (91.85, 97.45, "glitch", "zoom", "dark", s20_through),
    (97.45, 99.35, "zoom", "flash", "violet", s21_cta),
    (99.35, 104.5, "flash", "zoom", "mixed", s22_final),
    (104.5, DURATION + 1, "zoom", "none", "violet", s23_end),
]
TR = 0.32  # transition duration

def transition_in(layer, kind, p):
    """p: 0 -> 1 as scene enters."""
    if kind in ("none", "cut") or p >= 1: return layer
    e = ease_out_expo(p)
    if kind == "zoom": return set_alpha(scaled(layer, lerp(0.7, 1, e)), e)
    if kind == "zoomout": return set_alpha(scaled(layer, lerp(1.5, 1, e)), e)
    if kind == "push": return set_alpha(shifted(layer, 0, H * 0.6 * (1 - e)), min(1, p * 2))
    if kind == "iris": return iris(layer, 1400 * e, feather=60)
    if kind == "flash": return set_alpha(scaled(layer, lerp(1.15, 1, e)), e)
    if kind == "glitch": return glitch(layer, p, strength=1 - p)
    return layer

def transition_out(layer, kind, p):
    """p: 0 -> 1 as scene leaves."""
    if kind in ("none", "cut") or p <= 0: return layer
    e = ease_in_cubic(p)
    if kind == "zoom": return set_alpha(scaled(layer, lerp(1, 1.6, e)), 1 - e)
    if kind == "push": return set_alpha(shifted(layer, 0, -H * 0.6 * e), 1 - e)
    if kind == "iris": return iris(layer, 1400 * (1 - e), feather=60)
    if kind == "flash": return set_alpha(layer, 1 - e)
    return layer

# camera hits (shake) at strong beats
HITS = [3.6, 5.4, 11.0, 18.9, 25.4, 27.2, 28.3, 31.7, 34.7, 44.3, 58.6, 61.2, 67.4, 68.3, 73.4, 77.5, 86.3, 91.0, 92.3, 97.6, 103.8]

def camera(im, t):
    # continuous slow breathing zoom + shake on hits
    zoom = 1.02 + 0.02 * math.sin(t * 0.35)
    sx = sy = 0
    for h in HITS:
        dt = t - h
        if 0 <= dt < 0.35:
            k = (1 - dt / 0.35) ** 2 * 26
            sx += math.sin(dt * 90) * k; sy += math.cos(dt * 70) * k
            zoom += 0.04 * (1 - dt / 0.35)
    cw, chh = W / zoom, H / zoom
    cx, cy = W / 2 + sx, H / 2 + sy
    box = (int(cx - cw / 2), int(cy - chh / 2), int(cx + cw / 2), int(cy + chh / 2))
    return im.crop(box).resize((W, H), Image.BILINEAR)

def flash_amount(t):
    a = 0
    for s in SCENES:
        if s[2] == "flash" and 0 <= t - s[0] < 0.2: a = max(a, (1 - (t - s[0]) / 0.2) * 0.6)
    return a

WORDS = None; CHUNKS = None
def render_frame(i):
    t = i / FPS
    mood = "violet"; energy = 1.0
    frame_layer = new_layer()
    for (s, e, tin, tout, md, fn) in SCENES:
        if not (s - TR <= t <= e + TR): continue
        lt = t - s
        L = new_layer()
        fn(L, t, lt)
        p_in = prog(t, s, s + TR); p_out = prog(t, e - TR, e)
        if t < s or (tout == "cut" and t >= e) or (tin == "cut" and t < s): continue
        L = transition_in(L, tin, p_in)
        if t > e - TR: L = transition_out(L, tout, p_out)
        if s <= t < e: mood = md
        composite_glow(frame_layer, L, radius=26, gain=0.85)
    bg = background(t, mood, energy)
    bg.alpha_composite(frame_layer)
    subs = new_layer(); subtitles(subs, CHUNKS, t)
    bg.alpha_composite(subs)
    out = camera(bg.convert("RGB"), t)
    fa = flash_amount(t)
    if fa > 0:
        out = Image.blend(out, Image.new("RGB", (W, H), (240, 240, 255)), fa)
    if t > DURATION - 0.8:  # fade out
        out = Image.blend(out, Image.new("RGB", (W, H), BG[:3]), prog(t, DURATION - 0.8, DURATION))
    return out.tobytes()

def _init(words_path, font_dir):
    global WORDS, CHUNKS, FONT_DIR
    FONT_DIR = font_dir
    WORDS = json.load(open(words_path))
    CHUNKS = build_sub_chunks(WORDS)
    init_globals()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True); ap.add_argument("--words", required=True)
    ap.add_argument("--fonts", default="fonts"); ap.add_argument("--out", default="reels.mp4")
    ap.add_argument("--ffmpeg", default=None); ap.add_argument("--frames", type=int, default=None)
    ap.add_argument("--still", type=float, default=None, help="render one frame at t seconds to PNG")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    _init(a.words, a.fonts)
    if a.still is not None:
        Image.frombytes("RGB", (W, H), render_frame(int(a.still * FPS))).save(a.out); return
    ffmpeg = a.ffmpeg or (__import__("imageio_ffmpeg").get_ffmpeg_exe())
    n = a.frames or int(DURATION * FPS)
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", a.audio, "-af", "apad", "-t", f"{n / FPS:.3f}",
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
           "-c:a", "aac", "-b:a", "192k", a.out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(a.workers, initializer=_init, initargs=(a.words, a.fonts)) as pool:
        for k, buf in enumerate(pool.imap(render_frame, range(n), chunksize=8)):
            proc.stdin.write(buf)
            if k % 150 == 0: print(f"frame {k}/{n}", file=sys.stderr, flush=True)
    proc.stdin.close(); proc.wait()
    print("done", a.out)

if __name__ == "__main__":
    main()
