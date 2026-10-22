// Aprendizaje en el aparato, sin IA: se calcula a partir del historial que tú mismo valoras.
//  1. Calibración: por tipo de tarea, qué tanto subir o bajar el peldaño de la escalera de modelos.
//  2. Hábitos: líneas que repites al editar el prompt mejorado (a la segunda vez se incluyen solas).
//  3. Palabras: lo que corriges del tipo de tarea se asocia a las palabras de ese borrador.

import { RESULTADOS, CATEGORIA } from './datos.js';

export const DIAS_MAX = 180;
const PESOS = [4, 2, 1];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const normaliza = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const paso = { corto: 1, sobro: -1, justo: 0 };

const valoraciones = (items, categoria, ahora) => items
  .filter((i) => i && i.categoria === categoria && RESULTADOS[i.resultado] && Number.isInteger(i.base) && Number.isInteger(i.rung) && ahora - (i.vt || i.t || 0) < DIAS_MAX * 864e5)
  .sort((a, b) => (b.vt || b.t) - (a.vt || a.t));

// Cada valoración dice dónde debió estar el peldaño: lo usado más (corto), menos (sobró) o igual (justo), frente al peldaño de partida.
// Las 3 últimas pesan 4, 2 y 1: la más reciente manda, pero una sola rara no cambia todo.
export function ajusteDe(categoria, items, ahora = Date.now()) {
  const todas = valoraciones(items || [], categoria, ahora);
  const ultimas = todas.slice(0, 3);
  if (!ultimas.length) return { ajuste: 0, n: 0, corto: 0, justo: 0, sobro: 0, ultimas: 0 };
  let suma = 0, peso = 0;
  ultimas.forEach((e, k) => { suma += PESOS[k] * (e.rung - e.base + paso[e.resultado]); peso += PESOS[k]; });
  const media = suma / peso;
  const cuenta = (r) => ultimas.filter((e) => e.resultado === r).length;
  return {
    ajuste: clamp(Math.sign(media) * Math.round(Math.abs(media)), -3, 3),
    n: todas.length, ultimas: ultimas.length, corto: cuenta('corto'), justo: cuenta('justo'), sobro: cuenta('sobro')
  };
}

export function resumenAprendizaje(items, ahora = Date.now()) {
  const ids = [...new Set((items || []).filter((i) => i && RESULTADOS[i.resultado]).map((i) => i.categoria))];
  return ids.filter((id) => CATEGORIA[id]).map((id) => ({ categoria: id, nombre: CATEGORIA[id].nombre, ...ajusteDe(id, items, ahora) }))
    .filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
}

export function describirAjuste(info, nombre) {
  if (!info || !info.ajuste) return '';
  const n = Math.abs(info.ajuste), niv = n === 1 ? 'un nivel' : n + ' niveles';
  const motivo = info.ajuste > 0
    ? (info.corto === 1 ? 'una quedó corta' : info.corto + ' quedaron cortas')
    : (info.sobro === 1 ? 'una sobró' : info.sobro + ' sobraron');
  return (info.ajuste > 0 ? 'Subí ' : 'Bajé ') + niv + ' por tus valoraciones de «' + nombre + '»: de las últimas ' + info.ultimas + ', ' + motivo + '.';
}

// Qué pasará la próxima vez, para decírtelo al valorar.
export function efectoProximo(info, nombre) {
  if (!info || !info.ajuste) return 'Para «' + nombre + '» sigo con la recomendación normal.';
  const n = Math.abs(info.ajuste);
  return 'Para «' + nombre + '» ' + (info.ajuste > 0 ? 'subo ' : 'bajo ') + (n === 1 ? 'un nivel' : n + ' niveles') + ' la próxima vez.';
}

/* ---------- hábitos: líneas que añades a mano al prompt mejorado ---------- */

const MAX_HABITOS = 40;
const normLinea = (l) => normaliza(l).replace(/^[\s\-*•\d.)]+/, '').replace(/\s+/g, ' ').replace(/[\s.;:,!]+$/, '').trim();
const limpiaLinea = (l) => String(l).replace(/^[\s\-*•]+/, '').trim();
const ENCABEZADO = /^(objetivo|detalles|contexto|restricciones|formato de respuesta|como comprobar que quedo bien):?$/;
const candidata = (k) => k.length >= 8 && k.length <= 200 && !k.includes('[completar') && !ENCABEZADO.test(k);

export function registrarEdicion(habitos, categoria, generado, final, ahora = Date.now()) {
  const salida = JSON.parse(JSON.stringify(habitos || {}));
  const tabla = (salida[categoria] ||= {});
  const gen = new Set(String(generado).split('\n').map(normLinea).filter(Boolean));
  const fin = new Map();
  for (const l of String(final).split('\n')) { const k = normLinea(l); if (k) fin.set(k, limpiaLinea(l)); }
  for (const [k, texto] of fin) {
    if (gen.has(k) || !candidata(k)) continue;
    const h = (tabla[k] ||= { texto: texto.slice(0, 200), n: 0, t: ahora });
    h.n += 1; h.t = ahora;
  }
  for (const [k, h] of Object.entries(tabla)) {
    if (h.n >= 2 && gen.has(k) && !fin.has(k)) { h.n = Math.max(0, h.n - 1); h.t = ahora; }
  }
  const claves = Object.keys(tabla);
  if (claves.length > MAX_HABITOS) {
    claves.sort((a, b) => (tabla[b].n - tabla[a].n) || (tabla[b].t - tabla[a].t)).slice(MAX_HABITOS).forEach((k) => delete tabla[k]);
  }
  for (const k of Object.keys(tabla)) if (tabla[k].n <= 0) delete tabla[k];
  if (!Object.keys(tabla).length) delete salida[categoria];
  return salida;
}

export const habitosActivos = (habitos, categoria) =>
  Object.entries((habitos && habitos[categoria]) || {}).filter(([, h]) => h.n >= 2).map(([k, h]) => ({ clave: k, texto: h.texto, n: h.n }));

export function olvidarHabito(habitos, categoria, clave) {
  const salida = JSON.parse(JSON.stringify(habitos || {}));
  if (salida[categoria]) { delete salida[categoria][clave]; if (!Object.keys(salida[categoria]).length) delete salida[categoria]; }
  return salida;
}

/* ---------- palabras: corregir el tipo de tarea enseña qué palabras lo delatan ---------- */

const PARADAS = new Set(('para como esto esta este estos estas pero porque cuando donde quiero necesito puedes puedo hacer hazme dame dime ' +
  'tengo tiene tienen sobre entre desde hasta cada todo toda todos todas algo nada mucho mucha muchos muy mas menos otra otro otras otros ' +
  'solo tambien aqui alli ahora luego despues antes siempre nunca favor ayuda ayudame quisiera necesitas podria podrias debe deben ' +
  'esto eso aquel unos unas una uno con sin del las los que por the and for with revisar revisa verifica verificar favor').split(' '));

export function palabrasClave(texto, max = 3) {
  const cuenta = new Map();
  for (const w of normaliza(texto).match(/[a-z][a-z0-9_.-]{3,}/g) || []) {
    const p = w.replace(/[.-]+$/, '');
    if (p.length < 4 || PARADAS.has(p)) continue;
    cuenta.set(p, (cuenta.get(p) || 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length) || (a[0] < b[0] ? -1 : 1)).slice(0, max).map(([w]) => w);
}

export function aprenderCategoria(tokens, texto, categoria) {
  const salida = { ...(tokens || {}) };
  const aprendidas = [];
  for (const w of palabrasClave(texto)) {
    const previo = salida[w];
    salida[w] = { cat: categoria, n: previo && previo.cat === categoria ? previo.n + 1 : 1 };
    aprendidas.push(w);
  }
  const claves = Object.keys(salida);
  if (claves.length > 120) claves.sort((a, b) => salida[a].n - salida[b].n).slice(0, claves.length - 120).forEach((k) => delete salida[k]);
  return { tokens: salida, aprendidas };
}

export function olvidarPalabra(tokens, palabra) {
  const salida = { ...(tokens || {}) };
  delete salida[palabra];
  return salida;
}
