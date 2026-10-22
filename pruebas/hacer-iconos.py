#!/usr/bin/env python3
"""Genera los iconos PNG de la app (192, 512, adaptable 512, 180 para iPhone y favicon 32) con el mismo dibujo que iconos/icono.svg.
Uso: python3 pruebas/hacer-iconos.py   (necesita Pillow y numpy)"""
import os
import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'iconos')
BASE = 512            # el dibujo está pensado en 512
SUPER = 2             # se dibuja al doble y se reduce, para bordes suaves
ARENA, SOL = (244, 241, 232), (242, 169, 59)


def fondo(n, redondeado):
    t = np.linspace(0, 1, n)
    d = (t[None, :] + t[:, None]) / 2                      # diagonal 135 grados
    a, b = np.array([10, 90, 78]), np.array([18, 128, 108])
    rgb = (a[None, None, :] * (1 - d[..., None]) + b[None, None, :] * d[..., None])
    # brillo en la esquina de arriba a la derecha
    yy, xx = np.mgrid[0:n, 0:n] / (n - 1)
    r = np.sqrt((1 - xx) ** 2 + yy ** 2)
    brillo = np.clip(1 - r / 0.9, 0, 1) * 0.24
    rgb = rgb * (1 - brillo[..., None]) + 255 * brillo[..., None]
    im = Image.fromarray(rgb.astype('uint8'), 'RGB').convert('RGBA')
    if redondeado:
        m = Image.new('L', (n, n), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 115 / 512), fill=255)
        im.putalpha(m)
    return im


def dibujo(n, redondeado, escala_glifo=1.0):
    k = n / BASE
    im = fondo(n, redondeado)
    cx = cy = BASE / 2
    capa = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)

    def p(x, y):  # coordenada del dibujo base -> pixeles, con el glifo reducido alrededor del centro
        return ((cx + (x - cx) * escala_glifo) * k, (cy + (y - cy) * escala_glifo) * k)

    barras = [(118, 70, ARENA, 0.5), (192, 118, ARENA, 0.72), (266, 166, ARENA, 0.92), (340, 214, SOL, 1.0)]
    for x, h, color, alfa in barras:
        x0, y0 = p(x, 388 - h)
        x1, y1 = p(x + 54, 388)
        d.rounded_rectangle([x0, y0, x1, y1], radius=14 * k * escala_glifo, fill=color + (int(255 * alfa),))
    estrella = [(392, 98), (400, 120), (422, 128), (400, 136), (392, 158), (384, 136), (362, 128), (384, 120)]
    d.polygon([p(x, y) for x, y in estrella], fill=ARENA + (255,))
    return Image.alpha_composite(im, capa)


def guardar(nombre, tam, redondeado, escala_glifo=1.0):
    im = dibujo(tam * SUPER, redondeado, escala_glifo).resize((tam, tam), Image.LANCZOS)
    ruta = os.path.join(SALIDA, nombre)
    im.save(ruta, optimize=True)
    print(f'{nombre}  {tam}x{tam}  {os.path.getsize(ruta)} bytes')


os.makedirs(SALIDA, exist_ok=True)
guardar('asesor-192.png', 192, True)
guardar('asesor-512.png', 512, True)
guardar('asesor-maskable-512.png', 512, False, 0.9)   # sin esquinas redondeadas: el sistema le pone su máscara
guardar('asesor-180.png', 180, False, 0.9)            # iPhone: cuadrado completo, iOS redondea
guardar('favicon-32.png', 32, True)
