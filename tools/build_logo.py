"""Genera el logo horizontal de Amauris Willmore como SVG autonomouso.

El texto se convierte a curvas con fontTools para que el logo no dependa de
que las fuentes esten instaladas en el equipo que lo renderice.
"""

import os
import random
import struct
import subprocess
import tempfile
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "assets", "icons")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# Geometria del lockup horizontal, calibrada sobre el arte original.
LOCKUP = dict(
    amauris_size=190, amauris_x=6, amauris_baseline=140,
    more_size=116, more_x=892, more_baseline=117,
    block_x=866, block_y=16, block_w=386, block_h=138, angle=-1.4,
    canvas_w=1268, canvas_h=170,
)

FONTS = r"C:\Windows\Fonts"
BLACK = "#0d0d0d"
YELLOW = "#f2e534"


def load(path):
    return TTFont(path)


def text_paths(font, text, size, x, baseline, tracking=0.0):
    """Devuelve (paths, ancho_total). Cada curva lleva su propia escala."""
    glyphset = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm

    out = []
    cursor = 0.0
    for ch in text:
        name = cmap[ord(ch)]
        glyph = glyphset[name]
        pen = SVGPathPen(glyphset)
        glyph.draw(pen)
        commands = pen.getCommands()
        if commands:
            out.append((x + cursor, commands))
        cursor += glyph.width * scale + tracking
    return out, cursor


def rough_block(x, y, w, h, seed=7, jitter=3.0, steps=16):
    """Rectangulo con bordes rasgados, como el bloque amarillo del logo."""
    rng = random.Random(seed)
    pts = []

    def edge(x0, y0, x1, y1):
        for i in range(steps):
            t = i / steps
            px = x0 + (x1 - x0) * t
            py = y0 + (y1 - y0) * t
            nx, ny = (y1 - y0), -(x1 - x0)
            length = (nx ** 2 + ny ** 2) ** 0.5 or 1
            d = rng.uniform(-jitter, jitter)
            pts.append((px + nx / length * d, py + ny / length * d))

    edge(x, y, x + w, y)
    edge(x + w, y, x + w, y + h)
    edge(x + w, y + h, x, y + h)
    edge(x, y + h, x, y)
    pts.append(pts[0])

    return "M" + " L".join(f"{px:.1f} {py:.1f}" for px, py in pts) + " Z"


def build(amauris_size, amauris_x, amauris_baseline, more_size, more_x,
          more_baseline, block_x, block_y, block_w, block_h, angle,
          canvas_w, canvas_h, amauris_font="Poppins-Bold.ttf",
          more_font="Poppins-Medium.ttf", a_tracking=0.0, m_tracking=0.0,
          brand_color=BLACK, seed=7, jitter=3.0, amauris_text="amauris"):
    scale_ref = 1.0
    f_bold = load(f"{FONTS}\\{amauris_font}")
    f_more = load(f"{FONTS}\\{more_font}")

    def esc(d):
        return d

    body = []
    for cx, d in text_paths(f_bold, amauris_text, amauris_size, 0, 0, a_tracking)[0]:
        s = amauris_size / f_bold["head"].unitsPerEm
        body.append(
            f'    <path fill="{brand_color}" d="{esc(d)}" '
            f'transform="translate({cx + amauris_x:.1f},{amauris_baseline}) '
            f'scale({s * scale_ref:.6f},{-s * scale_ref:.6f})"/>'
        )

    for cx, d in text_paths(f_more, "more", more_size, 0, 0, m_tracking)[0]:
        s = more_size / f_more["head"].unitsPerEm
        body.append(
            f'    <path fill="{BLACK}" d="{esc(d)}" '
            f'transform="translate({cx + more_x:.1f},{more_baseline}) '
            f'scale({s * scale_ref:.6f},{-s * scale_ref:.6f})"/>'
        )

    block = rough_block(block_x, block_y, block_w, block_h, seed=seed, jitter=jitter)
    cxb = block_x + block_w / 2
    cyb = block_y + block_h / 2

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_w} {canvas_h}" width="{canvas_w}" height="{canvas_h}">
  <g>
    <path fill="{YELLOW}" d="{block}" transform="rotate({angle} {cxb} {cyb})"/>
{chr(10).join(body)}
  </g>
</svg>
'''
    return svg


def build_mark(size=512, block_ratio=2.797, pad=0.11, jitter=3.0, seed=7):
    """Version cuadrada para favicon y PWA: solo el bloque amarillo con 'more'."""
    block_w = size * (1 - 2 * pad)
    block_h = block_w / block_ratio
    x0 = (size - block_w) / 2
    y0 = (size - block_h) / 2

    more_size = block_w / 2.74 * 0.82
    more_width = 2.74 * more_size
    more_x = x0 + (block_w - more_width) / 2
    x_height = 0.551 * more_size
    more_baseline = y0 + (block_h + x_height) / 2

    return build(
        amauris_size=more_size, amauris_x=0, amauris_baseline=0,
        amauris_text="", more_font="Poppins-Medium.ttf",
        more_size=more_size, more_x=more_x, more_baseline=more_baseline,
        block_x=x0, block_y=y0, block_w=block_w, block_h=block_h, angle=0,
        canvas_w=size, canvas_h=size, seed=seed, jitter=jitter,
    )


def build_ico(sources, path):
    """Empaqueta PNGs multirresolucion en un .ico (con PNG embebido)."""
    offset = 6 + 16 * len(sources)
    header = struct.pack("<HHH", 0, 1, len(sources))
    directory = b""
    blobs = []
    for png in sources:
        with open(png, "rb") as fh:
            data = fh.read()
        dim = int.from_bytes(data[16:20], "big")
        size_byte = 0 if dim >= 256 else dim
        directory += struct.pack(
            "<BBBBHHII", size_byte, size_byte, 0, 0, 1, 32, len(data), offset
        )
        offset += len(data)
        blobs.append(data)

    with open(path, "wb") as fh:
        fh.write(header + directory + b"".join(blobs))


# ---------------------------------------------------------------- generacion


def render(svg, width, height, out_png):
    """Rasteriza un SVG con Chrome headless al tamano exacto."""
    import base64

    payload = base64.b64encode(svg.encode()).decode()
    html = (
        '<html><body style="margin:0;background:transparent">'
        f'<img src="data:image/svg+xml;base64,{payload}" '
        f'width="{width}" height="{height}"></body></html>'
    )
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False,
                                     encoding="utf-8") as fh:
        fh.write(html)
        page = fh.name
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         f"--screenshot={out_png}", f"--window-size={width},{height}",
         "--default-background-color=00000000",
         "file:///" + page.replace("\\", "/")],
        capture_output=True,
    )
    os.unlink(page)


def generate():
    os.makedirs(ICONS, exist_ok=True)

    light = build(**LOCKUP)
    dark = build(brand_color="#f4f4f2", **LOCKUP)

    with open(os.path.join(ICONS, "aw-logo.svg"), "w", encoding="utf-8") as fh:
        fh.write(light)
    with open(os.path.join(ICONS, "aw-logo-dark.svg"), "w", encoding="utf-8") as fh:
        fh.write(dark)
    print("SVG horizontal: aw-logo.svg (claro) y aw-logo-dark.svg (oscuro)")

    for stale in ("aw.svg", "aw-mask.svg"):
        path = os.path.join(ICONS, stale)
        if os.path.exists(path):
            os.remove(path)
    print("SVG aproximados antiguos eliminados (aw.svg, aw-mask.svg)")

    with open(os.path.join(ICONS, "aw-mark.svg"), "w", encoding="utf-8") as fh:
        fh.write(build_mark(512))
    print("SVG cuadrado: aw-mark.svg")

    tmp = tempfile.mkdtemp()
    ico_paths = []
    for size in (16, 32, 48):
        png = os.path.join(tmp, f"ico-{size}.png")
        render(build_mark(size), size, size, png)
        ico_paths.append(png)

    for size in (32, 180, 192, 512):
        render(build_mark(size), size, size,
               os.path.join(ICONS, f"aw-{size}.png"))
    print("PNG cuadrados: aw-32/180/192/512.png")

    build_ico(ico_paths, os.path.join(ROOT, "favicon.ico"))
    print("favicon.ico multirresolucion (16/32/48)")

    render(light, 634, 85, os.path.join(ROOT, "tools", "_preview-claro.png"))
    render(dark, 634, 85, os.path.join(ROOT, "tools", "_preview-oscuro.png"))
    render(build_mark(192), 192, 192,
           os.path.join(ROOT, "tools", "_preview-mark.png"))
    print("vistas previas en tools/")


if __name__ == "__main__":
    generate()
