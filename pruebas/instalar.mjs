// Instalar la app: manifest, iconos, trabajador de servicio, abrir sin internet, actualización, botón de instalar y cabeceras de seguridad.
// Uso: node pruebas/instalar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { servir, lanzar, pagina, contador, esp, RAIZ } from './banco.mjs';

const PUERTO = 8852, URL = `http://127.0.0.1:${PUERTO}/`;
const { log, resumen } = contador();
const srv = await servir(PUERTO), br = await lanzar();
const errores = [];
const PS = 'hazme un script de powershell que copie descargas a una usb y me diga cuales fallaron';
const dim = (f) => { const b = fs.readFileSync(path.join(RAIZ, f)); return b.slice(1, 4).toString() === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
const hayAviso = async (page, re) => (await page.locator('.aviso span').allTextContents()).some((t) => re.test(t));

console.log('Manifest e iconos');
const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.webmanifest'), 'utf8'));
log('nombre, nombre corto (≤12), idioma, id, inicio y alcance', m.name === 'Asesor de prompts' && m.short_name.length <= 12 && m.lang === 'es-CO' && m.id && m.start_url && m.scope === './');
log('se abre como app (standalone) con los colores de la marca', m.display === 'standalone' && m.theme_color === '#0A5A4E' && m.background_color === '#F4F1E8');
for (const i of m.icons.filter((x) => x.type === 'image/png')) {
  const [w, h] = dim(i.src) || [0, 0];
  log(`icono ${i.src} mide ${i.sizes}${i.purpose ? ' (' + i.purpose + ')' : ''}`, `${w}x${h}` === i.sizes);
}
log('hay 192, 512 y 512 adaptable (maskable)', ['192x192', '512x512'].every((s) => m.icons.some((i) => i.sizes === s && !i.purpose)) && m.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'));
log('icono del iPhone de 180×180 y favicon de 32×32', dim('iconos/asesor-180.png').join('x') === '180x180' && dim('iconos/favicon-32.png').join('x') === '32x32');
log('el icono adaptable es opaco en las esquinas (sin transparencia)', await (async () => {
  const p = await pagina(br, { errores }); await p.page.goto(URL);
  const a = await p.page.evaluate(async () => { const r = await fetch('iconos/asesor-maskable-512.png'); const b = await createImageBitmap(await r.blob()); const c = new OffscreenCanvas(512, 512).getContext('2d'); c.drawImage(b, 0, 0); return [c.getImageData(0, 0, 1, 1).data[3], c.getImageData(511, 511, 1, 1).data[3]]; });
  const r = await p.page.evaluate(async () => { const r = await fetch('iconos/asesor-512.png'); const b = await createImageBitmap(await r.blob()); const c = new OffscreenCanvas(512, 512).getContext('2d'); c.drawImage(b, 0, 0); return c.getImageData(2, 2, 1, 1).data[3]; });
  await p.ctx.close();
  return a[0] === 255 && a[1] === 255 && r === 0;
})());
log('atajos (shortcuts) con dirección válida y con icono', m.shortcuts.length === 2 && m.shortcuts.every((s) => s.url.startsWith('./') && s.icons.length));
log('puede recibir texto compartido (share_target GET con título, texto y enlace)', m.share_target.method === 'GET' && m.share_target.params.text === 'texto' && m.share_target.params.url === 'enlace' && m.share_target.params.title === 'titulo');

console.log('Página: etiquetas de instalación y seguridad');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
log('viewport, idioma, manifest, ícono de iPhone y colores de la barra (claro y oscuro)', /viewport-fit=cover/.test(html) && /<html lang="es-CO">/.test(html) && /rel="manifest"/.test(html) && /apple-touch-icon/.test(html) && /theme-color" content="#0A5A4E" media="\(prefers-color-scheme: light\)"/.test(html) && /theme-color" content="#0D3B37" media="\(prefers-color-scheme: dark\)"/.test(html));
log('no carga nada de internet: sin fuentes, scripts ni estilos externos', !/(src|href)="https?:/.test(html.replace(/<a [^>]*>/g, '')) && !/@import|url\(https?:/.test(fs.readFileSync(path.join(RAIZ, 'estilos.css'), 'utf8')));
const r = await fetch(URL);
const csp = r.headers.get('content-security-policy') || '';
log('cabeceras: CSP estricta (solo lo propio y Gemini), nosniff, sin referrer, permisos', /default-src 'self'/.test(csp) && /script-src 'self'/.test(csp) && /connect-src 'self' https:\/\/generativelanguage\.googleapis\.com/.test(csp) && /frame-ancestors 'none'/.test(csp) && r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('referrer-policy') === 'no-referrer' && /camera=\(\)/.test(r.headers.get('permissions-policy') || ''));
log('el sw.js y el index.html no se quedan en caché del navegador', (await fetch(URL + 'sw.js')).headers.get('cache-control') === 'no-cache' && r.headers.get('cache-control') === 'no-cache');
log('la CSP de la etiqueta meta es la misma que la de las cabeceras', (html.match(/Content-Security-Policy" content="([^"]+)"/)[1].replace(/; frame-ancestors 'none'/, '')) === csp.replace(/; frame-ancestors 'none'/, ''));

console.log('Trabajador de servicio');
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const BASICOS = [...sw.match(/const BASICOS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
log('cada archivo de la lista existe', BASICOS.filter((f) => f !== './').every((f) => fs.existsSync(path.join(RAIZ, f))), BASICOS.filter((f) => f !== './' && !fs.existsSync(path.join(RAIZ, f))).join(', '));
let { ctx, page } = await pagina(br, { errores });
const pedidos = new Set();
page.on('request', (q) => { if (q.url().startsWith(URL)) pedidos.add(new globalThis.URL(q.url()).pathname.slice(1) || './'); });
await page.goto(URL);
await page.evaluate(() => navigator.serviceWorker.ready);
await esp(500);
await page.reload(); await esp(700);
for (const v of ['asesor', 'historial', 'aprendizaje', 'ajustes']) await page.click(`.pestana[data-vista=${v}]`);
await page.click('.pestana[data-vista=asesor]');
await page.fill('#borrador', PS); await page.click('#btnAnalizar'); await esp(500);
const faltan = [...pedidos].filter((f) => f !== 'sw.js' && f !== './' && f !== 'index.html' && !BASICOS.includes(f));
log('todo lo que la app pide está en la lista del trabajador (nada se queda sin guardar)', !faltan.length, faltan.join(', '));
log('el trabajador queda activo y controla la página', await page.evaluate(() => !!navigator.serviceWorker.controller));
const caches1 = await page.evaluate(async () => { const k = await caches.keys(); const c = await caches.open(k[0]); return { k, n: (await c.keys()).length }; });
log('guarda una sola versión (asesor-v1) con todos los archivos', caches1.k.join() === 'asesor-v1' && caches1.n === BASICOS.length, JSON.stringify(caches1));

console.log('Sin internet');
await ctx.setOffline(true);
await page.reload(); await esp(500);
log('recarga sin internet y la pantalla sale completa', (await page.textContent('h1')) === 'Asesor de prompts' && (await page.isVisible('#pillSinRed')));
log('el borrador se recuerda', (await page.inputValue('#borrador')) === PS);
await page.click('#btnAnalizar'); await esp(500);
log('analiza sin internet', (await page.textContent('#tRes')) === 'Sonnet 5.5');
await page.goto(URL + '?texto=hola%20sin%20red'); await esp(500);
log('incluso un enlace compartido (con ?texto=) abre sin internet', (await page.inputValue('#borrador')) === 'hola sin red');
await page.goto(URL + '#/historial'); await esp(400);
log('y la vista del historial', await page.isVisible('#vista-historial') && (await page.locator('#lista .item').count()) === 2);
await ctx.setOffline(false);

console.log('Actualización');
await page.goto(URL + '#/ajustes'); await esp(400);
await page.fill('#perfil', 'perfil de prueba'); await page.click('#btnPerfil');
await page.click('.pestana[data-vista=asesor]'); await page.fill('#borrador', 'borrador que debe sobrevivir a la actualización');
await esp(600);
await page.click('.pestana[data-vista=ajustes]');
await page.click('#btnActualizar');
await page.waitForFunction(() => [...document.querySelectorAll('.aviso span')].some((s) => /última versión/.test(s.textContent)), null, { timeout: 8000 });
log('sin versión nueva dice «Ya tienes la última versión»', true);
srv.reemplazos['/sw.js'] = (t) => t.replace("'asesor-v1'", "'asesor-v2'");
await page.click('#btnActualizar');
await page.waitForSelector('.aviso button', { timeout: 10000 });
log('con una versión nueva avisa y ofrece «Actualizar»', /versión nueva/.test(await page.locator('.aviso span').last().textContent()));
const recarga = page.waitForEvent('load', { timeout: 10000 });
await page.click('.aviso button');
await recarga; await esp(900);
const caches2 = await page.evaluate(async () => (await caches.keys()).join());
log('al actualizar se recarga, estrena asesor-v2 y borra la versión vieja', caches2 === 'asesor-v2', caches2);
log('no se pierde nada: borrador y perfil siguen', (await page.inputValue('#borrador')) === 'borrador que debe sobrevivir a la actualización' && (await page.evaluate(() => JSON.parse(localStorage.getItem('asesor-prompts.v1')).perfil)) === 'perfil de prueba');
delete srv.reemplazos['/sw.js'];
await ctx.close();

console.log('Botón de instalar');
({ ctx, page } = await pagina(br, { errores }));
await page.goto(URL); await esp(300);
log('en un navegador que no ofrece instalar, el botón no aparece', !(await page.isVisible('#btnInstalar')));
await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => { window.__pidio = 1; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
await esp(200);
log('cuando el navegador la ofrece, aparece «Instalar» arriba', await page.isVisible('#btnInstalar'));
await page.click('#btnInstalar'); await esp(200);
log('al tocarlo pide instalar al navegador y desaparece', (await page.evaluate(() => window.__pidio)) === 1 && !(await page.isVisible('#btnInstalar')));
await page.evaluate(() => window.dispatchEvent(new Event('appinstalled'))); await esp(200);
log('al terminar la instalación avisa', await hayAviso(page, /quedó instalado/));
await ctx.close();
({ ctx, page } = await pagina(br, { errores, ancho: 390, alto: 844, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }));
await page.goto(URL); await esp(300);
log('en iPhone (Safari no avisa) el botón sale igual y explica los pasos', await page.isVisible('#btnInstalar') && await (async () => { await page.click('#btnInstalar'); await page.waitForSelector('dialog[open]'); const t = await page.textContent('dialog'); return /Agregar a inicio/.test(t) && /Add to Home Screen/.test(t) && /Instalar app/.test(t); })());
await ctx.close();
({ ctx, page } = await pagina(br, { errores, init: () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q); } }));
await page.goto(URL + '#/ajustes'); await esp(300);
log('ya instalada: sin botones de instalar y lo dice', !(await page.isVisible('#btnInstalar')) && !(await page.isVisible('#btnInstalar2')) && /Ya la tienes instalada/.test(await page.textContent('#estadoInstalada')));
await ctx.close();

console.log('Abrir el archivo con doble clic');
{
  const e2 = [];
  ({ ctx, page } = await pagina(br, { errores: e2 }));
  await page.goto('file://' + path.join(RAIZ, 'index.html')); await esp(500);
  log('en file:// explica qué hacer en vez de mostrar una pantalla en blanco', await page.isVisible('#sinServidor') && /python -m http.server/.test(await page.textContent('#sinServidor')));
  await ctx.close();
}

log('ningún error de JavaScript, de consola ni de CSP', !errores.length, [...new Set(errores)].slice(0, 6).join('\n        '));
await br.close(); srv.close();
process.exit(resumen() ? 1 : 0);
