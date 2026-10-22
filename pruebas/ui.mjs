// La pantalla de punta a punta: analizar, copiar, valorar, historial, aprendizaje, respaldo, tema, teclado, tamaños, accesibilidad (axe) y errores de consola/CSP.
// Uso: node pruebas/ui.mjs   (CAPTURAS=carpeta para guardar las fotos)
import fs from 'node:fs';
import { servir, lanzar, pagina, contador, axe, esp, SALIDA } from './banco.mjs';

const PUERTO = 8851, URL = `http://127.0.0.1:${PUERTO}/`;
const { log, resumen } = contador();
const srv = await servir(PUERTO), br = await lanzar();
const errores = [];
const PS = 'hazme un script de powershell que copie descargas a una usb y me diga cuales fallaron';

const abrir = async (opts = {}, ruta = '') => {
  const p = await pagina(br, { errores, ...opts });
  await p.page.goto(URL + ruta);
  await p.page.waitForSelector('#principal');
  await esp(250);
  return p;
};
const analizar = async (page, texto) => {
  await page.fill('#borrador', texto);
  await page.click('#btnAnalizar');
  await page.waitForSelector('#resultado:not([hidden])');
  await esp(650);
};
const avisos = (page) => page.locator('.aviso span').allTextContents();
const hayAviso = async (page, re) => (await avisos(page)).some((t) => re.test(t));
const pestana = async (page, v) => { await page.click(`.pestana[data-vista=${v}]`); await esp(350); };

console.log('Primer arranque');
let { ctx, page } = await abrir();
log('título y encabezado', (await page.title()) === 'Asesor de prompts' && (await page.textContent('h1')) === 'Asesor de prompts');
log('cuatro pestañas y la primera está activa', (await page.locator('.pestana').count()) === 4 && (await page.getAttribute('.pestana[data-vista=asesor]', 'aria-current')) === 'page');
log('sin análisis: muestra el estado vacío con 4 ejemplos y oculta el resultado', (await page.isVisible('#vacio')) && (await page.locator('#ejemplos .chip').count()) === 4 && !(await page.isVisible('#resultado')));
log('motor por defecto: en este aparato', /En este aparato/.test(await page.textContent('#etiquetaMotor')));
await page.click('#btnAnalizar');
log('analizar sin texto: avisa y deja el cursor en el borrador', /Escribe primero/.test(await page.textContent('#estado')) && (await page.evaluate(() => document.activeElement.id)) === 'borrador');
await page.fill('#borrador', PS);
log('cuenta tokens y aparece «Limpiar»', /≈ \d+ tokens/.test(await page.textContent('#contador')) && (await page.isVisible('#btnLimpiar')));
await page.click('#btnAnalizar');
await page.waitForSelector('#resultado:not([hidden])');
await esp(700);
log('recomienda Sonnet 5.5 con esfuerzo Medio (medium)', (await page.textContent('#tRes')) === 'Sonnet 5.5' && (await page.textContent('#resEsfuerzo')) === 'Medio' && (await page.textContent('#resEsfuerzoId')) === 'medium');
log('escalera de 9 peldaños con el 4.º marcado', (await page.locator('#escalera .peldano').count()) === 9 && (await page.locator('#escalera .peldano').nth(3).getAttribute('class')).includes('actual'));
log('la escalera tiene descripción para lector de pantalla', /Sonnet 5.5 con esfuerzo medio, peldaño 4 de 9/.test(await page.getAttribute('#escalera', 'aria-label')));
log('tipo, complejidad y costo visibles', /PowerShell/.test(await page.textContent('#resTipo')) && /media/.test(await page.textContent('#resComplejidad')) && /x1/.test(await page.textContent('#resCosto')));
log('alternativa más barata con su riesgo', /gastar menos/.test(await page.textContent('#resBarata')) && /Riesgo/.test(await page.textContent('#resBarata')));
log('pide 2 datos que faltan (ruta y cómo comprobar)', (await page.locator('#faltan li').count()) === 2);
log('el foco pasa al resultado', (await page.evaluate(() => document.activeElement.id)) === 'resultado');
const mejorado = await page.inputValue('#mejorado');
log('prompt mejorado con las secciones y el borrador', ['Objetivo:', 'Contexto:', 'Restricciones:', 'Formato de respuesta:'].every((s) => mejorado.includes(s)) && mejorado.includes(PS));
log('«2 datos por completar» y «Ir al primero» selecciona el primero', (await page.textContent('#pendientes')) === '2 datos por completar' && await (async () => {
  await page.click('#btnPendiente');
  return page.evaluate(() => { const t = document.querySelector('#mejorado'); return t.value.slice(t.selectionStart, t.selectionEnd).startsWith('[COMPLETAR'); });
})());
log('el contador de pendientes baja al completar uno', await (async () => {
  await page.evaluate(() => { const t = document.querySelector('#mejorado'); t.setRangeText('E:\\Copias', t.selectionStart, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input')); });
  return (await page.textContent('#pendientes')) === '1 dato por completar';
})());
await page.fill('#mejorado', mejorado);
await page.dispatchEvent('#mejorado', 'input');

console.log('Copiar, compartir y pegar');
await page.click('#btnCopiar');
await esp(200);
log('copia el prompt tal cual está en el cuadro', (await page.evaluate(() => navigator.clipboard.readText())) === mejorado);
log('el botón dice «¡Copiado!» y avisa que quedan datos por completar', /Copiado/.test(await page.textContent('#btnCopiar')) && (await hayAviso(page, /quedan 2 datos por completar/)));
log('sin navigator.share no aparece «Compartir»', !(await page.isVisible('#btnCompartir')));
await page.evaluate(() => navigator.clipboard.writeText('texto desde el portapapeles'));
await page.click('#btnPegar');
await esp(200);
log('«Pegar» pone el portapapeles en el borrador', (await page.inputValue('#borrador')) === 'texto desde el portapapeles');
await page.click('#btnLimpiar');
log('«Limpiar» vacía el borrador y se esconde', (await page.inputValue('#borrador')) === '' && !(await page.isVisible('#btnLimpiar')));
await page.fill('#borrador', PS);

console.log('Atajo de teclado');
await page.press('#borrador', 'Control+Enter');
await esp(700);
log('Ctrl + Intro analiza y suma otro análisis', (await page.evaluate(() => JSON.parse(localStorage.getItem('asesor-prompts.v1')).items.length)) === 2);

console.log('Valorar y aprender');
log('la insignia del Historial cuenta los análisis sin valorar', (await page.textContent('#insigniaHist')) === '2');
await page.click('#fb [data-r=corto]');
log('«Quedó corto» queda marcado y dice qué hará la próxima vez', (await page.getAttribute('#fb [data-r=corto]', 'aria-pressed')) === 'true' && /subo un nivel la próxima vez/.test(await page.textContent('#fbEfecto')));
log('y avisa con un aviso que desaparece solo', await hayAviso(page, /Anotado/) && await (async () => { await esp(4600); return (await page.locator('.aviso').count()) === 0; })());
log('la insignia baja a 1', (await page.textContent('#insigniaHist')) === '1');
await analizar(page, PS);
log('la próxima vez sube un peldaño: Sonnet con esfuerzo Alto', (await page.textContent('#tRes')) === 'Sonnet 5.5' && (await page.textContent('#resEsfuerzo')) === 'Alto');
log('explica que se ajustó por lo valorado y marca el punto de partida', /Subí un nivel por tus valoraciones/.test(await page.textContent('#resAprendido')) && (await page.locator('#escalera .partida').count()) === 1);
await page.click('#fb [data-r=justo]');
log('«Justo» en el peldaño subido mantiene la subida', /subo un nivel/.test(await page.textContent('#fbEfecto')));
await page.click('#fb [data-r=justo]');
log('tocar de nuevo quita la valoración', (await page.getAttribute('#fb [data-r=justo]', 'aria-pressed')) === 'false' && /Quité/.test(await page.textContent('#fbEfecto')));
await page.click('#fb [data-r=justo]');

console.log('Historial');
await pestana(page, 'historial');
log('la pestaña usa la dirección #/historial y cambia el título', page.url().endsWith('#/historial') && /Historial/.test(await page.title()));
log('hay 3 análisis con su franja de estado', (await page.locator('#lista .item').count()) === 3 && (await page.locator('#lista .item[data-r=corto]').count()) === 1 && (await page.locator('#lista .item[data-r=justo]').count()) === 1);
log('los filtros cuentan: todos 3, justo 1, corto 1, sin valorar 1', (await page.locator('#filtros .chip').evaluateAll((l) => l.map((c) => c.querySelector('.n').textContent))).join(',') === '3,1,1,0,1');
await page.click('#filtros [data-f=justo]');
log('filtrar por «Justo» deja uno', (await page.locator('#lista .item').count()) === 1);
await page.click('#filtros [data-f=todos]');
await page.fill('#buscar', 'zzzz');
await esp(300);
log('buscar algo que no existe muestra «Nada coincide»', (await page.isVisible('#histVacio')) && /Nada coincide/.test(await page.textContent('#histVacio')));
await page.fill('#buscar', 'usb');
await esp(300);
log('buscar «usb» los encuentra', (await page.locator('#lista .item').count()) === 3);
await page.fill('#buscar', '');
await page.locator('#lista .item').first().click();
await esp(500);
log('abrir uno vuelve al Asesor con su borrador y su resultado', (await page.inputValue('#borrador')) === PS && (await page.isVisible('#resultado')) && page.url().endsWith('#/asesor'));
await page.goBack();
await esp(300);
log('el botón Atrás del navegador vuelve al Historial', (await page.isVisible('#vista-historial')) && !(await page.isVisible('#vista-asesor')));
await page.locator('#lista .item-borrar').first().click();
log('borrar un análisis avisa y deja «Deshacer»', (await page.locator('#lista .item').count()) === 2 && await hayAviso(page, /Análisis borrado/));
await page.click('.aviso button');
await esp(300);
log('«Deshacer» lo devuelve', (await page.locator('#lista .item').count()) === 3);

console.log('Aprendizaje');
await pestana(page, 'aprendizaje');
await esp(800);
log('las cifras cuentan hasta su valor: 3 análisis, 2 valorados, 50% justos', (await page.textContent('#c-analisis')) === '3' && (await page.textContent('#c-valorados')) === '2' && (await page.textContent('#c-justos')) === '50%');
log('muestra el ajuste de PowerShell: +1 nivel', /Script de PowerShell/.test(await page.textContent('#calibracion')) && /\+1 nivel/.test(await page.textContent('#calibracion')));
log('la balanza marca +1', (await page.locator('#calibracion .balanza i').evaluateAll((l) => l.findIndex((x) => x.classList.contains('marca')))) === 4);

console.log('Respaldo: exportar, borrar e importar');
await pestana(page, 'ajustes');
const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportar')]);
const ruta = SALIDA + '/respaldo-prueba.json';
await descarga.saveAs(ruta);
const respaldo = JSON.parse(fs.readFileSync(ruta, 'utf8'));
log('exporta un .json con la fecha en el nombre', /^asesor-prompts-\d{4}-\d{2}-\d{2}\.json$/.test(descarga.suggestedFilename()) && respaldo.app === 'asesor-prompts' && respaldo.items.length === 3);
await page.click('#btnBorrarHist');
await page.waitForSelector('dialog[open]');
log('borrar el historial pide confirmar y el foco cae en «Cancelar»', /Borrar todo el historial/.test(await page.textContent('dialog h2')) && (await page.evaluate(() => document.activeElement.textContent)) === 'Cancelar');
await page.keyboard.press('Escape');
await esp(300);
log('Escape cierra y devuelve el foco al botón', !(await page.locator('dialog').count()) && (await page.evaluate(() => document.activeElement.id)) === 'btnBorrarHist');
log('cancelar no borró nada', (await page.evaluate(() => JSON.parse(localStorage.getItem('asesor-prompts.v1')).items.length)) === 3);
await page.click('#btnBorrarHist');
await page.waitForSelector('dialog[open]');
await page.click('dialog .btn.peligro');
await esp(400);
log('confirmar borra todo', (await page.evaluate(() => JSON.parse(localStorage.getItem('asesor-prompts.v1')).items.length)) === 0);
await page.setInputFiles('#archivo', ruta);
await page.waitForSelector('dialog[open]');
log('importar suma los análisis y lo cuenta', /3 análisis nuevos y 0 actualizados/.test(await page.textContent('dialog .hoja-cuerpo')));
await page.click('dialog .btn');
await esp(300);
log('el historial vuelve con sus valoraciones', (await page.evaluate(() => JSON.parse(localStorage.getItem('asesor-prompts.v1')).items.filter((i) => i.resultado).length)) === 2);
fs.writeFileSync(SALIDA + '/no-respaldo.json', '{"hola":1}');
await page.setInputFiles('#archivo', SALIDA + '/no-respaldo.json');
await esp(300);
log('un archivo que no es respaldo se rechaza con un mensaje claro', await hayAviso(page, /no es un respaldo del asesor/));
await page.setInputFiles('#archivo', ruta);
await page.waitForSelector('dialog[open]');
log('importar el mismo respaldo otra vez no duplica', /0 análisis nuevos y 0 actualizados/.test(await page.textContent('dialog .hoja-cuerpo')));
await page.click('dialog .btn');
await page.click('#btnOlvidar');
await page.waitForSelector('dialog[open]');
await page.click('dialog .btn.peligro');
await esp(300);
log('«Olvidar lo aprendido» quita las valoraciones pero deja los análisis', await page.evaluate(() => { const it = JSON.parse(localStorage.getItem('asesor-prompts.v1')).items; return it.length === 3 && it.every((i) => !i.resultado); }));
await ctx.close();

console.log('Hábitos: lo que añades a mano');
({ ctx, page } = await abrir());
const editarYCopiar = async (texto, linea) => {
  await analizar(page, texto);
  if (linea) await page.evaluate((l) => { const t = document.querySelector('#mejorado'); t.value += '\n- ' + l; t.dispatchEvent(new Event('input')); }, linea);
  await page.click('#btnCopiar');
  await esp(150);
};
await editarYCopiar(PS, 'Usa siempre rutas con comillas');
await editarYCopiar(PS + ' ', 'usa siempre rutas con comillas.');
await analizar(page, PS);
log('a la segunda vez ya lo incluye solo en el siguiente prompt', (await page.inputValue('#mejorado')).includes('- Usa siempre rutas con comillas'));
await pestana(page, 'aprendizaje');
log('y aparece en «Lo que sueles añadir»', /Usa siempre rutas con comillas/.test(await page.textContent('#habitos')));
await page.click('#habitos .quitar');
await esp(200);
log('«Olvidar» esa línea la quita', !(await page.textContent('#habitos')).includes('rutas con comillas') && await hayAviso(page, /La olvidé/));
await pestana(page, 'asesor');
await analizar(page, PS);
log('el prompt nuevo ya no la lleva', !(await page.inputValue('#mejorado')).includes('rutas con comillas'));

console.log('Corregir el tipo de tarea');
await analizar(page, 'revisar el cuarto del patch panel y el rack');
log('al principio no lo reconoce (consulta general)', /Consulta general/.test(await page.textContent('#resTipo')));
await page.click('#detTipo summary');
await page.selectOption('#selTipo', 'soporte');
await page.click('#btnTipo');
await esp(300);
log('lo corrigo y se recalcula', /Soporte técnico/.test(await page.textContent('#resTipo')) && await hayAviso(page, /Aprendí: cuarto, panel, patch/));
await analizar(page, 'necesito revisar otra vez el cuarto del patch panel');
log('la próxima vez con esas palabras acierta solo', /Soporte técnico/.test(await page.textContent('#resTipo')));
await pestana(page, 'aprendizaje');
log('las palabras aprendidas se listan y se pueden olvidar', (await page.locator('#palabras li:not(.sin-datos)').count()) === 3);
await page.click('#palabras .quitar');
log('olvidar una palabra la quita', (await page.locator('#palabras li:not(.sin-datos)').count()) === 2);
await ctx.close();

console.log('Secretos y texto raro');
({ ctx, page } = await abrir());
await analizar(page, 'mi clave de gemini es AIzaSyA1234567890abcdefghijklmnopqrstu12 y quiero un script de powershell');
log('avisa que quitó el secreto', /secreto/.test(await page.textContent('#faltan li:first-child')));
const crudo = await page.evaluate(() => localStorage.getItem('asesor-prompts.v1'));
log('el secreto no está en el prompt ni en lo guardado', !(await page.inputValue('#mejorado')).includes('AIzaSyA123') && !crudo.includes('AIzaSyA123') && crudo.includes('DATO SECRETO OCULTO'));
await analizar(page, '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script> hazme algo');
await pestana(page, 'historial');
log('el HTML escrito se muestra como texto y no se ejecuta', (await page.evaluate(() => window.__xss)) === undefined && /<img src=x/.test(await page.textContent('#lista .item-t')) && (await page.locator('#lista img').count()) === 0);
await pestana(page, 'asesor');
await page.evaluate(() => { document.querySelector('#borrador').value = 'x'.repeat(21000); });
await page.click('#btnAnalizar');
log('un borrador de más de 20.000 letras se rechaza con un mensaje', /muy largo/.test(await page.textContent('#estado')));
const t0 = Date.now();
await analizar(page, ('powershell script 1. paso\n').repeat(700));
log('un borrador de ~17.000 letras se analiza rápido', Date.now() - t0 < 4000 && (await page.isVisible('#resultado')), (Date.now() - t0) + ' ms');
log('el prompt mejorado largo se adapta pero no pasa del 70% de la pantalla', (await page.evaluate(() => document.querySelector('#mejorado').getBoundingClientRect().height)) <= 900 * 0.7 + 8);
await ctx.close();

console.log('Compartir hacia afuera, dirección compartida y atajos de la app');
({ ctx, page } = await abrir({ init: () => { navigator.share = async (d) => { window.__compartido = d; }; } }));
await analizar(page, PS);
log('con navigator.share aparece «Compartir» y manda el prompt', (await page.isVisible('#btnCompartir')) && await (async () => { await page.click('#btnCompartir'); await esp(150); return (await page.evaluate(() => window.__compartido.text)) === (await page.inputValue('#mejorado')); })());
await page.goto(URL + '?titulo=Nota&texto=revisar%20este%20error%20de%20n8n&enlace=https%3A%2F%2Fej.com%2Fa');
await esp(400);
log('recibir texto compartido lo pone en el borrador y limpia la dirección', (await page.inputValue('#borrador')) === 'Nota\nrevisar este error de n8n\nhttps://ej.com/a' && !page.url().includes('?') && await hayAviso(page, /Recibí lo que compartiste/));
await page.goto(URL + '?nuevo=1');
await esp(300);
log('el atajo «Nuevo análisis» deja el cursor en el borrador', (await page.evaluate(() => document.activeElement.id)) === 'borrador');
await page.goto(URL + '#/ajustes');
await esp(300);
log('el atajo «Historial» / enlace directo abre la vista correcta', (await page.isVisible('#vista-ajustes')) && (await page.evaluate(() => document.activeElement.id)) !== 'x');
await ctx.close();

console.log('Tema');
({ ctx, page } = await abrir({ tema: 'light' }));
const fondo = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
log('automático con el aparato en claro: arena', (await fondo()) === 'rgb(244, 241, 232)');
await page.click('#btnTema');
log('1.er toque: claro explícito', (await page.getAttribute('html', 'data-theme')) === 'light' && /claro/.test(await page.getAttribute('#btnTema', 'aria-label')));
await page.click('#btnTema'); await esp(100);
log('2.º toque: oscuro (fondo petróleo profundo)', (await page.getAttribute('html', 'data-theme')) === 'dark' && (await fondo()) === 'rgb(10, 27, 28)');
await page.reload(); await esp(300);
log('el tema se recuerda al recargar', (await page.getAttribute('html', 'data-theme')) === 'dark');
await pestana(page, 'ajustes');
log('en Ajustes el selector refleja el tema', await page.isChecked('input[name=tema][value=dark]'));
await page.click('input[name=tema][value=auto]');
log('«Automático» quita el tema forzado', (await page.getAttribute('html', 'data-theme')) === null);
await ctx.close();
({ ctx, page } = await abrir({ tema: 'dark' }));
log('automático con el aparato en oscuro: oscuro sin tocar nada', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(10, 27, 28)');
await ctx.close();

console.log('Teclado y foco');
({ ctx, page } = await abrir());
await page.keyboard.press('Tab');
log('el primer Tab llega a «Ir al contenido»', (await page.evaluate(() => document.activeElement.className)) === 'saltar');
await pestana(page, 'historial');
await page.focus('.saltar'); await page.keyboard.press('Enter'); await esp(300);
log('el enlace de salto no cambia de vista', await page.isVisible('#vista-historial'));
await page.focus('.pestana[data-vista=ajustes]');
await page.keyboard.press('Enter'); await esp(300);
log('las pestañas se activan con Enter y mueven el foco al título', (await page.evaluate(() => document.activeElement.id)) === 't-ajustes');
log('el foco se ve (contorno de 3 px)', await (async () => { await page.keyboard.press('Tab'); return (await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth)) === '3px'; })());
await ctx.close();

console.log('Sin conexión y sin almacenamiento');
({ ctx, page } = await abrir());
await ctx.setOffline(true); await esp(200);
log('sin conexión: aparece la etiqueta y el asesor sigue analizando', (await page.isVisible('#pillSinRed')) && await (async () => { await analizar(page, PS); return (await page.textContent('#tRes')) === 'Sonnet 5.5'; })());
await ctx.setOffline(false); await esp(200);
log('al volver la conexión la etiqueta se va', !(await page.isVisible('#pillSinRed')));
await ctx.close();
({ ctx, page } = await abrir({ init: () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); } }); } }));
log('con el almacenamiento bloqueado la app abre y avisa', (await page.isVisible('h1')) && await hayAviso(page, /no deja guardar datos/));
await analizar(page, PS);
await pestana(page, 'ajustes');
log('sigue funcionando en memoria y Ajustes lo explica', (await page.textContent('#tRes')) === 'Sonnet 5.5' || /no deja guardar/.test(await page.textContent('#estadoAlmacen')));
log('Ajustes dice que no se está guardando', /no deja guardar datos/.test(await page.textContent('#estadoAlmacen')));
await ctx.close();

console.log('Movimiento reducido');
({ ctx, page } = await abrir({ quieto: true }));
await analizar(page, PS);
log('con «reducir movimiento» las animaciones duran ~0', await page.evaluate(() => { const d = parseFloat(getComputedStyle(document.querySelector('#resultado > *')).animationDuration); return d < 0.001; }));
log('y la escalera queda pintada al instante', (await page.locator('#escalera .actual').count()) === 1);
await ctx.close();

console.log('Tamaños de pantalla');
const PANTALLAS = [['teléfono chico', 360, 740], ['teléfono', 390, 844], ['tableta', 768, 1024], ['portátil', 1280, 800], ['pantalla grande', 1920, 1080]];
for (const [nombre, ancho, alto] of PANTALLAS) {
  ({ ctx, page } = await abrir({ ancho, alto }));
  await analizar(page, PS);
  await page.click('#fb [data-r=corto]');
  const malos = [];
  for (const v of ['asesor', 'historial', 'aprendizaje', 'ajustes']) {
    await pestana(page, v);
    if (v === 'ajustes') { await page.click('input[name=motor][value=gemini]'); await esp(200); }
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (sobra > 0) malos.push(`${v}: desborda ${sobra}px`);
    const chicos = await page.evaluate(() => [...document.querySelectorAll('button, input:not([type=file]), select, summary, textarea, a.saltar')]
      .filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ e, r }) => r.width > 0 && r.height > 0 && (r.height < 38 || r.width < 38) && !e.closest('.visualmente-oculto') && !e.classList.contains('saltar'))
      .map(({ e, r }) => `${e.tagName.toLowerCase()}#${e.id || e.className} ${Math.round(r.width)}x${Math.round(r.height)}`));
    if (chicos.length) malos.push(`${v}: controles chicos ${chicos.join(', ')}`);
    if (v === 'asesor') await page.screenshot({ path: `${SALIDA}/${ancho}-${v}.png`, fullPage: true });
  }
  log(`${nombre} (${ancho}×${alto}): sin scroll horizontal y controles de 38 px o más`, !malos.length, malos.join(' | '));
  const nav = await page.evaluate(() => { const n = document.querySelector('.pestanas'), r = n.getBoundingClientRect(); return { pos: getComputedStyle(n).position, abajo: Math.round(window.innerHeight - r.bottom) }; });
  log(`${nombre}: pestañas ${ancho < 900 ? 'fijas abajo' : 'arriba, pegadas al encabezado'}`, ancho < 900 ? nav.pos === 'fixed' && nav.abajo === 0 : nav.pos === 'sticky');
  await ctx.close();
}

console.log('Accesibilidad (axe)');
for (const tema of ['light', 'dark']) {
  for (const [ancho, alto] of [[1280, 900], [390, 844]]) {
    ({ ctx, page } = await abrir({ tema, ancho, alto }));
    const n = `${tema === 'light' ? 'claro' : 'oscuro'} ${ancho}`;
    await axe(page, log, `${n}: Asesor vacío`);
    await analizar(page, PS);
    await axe(page, log, `${n}: Asesor con resultado`);
    await page.click('#fb [data-r=corto]');
    for (const v of ['historial', 'aprendizaje', 'ajustes']) {
      await pestana(page, v);
      if (v === 'ajustes') { await page.click('input[name=motor][value=gemini]'); await esp(200); }
      await esp(700);
      await axe(page, log, `${n}: ${v}`);
    }
    await page.click('#btnBorrarClave'); await page.waitForSelector('dialog[open]'); await esp(400);
    await axe(page, log, `${n}: diálogo`);
    await page.screenshot({ path: `${SALIDA}/${n.replace(' ', '-')}-dialogo.png` });
    await ctx.close();
  }
}

log('ningún error de JavaScript, de consola ni de CSP, ni archivos que no carguen', !errores.length, [...new Set(errores)].slice(0, 8).join('\n        '));
await br.close(); srv.close();
process.exit(resumen() ? 1 : 0);
