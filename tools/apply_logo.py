"""Aplica el logo ORIGINAL al sitio. Solo escala: no redibuja ni recompone.

Uso:
    python tools/apply_logo.py --header assets/brand/logo.png
    python tools/apply_logo.py --header logo.png --mark more.png

--header  lockup horizontal para la cabecera (se copia tal cual, sin tocar bytes)
--mark    imagen cuadrada para favicon y PWA (por defecto, recorte del lockup)

No requiere Pillow: el lockup se copia byte a byte y el rasterizado de los
iconos cuadrados lo hace Chrome headless, igual que el resto de herramientas.
"""

import os
import shutil
import struct
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "assets", "icons")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SQUARE = (32, 180, 192, 512)


def png_size(path):
    with open(path, "rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path}: se esperaba un PNG")
    return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")


def data_uri(path):
    import base64
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    with open(path, "rb") as fh:
        return f"data:{mime};base64," + base64.b64encode(fh.read()).decode()


def render(img_uri, width, height, out_png, cover=False):
    """Rasteriza a un tamano exacto. cover=True recorta al centro para llenar."""
    style = "object-fit:cover" if cover else "object-fit:contain"
    html = (
        '<html><body style="margin:0;background:transparent">'
        f'<img src="{img_uri}" style="width:{width}px;height:{height}px;'
        f'{style};display:block"></body></html>'
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


def build_ico(sources, path):
    offset = 6 + 16 * len(sources)
    directory = b""
    blobs = []
    for png in sources:
        with open(png, "rb") as fh:
            data = fh.read()
        dim = int.from_bytes(data[16:20], "big")
        size_byte = 0 if dim >= 256 else dim
        directory += struct.pack("<BBBBHHII", size_byte, size_byte, 0, 0,
                                 1, 32, len(data), offset)
        offset += len(data)
        blobs.append(data)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<HHH", 0, 1, len(sources)) + directory
                 + b"".join(blobs))


def main():
    args = sys.argv[1:]
    header = mark = None
    for i, arg in enumerate(args):
        if arg == "--header":
            header = args[i + 1]
        if arg == "--mark":
            mark = args[i + 1]
    if not header:
        raise SystemExit(__doc__)

    for src in (header, mark):
        if src and not os.path.isabs(src):
            src = os.path.join(ROOT, src)
    header = os.path.abspath(header)
    if not os.path.exists(header):
        raise SystemExit(f"no existe: {header}")

    os.makedirs(ICONS, exist_ok=True)
    w, h = png_size(header)
    print(f"lockup original: {w}x{h}px  (ratio {w / h:.3f})")

    dest = os.path.join(ICONS, "aw-logo.png")
    shutil.copyfile(header, dest)
    print(f"copiado sin modificar -> assets/icons/aw-logo.png")

    # SVG que solo envuelve el original, para poder darlo como <img> con tamano
    with open(os.path.join(ICONS, "aw-logo.svg"), "w", encoding="utf-8") as fh:
        fh.write(
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<image width="{w}" height="{h}" '
            f'xlink:href="{data_uri(header)}"/></svg>'
        )
    print("assets/icons/aw-logo.svg (envuelve el original, sin redibujar)")

    source = mark or header
    if mark:
        source = os.path.abspath(mark)
        shutil.copyfile(source, os.path.join(ICONS, "aw-mark.png"))
        print("assets/icons/aw-mark.png (original cuadrado)")

    uri = data_uri(source)
    tmp = tempfile.mkdtemp()
    ico_paths = []
    for size in (16, 32, 48):
        png = os.path.join(tmp, f"i{size}.png")
        render(uri, size, size, png, cover=not mark)
        ico_paths.append(png)
    for size in SQUARE:
        render(uri, size, size, os.path.join(ICONS, f"aw-{size}.png"),
               cover=not mark)
    build_ico(ico_paths, os.path.join(ROOT, "favicon.ico"))
    print(f"PNG {SQUARE} y favicon.ico regenerados desde el original")
    print(f"\nProximo paso: poner aspect-ratio: {w} / {h} en .site-title__mark")


if __name__ == "__main__":
    main()
