"""Genera las dos variantes del logo de la cabecera a partir del arte original.

Cada tema usa un lockup distinto, a proposito:

- claro  -> v1, solo el bloque "more" recortado a su caja. Compacto y sin
            texto que compita con la navegacion.
- oscuro -> v2, el lockup completo "amauriswill" con el texto claro, que es
            como esta desenhado el arte.

El arte llega como raster, no como vector, asi que aqui no se redibuja nada: se
recorta y se recolorea. Sin dependencias: el PNG se decodifica y se vuelve a
codificar con zlib, para que el color sea exacto y no dependa de Pillow ni de
filtros CSS, que deformarian el amarillo al invertirlo.

Uso:
    python tools/make_logo_variants.py
"""

import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "assets", "icons")
BRAND = os.path.join(ROOT, "assets", "brand")

SOURCES = {
    # El lockup completo es el que va en la cabecera; el de "more" solo queda
    # guardado como referencia de marca, no se usa en el sitio.
    "logo": os.path.join(BRAND, "amauriswill-page_LOGO_v2.png"),
    "mark": os.path.join(BRAND, "amauriswill-page_LOGO.png"),
}

# El lockup de la v1 es solo el bloque amarillo; el de la v2 lleva el nombre.
# En tema oscuro se usa el lockup completo con el texto claro.
# El amarillo del bloque y la palabra "more" nunca se tocan: "more" es negra
# sobre amarillo en ambos temas, y al recolorearla perderia el contraste.
DARK_INK = (0xF4, 0xF4, 0xF2)


# ------------------------------------------------------------------ PNG codec

def read_png(path):
    """Devuelve (ancho, alto, pixeles RGBA en un bytearray plano)."""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path}: no es un PNG")

    pos, idat, width, height, depth, color = 8, [], 0, 0, 0, 0
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, color = struct.unpack(">IIBB", body[:10])
        elif kind == b"IDAT":
            idat.append(body)
        elif kind == b"IEND":
            break
        pos += 12 + length

    if depth != 8 or color != 6:
        raise SystemExit(f"{path}: se esperaba RGBA de 8 bits, no {color} de {depth}")

    raw = zlib.decompress(b"".join(idat))
    stride = width * 4
    out = bytearray(stride * height)

    prev = bytearray(stride)
    for y in range(height):
        start = y * (stride + 1)
        ftype = raw[start]
        line = bytearray(raw[start + 1:start + 1 + stride])
        if ftype == 1:
            for i in range(4, stride):
                line[i] = (line[i] + line[i - 4]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                left = line[i - 4] if i >= 4 else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = line[i - 4] if i >= 4 else 0
                b = prev[i]
                c = prev[i - 4] if i >= 4 else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else b if pb <= pc else c
                line[i] = (line[i] + pred) & 0xFF
        out[y * stride:(y + 1) * stride] = line
        prev = line

    return width, height, out


def write_png(path, width, height, pixels):
    stride = width * 4
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw += pixels[y * stride:(y + 1) * stride]

    def chunk(kind, body):
        return (struct.pack(">I", len(body)) + kind + body
                + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


# ----------------------------------------------------------------- recolorado

def yellow_box(width, height, pixels):
    """Caja envolvente del bloque amarillo. Sirve de frontera para recolorear."""
    x0, y0, x1, y1 = width, height, -1, -1
    for y in range(height):
        for x in range(width):
            i = (y * width + x) * 4
            r, g, b, a = pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]
            if a and r > 150 and g > 150 and b < 150:
                x0, y0 = min(x0, x), min(y0, y)
                x1, y1 = max(x1, x), max(y1, y)
    return x0, y0, x1, y1


def recolor_ink(width, height, pixels, ink):
    """Pinta el texto SOLO fuera del bloque amarillo.

    El bloque amarillo y la palabra "more" que lleva encima se dejan como
    estan: al invertirlos, "more" quedaria del color del fondo sobre amarillo
    y perderia todo el contraste.
    """
    bx0, _, bx1, _ = yellow_box(width, height, pixels)
    changed = 0
    for y in range(height):
        for x in range(width):
            if bx0 - 1 <= x <= bx1 + 1:
                continue
            i = (y * width + x) * 4
            if pixels[i + 3] == 0:
                continue
            pixels[i], pixels[i + 1], pixels[i + 2] = ink
            changed += 1
    return changed


# ----------------------------------------------------------------- generacion

def crop_box(pixels, width, height, x0, y0, x1, y1, pad=2):
    """Recorta la caja indicada y devuelve un PNG RGBA nuevo."""
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(width - 1, x1 + pad)
    y1 = min(height - 1, y1 + pad)

    out_w, out_h = x1 - x0 + 1, y1 - y0 + 1
    out = bytearray(out_w * out_h * 4)
    for y in range(out_h):
        src = ((y + y0) * width + x0) * 4
        out[y * out_w * 4:(y + 1) * out_w * 4] = pixels[src:src + out_w * 4]

    path = os.path.join(ICONS, "aw-logo.png")
    write_png(path, out_w, out_h, out)
    return out_w, out_h


def generate():
    os.makedirs(ICONS, exist_ok=True)
    os.makedirs(BRAND, exist_ok=True)

    for src in SOURCES.values():
        if not os.path.exists(src):
            raise SystemExit(f"falta el arte original: {src}")

    # Tema claro: el bloque "more" de la v1, recortado a su caja. Sobre fondo
    # claro el lockup largo no aporta: el nombre ya esta en el h1 y el titulo.
    width, height, pixels = read_png(SOURCES["mark"])
    box = yellow_box(width, height, pixels)
    out_w, out_h = crop_box(pixels, width, height, *box)
    print(f"assets/icons/aw-logo.png (tema claro, mark \"more\" "
          f"{out_w}x{out_h} recortado de {width}x{height})")

    # Tema oscuro: el lockup completo de la v2, con el texto claro.
    width, height, pixels = read_png(SOURCES["logo"])
    changed = recolor_ink(width, height, pixels, DARK_INK)
    write_png(os.path.join(ICONS, "aw-logo-dark.png"), width, height, pixels)
    print(f"assets/icons/aw-logo-dark.png (tema oscuro, lockup {width}x{height}, "
          f"{changed} pixeles a #{DARK_INK[0]:02x}{DARK_INK[1]:02x}{DARK_INK[2]:02x})")

    print(f"\nProximo paso: aspect-ratio distinto por tema en .site-title__mark")


def inspect():
    """Muestrea el color real del texto y del bloque en ambas variantes."""
    for name in ("aw-logo.png", "aw-logo-dark.png"):
        path = os.path.join(ICONS, name)
        width, height, pixels = read_png(path)
        ink = {}
        for i in range(0, len(pixels), 4):
            if pixels[i + 3] != 0:
                key = (pixels[i], pixels[i + 1], pixels[i + 2])
                ink[key] = ink.get(key, 0) + 1
        top = sorted(ink.items(), key=lambda kv: -kv[1])[:3]
        colores = ", ".join(f"#{r:02x}{g:02x}{b:02x} x{n}" for (r, g, b), n in top)
        print(f"{name} {width}x{height}: {colores}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "inspect":
        inspect()
    else:
        generate()