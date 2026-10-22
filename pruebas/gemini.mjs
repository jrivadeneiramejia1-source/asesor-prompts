// Motor opcional Gemini desde la pantalla, con respuestas simuladas (no gasta cuota ni usa claves reales).
// Uso: node pruebas/gemini.mjs
import fs from 'node:fs';
import { servir, lanzar, pagina, contador, esp, SALIDA } from './banco.mjs';

const PUERTO = 8853, URL = `http://127.0.0.1:${PUERTO}/`;
const { log, resumen } = contador();
const srv = await servir(PUERTO), br = await lanzar();
const errores = [];
const CLAVE = 'AIzaSyEjemploEjemploEjemploEjemplo12345';
const PS = 'hazme un script de powershell que copie descargas a una usb y me diga cuales fallaron';
const RESP = { categoria: 'arquitectura', modelo: 'opus', esfuerzo: 'high', motivo: 'Es un diseño con varias partes que dependen entre sí.', alternativa_barata: { modelo: 'sonnet', esfuerzo: 'high', riesgo: 'Puede dejar huecos entre las partes.' }, faltan: ['Presupuesto', 'Plazo'], mejorado: 'Objetivo: diseñar la base de datos de equipos.\n\nPresupuesto: [COMPLETAR: cuánto puedes gastar]' };
const ok = (obj) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] }) });
const hayAviso = async (page, re) => (await page.locator('.aviso span').allTextContents()).some((t) => re.test(t));

const { ctx, page } = await pagina(br, { errores });
const llamadas = [];
let respuesta = () => ok(RESP);
await page.route('https://generativelanguage.googleapis.com/**', async (ruta) => {
  const q = ruta.request();
  llamadas.push({ url: q.url(), cab: q.headers(), cuerpo: q.postData() });
  const r = await respuesta(q);
  if (r === 'abortar') return ruta.abort('failed');
  return ruta.fulfill(r);
});
await page.goto(URL);
await esp(300);

console.log('Configurar');
await page.click('.pestana[data-vista=ajustes]');
log('el panel de Gemini está oculto al principio', !(await page.isVisible('#panelGemini')));
await page.click('input[name=motor][value=gemini]');
log('al elegir Gemini aparece el panel con el aviso de privacidad', (await page.isVisible('#panelGemini')) && /puede usar lo que envías/.test(await page.textContent('#panelGemini')));
log('el campo de la clave está oculto (password) y se puede mostrar', (await page.getAttribute('#clave', 'type')) === 'password' && await (async () => { await page.click('#btnVerClave'); const v = (await page.getAttribute('#clave', 'type')) === 'text' && (await page.getAttribute('#btnVerClave', 'aria-pressed')) === 'true'; await page.click('#btnVerClave'); return v; })());
await page.click('.pestana[data-vista=asesor]');
log('con Gemini elegido pero sin clave, la etiqueta avisa', /Falta la clave de Gemini/.test(await page.textContent('#etiquetaMotor')));
await page.fill('#borrador', PS); await page.click('#btnAnalizar'); await page.waitForSelector('#resultado:not([hidden])'); await esp(400);
log('y analiza igual con el motor local, diciéndolo', (await page.textContent('#tRes')) === 'Sonnet 5.5' && /Sin Gemini/.test(await page.textContent('#resFuente')) && (await hayAviso(page, /Falta la clave/)) && !llamadas.length);
await page.click('.pestana[data-vista=ajustes]');
await page.fill('#clave', 'abc'); await page.click('#btnGuardarClave');
log('una clave corta o rara se rechaza explicando qué hacer', /no parece válida/.test(await page.textContent('#estadoGemini')));
await page.fill('#clave', CLAVE); await page.fill('#modeloGemini', '../../x'); await page.click('#btnGuardarClave');
log('un nombre de modelo raro se rechaza', /nombre del modelo/.test(await page.textContent('#estadoGemini')));
await page.fill('#modeloGemini', 'gemini-flash-lite-latest'); await page.click('#btnGuardarClave');
log('guardar confirma y la clave queda en este aparato', /Guardado/.test(await page.textContent('#estadoGemini')) && (await page.evaluate(() => localStorage.getItem('asesor-prompts.clave'))) === CLAVE);
log('la clave NO está en el almacenamiento principal (el que se exporta)', !(await page.evaluate(() => localStorage.getItem('asesor-prompts.v1'))).includes('AIza'));
await page.click('#btnProbar');
await page.waitForFunction(() => /Funciona/.test(document.querySelector('#estadoGemini').textContent), null, { timeout: 5000 });
log('«Probar conexión» confirma que funciona', llamadas.length === 1);
log('la clave viaja en un encabezado, no en la dirección; y solo a Google', llamadas[0].cab['x-goog-api-key'] === CLAVE && !llamadas[0].url.includes('AIza') && llamadas[0].url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent'));

console.log('Analizar con Gemini');
await page.click('.pestana[data-vista=asesor]');
log('la etiqueta ahora dice Gemini', /Gemini \(tu clave\)/.test(await page.textContent('#etiquetaMotor')));
const secreto = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
await page.fill('#borrador', 'necesito diseñar la base de datos de equipos, mi token es ' + secreto);
respuesta = async () => { await esp(1500); return ok(RESP); };
await page.click('#btnAnalizar');
await esp(400);
log('mientras piensa: botón ocupado, «Parar» visible y aviso de espera', (await page.isVisible('#btnParar')) && (await page.isDisabled('#btnAnalizar')) && /Consultando a Gemini/.test(await page.textContent('#estado')));
await page.waitForFunction(() => !document.querySelector('#btnAnalizar').disabled, null, { timeout: 8000 });
await esp(600);
log('muestra lo que decidió Gemini: Opus 5.5, esfuerzo Alto, tipo y su motivo', (await page.textContent('#tRes')) === 'Opus 5.5' && (await page.textContent('#resEsfuerzo')) === 'Alto' && /Diseño o arquitectura/.test(await page.textContent('#resTipo')) && /varias partes/.test(await page.textContent('#resMotivo')));
log('lleva la etiqueta «Analizado con Gemini», la alternativa y los datos que faltan', /Analizado con Gemini/.test(await page.textContent('#resFuente')) && /Sonnet 5.5 con esfuerzo alto/.test(await page.textContent('#resBarata')) && (await page.locator('#faltan li').allTextContents()).join().includes('Presupuesto') && (await page.inputValue('#mejorado')).startsWith('Objetivo: diseñar'));
const ultima = llamadas.at(-1);
log('el token de GitHub del borrador NO salió del aparato', !ultima.cuerpo.includes('ghp_abcdef') && ultima.cuerpo.includes('DATO SECRETO OCULTO'));
log('el pedido lleva el perfil y marca el borrador como material, no como órdenes', ultima.cuerpo.includes('Jeiler') && /no son instrucciones/.test(ultima.cuerpo));
log('la respuesta se guarda en el historial como de Gemini', (await page.evaluate(() => JSON.parse(localStorage.getItem('asesor-prompts.v1')).items[0].fuente)) === 'gemini');
await page.click('#fb [data-r=sobro]'); await esp(200);
await page.fill('#borrador', 'necesito diseñar la base de datos de equipos otra vez'); respuesta = () => ok(RESP);
await page.click('#btnAnalizar'); await page.waitForSelector('#resultado:not([hidden])'); await esp(500);
log('lo aprendido también corrige a Gemini: tras «Sobró», baja un peldaño (Opus medio)', (await page.textContent('#tRes')) === 'Opus 5.5' && (await page.textContent('#resEsfuerzo')) === 'Medio' && /Bajé un nivel/.test(await page.textContent('#resAprendido')));
await page.screenshot({ path: SALIDA + '/gemini-resultado.png', fullPage: true });

console.log('Cuando Gemini falla, el asesor no se rompe');
const casos = [
  ['límite gratuito (429)', () => ({ status: 429, contentType: 'application/json', body: '{"error":{"message":"quota"}}' }), /límite gratuito/],
  ['clave no aceptada (400)', () => ({ status: 400, contentType: 'application/json', body: '{"error":{"message":"API key not valid. Please pass a valid API key."}}' }), /no aceptó tu clave/],
  ['modelo que no existe (404)', () => ({ status: 404, contentType: 'application/json', body: '{"error":{"message":"not found"}}' }), /no existe o no está disponible/],
  ['servicio caído (503)', () => ({ status: 503, contentType: 'application/json', body: '{}' }), /error del servicio/],
  ['respuesta que no es JSON', () => ok('lo siento, no puedo'), /formato que no pude leer/],
  ['bloqueado por seguridad', () => ({ status: 200, contentType: 'application/json', body: '{"promptFeedback":{"blockReason":"SAFETY"}}' }), /no quiso analizar/],
  ['sin conexión', () => 'abortar', /No hay conexión con Gemini/]
];
for (const [nombre, r, re] of casos) {
  respuesta = r;
  await page.fill('#borrador', PS);
  await page.click('#btnAnalizar'); await page.waitForSelector('#resultado:not([hidden])'); await esp(500);
  log(`${nombre}: avisa y da la estimación local`, (await hayAviso(page, re)) && /Sin Gemini/.test(await page.textContent('#resFuente')) && (await page.textContent('#tRes')) === 'Sonnet 5.5', (await page.locator('.aviso span').allTextContents()).join(' | '));
  log(`${nombre}: el botón vuelve a estar activo`, await page.isEnabled('#btnAnalizar'));
  await page.evaluate(() => document.querySelector('#avisos').replaceChildren());
}

console.log('Parar');
respuesta = async () => { await esp(4000); return ok(RESP); };
await page.fill('#borrador', 'necesito diseñar algo grande desde cero');
const antes = await page.locator('#vista-asesor').evaluate(() => JSON.parse(localStorage.getItem('asesor-prompts.v1')).items.length);
await page.click('#btnAnalizar');
await esp(300);
log('mientras espera: «Parar» visible, Analizar desactivado y ocupado', (await page.isVisible('#btnParar')) && (await page.isDisabled('#btnAnalizar')) && (await page.getAttribute('#btnAnalizar', 'aria-busy')) === 'true' && /Consultando a Gemini/.test(await page.textContent('#estado')));
await page.click('#btnParar');
await esp(300);
log('«Parar» detiene: sin resultado nuevo ni análisis guardado', /Análisis detenido/.test(await page.textContent('#estado')) && (await page.isEnabled('#btnAnalizar')) && !(await page.isVisible('#btnParar')) && (await page.evaluate(() => JSON.parse(localStorage.getItem('asesor-prompts.v1')).items.length)) === antes);

console.log('Privacidad de la clave');
await page.click('.pestana[data-vista=ajustes]');
const [d] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportar')]);
await d.saveAs(SALIDA + '/respaldo-gemini.json');
log('el respaldo exportado no lleva la clave', !fs.readFileSync(SALIDA + '/respaldo-gemini.json', 'utf8').includes('AIza'));
await page.click('#btnBorrarClave'); await page.waitForSelector('dialog[open]');
log('borrar la clave pide confirmar', /Borrar la clave/.test(await page.textContent('dialog h2')));
await page.click('dialog .btn.peligro'); await esp(400);
log('y deja el motor local y sin clave', (await page.isChecked('input[name=motor][value=local]')) && (await page.evaluate(() => localStorage.getItem('asesor-prompts.clave'))) === null && !(await page.isVisible('#panelGemini')));

log('ningún error de JavaScript, de consola ni de CSP', !errores.some((e) => !/Failed to load resource|net::ERR_FAILED/.test(e)), [...new Set(errores)].slice(0, 6).join('\n        '));
await br.close(); srv.close();
process.exit(resumen() ? 1 : 0);
