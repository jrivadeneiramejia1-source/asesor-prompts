// Motor, aprendizaje, secretos, guardado, exportar/importar y Gemini (con respuestas falsas). No necesita navegador.
// Uso: node pruebas/motor.mjs
import { analizarLocal, clasificar, ocultarSecretos, senales, rungDe, resultadoDesdeIA, contarPendientes, estimarTokens, SECRETO } from '../js/motor.js';
import { ajusteDe, resumenAprendizaje, registrarEdicion, habitosActivos, palabrasClave, aprenderCategoria, efectoProximo, describirAjuste } from '../js/aprendizaje.js';
import { ESCALERA, CATEGORIAS, CATEGORIA, MODELOS, PERFIL_BASE } from '../js/datos.js';
import { crearAlmacen, sanearItem } from '../js/almacen.js';
import { armarPedidoIA, pedirGemini, leerRespuestaIA, claveValida, modeloValido } from '../js/ia.js';

let ok = 0, mal = 0;
const log = (n, t, x) => { t ? ok++ : mal++; console.log((t ? 'OK   ' : 'FALLA') + ' ' + n + (t || x === undefined ? '' : '\n      ' + x)); };
const igual = (n, a, b) => log(n, JSON.stringify(a) === JSON.stringify(b), 'recibí ' + JSON.stringify(a) + ' y esperaba ' + JSON.stringify(b));

console.log('Datos');
log('hay 9 peldaños y ninguno repetido', ESCALERA.length === 9 && new Set(ESCALERA.map((p) => p.modelo + p.esfuerzo)).size === 9);
log('cada peldaño usa un modelo que existe', ESCALERA.every((p) => MODELOS[p.modelo]));
log('los peldaños suben de costo', ESCALERA.every((p, i) => i === 0 || MODELOS[p.modelo].costo >= MODELOS[ESCALERA[i - 1].modelo].costo));
log('cada tipo de tarea tiene id único, peldaño de partida válido y claves con expresiones', new Set(CATEGORIAS.map((c) => c.id)).size === CATEGORIAS.length && CATEGORIAS.every((c) => c.base >= 0 && c.base <= 7 && c.claves.every(([re, w]) => re instanceof RegExp && w > 0)));
log('ningún tipo de tarea parte de Fable (es solo de escalada manual)', CATEGORIAS.every((c) => ESCALERA[c.base].modelo !== 'fable'));

console.log('Clasificar y recomendar');
const casos = [
  ['hazme un script de powershell que copie descargas a una usb y me diga cuales fallaron', 'powershell', 'sonnet'],
  ['mi flujo de n8n con webhook de telegram no llega al nodo http request', 'n8n', 'sonnet'],
  ['traduce este parrafo al ingles', 'traduccion', 'haiku'],
  ['que significa DHCP?', 'rapida', 'haiku'],
  ['necesito una arquitectura escalable para migrar toda la base de datos a otro servicio, desde cero', 'arquitectura', 'opus'],
  ['audita la seguridad de mi servidor y dime las vulnerabilidades', 'seguridad', 'opus'],
  ['la impresora epson no enciende y el computador esta muy lento', 'soporte', 'sonnet'],
  ['redacta un correo formal para mi instructor pidiendo una prorroga', 'redaccion', 'sonnet'],
  ['hola', 'general', 'sonnet']
];
for (const [t, cat, modelo] of casos) {
  const r = analizarLocal(t);
  log(`«${t.slice(0, 44)}…» → ${cat} / ${modelo}`, r.categoria === cat && r.modelo === modelo, `recibí ${r.categoria} / ${r.modelo} / ${r.esfuerzo}`);
}
{
  const corto = analizarLocal('script de powershell que liste los procesos');
  const largo = analizarLocal('script de powershell que copie archivos.\n1. Lee la carpeta\n2. Filtra por fecha\n3. Copia a la USB\n4. Registra errores\n5. Envía un resumen\nY luego, además, también por último revisa todo el proyecto completo otra vez porque sigue fallando en producción. ' + 'x'.repeat(1300));
  log('un borrador corto baja un peldaño y uno largo con varias señales sube', corto.rung < largo.rung, `${corto.rung} vs ${largo.rung}`);
  log('las señales se explican en el motivo', /subí el nivel por/.test(largo.motivo) && /texto es muy corto/.test(corto.motivo), largo.motivo);
  log('el motor local nunca recomienda Fable por su cuenta', casos.every(([t]) => analizarLocal(t + ' ' + 'x'.repeat(5000)).modelo !== 'fable'));
  log('hay alternativa más barata (salvo en el peldaño más bajo)', analizarLocal('hola').alt && analizarLocal('hola').alt.rung < analizarLocal('hola').rung && analizarLocal('traduce hola').alt !== undefined);
}
{
  const r = analizarLocal('mi script de powershell da error al copiar y no funciona');
  log('un error dentro de un script pide el texto exacto del error (tipo secundario)', r.categoria === 'powershell' && r.faltan.some((f) => /error/i.test(f)), r.faltan.join(' | '));
  const completo = analizarLocal('script de powershell 7 en Windows 11 que copie C:\\Descargas a E:\\Copias; si algo falla que avise y siga. Para comprobar, debe mostrar cuántos archivos copió.');
  log('si el borrador ya trae ruta, versión, qué hacer si falla y cómo comprobar, no pide nada', completo.faltan.length === 0, completo.faltan.join(' | '));
  log('el perfil cuenta como dato conocido (versión de PowerShell)', !analizarLocal('script de powershell que copie C:\\a a E:\\b', { perfil: PERFIL_BASE }).faltan.some((f) => /Versión/.test(f)));
}

console.log('Prompt mejorado');
{
  const r = analizarLocal('hazme un script de powershell que copie descargas a una usb y me diga cuales fallaron', { perfil: PERFIL_BASE });
  log('trae objetivo, contexto, restricciones, formato y cómo comprobar', ['Objetivo:', 'Contexto:', 'Restricciones:', 'Formato de respuesta:', 'Cómo comprobar'].every((s) => r.mejorado.includes(s)), r.mejorado);
  log('conserva el borrador tal cual', r.mejorado.includes('hazme un script de powershell que copie descargas a una usb'));
  log('lo que falta queda como [COMPLETAR: …] y se cuenta', contarPendientes(r.mejorado) >= 1 && contarPendientes(r.mejorado) === r.faltan.length, r.mejorado);
  log('lleva las reglas del perfil (español, avísame…) y no el dato de quién soy repetido', /Quiero respuestas en español/.test(r.mejorado) && /Avísame/.test(r.mejorado));
  const corto = analizarLocal('traduce hola al ingles', { perfil: PERFIL_BASE });
  log('una tarea simple no se infla: solo el borrador y una línea', corto.mejorado === 'traduce hola al ingles\n\nResponde en español, breve y directo.', JSON.stringify(corto.mejorado));
  const largo = analizarLocal('Primero esto. ' + 'Esto es una explicación muy larga del problema con mucho detalle técnico. '.repeat(8), { perfil: PERFIL_BASE });
  log('un párrafo largo se divide en objetivo y detalles', /Objetivo:\nPrimero esto\./.test(largo.mejorado) && /Detalles:\n/.test(largo.mejorado), largo.mejorado.slice(0, 120));
}

console.log('Secretos');
{
  const casos = [
    ['mi clave de Gemini es AIzaSyA1234567890abcdefghijklmnopqrstu12', 1],
    ['token: 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0', 1],
    ['el token de github ghp_abcdefghijklmnopqrstuvwxyz0123456789 sirve', 1],
    ['mi contraseña es Hunter2024!', 1],
    ['password=supersecreta99', 1],
    ['sk-ant-api03-abcdefghijklmnopqrstuvwxyz', 1],
    ['la clave es segura', 0],
    ['la contraseña debe ser larga', 0],
    ['abre la carpeta y copia todo', 0]
  ];
  for (const [t, n] of casos) { const r = ocultarSecretos(t); log(`secretos(${n}): «${t.slice(0, 40)}»`, r.n === n && (n === 0 ? r.texto === t : r.texto.includes(SECRETO)), JSON.stringify(r)); }
  const r = analizarLocal('mi contraseña es Hunter2024! y quiero un script de powershell');
  log('el resultado no contiene el secreto y avisa', !JSON.stringify(r).includes('Hunter2024') && /secreto/.test(r.faltan[0]) && r.secretos === 1, r.faltan[0]);
}

console.log('Calibración (aprender de tus valoraciones)');
{
  const ahora = Date.UTC(2026, 9, 22);
  const item = (id, categoria, base, rung, resultado, dt = 0) => ({ id, t: ahora - dt, vt: ahora - dt, categoria, base, rung, resultado });
  igual('sin valoraciones no hay ajuste', ajusteDe('powershell', [], ahora).ajuste, 0);
  igual('una valoración «corto» sube un nivel', ajusteDe('powershell', [item('a', 'powershell', 3, 3, 'corto')], ahora).ajuste, 1);
  igual('una valoración «sobró» baja un nivel', ajusteDe('powershell', [item('a', 'powershell', 3, 3, 'sobro')], ahora).ajuste, -1);
  igual('«justo» sin ajuste previo lo deja en 0', ajusteDe('powershell', [item('a', 'powershell', 3, 3, 'justo')], ahora).ajuste, 0);
  igual('«justo» con el peldaño ya subido MANTIENE la subida', ajusteDe('powershell', [item('a', 'powershell', 3, 4, 'justo', 1), item('b', 'powershell', 3, 3, 'corto', 2)], ahora).ajuste, 1);
  igual('corto, luego sobró en el peldaño subido: vuelve a 0', ajusteDe('powershell', [item('c', 'powershell', 3, 4, 'sobro', 1), item('b', 'powershell', 3, 3, 'corto', 2)], ahora).ajuste, 0);
  igual('dos «corto» seguidos suben más (se va acercando)', ajusteDe('powershell', [item('c', 'powershell', 3, 4, 'corto', 1), item('b', 'powershell', 3, 3, 'corto', 2)], ahora).ajuste, 2);
  igual('una sola rara no deshace dos coincidentes viejas', ajusteDe('powershell', [item('d', 'powershell', 3, 4, 'justo', 1), item('c', 'powershell', 3, 4, 'justo', 2), item('b', 'powershell', 3, 3, 'corto', 3)], ahora).ajuste, 1);
  igual('otro tipo de tarea no se contagia', ajusteDe('n8n', [item('a', 'powershell', 3, 3, 'corto')], ahora).ajuste, 0);
  igual('las valoraciones de hace más de 180 días se ignoran', ajusteDe('powershell', [item('a', 'powershell', 3, 3, 'corto', 200 * 864e5)], ahora).ajuste, 0);
  igual('el ajuste nunca pasa de 3', ajusteDe('powershell', [item('a', 'powershell', 0, 6, 'corto', 1)], ahora).ajuste, 3);
  igual('se ignoran entradas sin base (importadas de versiones viejas)', ajusteDe('powershell', [{ id: 'z', t: ahora, categoria: 'powershell', resultado: 'corto' }], ahora).ajuste, 0);

  const items = [item('a', 'powershell', 3, 3, 'corto', 5), item('b', 'n8n', 3, 3, 'sobro', 4)];
  const sin = analizarLocal('hazme un script de powershell que copie descargas a una usb', { items: [], ahora });
  const con = analizarLocal('hazme un script de powershell que copie descargas a una usb', { items, ahora });
  log('la recomendación sube un peldaño y lo explica', con.rung === sin.rung + 1 && con.ajuste === 1 && /Subí un nivel por tus valoraciones/.test(con.aprendido) && !/valoraciones/.test(con.motivo), con.aprendido);
  const n8n = analizarLocal('mi flujo de n8n con webhook falla', { items, ahora });
  const n8nSin = analizarLocal('mi flujo de n8n con webhook falla', { items: [], ahora });
  log('y en n8n baja un peldaño', n8n.rung === n8nSin.rung - 1, `${n8n.rung} vs ${n8nSin.rung}`);
  log('el resultado guarda base y peldaño final para aprender luego', con.base === sin.rung && con.rung === con.base + 1);
  const res = resumenAprendizaje(items, ahora);
  log('el resumen lista los tipos valorados', res.length === 2 && res.some((r) => r.categoria === 'powershell' && r.ajuste === 1));
  log('textos para decirte el efecto', /subo un nivel/.test(efectoProximo(ajusteDe('powershell', items, ahora), 'X')) && /sigo con la recomendación normal/.test(efectoProximo({ ajuste: 0 }, 'X')) && describirAjuste({ ajuste: 0 }, 'x') === '');
  const tope = analizarLocal('necesito una arquitectura escalable para migrar todo desde cero', { items: [item('a', 'arquitectura', 7, 7, 'corto', 1)], ahora });
  log('el aprendizaje tampoco pasa a Fable por su cuenta', tope.modelo === 'opus' && tope.rung === 7, tope.modelo + ' ' + tope.rung);
}

console.log('Hábitos (lo que añades a mano)');
{
  let h = {};
  const gen = 'Objetivo:\nhaz algo\n\nContexto:\n- [COMPLETAR: Ruta exacta]';
  h = registrarEdicion(h, 'powershell', gen, gen + '\n- Usa siempre rutas con comillas', 1);
  log('la primera vez todavía no es hábito', habitosActivos(h, 'powershell').length === 0);
  h = registrarEdicion(h, 'powershell', gen, gen + '\n- usa siempre rutas con comillas.', 2);
  igual('a la segunda vez (aunque cambie mayúscula o punto final) es hábito', habitosActivos(h, 'powershell').map((x) => x.n), [2]);
  log('no cuenta líneas con [COMPLETAR] ni encabezados', Object.keys(registrarEdicion({}, 'n8n', gen, 'Objetivo:\n[COMPLETAR: algo]\nContexto:', 1)).length === 0);
  const r = analizarLocal('hazme un script de powershell que copie descargas a una usb', { perfil: PERFIL_BASE, habitos: h });
  log('el prompt mejorado ya incluye el hábito', /- Usa siempre rutas con comillas/.test(r.mejorado), r.mejorado);
  log('no se cuela en otros tipos de tarea', !analizarLocal('mi flujo de n8n con webhook falla', { perfil: PERFIL_BASE, habitos: h }).mejorado.includes('rutas con comillas'));
  const quitado = registrarEdicion(h, 'powershell', r.mejorado, r.mejorado.replace('- Usa siempre rutas con comillas', ''), 3);
  log('si lo borras del prompt, deja de ser hábito', habitosActivos(quitado, 'powershell').length === 0);
}

console.log('Palabras aprendidas');
{
  const p = palabrasClave('quiero copiar la carpeta de descargas a una usb, la usb falla y la carpeta pesa mucho');
  log('palabras clave: sin palabras vacías y por frecuencia', p[0] === 'carpeta' && !p.includes('para') && p.length === 3, p.join(','));
  const { tokens } = aprenderCategoria({}, 'revisar el rack de patch panel del cuarto', 'soporte');
  log('corregir el tipo asocia palabras de ese borrador', Object.values(tokens).every((v) => v.cat === 'soporte') && Object.keys(tokens).length > 0, JSON.stringify(tokens));
  log('una palabra aprendida una sola vez, sola, no cambia el tipo; confirmada dos veces sí', clasificar('el cuarto esta sucio', tokens).categoria === 'general' && clasificar('el cuarto esta sucio', aprenderCategoria(tokens, 'revisar el cuarto del patch panel', 'soporte').tokens).categoria === 'soporte');
  const antes = clasificar('revisar el cuarto del patch panel').categoria;
  const despues = clasificar('revisar el cuarto del patch panel', tokens).categoria;
  log('la próxima vez esas palabras empujan hacia el tipo corregido', antes === 'general' && despues === 'soporte', antes + ' → ' + despues);
}

console.log('Guardado, exportar e importar');
{
  const mem = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; })();
  const A = crearAlmacen(mem);
  const it = A.agregar({ t: 1000, borrador: 'hola', categoria: 'general', base: 3, rung: 3, modelo: 'sonnet', esfuerzo: 'medium', tipo: 'Consulta general', motivo: 'm', faltan: [], mejorado: 'hola' });
  log('guarda y recupera del almacenamiento', crearAlmacen(mem).estado.items.length === 1 && it.id.startsWith('p'));
  A.cambiar(it.id, { resultado: 'corto', vt: 2000 });
  log('al valorar guarda el resultado y la hora', crearAlmacen(mem).estado.items[0].resultado === 'corto' && crearAlmacen(mem).estado.items[0].vt === 2000);
  A.fijarClave('AIzaSyEjemploEjemploEjemploEjemplo12345');
  const x = A.exportar();
  log('el archivo de exportación NO lleva la clave de Gemini', !x.includes('AIza') && !x.includes('EjemploEjemplo'));
  log('el archivo de exportación dice qué es', JSON.parse(x).app === 'asesor-prompts' && JSON.parse(x).items.length === 1);

  const memB = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
  const B = crearAlmacen(memB);
  B.agregar({ t: 5000, borrador: 'otro', categoria: 'n8n', base: 3, rung: 3, modelo: 'sonnet', esfuerzo: 'medium', tipo: 'Flujo de n8n', motivo: '', faltan: [], mejorado: 'otro' });
  const r1 = B.importar(x);
  igual('importar suma lo nuevo sin tocar lo que ya había', [r1.nuevos, r1.actualizados, B.estado.items.length], [1, 0, 2]);
  const r2 = B.importar(x);
  igual('importar dos veces lo mismo no duplica', [r2.nuevos, r2.actualizados, B.estado.items.length], [0, 0, 2]);
  const modificado = JSON.parse(x); modificado.items[0].resultado = 'sobro'; modificado.items[0].mod = Date.now() + 1e6; modificado.items[0].vt = Date.now() + 1e6;
  const r3 = B.importar(JSON.stringify(modificado));
  log('si el archivo trae un cambio más nuevo, lo actualiza', r3.actualizados === 1 && B.estado.items.find((i) => i.id === it.id).resultado === 'sobro');
  const viejo = JSON.parse(x); viejo.items[0].resultado = 'justo'; viejo.items[0].mod = 10;
  B.importar(JSON.stringify(viejo));
  log('y no pisa con uno más viejo', B.estado.items.find((i) => i.id === it.id).resultado === 'sobro');
  for (const [n, t] of [['no es JSON', 'hola'], ['JSON de otra app', '{"app":"otra","items":[]}'], ['sin lista', '{"app":"asesor-prompts"}']]) {
    let msg = ''; try { B.importar(t); } catch (e) { msg = e.message; }
    log('importar rechaza: ' + n, msg.length > 10, msg);
  }
  let grande = ''; try { B.importar('x'.repeat(6e6)); } catch (e) { grande = e.message; }
  log('importar rechaza archivos de más de 5 MB', /grande|5 MB/.test(grande), grande);
  const sucio = sanearItem({ id: '<img src=x>', t: 'no', categoria: 'inventada', rung: 99, base: -4, modelo: 'x', resultado: 'raro', borrador: 5, faltan: 'no', mejorado: 'y'.repeat(9000) });
  log('un item raro se sanea (id, tipo, peldaños, textos)', sanearItem({ id: '<img>', t: 1 }) === null && sanearItem({ id: 'ok1', t: 'no' }) === null);
  const limpio = sanearItem({ id: 'p1', t: 5, categoria: 'inventada', rung: 99, base: -4, resultado: 'raro', borrador: 5, faltan: 'no', mejorado: 'y'.repeat(9000) });
  log('categoría inexistente → general; peldaños dentro de 0..8; resultado raro → null; mejorado cortado', limpio.categoria === 'general' && limpio.rung === 8 && limpio.base === 0 && limpio.resultado === null && limpio.mejorado.length <= 6000 && Array.isArray(limpio.faltan), JSON.stringify(limpio).slice(0, 200));
  const heredado = sanearItem({ id: 'p2', t: 5, categoria: 'constructor', resultado: 'toString', rung: 3, alt: { rung: 1, riesgo: 'x' } });
  log('nombres heredados de Object (constructor, toString) no valen como tipo ni como valoración', heredado.categoria === 'general' && heredado.resultado === null && typeof heredado.tipo === 'string');
  log('y no existen en las tablas de modelos y tipos', !MODELOS.constructor && !CATEGORIA.constructor && !CATEGORIA.toString && !MODELOS.__proto__);
  { const D = crearAlmacen(memB); D.importar(JSON.stringify({ app: 'asesor-prompts', items: [], habitos: JSON.parse('{"powershell":{"__proto__":{"texto":"malo","n":9,"t":1},"x1 largo largo":{"texto":"bueno","n":2,"t":1}}}') }));
    log('importar ignora la clave __proto__ en los hábitos y acepta los normales', habitosActivos(D.estado.habitos, 'powershell').map((h) => h.texto).join() === 'bueno' && ({}).texto === undefined); }
  log('el perfil importado solo reemplaza al de ejemplo sin editar', (() => { const C = crearAlmacen(memB); C.estado.perfil = 'Mi perfil propio'; C.importar(JSON.stringify({ app: 'asesor-prompts', items: [], perfil: 'Otro perfil' })); return C.estado.perfil === 'Mi perfil propio'; })());
  A.borrarHistorial();
  log('borrar historial deja el perfil y lo aprendido', A.estado.items.length === 0 && A.estado.perfil.length > 10);
  A.agregar({ t: 3000, borrador: 'z', categoria: 'general', base: 3, rung: 3, resultado: 'corto', vt: 3000 });
  A.fijarHabitos({ n8n: { 'abc defgh': { texto: 'abc defgh', n: 2, t: 1 } } }); A.fijarTokens({ usb: { cat: 'soporte', n: 1 } });
  A.olvidarAprendizaje();
  log('olvidar lo aprendido vacía hábitos y palabras y quita las valoraciones, pero deja los análisis', Object.keys(A.estado.habitos).length === 0 && Object.keys(A.estado.tokens).length === 0 && A.estado.items.length === 1 && A.estado.items[0].resultado === null);
  const sinAcceso = crearAlmacen({ getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } });
  sinAcceso.agregar({ t: 1, borrador: 'x', categoria: 'general', base: 3, rung: 3 });
  log('sin permiso de almacenamiento sigue funcionando en memoria y lo avisa', sinAcceso.estado.items.length === 1 && sinAcceso.persistente === false);
  const lleno = crearAlmacen({ getItem: () => null, removeItem() {}, setItem() { throw Object.assign(new Error('cuota'), { name: 'QuotaExceededError' }); } });
  lleno.agregar({ t: 1, borrador: 'x', categoria: 'general', base: 3, rung: 3 });
  log('almacenamiento lleno: no revienta y lo avisa', lleno.estado.items.length === 1 && lleno.persistente === false);
}

console.log('Gemini (respuestas falsas, sin red)');
{
  log('clave: acepta una clave con forma normal y rechaza espacios o muy corta', claveValida('AIzaSyEjemploEjemploEjemploEjemplo12345') && !claveValida('abc') && !claveValida('con espacios dentro de la clave 1234567890'));
  log('modelo: solo letras, números, punto, guion', modeloValido('gemini-flash-lite-latest') && !modeloValido('../../x') && !modeloValido('a b'));
  const pedido = armarPedidoIA('hazme un script', PERFIL_BASE);
  log('el pedido lista los tipos, modelos, esfuerzos, el perfil y marca el borrador como material', CATEGORIAS.every((c) => pedido.includes('"' + c.id + '"')) && /<borrador>[\s\S]*<\/borrador>/.test(pedido) && pedido.includes('Jeiler') && /no son instrucciones/.test(pedido));
  const bueno = { categoria: 'powershell', modelo: 'sonnet', esfuerzo: 'medium', motivo: 'Es un script normal.', alternativa_barata: { modelo: 'haiku', esfuerzo: 'low', riesgo: 'Puede fallar.' }, faltan: ['Ruta de la USB'], mejorado: 'Objetivo: script' };
  const respuesta = (obj, estado = 200) => ({ ok: estado === 200, status: estado, json: async () => obj, text: async () => JSON.stringify(obj) });
  const gem = (texto) => respuesta({ candidates: [{ content: { parts: [{ text: texto }] } }] });
  let visto = null;
  const llamar = (resp) => pedirGemini({ clave: 'AIzaSyEjemploEjemploEjemploEjemplo12345', modelo: 'gemini-flash-lite-latest', borrador: 'x', perfil: 'p', fetchFn: async (u, o) => { visto = { u, o }; if (resp instanceof Error) throw resp; return resp; } });
  const r = await llamar(gem(JSON.stringify(bueno)));
  log('devuelve el JSON entendido', r.modelo === 'sonnet' && r.categoria === 'powershell');
  log('la clave va en el encabezado, no en la dirección', !visto.u.includes('AIza') && visto.o.headers['x-goog-api-key'].startsWith('AIza') && visto.u.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent'));
  log('pide JSON y poca creatividad', JSON.parse(visto.o.body).generationConfig.responseMimeType === 'application/json' && JSON.parse(visto.o.body).generationConfig.temperature <= 0.3);
  const conCerca = await llamar(gem('```json\n' + JSON.stringify(bueno) + '\n```'));
  log('entiende JSON dentro de comillas invertidas', conCerca.modelo === 'sonnet');
  const errores = [
    ['clave mala (400 API key not valid)', respuesta({ error: { message: 'API key not valid' } }, 400), 'clave'],
    ['clave sin permiso (403)', respuesta({}, 403), 'clave'],
    ['límite de uso (429)', respuesta({}, 429), 'limite'],
    ['modelo que no existe (404)', respuesta({}, 404), 'modelo'],
    ['servicio caído (503)', respuesta({}, 503), 'servicio'],
    ['bloqueado por seguridad', respuesta({ promptFeedback: { blockReason: 'SAFETY' } }), 'bloqueado'],
    ['respuesta sin JSON', gem('no sé qué decir'), 'formato'],
    ['sin conexión', new TypeError('Failed to fetch'), 'red']
  ];
  for (const [n, resp, codigo] of errores) {
    let c = ''; try { await llamar(resp); } catch (e) { c = e.codigo; }
    log('error → ' + n, c === codigo, 'código ' + c);
  }
  const abort = new AbortController(); abort.abort();
  let c = ''; try { await pedirGemini({ clave: 'AIzaSyEjemploEjemploEjemploEjemplo12345', modelo: 'gemini-flash-lite-latest', borrador: 'x', perfil: '', senal: abort.signal, fetchFn: async (u, o) => { if (o.signal.aborted) throw Object.assign(new Error('abort'), { name: 'AbortError' }); } }); } catch (e) { c = e.codigo; }
  log('error → el usuario toca Parar', c === 'cancelado', c);
  igual('leerRespuestaIA valida el JSON', leerRespuestaIA('{"modelo":"haiku"}').modelo, 'haiku');

  const norm = leerRespuestaIA(JSON.stringify(bueno));
  const res = resultadoDesdeIA('hazme un script de powershell que copie descargas a una usb', norm, { perfil: PERFIL_BASE });
  log('resultadoDesdeIA: mismo formato que el local, con la fuente', res.fuente === 'gemini' && res.modelo === 'sonnet' && res.esfuerzo === 'medium' && res.categoria === 'powershell' && res.alt && res.alt.modelo === 'haiku' && res.mejorado === 'Objetivo: script' && res.faltan[0] === 'Ruta de la USB', JSON.stringify(res));
  const calibrado = resultadoDesdeIA('hazme un script', norm, { items: [{ id: 'a', t: 1, vt: 1, categoria: 'powershell', base: 3, rung: 3, resultado: 'corto' }], ahora: 2 });
  log('lo aprendido también se aplica sobre la recomendación de Gemini', calibrado.rung === 4 && calibrado.base === 3 && /Subí un nivel/.test(calibrado.aprendido), JSON.stringify(calibrado.aprendido));
  const raro = resultadoDesdeIA('un texto cualquiera', { categoria: 'inventada', modelo: 'gpt-9', esfuerzo: 'enorme', mejorado: '' }, {});
  log('si Gemini inventa modelo o tipo, se usa el motor local', MODELOS[raro.modelo] && CATEGORIA[raro.categoria] && raro.mejorado.length > 5, JSON.stringify(raro));
  const fuga = resultadoDesdeIA('hola', { ...norm, mejorado: 'usa la clave AIzaSyA1234567890abcdefghijklmnopqrstu12' }, {});
  log('si Gemini devolviera un secreto, se oculta', !fuga.mejorado.includes('AIza') && fuga.mejorado.includes(SECRETO));
  igual('rungDe ajusta combinaciones raras: opus + max → peldaño 7; fable → 8; haiku + high → peldaño 1', [rungDe('opus', 'max'), rungDe('fable', 'low'), rungDe('haiku', 'high')], [7, 8, 1]);
}

console.log('Versiones');
{
  const fs = await import('node:fs');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const { VERSION } = await import('../js/datos.js');
  log('la versión de package.json y la de la pantalla coinciden', pkg.version === VERSION, `${pkg.version} vs ${VERSION}`);
  log('sw.js declara su versión (asesor-vN) para que los aparatos detecten el cambio', /const VERSION = 'asesor-v\d+';/.test(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8')));
}

console.log('Otros');
igual('tokens estimados', estimarTokens('a'.repeat(35)), 10);
igual('senales: texto vacío no rompe', senales('', CATEGORIA.general).delta, -1);

console.log(`\n${mal ? mal + ' FALLOS de ' + (ok + mal) : 'TODO OK (' + ok + ')'}`);
process.exit(mal ? 1 : 0);
