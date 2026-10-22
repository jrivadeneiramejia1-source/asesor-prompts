#!/usr/bin/env python3
"""Arma el ZIP con SOLO lo que la app necesita para funcionar (sin pruebas, sin node_modules).
Sirve para subir la carpeta a Cloudflare (Workers y Pages > Subir archivos) o a cualquier hosting estático.
Uso: python3 pruebas/empaquetar.py [carpeta_de_salida]   (por defecto, la carpeta actual)"""
import json, os, re, sys, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sw = open(os.path.join(RAIZ, 'sw.js'), encoding='utf8').read()
basicos = re.findall(r"'([^']+)'", re.search(r"const BASICOS = \[(.*?)\];", sw, re.S).group(1))
archivos = sorted({f for f in basicos if f != './'} | {'sw.js', '_headers'})
faltan = [f for f in archivos if not os.path.exists(os.path.join(RAIZ, f))]
if faltan:
    sys.exit('Faltan archivos: ' + ', '.join(faltan))
version = json.load(open(os.path.join(RAIZ, 'package.json'), encoding='utf8'))['version']
salida = os.path.join(sys.argv[1] if len(sys.argv) > 1 else os.getcwd(), f'asesor-prompts-{version}.zip')
with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in archivos:
        z.write(os.path.join(RAIZ, f), f)
print(f'{salida}  ({len(archivos)} archivos, {os.path.getsize(salida) // 1024} KB)')
