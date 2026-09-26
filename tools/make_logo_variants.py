"""Genera las dos variantes del logo de la cabecera a partir del arte original.

El lockup es el MISMO en los dos temas: "amauriswill" seguido del bloque
amarillo con "more". Lo unico que cambia es el color del texto, para que se lea
sobre el fondo claro y sobre el oscuro sin que el logo cambie de forma al
alternar el tema. El amarillo del bloque y la palabra "more" se dejan igual en
ambos casos, porque "more" es negra sobre amarillo y al recolorearla perderia
todo el contraste.

El arte llega como raster, no como vector, asi que aqui no se redibuja nada: se
recolorea. Sin dependencias: el PNG se decodifica y se vuelve a codificar con
zlib, para que el color sea exacto y no dependa de Pillow ni de filtros CSS,
que deformarian el amarillo al invertirlo.

Uso:
    python tools/make_logo_variants.py          # genera ambas variantes
    python tools/make_logo_variants.py inspect  # muestra los colores usados
"""

import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "assets", "icons")
BRAND = os.path.join(ROOT, "assets", "brand")

SOURCE = os.path.join(BRAND, "amauriswill-page_LOGO_v2.png")

# Color del texto segun el fondo. El negro es el del propio arte.
LIGHT_INK = (0x0D, 0x0D, 0x0D)
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

def generate():
    os.makedirs(ICONS, exist_ok=True)
    os.makedirs(BRAND, exist_ok=True)

    if not os.path.exists(SOURCE):
        raise SystemExit(f"falta el arte original: {SOURCE}")

    width, height, original = read_png(SOURCE)

    for name, ink in (("aw-logo.png", LIGHT_INK), ("aw-logo-dark.png", DARK_INK)):
        pixels = bytearray(original)
        changed = recolor_ink(width, height, pixels, ink)
        write_png(os.path.join(ICONS, name), width, height, pixels)
        color = f"#{ink[0]:02x}{ink[1]:02x}{ink[2]:02x}"
        print(f"assets/icons/{name} ({width}x{height}, {changed} pixeles a {color})")

    print(f"\nMismo lockup en ambos temas: aspect-ratio: {width} / {height}")


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