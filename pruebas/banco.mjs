// Utilidades comunes de las pruebas con navegador: servidor local con las mismas cabeceras que _headers, lanzador y página con vigilancia de errores.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

export const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const SALIDA = process.env.CAPTURAS || path.join(os.tmpdir(), 'capturas-asesor');
fs.mkdirSync(SALIDA, { recursive: true });
export const AXE_JS = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const CHROMIUM = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
export const lanzar = (extra = []) => chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox', '--disable-dev-shm-usage', ...extra] });
export const esp = (ms) => new Promise((r) => setTimeout(r, ms));

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

// Lee _headers (formato de Cloudflare) para servir exactamente lo mismo que en producción.
function leerCabeceras() {
  const bloques = [];
  let actual = null;
  for (const linea of fs.readFileSync(path.join(RAIZ, '_headers'), 'utf8').split('\n')) {
    if (!linea.trim() || linea.trim().startsWith('#')) continue;
    if (!/^\s/.test(linea)) { actual = { ruta: linea.trim(), cab: {} }; bloques.push(actual); }
    else { const i = linea.indexOf(':'); actual.cab[linea.slice(0, i).trim().toLowerCase()] = linea.slice(i + 1).trim(); }
  }
  return bloques;
}

// reemplazos: { '/sw.js': (texto) => texto } para simular una versión nueva sin tocar los archivos.
export function servir(puerto, { reemplazos = {} } = {}) {
  const bloques = leerCabeceras();
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(RAIZ, p);
    if (!f.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f) || path.basename(f) === '_headers') { res.writeHead(404); return res.end('no'); }
    const cab = { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' };
    const rel = '/' + path.relative(RAIZ, f).split(path.sep).join('/');
    for (const b of bloques) if (b.ruta === '/*' || b.ruta === rel) Object.assign(cab, b.cab);
    let cuerpo = fs.readFileSync(f);
    if (reemplazos[rel]) cuerpo = Buffer.from(reemplazos[rel](cuerpo.toString('utf8')));
    res.writeHead(200, cab);
    res.end(cuerpo);
  });
  srv.reemplazos = reemplazos;
  return new Promise((ok) => srv.listen(puerto, '127.0.0.1', () => ok(srv)));
}

// Una página con vigilancia: errores de JavaScript, errores de consola, violaciones de CSP y archivos propios que no cargan.
export async function pagina(browser, { ancho = 1280, alto = 900, tema = 'light', quieto = false, ua, init, permisos = ['clipboard-read', 'clipboard-write'], errores = [] } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: alto }, colorScheme: tema, locale: 'es-CO', deviceScaleFactor: 2,
    reducedMotion: quieto ? 'reduce' : 'no-preference', userAgent: ua, isMobile: ancho < 700, hasTouch: ancho < 700, permissions: permisos
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errores.push('consola: ' + m.text()); });
  page.on('requestfailed', (r) => { if (r.url().startsWith('http://127.0.0.1')) errores.push('no cargó: ' + r.url()); });
  page.on('response', (r) => { if (r.url().startsWith('http://127.0.0.1') && r.status() >= 400) errores.push(r.status() + ' ' + r.url()); });
  return { ctx, page, errores };
}

export function contador() {
  let ok = 0, mal = 0;
  const log = (n, t, x) => { t ? ok++ : mal++; console.log((t ? 'OK   ' : 'FALLA') + ' ' + n + (t || x === undefined ? '' : '\n      ' + x)); };
  return { log, resumen: () => { console.log(`\n${mal ? mal + ' FALLOS de ' + (ok + mal) : 'TODO OK (' + ok + ')'}`); return mal; } };
}

export async function axe(page, log, nombre) {
  if ((await page.evaluate(() => typeof window.axe)) === 'undefined') await page.evaluate(AXE_JS);
  const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map((x) => x.id + ': ' + x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ') + ' — ' + x.help));
  log(`accesible (axe): ${nombre}`, !v.length, v.join('\n        '));
}
