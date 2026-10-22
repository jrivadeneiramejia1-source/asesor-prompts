---
version: 1
name: Asesor de prompts
description: App instalable (computador y teléfono) que recomienda modelo y esfuerzo para un prompt, lo mejora y aprende de las valoraciones de quien la usa. Misma familia visual que Equipos y Entregas.

colors:
  encabezado: "#0A5A4E → #12806C"  # banda de marca con brillo en la esquina (oscuro: #0D3B37 → #14594F). También es la tarjeta de la recomendación
  arena: "#F4F1E8"            # fondo claro
  papel: "#FFFFFF"            # superficies (claro)
  arena-2: "#EEE9DC"          # superficies hundidas
  linea: "#DFD8C7"
  tinta: "#14201C"
  gris: "#56615B"             # texto suave (5,5:1 sobre arena)
  petroleo: "#0B7563"         # único acento: acción principal, pestaña activa, foco
  sol: "#F2A93B"              # insignias, el peldaño recomendado y «datos por completar»; texto oscuro encima
  noche: "#0A1B1C"            # fondo oscuro: petróleo profundo, nunca negro puro
  noche-sup: "#11292A"
  petroleo-claro: "#3FD1B0"   # acento en oscuro
  estados:                    # solo para estados (valoración, avisos), nunca decorativos
    sobro: naranja (#8F5200 / #F2B552)
    parcial: azul (#1D5BA6 / #8AB8F2)
    justo: verde (#136A42 / #66D69A)
    corto-y-peligro: rojo (#B0281F / #FF8E84)

typography:
  familia: Bricolage Grotesque (variable 200-800, incluida en /fuentes)
  monoespaciada: JetBrains Mono 500 (tokens, fechas, el prompt mejorado, cifras)
  titulo-vista: 1.55rem / 760 / -0.02em
  modelo-recomendado: clamp(1.9rem, 6vw, 2.5rem) / 760
  cifra: 1.95rem / 720, números tabulares
  cuerpo: 16px / 400 / 1.45
  ayuda: 0.9rem, color gris

shapes:
  controles: 12px        # campos y botones (mínimo 44px de alto; chips 40px)
  tarjetas: 18px
  hojas: 24px            # diálogos: suben desde abajo en el teléfono, centrados en computador
  chips: 999px

icons: Phosphor regular (relleno en la pestaña activa), 1.25em, color heredado. Copiados en js/iconos.js para usar sin internet.
---

## Overview
Una sola persona, dos aparatos (computador y teléfono), a veces sin señal. La pantalla responde una pregunta:
«¿qué modelo y cuánto esfuerzo le pongo a esto, y cómo lo escribo mejor?». Todo corre en el aparato; Gemini es opcional.

## Signature
La **escalera de costo**: nueve peldaños de menor a mayor (Haiku → Sonnet → Opus → Fable). El peldaño recomendado
se pinta en sol; si lo aprendido de ti lo movió, un punto blanco marca dónde habría quedado. Es el mismo modelo mental
que usa el aprendizaje (subir o bajar de a un peldaño), así que lo aprendido se puede ver.
La tarjeta de la recomendación usa la banda de marca del encabezado.

## Interacción
- Al analizar, el resultado entra escalonado (0,38 s) y la escalera se llena de izquierda a derecha.
- Copiar cambia el botón a «¡Copiado!» con un brillo; los avisos salen arriba, duran 3,8 s (6,5 s si traen «Deshacer») y se detienen al pasar el mouse.
- Las cifras de «Aprendizaje» cuentan hasta su valor; la insignia sol del Historial salta cuando cambia (análisis sin valorar de los últimos 30 días).
- Borrar un análisis no pregunta: avisa con «Deshacer». Lo que borra mucho (historial, lo aprendido, la clave) pide confirmar en una hoja.
- Todo se apaga con «reducir movimiento» del aparato.

## Do
- Un acento (petróleo); el sol solo para insignias, el peldaño recomendado y los datos por completar. Los colores de estado solo dicen estado.
- Tema automático (el del aparato) con botón en el encabezado: automático → claro → oscuro. Se guarda y se aplica antes de pintar (js/tema.js) para que no parpadee.
- Español, voz activa, segunda persona. Los errores dicen qué hacer. Lo que está en inglés lleva su traducción entre paréntesis.
- Hojas y diálogos con `<dialog>`: foco adentro al abrir (en «Cancelar» si borra algo), Escape cierra, el foco vuelve al botón que la abrió.
- Navegación por dirección (#/historial, #/aprendizaje, #/ajustes): el botón Atrás funciona y se puede abrir una vista directo.
- Pestañas abajo en el teléfono (4, con insignia) y arriba en el computador; áreas táctiles de 44px (chips 40px).
- Nada se guarda con claves o contraseñas: se ocultan del borrador antes de analizar, guardar o mandar a Gemini.

## Don't
- No emojis ni símbolos como iconos; no iconos dibujados a mano.
- No `prompt()`, `confirm()` ni `alert()` del navegador: todo dentro de la app.
- No `transition: all`; solo transform, colores y sombras.
- No fuentes, librerías ni scripts desde internet (la CSP solo deja lo propio y generativelanguage.googleapis.com, y solo si se activa Gemini).
- No estilos ni scripts en línea (la CSP los bloquea): los tamaños dinámicos se ponen por CSSOM (`style.setProperty`).
