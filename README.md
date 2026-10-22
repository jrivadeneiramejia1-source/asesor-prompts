# Asesor de prompts

App web **instalable** (computador y teléfono, funciona sin internet) que te dice **qué modelo y cuánto esfuerzo** usar para lo que vas a pedirle a la IA, qué datos le faltan a tu texto y te devuelve el **prompt mejorado** para copiarlo. **Aprende de ti**: según cómo te fue con cada recomendación, la próxima vez sube o baja el nivel para ese tipo de tarea.

No hay servidor ni cuenta. Todo se calcula en el aparato y se guarda en él.

## Cómo aprende (sin IA)

1. **Calibración por tipo de tarea.** Después de cada recomendación valoras: *Justo*, *Quedó corto* o *Sobró*. Las 3 últimas valoraciones de ese tipo (pesan 4, 2 y 1) mueven el peldaño de la «escalera de costo» (Haiku → Sonnet → Opus; nunca pasa solo a Fable). *Justo* mantiene lo que ya había. Se ve en la pestaña **Aprendizaje**.
2. **Hábitos.** Las líneas que añades a mano al prompt mejorado dos veces (aunque cambie la mayúscula o el punto final) se incluyen solas desde la tercera. Si las borras, dejan de incluirse.
3. **Palabras.** Si corriges «¿Entendí mal el tipo de tarea?», aprende las palabras de ese borrador. Una palabra vista una vez, sola, no cambia el tipo; vista dos veces o junto a otra aprendida, sí.

Todo se puede ver y olvidar en **Aprendizaje**.

## Motores

| Motor | Qué hace | Cuesta | Privacidad |
|---|---|---|---|
| **En este aparato** (por defecto) | Reglas + lo aprendido. Sin internet. | Nada | No sale nada |
| **Gemini** (opcional, en Ajustes) | Entiende mejor el texto; lo aprendido se aplica encima de su recomendación. | Tu cuota gratuita de Google AI Studio | El borrador viaja a Google, **sin claves ni contraseñas**. En el plan gratuito Google puede usarlo para mejorar sus productos: no mandes datos de otras personas ni de las comunidades |

La clave de Gemini es **tuya**: se pega en Ajustes, se guarda solo en ese aparato, va en un encabezado (no en la dirección) y **no entra en el respaldo**. Si Gemini falla (límite, clave, sin internet), el asesor responde con el motor del aparato y te dice por qué.

## Computador ↔ teléfono

No hay sincronización automática (sería necesario un servidor). En **Ajustes → Mis datos**: *Exportar respaldo* en uno e *Importar respaldo* en el otro. Importar **suma** (no borra lo que ya tienes), no duplica si lo repites y conserva la versión más nueva de cada análisis. El respaldo lleva historial, perfil y lo aprendido.

> El perfil de ejemplo lleva el nombre y el contexto de Jeiler. Si el repositorio es público, ese texto se ve en `js/datos.js`. Cámbialo en **Ajustes → Mi perfil** (no quedan en el código).

## Publicarla (una vez)

Hace falta una dirección `https://` para poder instalarla. Dos caminos, igual que tus otras apps:

**A. Cloudflare (subir archivos).** `python3 pruebas/empaquetar.py` crea `asesor-prompts-1.0.0.zip` solo con lo necesario. En Cloudflare: *Workers y Pages* → *Crear* → *Pages* → *Cargar activos* (Upload assets), sube los archivos del ZIP descomprimido. `_headers` pone las cabeceras de seguridad.

**B. GitHub Pages** (repositorio público): *Settings* (Configuración) → *Pages* → *Deploy from a branch* (Desplegar desde una rama) → `main` / `/ (root)`. Pages ignora `_headers`; la etiqueta CSP de `index.html` hace el mismo trabajo.

Luego, en cada aparato: abrir la dirección → **Instalar** (botón en el encabezado, o menú del navegador; en iPhone, Compartir → *Agregar a inicio*). Compartir texto *hacia* la app (Android) funciona desde el menú Compartir de otras apps.

## Cambiar algo y publicar la versión nueva

1. Edita lo que necesites.
2. Sube el número en `sw.js` (`const VERSION = 'asesor-v2'`) y `version` en `package.json` y `js/datos.js`. Si agregas archivos, inclúyelos en `BASICOS` de `sw.js`.
3. `npm test` (abajo) y sube los cambios. Los aparatos que ya la tienen muestran «Hay una versión nueva» → *Actualizar*. No pierden nada.

## Pruebas

```bash
npm install            # una vez
npm run lint           # ESLint
npm run motor          # motor, aprendizaje, guardado, importar/exportar, Gemini (sin red)
npm run ui             # pantalla de punta a punta + accesibilidad (axe) + tamaños + errores de CSP
npm run instalar       # manifest, iconos, sin internet, actualización, botón de instalar
npm run gemini         # motor Gemini con respuestas simuladas (no gasta cuota)
npm run pruebas        # las cuatro anteriores
CAPTURAS=capturas npm run ui     # guarda fotos de cada tamaño
```

Las pruebas con navegador sirven la app con las mismas cabeceras de `_headers`, así que una CSP rota falla la prueba.

## Estructura

```
index.html  estilos.css  sw.js  manifest.webmanifest  _headers
js/   datos (modelos, escalera, tipos) · motor · aprendizaje · almacen · ia (Gemini) · iconos · app (pantalla) · tema
iconos/  fuentes/        (todo propio: nada se carga de internet)
pruebas/ DESIGN.md       (diseño: ver DESIGN.md)
```

Precios de lista (USD por millón de tokens, entrada/salida, al 2026-10-06): Haiku 5.5 $0,10/$0,50 · Sonnet 5.5 $2/$10 · Opus 5.5 $4/$20 · Fable 5.1 $10/$50. Si cambian, se editan en `js/datos.js`.
