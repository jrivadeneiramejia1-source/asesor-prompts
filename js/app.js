// Pantalla del Asesor de prompts. La lógica (motor, aprendizaje, guardado, Gemini) vive en los otros módulos.
// Todo texto que viene de ti o de Gemini entra al DOM con textContent; solo los íconos propios usan innerHTML.

import { MODELOS, ESFUERZOS, ESCALERA, CATEGORIAS, CATEGORIA, RESULTADOS, PERFIL_BASE, VERSION } from './datos.js';
import { analizarLocal, resultadoDesdeIA, estimarTokens, contarPendientes, ocultarSecretos } from './motor.js';
import { ajusteDe, resumenAprendizaje, efectoProximo, registrarEdicion, habitosActivos, olvidarHabito, aprenderCategoria, olvidarPalabra } from './aprendizaje.js';
import { crearAlmacen } from './almacen.js';
import { pedirGemini, ErrorIA, claveValida, revisarClave, modeloValido, MODELO_GEMINI } from './ia.js';
import { ico, llenarIconos } from './iconos.js';

const A = crearAlmacen();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const quieto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ancho = () => window.matchMedia('(min-width: 900px)').matches;
const fechaCorta = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const nfm = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
// El borrador en curso se guarda para recuperarlo al reabrir, pero nunca con claves ni contraseñas.
const guardarSeguro = (t) => A.fijarBorrador(ocultarSecretos(t).texto);
const retrasar = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) e.append(h);
  return e;
}
const iconoEl = (nombre) => { const i = document.createElement('i'); i.innerHTML = ico(nombre); return i; };
const esfuerzoEs = (id) => (ESFUERZOS.find((e) => e.id === id) || { es: id }).es;

/* ---------- avisos ---------- */

function toast(texto, tipo = 'ok', { accion, ms } = {}) {
  const cont = $('#avisos');
  while (cont.children.length >= 3) cont.firstChild.remove();
  let nodo, cierre;
  const quitar = () => {
    clearTimeout(cierre);
    if (!nodo.isConnected) return;
    nodo.classList.add('sale');
    setTimeout(() => nodo.remove(), quieto() ? 0 : 200);
  };
  nodo = el('div', { class: 'aviso t-' + tipo },
    iconoEl(tipo === 'ok' ? 'ok' : tipo === 'error' ? 'error' : 'aviso'),
    el('span', { text: texto }),
    accion ? el('button', { type: 'button', text: accion.texto, onclick: () => { accion.fn(); quitar(); } }) : null);
  const espera = ms || (accion ? 6500 : tipo === 'error' ? 6000 : 3800);
  const armar = () => { cierre = setTimeout(quitar, espera); };
  nodo.addEventListener('mouseenter', () => clearTimeout(cierre));
  nodo.addEventListener('mouseleave', armar);
  cont.append(nodo);
  armar();
}

function dialogo({ titulo, cuerpo = [], botones = [{ texto: 'Entendido', valor: true, primario: true }] }) {
  return new Promise((resolver) => {
    const previo = document.activeElement;
    let valor = null;
    const dlg = el('dialog', { class: 'hoja', 'aria-labelledby': 'dlgT' });
    const cerrar = (v) => { valor = v; dlg.close(); };
    dlg.append(el('div', { class: 'hoja-in' },
      el('h2', { id: 'dlgT', text: titulo }),
      el('div', { class: 'hoja-cuerpo' }, ...cuerpo),
      el('div', { class: 'hoja-botones' }, botones.map((b) => el('button', {
        type: 'button', class: 'btn' + (b.primario ? ' primario' : '') + (b.peligro ? ' peligro' : ''), text: b.texto, onclick: () => cerrar(b.valor)
      })))));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) cerrar(null); });
    dlg.addEventListener('close', () => { dlg.remove(); if (previo && previo.focus) previo.focus(); resolver(valor); });
    document.body.append(dlg);
    dlg.showModal();
  });
}
const confirmar = (titulo, texto, si, peligro = true) => dialogo({
  titulo, cuerpo: [el('p', { text: texto })],
  botones: [{ texto: 'Cancelar', valor: false }, { texto: si, valor: true, primario: !peligro, peligro }]
});

/* ---------- tema ---------- */

const TEMAS = { auto: ['auto', 'automático'], light: ['sol', 'claro'], dark: ['luna', 'oscuro'] };
function aplicarTema(t) {
  if (!TEMAS[t]) t = 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('asesor-prompts.tema', t); } catch { /* queda el automático */ }
  A.fijarAjuste('tema', t);
  const b = $('#btnTema');
  b.replaceChildren(iconoEl(TEMAS[t][0]));
  b.setAttribute('aria-label', 'Tema: ' + TEMAS[t][1] + '. Toca para cambiarlo');
  for (const r of $$('input[name=tema]')) r.checked = r.value === t;
}
const siguienteTema = () => ({ auto: 'light', light: 'dark', dark: 'auto' })[A.estado.ajustes.tema] || 'auto';

/* ---------- navegación ---------- */

const VISTAS = ['asesor', 'historial', 'aprendizaje', 'ajustes'];
const ICONO_VISTA = { asesor: 'analizar', historial: 'historial', aprendizaje: 'cerebro', ajustes: 'ajustes' };
const TITULO_VISTA = { asesor: 'Asesor de prompts', historial: 'Historial · Asesor de prompts', aprendizaje: 'Aprendizaje · Asesor de prompts', ajustes: 'Ajustes · Asesor de prompts' };
let vista = 'asesor';
const vistaDelHash = () => { const m = location.hash.match(/^#\/(\w+)/); return m && VISTAS.includes(m[1]) ? m[1] : 'asesor'; };

function mostrar(v, { enfocar = true } = {}) {
  vista = v;
  for (const n of VISTAS) $('#vista-' + n).hidden = n !== v;
  for (const b of $$('.pestana')) {
    const activa = b.dataset.vista === v;
    if (activa) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    $('.pestana-ico i', b).innerHTML = ico(ICONO_VISTA[b.dataset.vista] + (activa ? 'F' : ''));
  }
  document.title = TITULO_VISTA[v];
  if (v === 'historial') pintaHistorial();
  if (v === 'aprendizaje') { for (const n of $$('.cifra .num')) n.dataset.v = '0'; pintaAprendizaje(); }
  if (v === 'ajustes') pintaAjustes();
  if (v === 'asesor' && !$('#resultado').hidden) ajustarAltura($('#mejorado'));
  window.scrollTo(0, 0);
  if (enfocar) $('#t-' + v).focus({ preventScroll: true });
}
const irA = (v) => { if (location.hash === '#/' + v) mostrar(v); else location.hash = '#/' + v; };

/* ---------- motor y contexto ---------- */

const ctx = () => ({ perfil: A.estado.perfil, items: A.estado.items, habitos: A.estado.habitos, tokens: A.estado.tokens });
const usaGemini = () => A.estado.ajustes.motor === 'gemini' && claveValida(A.clave());

function pintaEtiquetaMotor() {
  const e = $('#etiquetaMotor');
  e.className = 'pill';
  e.replaceChildren();
  if (A.estado.ajustes.motor === 'gemini' && !claveValida(A.clave())) {
    e.classList.add('aviso'); e.append(iconoEl('aviso'), 'Falta la clave de Gemini');
  } else if (usaGemini()) e.append(iconoEl('analizar'), 'Gemini (tu clave)');
  else e.append(iconoEl('escudo'), 'En este aparato');
}

let actual = null;       // id del análisis que se ve en pantalla
let control = null;      // AbortController de Gemini
let ocupado = false;
const itemActual = () => (actual ? A.estado.items.find((i) => i.id === actual) : null);

function estado(texto, tipo = '') {
  const e = $('#estado');
  e.className = 'estado' + (tipo && tipo !== 'carga' ? ' ' + tipo : '');
  e.replaceChildren(...(tipo === 'carga' ? [el('span', { class: 'punto' })] : []), texto || '');
}

function ponerOcupado(si) {
  ocupado = si;
  const b = $('#btnAnalizar');
  b.disabled = si;
  b.setAttribute('aria-busy', String(si));
  $('#btnParar').hidden = !(si && control);
}

async function analizar() {
  if (ocupado) return;
  const crudo = $('#borrador').value.trim();
  if (!crudo) { estado('Escribe primero tu borrador.', 'error'); $('#borrador').focus(); return; }
  if (crudo.length > 20000) { estado('El borrador es muy largo (máximo 20.000 letras). Pega solo la parte que cambia.', 'error'); return; }
  let res;
  let sinGemini = '';
  if (A.estado.ajustes.motor === 'gemini' && !claveValida(A.clave())) sinGemini = 'Falta la clave de Gemini: puse la estimación de este aparato. Pégala en Ajustes.';
  if (usaGemini()) {
    control = new AbortController();
    ponerOcupado(true);
    estado('Consultando a Gemini…', 'carga');
    try {
      const datos = await pedirGemini({ clave: A.clave(), modelo: A.estado.ajustes.modelo, borrador: ocultarSecretos(crudo).texto, perfil: A.estado.perfil, senal: control.signal });
      res = resultadoDesdeIA(crudo, datos, ctx());
    } catch (e) {
      if (e instanceof ErrorIA && e.codigo === 'cancelado') { control = null; ponerOcupado(false); estado('Análisis detenido.'); return; }
      sinGemini = e instanceof ErrorIA ? e.message : 'No se pudo consultar a Gemini. Te doy la estimación de este aparato.';
    }
    control = null;
  }
  if (!res) { ponerOcupado(true); res = analizarLocal(crudo, ctx()); }
  ponerOcupado(false);
  estado('');
  const item = A.agregar({
    t: Date.now(), borrador: ocultarSecretos(crudo).texto.slice(0, 4000), categoria: res.categoria, base: res.base, rung: res.rung,
    alt: res.alt, faltan: res.faltan, mejorado: res.mejorado, motivo: res.motivo, aprendido: res.aprendido, fuente: res.fuente
  });
  actual = item.id;
  pintaResultado(item, { sinGemini });
  if (sinGemini) toast(sinGemini, 'aviso', { ms: 6000 });
  if (!ancho()) $('#resultado').scrollIntoView({ behavior: quieto() ? 'auto' : 'smooth', block: 'start' });
  $('#resultado').focus({ preventScroll: true });
}

/* ---------- resultado ---------- */

function pintaEscalera(rung, base) {
  const e = $('#escalera');
  e.replaceChildren();
  const m = ESCALERA[rung];
  e.setAttribute('aria-label', 'Escalera de costo de menor a mayor: ' + MODELOS[m.modelo].nombre + ' con esfuerzo ' + esfuerzoEs(m.esfuerzo).toLowerCase() + ', peldaño ' + (rung + 1) + ' de ' + ESCALERA.length + (base !== rung ? '. Punto de partida: peldaño ' + (base + 1) : ''));
  ESCALERA.forEach((_, i) => {
    const p = el('div', { class: 'peldano' });
    p.style.setProperty('--i', String(i));
    e.append(p);
  });
  const pasos = $$('.peldano', e);
  const encender = () => pasos.forEach((p, i) => {
    if (i < rung) p.classList.add('lleno');
    if (i === rung) p.classList.add('actual');
    if (i === base && base !== rung) p.classList.add('partida');
  });
  if (quieto()) encender(); else requestAnimationFrame(() => requestAnimationFrame(encender));
}

function pintaResultado(item, { sinGemini = '' } = {}) {
  const m = MODELOS[item.modelo];
  const art = $('#resultado');
  $('#vacio').hidden = true;
  art.hidden = true; void art.offsetWidth; art.hidden = false;
  $('#tRes').textContent = m.nombre;
  $('#resUso').textContent = 'Ideal para ' + m.uso;
  $('#resEsfuerzo').textContent = esfuerzoEs(item.esfuerzo);
  $('#resEsfuerzoId').textContent = item.esfuerzo;
  pintaEscalera(item.rung, item.base);
  $('#resTipo').textContent = item.tipo;
  $('#resComplejidad').textContent = 'Complejidad ' + item.complejidad;
  $('#resCosto').textContent = 'x' + nfm.format(m.costo) + ' · ' + m.usd;
  const f = $('#resFuente');
  f.replaceChildren();
  f.className = 'pill';
  f.hidden = !(item.fuente === 'gemini' || sinGemini);
  if (!f.hidden) {
    if (sinGemini) { f.classList.add('aviso'); f.append(iconoEl('aviso'), 'Sin Gemini: estimación local'); }
    else f.append(iconoEl('analizar'), 'Analizado con Gemini');
  }
  $('#resMotivo').textContent = item.motivo;
  const ap = $('#resAprendido');
  ap.hidden = !item.aprendido;
  $('p', ap).textContent = item.aprendido || '';

  const barata = $('#resBarata');
  const alt = item.alt && item.alt.rung < item.rung ? item.alt : null;
  barata.hidden = !alt;
  if (alt) {
    const a = MODELOS[alt.modelo];
    let txt = 'Si quieres gastar menos: ' + a.nombre + ' con esfuerzo ' + esfuerzoEs(alt.esfuerzo).toLowerCase() + ' (' + alt.esfuerzo + '). ';
    if (alt.modelo !== item.modelo) txt += 'Cuesta x' + nfm.format(a.costo) + ' por token en vez de x' + nfm.format(m.costo) + '. ';
    $('p', barata).textContent = txt + (alt.riesgo ? 'Riesgo: ' + alt.riesgo.replace(/^riesgo:\s*/i, '') : '');
  }

  const fl = $('#faltan');
  fl.replaceChildren(...item.faltan.map((t) => el('li', { text: t })));
  $('#faltanBox').hidden = !item.faltan.length;

  const ta = $('#mejorado');
  ta.value = item.mejorado;
  ajustarAltura(ta);
  pintaPendientes();
  pintaFeedback(item.resultado);
  $('#fbEfecto').textContent = '';
  $('#selTipo').value = item.categoria;
  $('#detTipo').open = false;
  $('#btnCopiar span').textContent = 'Copiar prompt';
}

function ajustarAltura(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(Math.max(ta.scrollHeight + 4, 200), Math.round(window.innerHeight * 0.7)) + 'px';
}

function pintaPendientes() {
  const n = contarPendientes($('#mejorado').value);
  const p = $('#pendientes');
  p.hidden = n === 0;
  p.textContent = n + (n === 1 ? ' dato por completar' : ' datos por completar');
  $('#btnPendiente').hidden = n === 0;
}

function irAlPendiente() {
  const ta = $('#mejorado');
  const i = ta.value.indexOf('[COMPLETAR');
  if (i < 0) return;
  const f = ta.value.indexOf(']', i);
  ta.focus();
  ta.setSelectionRange(i, f < 0 ? ta.value.length : f + 1);
}

function pintaFeedback(valor) {
  for (const b of $$('#fb .fb-btn')) b.setAttribute('aria-pressed', String(b.dataset.r === valor));
}

function valorar(r) {
  const it = itemActual();
  if (!it) { toast('Ese análisis ya no está en el historial, así que no puedo anotar tu respuesta.', 'error'); return; }
  const nuevo = it.resultado === r ? null : r;
  A.cambiar(it.id, nuevo ? { resultado: nuevo, vt: Date.now() } : { resultado: null, vt: null });
  pintaFeedback(nuevo);
  if (nuevo && navigator.vibrate) { try { navigator.vibrate(12); } catch { /* sin vibración */ } }
  const nombre = CATEGORIA[it.categoria].nombre;
  const msg = nuevo ? 'Anotado: «' + RESULTADOS[nuevo] + '». ' + efectoProximo(ajusteDe(it.categoria, A.estado.items), nombre) : 'Quité tu valoración.';
  $('#fbEfecto').textContent = msg;
  toast(msg, 'ok');
}

async function copiar() {
  const ta = $('#mejorado');
  const b = $('#btnCopiar');
  try { await navigator.clipboard.writeText(ta.value); }
  catch {
    ta.focus(); ta.select();
    toast('No pude copiar solo. Quedó seleccionado: cópialo con Ctrl + C (en el teléfono, mantén pulsado y elige Copiar).', 'aviso', { ms: 6000 });
    return;
  }
  b.classList.remove('ok-anim'); void b.offsetWidth; b.classList.add('ok-anim');
  $('i', b).innerHTML = ico('check');
  $('span', b).textContent = '¡Copiado!';
  setTimeout(() => { $('i', b).innerHTML = ico('copiar'); $('span', b).textContent = 'Copiar prompt'; }, 1800);
  const it = itemActual();
  if (it && !it.copiado) {
    A.fijarHabitos(registrarEdicion(A.estado.habitos, it.categoria, it.mejorado, ta.value));
    A.cambiar(it.id, { copiado: true });
  }
  const n = contarPendientes(ta.value);
  if (n) toast('Copiado. Ojo: aún quedan ' + n + (n === 1 ? ' dato' : ' datos') + ' por completar.', 'aviso');
}

async function compartir() {
  try { await navigator.share({ text: $('#mejorado').value }); }
  catch (e) { if (e && e.name !== 'AbortError') toast('No pude abrir el menú de compartir. Usa «Copiar prompt».', 'aviso'); }
}

function usarComoBorrador() {
  const b = $('#borrador');
  b.value = $('#mejorado').value;
  actualizaContador(); guardarSeguro(b.value);
  window.scrollTo({ top: 0, behavior: quieto() ? 'auto' : 'smooth' });
  b.focus({ preventScroll: true });
  estado('Lo puse como borrador. Pulsa Analizar para pulirlo otra vez.');
}

function corregirTipo() {
  const it = itemActual();
  if (!it) return;
  const nueva = $('#selTipo').value;
  if (nueva === it.categoria) { toast('Ya estaba en ese tipo de tarea.', 'aviso'); return; }
  const { tokens, aprendidas } = aprenderCategoria(A.estado.tokens, it.borrador, nueva);
  A.fijarTokens(tokens);
  const res = analizarLocal(it.borrador, ctx(), { categoria: nueva });
  const cambios = { categoria: nueva, tipo: res.tipo, base: res.base, rung: res.rung, alt: res.alt, faltan: res.faltan, mejorado: res.mejorado, motivo: res.motivo, aprendido: res.aprendido, fuente: 'local', resultado: null, vt: null, copiado: false };
  A.cambiar(it.id, cambios);
  pintaResultado(itemActual());
  toast('Listo: ahora es «' + CATEGORIA[nueva].nombre + '».' + (aprendidas.length ? ' Aprendí: ' + aprendidas.join(', ') + '.' : '') + ' Quité la valoración de este análisis porque era de otro tipo.', 'ok', { ms: 6000 });
}

function abrirItem(it) {
  $('#borrador').value = it.borrador || '';
  actualizaContador(); guardarSeguro($('#borrador').value);
  actual = it.id;
  irA('asesor');
  pintaResultado(it);
  if (!ancho()) setTimeout(() => $('#resultado').scrollIntoView({ behavior: quieto() ? 'auto' : 'smooth', block: 'start' }), 60);
}

/* ---------- borrador ---------- */

function actualizaContador() {
  const t = $('#borrador').value;
  $('#contador').textContent = t.trim() ? '≈ ' + estimarTokens(t) + ' tokens' + (t.length > 15000 ? ' · ' + t.length.toLocaleString('es-CO') + ' de 20.000 letras' : '') : '';
  $('#btnLimpiar').hidden = !t;
}

async function pegar() {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) { toast('El portapapeles está vacío.', 'aviso'); return; }
    const b = $('#borrador');
    b.value = t.slice(0, 20000);
    actualizaContador(); guardarSeguro(b.value);
    b.focus();
    toast('Pegado.', 'ok');
  } catch { toast('No pude leer el portapapeles. Mantén pulsado en el cuadro y elige Pegar.', 'aviso'); $('#borrador').focus(); }
}

const EJEMPLOS = [
  ['Script para copiar a una USB', 'hazme un script de powershell que copie descargas a una usb y me diga cuales fallaron'],
  ['Error en un flujo de n8n', 'mi flujo de n8n con webhook de telegram falla en el nodo http request y no se por que'],
  ['Traducir un texto', 'traduce este párrafo al inglés: Mañana entregamos los equipos revisados.'],
  ['Diseñar algo grande', 'necesito una arquitectura para guardar equipos y entregas de varias sedes, desde cero, sin perder datos']
];

/* ---------- historial ---------- */

let filtro = 'todos', busqueda = '', limite = 50;
const FILTROS = [['todos', 'Todos'], ['justo', 'Justo'], ['corto', 'Quedó corto'], ['sobro', 'Sobró'], ['sin', 'Sin valorar']];
const cumple = (i, f) => f === 'todos' || (f === 'sin' ? !i.resultado : i.resultado === f);

function pintaHistorial() {
  const todos = A.estado.items;
  for (const b of $$('#filtros .chip')) {
    const f = b.dataset.f;
    b.setAttribute('aria-pressed', String(filtro === f));
    $('.n', b).textContent = String(todos.filter((i) => cumple(i, f)).length);
  }
  const q = busqueda.trim().toLowerCase();
  const lista = todos.filter((i) => cumple(i, filtro) && (!q || i.borrador.toLowerCase().includes(q) || i.tipo.toLowerCase().includes(q)));
  const ul = $('#lista');
  ul.replaceChildren(...lista.slice(0, limite).map((it, k) => {
    const li = el('li');
    li.style.setProperty('--k', String(Math.min(k, 10)));
    const m = MODELOS[it.modelo];
    li.append(
      el('button', { type: 'button', class: 'item', 'data-r': it.resultado || '', 'data-id': it.id, onclick: () => abrirItem(it) },
        el('span', { class: 'item-t', text: it.borrador.replace(/\s+/g, ' ').trim() || '(vacío)' }),
        el('span', { class: 'item-m' },
          el('span', { text: it.tipo }),
          el('span', { class: 'mono', text: m.nombre + ' · ' + esfuerzoEs(it.esfuerzo) }),
          el('span', { class: 'mono', text: fechaCorta.format(it.t) }),
          el('span', { class: 'r', text: it.resultado ? RESULTADOS[it.resultado] : 'Sin valorar' }))),
      el('button', { type: 'button', class: 'item-borrar', 'aria-label': 'Borrar este análisis: ' + it.borrador.replace(/\s+/g, ' ').trim().slice(0, 40), onclick: () => borrarItem(it.id) }, iconoEl('borrar')));
    return li;
  }));
  $('#btnMas').hidden = lista.length <= limite;
  const vacio = $('#histVacio');
  vacio.hidden = lista.length > 0;
  if (!lista.length) {
    vacio.replaceChildren();
    if (!todos.length) {
      vacio.append(el('span', { class: 'vacio-ico' }, iconoEl('bandeja')), el('h3', { text: 'Todavía no hay nada' }),
        el('p', { class: 'ayuda', text: 'Cada análisis que hagas queda guardado aquí, solo en este aparato.' }),
        el('button', { type: 'button', class: 'btn primario', onclick: () => irA('asesor') }, iconoEl('analizar'), el('span', { text: 'Hacer mi primer análisis' })));
    } else vacio.append(el('span', { class: 'vacio-ico' }, iconoEl('buscar')), el('h3', { text: 'Nada coincide' }), el('p', { class: 'ayuda', text: 'Prueba con otra palabra o quita el filtro.' }));
  }
}

function borrarItem(id) {
  const lis = $$('#lista li');
  const pos = lis.findIndex((li) => $('.item', li).dataset.id === id);
  const quitado = A.quitar(id);
  if (!quitado) return;
  if (actual === id) { actual = null; $('#resultado').hidden = true; $('#vacio').hidden = false; }
  pintaHistorial();
  const sig = $$('#lista .item-borrar')[Math.min(pos, $$('#lista .item-borrar').length - 1)];
  (sig || $('#buscar')).focus();
  toast('Análisis borrado.', 'ok', { accion: { texto: 'Deshacer', fn: () => { A.restaurar(quitado); pintaHistorial(); } } });
}

/* ---------- aprendizaje ---------- */

function contar(e, hasta, sufijo = '') {
  const desde = Number(e.dataset.v || 0);
  e.dataset.v = String(hasta);
  if (quieto() || desde === hasta) { e.textContent = hasta + sufijo; return; }
  const t0 = performance.now(), dur = 650;
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    e.textContent = Math.round(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3))) + sufijo;
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function pintaAprendizaje() {
  const items = A.estado.items;
  const val = items.filter((i) => i.resultado);
  const justos = val.filter((i) => i.resultado === 'justo').length;
  contar($('#c-analisis'), items.length);
  contar($('#c-valorados'), val.length);
  contar($('#c-justos'), val.length ? Math.round((justos / val.length) * 100) : 0, '%');

  const resumen = resumenAprendizaje(items);
  const cal = $('#calibracion');
  cal.replaceChildren();
  if (!resumen.length) cal.append(el('li', { class: 'sin-datos', text: 'Todavía no has valorado ningún análisis. Cuando lo hagas, aquí verás cuánto ajusto cada tipo de tarea.' }));
  for (const r of resumen) {
    const txt = r.ajuste === 0 ? 'Sin ajuste' : (r.ajuste > 0 ? '+' : '−') + Math.abs(r.ajuste) + (Math.abs(r.ajuste) === 1 ? ' nivel' : ' niveles');
    cal.append(el('li', { class: 'cal' },
      el('div', { class: 'cal-top' }, el('b', { text: r.nombre }), el('span', { class: 'pill' + (r.ajuste === 0 ? ' neutra' : ''), text: txt })),
      el('div', { class: 'balanza', role: 'img', 'aria-label': 'Ajuste ' + txt }, [-3, -2, -1, 0, 1, 2, 3].map((n) => el('i', { class: (n === 0 ? 'centro ' : '') + (n === r.ajuste ? 'marca' : '') }))),
      el('div', { class: 'balanza-et', 'aria-hidden': 'true' }, el('span', { text: '← más barato' }), el('span', { text: 'más fuerte →' })),
      el('p', { class: 'mono', text: 'En las últimas ' + r.ultimas + ': quedó corto ' + r.corto + ' · justo ' + r.justo + ' · sobró ' + r.sobro + ' (' + r.n + ' valoradas en total)' })));
  }

  const hab = $('#habitos');
  hab.replaceChildren();
  let hayHab = false;
  for (const c of CATEGORIAS) {
    for (const h of habitosActivos(A.estado.habitos, c.id)) {
      hayHab = true;
      hab.append(el('li', {}, el('span', { text: h.texto }), el('span', { class: 'pill neutra', text: c.nombre }),
        el('button', { type: 'button', class: 'quitar', 'aria-label': 'Olvidar esta línea: ' + h.texto, onclick: () => { A.fijarHabitos(olvidarHabito(A.estado.habitos, c.id, h.clave)); toast('La olvidé. No la incluiré más.', 'ok'); } }, iconoEl('x'))));
    }
  }
  if (!hayHab) hab.append(el('li', { class: 'sin-datos', text: 'Aún no hay ninguna. Si añades la misma línea a mano dos veces, aparece aquí.' }));

  const pal = $('#palabras');
  pal.replaceChildren();
  const toks = Object.entries(A.estado.tokens).sort((a, b) => b[1].n - a[1].n);
  for (const [w, v] of toks) {
    pal.append(el('li', {}, w, el('small', { text: '→ ' + (CATEGORIA[v.cat] ? CATEGORIA[v.cat].nombre : v.cat) }),
      el('button', { type: 'button', class: 'quitar', 'aria-label': 'Olvidar la palabra ' + w, onclick: () => { A.fijarTokens(olvidarPalabra(A.estado.tokens, w)); } }, iconoEl('x'))));
  }
  if (!toks.length) pal.append(el('li', { class: 'sin-datos', text: 'Aún no hay ninguna.' }));
}

/* ---------- ajustes ---------- */

function pintaAjustes() {
  if (document.activeElement !== $('#perfil')) $('#perfil').value = A.estado.perfil;
  const m = A.estado.ajustes.motor;
  for (const r of $$('input[name=motor]')) r.checked = r.value === m;
  $('#panelGemini').hidden = m !== 'gemini';
  if (document.activeElement !== $('#clave')) $('#clave').value = A.clave();
  pintaInfoClave();
  if (document.activeElement !== $('#modeloGemini')) $('#modeloGemini').value = A.estado.ajustes.modelo || MODELO_GEMINI;
  for (const r of $$('input[name=tema]')) r.checked = r.value === A.estado.ajustes.tema;
  $('#estadoAlmacen').textContent = A.persistente ? '' : 'Este navegador no deja guardar datos (modo privado o bloqueado): lo que hagas se perderá al cerrarlo. Exporta un respaldo para no perderlo.';
  $('#estadoAlmacen').className = 'estado' + (A.persistente ? '' : ' error');
  pintaInstalar();
  $('#version').textContent = 'Versión ' + VERSION + ' · todo funciona sin internet';
}

function pintaInfoClave() {
  const e = $('#infoClave'), r = revisarClave($('#clave').value);
  if (!r.largo) { e.textContent = ''; return; }
  const forma = r.forma === 'AQ' ? 'formato nuevo (AQ.)' : r.forma === 'AIza' ? 'formato clásico (AIza)' : '';
  e.textContent = r.ok
    ? r.largo + ' caracteres' + (r.conocida ? ' · ' + forma + ' · se ve bien.' : ' · no empieza como las de Google (AIza o AQ.); «Probar conexión» lo confirma.')
    : 'La clave ' + r.problema;
  e.classList.toggle('error', !r.ok);
}

async function guardarGemini({ silencioso = false } = {}) {
  const r = revisarClave($('#clave').value), modelo = $('#modeloGemini').value.trim() || MODELO_GEMINI;
  const e = $('#estadoGemini');
  e.className = 'estado';
  if (!r.ok) { e.classList.add('error'); e.textContent = 'La clave no parece válida: ' + r.problema; $('#clave').focus(); return false; }
  if (!modeloValido(modelo)) { e.classList.add('error'); e.textContent = 'El nombre del modelo solo puede llevar letras, números, punto y guion. Ejemplo: ' + MODELO_GEMINI; $('#modeloGemini').focus(); return false; }
  A.fijarClave(r.clave);
  A.fijarAjuste('modelo', modelo);
  if (r.cambios.length) $('#clave').value = r.clave;
  pintaInfoClave();
  pintaEtiquetaMotor();
  if (!silencioso) {
    e.classList.add('ok');
    e.textContent = 'Guardado en este aparato.' + (r.cambios.length ? ' Limpié la clave: ' + r.cambios.join('; ') + '.' : '') + (r.conocida ? '' : ' Ojo: no empieza como las de Google (AIza o AQ.). Toca «Probar conexión» para confirmar.');
  }
  return true;
}

async function probarGemini() {
  const b = $('#btnProbar'), e = $('#estadoGemini');
  if (!(await guardarGemini({ silencioso: true }))) return;
  b.setAttribute('aria-busy', 'true'); b.disabled = true;
  e.className = 'estado'; e.replaceChildren(el('span', { class: 'punto' }), 'Probando…');
  try {
    await pedirGemini({ clave: A.clave(), modelo: A.estado.ajustes.modelo, borrador: 'traduce al inglés: hola', perfil: '' });
    e.className = 'estado ok'; e.textContent = 'Funciona: Gemini respondió bien.';
  } catch (err) {
    e.className = 'estado error'; e.textContent = err instanceof ErrorIA ? err.message + (err.codigoGoogle ? ' (Código de Google: ' + err.codigoGoogle + ')' : '') : 'No se pudo probar. Intenta de nuevo.';
  }
  b.removeAttribute('aria-busy'); b.disabled = false;
}

function exportar() {
  const url = URL.createObjectURL(new Blob([A.exportar()], { type: 'application/json' }));
  const a = el('a', { href: url, download: 'asesor-prompts-' + new Date().toISOString().slice(0, 10) + '.json' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  toast('Respaldo exportado. Revísalo en tu carpeta de Descargas.', 'ok');
}

async function importar(archivo) {
  if (!archivo) return;
  try {
    if (archivo.size > 5e6) throw new Error('El archivo es muy grande (más de 5 MB). Exporta de nuevo desde la otra app.');
    const r = A.importar(await archivo.text());
    await dialogo({
      titulo: 'Respaldo importado',
      cuerpo: [el('p', { text: r.nuevos + (r.nuevos === 1 ? ' análisis nuevo' : ' análisis nuevos') + ' y ' + r.actualizados + (r.actualizados === 1 ? ' actualizado' : ' actualizados') + '.' + (r.ignorados ? ' Ignoré ' + r.ignorados + ' que venían dañados.' : '') }),
        el('p', { class: 'ayuda', text: 'Lo que ya tenías sigue aquí. Lo aprendido de los dos aparatos se sumó.' })]
    });
    pintaAjustes();
  } catch (e) { toast(e.message || 'No pude leer ese archivo.', 'error'); }
  $('#archivo').value = '';
}

/* ---------- instalar y actualizar ---------- */

let instalador = null, swReg = null;
const esInstalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function pintaInstalar() {
  const puede = !esInstalada() && !!(instalador || esIOS());
  $('#btnInstalar').hidden = !puede;
  $('#btnInstalar2').hidden = !puede;
  $('#estadoInstalada').textContent = esInstalada()
    ? 'Ya la tienes instalada: abre sin internet y se actualiza sola cuando hay una versión nueva.'
    : 'Instálala para abrirla como una app, desde el icono, también sin internet. En el computador y en el teléfono.';
}

async function instalar() {
  if (instalador) {
    instalador.prompt();
    try { await instalador.userChoice; } catch { /* sin respuesta */ }
    instalador = null;
    pintaInstalar();
  } else ayudaInstalar();
}

function ayudaInstalar() {
  dialogo({
    titulo: 'Instalar el asesor',
    cuerpo: [
      el('p', { text: 'Elige tu aparato:' }),
      el('ol', {},
        el('li', {}, el('b', { text: 'Teléfono Android (Chrome): ' }), 'menú ⋮ → «Instalar app» (Install app) o «Agregar a la pantalla de inicio» (Add to Home screen).'),
        el('li', {}, el('b', { text: 'iPhone o iPad (Safari): ' }), 'toca Compartir → «Agregar a inicio» (Add to Home Screen).'),
        el('li', {}, el('b', { text: 'Computador (Chrome o Edge): ' }), 'ícono de instalar al final de la barra de direcciones, o menú ⋮ → «Instalar Asesor de prompts» (Install).')),
      el('p', { class: 'ayuda', text: 'Para tener lo mismo en los dos: en uno exporta el respaldo (Ajustes → Mis datos) y en el otro impórtalo.' })]
  });
}

function ofrecerActualizar(sw) {
  toast('Hay una versión nueva del asesor.', 'ok', { accion: { texto: 'Actualizar', fn: () => sw.postMessage('saltar') }, ms: 15000 });
}

async function registrarSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    let tuvo = !!navigator.serviceWorker.controller, recargando = false;
    swReg = await navigator.serviceWorker.register('sw.js');
    const vigilar = (sw) => sw.addEventListener('statechange', () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) ofrecerActualizar(sw); });
    if (swReg.waiting && navigator.serviceWorker.controller) ofrecerActualizar(swReg.waiting);
    swReg.addEventListener('updatefound', () => { if (swReg.installing) vigilar(swReg.installing); });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!tuvo) { tuvo = true; return; }
      if (recargando) return;
      recargando = true;
      guardarSeguro($('#borrador').value);
      location.reload();
    });
  } catch { /* la app funciona igual; solo no abrirá sin internet */ }
}

async function buscarActualizacion() {
  if (!swReg) { toast('Este navegador no permite la versión sin internet, pero la app funciona igual.', 'aviso'); return; }
  const b = $('#btnActualizar');
  b.setAttribute('aria-busy', 'true'); b.disabled = true;
  try { await swReg.update(); } catch { toast('No pude buscar: parece que no hay internet.', 'aviso'); b.removeAttribute('aria-busy'); b.disabled = false; return; }
  setTimeout(() => {
    b.removeAttribute('aria-busy'); b.disabled = false;
    if (!swReg.waiting && !swReg.installing) toast('Ya tienes la última versión (' + VERSION + ').', 'ok');
  }, 1500);
}

/* ---------- arranque ---------- */

function leerParametros() {
  const p = new URLSearchParams(location.search);
  const compartido = [p.get('titulo'), p.get('texto') || p.get('text'), p.get('enlace')].filter(Boolean).join('\n');
  if (compartido) {
    $('#borrador').value = compartido.slice(0, 20000);
    guardarSeguro($('#borrador').value);
    toast('Recibí lo que compartiste. Pulsa Analizar.', 'ok');
  }
  if ([...p.keys()].length) history.replaceState(null, '', location.pathname + location.hash);
  return p.get('nuevo') === '1';
}

let ultimaInsignia = null;
function pintaInsignia() {
  const hace30 = Date.now() - 30 * 864e5;
  const n = A.estado.items.filter((i) => !i.resultado && i.t > hace30).length;
  const b = $('#insigniaHist');
  b.hidden = n === 0;
  b.textContent = n > 9 ? '9+' : String(n);
  $('#histSr').textContent = n ? ', ' + n + ' sin valorar' : '';
  if (ultimaInsignia !== null && n > ultimaInsignia && !quieto()) { b.classList.remove('salta'); void b.offsetWidth; b.classList.add('salta'); }
  ultimaInsignia = n;
}

function refrescar() {
  pintaInsignia();
  pintaEtiquetaMotor();
  if (vista === 'historial') pintaHistorial();
  if (vista === 'aprendizaje') pintaAprendizaje();
  if (actual && !itemActual()) { actual = null; $('#resultado').hidden = true; $('#vacio').hidden = false; }
}

function conectar() {
  const b = $('#borrador');
  b.addEventListener('input', () => { actualizaContador(); guardarBorrador(b.value); });
  b.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); analizar(); } });
  $('#btnAnalizar').addEventListener('click', analizar);
  $('#btnParar').addEventListener('click', () => { if (control) control.abort(); });
  $('#btnPegar').addEventListener('click', pegar);
  $('#btnLimpiar').addEventListener('click', () => { b.value = ''; actualizaContador(); guardarSeguro(''); estado(''); b.focus(); });
  if (!navigator.clipboard || !navigator.clipboard.readText) $('#btnPegar').hidden = true;
  if (navigator.share) $('#btnCompartir').hidden = false;

  $('#btnCopiar').addEventListener('click', copiar);
  $('#btnCompartir').addEventListener('click', compartir);
  $('#btnOtra').addEventListener('click', usarComoBorrador);
  $('#btnPendiente').addEventListener('click', irAlPendiente);
  $('#mejorado').addEventListener('input', () => { pintaPendientes(); ajustarAltura($('#mejorado')); });
  for (const x of $$('#fb .fb-btn')) x.addEventListener('click', () => valorar(x.dataset.r));
  $('#btnTipo').addEventListener('click', corregirTipo);

  $('#selTipo').replaceChildren(...CATEGORIAS.map((c) => el('option', { value: c.id, text: c.nombre })));
  $('#ejemplos').replaceChildren(...EJEMPLOS.map(([t, txt]) => el('button', { type: 'button', class: 'chip', text: t, onclick: () => { b.value = txt; actualizaContador(); guardarSeguro(txt); analizar(); } })));
  $('#listaModelos').replaceChildren(...Object.values(MODELOS).map((m) => el('div', { class: 'modelo-fila' },
    el('b', { text: m.nombre }), el('span', { class: 'mono', text: 'x' + nfm.format(m.costo) }), el('span', { text: m.uso }), el('span', { class: 'mono', text: m.usd }))));

  for (const p of $$('.pestana')) p.addEventListener('click', () => irA(p.dataset.vista));
  window.addEventListener('hashchange', () => { if (location.hash === '' || location.hash.startsWith('#/')) mostrar(vistaDelHash()); });
  $('#btnTema').addEventListener('click', () => aplicarTema(siguienteTema()));
  for (const r of $$('input[name=tema]')) r.addEventListener('change', () => aplicarTema(r.value));

  $('#filtros').replaceChildren(...FILTROS.map(([f, t]) => el('button', { type: 'button', class: 'chip', 'data-f': f, 'aria-pressed': 'false', onclick: () => { filtro = f; limite = 50; pintaHistorial(); } }, t, el('span', { class: 'n', text: '0' }))));
  $('#buscar').addEventListener('input', retrasar((e) => { busqueda = e.target.value; limite = 50; pintaHistorial(); }, 150));
  $('#btnMas').addEventListener('click', () => { limite += 50; pintaHistorial(); });

  $('#cifras').replaceChildren(
    el('div', { class: 'cifra' }, el('span', { class: 'rot', text: 'Análisis' }), el('span', { class: 'num', id: 'c-analisis', text: '0' })),
    el('div', { class: 'cifra c-parcial' }, el('span', { class: 'rot', text: 'Valorados' }), el('span', { class: 'num', id: 'c-valorados', text: '0' })),
    el('div', { class: 'cifra c-listo' }, el('span', { class: 'rot', text: 'Justos' }), el('span', { class: 'num', id: 'c-justos', text: '0%' })));

  $('#btnPerfil').addEventListener('click', () => { A.guardarPerfil($('#perfil').value); $('#perfil').value = A.estado.perfil; toast('Perfil guardado.', 'ok'); });
  $('#btnPerfilBase').addEventListener('click', async () => {
    if (await confirmar('¿Volver al perfil de ejemplo?', 'Se reemplaza el texto de tu perfil por el de ejemplo. No se puede deshacer.', 'Volver al de ejemplo')) { A.guardarPerfil(PERFIL_BASE); pintaAjustes(); toast('Perfil de ejemplo restaurado.', 'ok'); }
  });
  for (const r of $$('input[name=motor]')) r.addEventListener('change', () => { A.fijarAjuste('motor', r.value); pintaAjustes(); });
  $('#btnVerClave').addEventListener('click', (e) => {
    const c = $('#clave'), ver = c.type === 'password';
    c.type = ver ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-pressed', String(ver));
    e.currentTarget.setAttribute('aria-label', ver ? 'Ocultar la clave' : 'Mostrar la clave');
    e.currentTarget.replaceChildren(iconoEl(ver ? 'ojoNo' : 'ojo'));
  });
  $('#clave').addEventListener('input', pintaInfoClave);
  $('#btnGuardarClave').addEventListener('click', () => guardarGemini());
  $('#btnProbar').addEventListener('click', probarGemini);
  $('#btnBorrarClave').addEventListener('click', async () => {
    if (!(await confirmar('¿Borrar la clave de Gemini?', 'Se quita de este aparato. Tendrás que pegarla otra vez para usar Gemini.', 'Borrar la clave'))) return;
    A.borrarClave(); A.fijarAjuste('motor', 'local'); pintaAjustes(); toast('Clave borrada. Volví al motor de este aparato.', 'ok');
  });
  $('#btnExportar').addEventListener('click', exportar);
  $('#btnImportar').addEventListener('click', () => $('#archivo').click());
  $('#archivo').addEventListener('change', (e) => importar(e.target.files[0]));
  $('#btnBorrarHist').addEventListener('click', async () => {
    if (!A.estado.items.length) { toast('El historial ya está vacío.', 'aviso'); return; }
    if (await confirmar('¿Borrar todo el historial?', 'Se borran los ' + A.estado.items.length + ' análisis de este aparato, con sus valoraciones. No se puede deshacer. Tip: exporta un respaldo antes.', 'Borrar historial')) { actual = null; $('#resultado').hidden = true; $('#vacio').hidden = false; A.borrarHistorial(); toast('Historial borrado.', 'ok'); }
  });
  $('#btnOlvidar').addEventListener('click', async () => {
    if (await confirmar('¿Olvidar lo aprendido?', 'Se quitan tus valoraciones, las líneas que sueles añadir y las palabras aprendidas. Los análisis del historial se quedan. No se puede deshacer.', 'Olvidar lo aprendido')) { A.olvidarAprendizaje(); toast('Listo: empiezo de cero.', 'ok'); }
  });
  $('#btnInstalar').addEventListener('click', instalar);
  $('#btnInstalar2').addEventListener('click', instalar);
  $('#btnAyudaInstalar').addEventListener('click', ayudaInstalar);
  $('#btnActualizar').addEventListener('click', buscarActualizacion);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalador = e; pintaInstalar(); });
  window.addEventListener('appinstalled', () => { instalador = null; toast('Listo: el asesor quedó instalado.', 'ok'); pintaInstalar(); });
  const red = () => { $('#pillSinRed').hidden = navigator.onLine; };
  window.addEventListener('online', red); window.addEventListener('offline', red); red();
  window.addEventListener('beforeunload', () => guardarSeguro($('#borrador').value));
  window.addEventListener('resize', retrasar(() => { if (vista === 'asesor' && !$('#resultado').hidden) ajustarAltura($('#mejorado')); }, 150));
}

const guardarBorrador = retrasar((t) => guardarSeguro(t), 400);

function iniciar() {
  llenarIconos();
  conectar();
  $('#borrador').value = A.estado.borrador;
  aplicarTema(A.estado.ajustes.tema);
  actualizaContador();
  const nuevo = leerParametros();
  A.suscribir(refrescar);
  mostrar(vistaDelHash(), { enfocar: false });
  pintaInsignia();
  pintaEtiquetaMotor();
  pintaInstalar();
  if (!A.persistente) toast('Este navegador no deja guardar datos: lo que hagas se perderá al cerrarlo.', 'aviso', { ms: 7000 });
  if (nuevo) $('#borrador').focus();
  registrarSW();
}
iniciar();
