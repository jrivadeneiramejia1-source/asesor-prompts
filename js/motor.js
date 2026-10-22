// Motor local: clasifica el borrador, elige un peldaño de la escalera, aplica lo aprendido y arma el prompt mejorado.
// Todo ocurre en el aparato, sin internet. Funciones puras: se prueban en Node sin navegador.

import { MODELOS, ESFUERZOS, ESCALERA, TOPE_AUTOMATICO, CATEGORIAS, CATEGORIA } from './datos.js';
import { ajusteDe, describirAjuste, habitosActivos } from './aprendizaje.js';

export const normaliza = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const estimarTokens = (t) => Math.ceil(String(t || '').length / 3.5);
export const recorta = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- secretos: nunca salen del aparato ni se guardan ---------- */

export const SECRETO = '[DATO SECRETO OCULTO]';
const PATRONES_SECRETO = [
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
];
const ASIGNACION = /(contrase[ñn]a|clave|password|passwd|token|secret|api[_ -]?key)\s*(?:es|=|:)\s*["']?([^\s"']{6,})/gi;

export function ocultarSecretos(texto) {
  let n = 0, t = String(texto ?? '');
  for (const re of PATRONES_SECRETO) t = t.replace(re, () => { n++; return SECRETO; });
  t = t.replace(ASIGNACION, (m, _k, v) => {
    if (v === SECRETO || !(/[\d!@#$%^&*_-]/.test(v) || v.length >= 10)) return m;
    n++; return m.slice(0, m.length - v.length) + SECRETO;
  });
  return { texto: t, n };
}

/* ---------- clasificar ---------- */

export function clasificar(texto, tokens = {}) {
  const t = normaliza(texto).trim();
  const puntos = {}, pistas = {};
  for (const c of CATEGORIAS) {
    for (const [re, w] of c.claves) {
      const m = t.match(re);
      if (m) { puntos[c.id] = (puntos[c.id] || 0) + w; (pistas[c.id] ||= []).push(m[0].trim().slice(0, 22)); }
    }
  }
  for (const [palabra, v] of Object.entries(tokens || {})) {
    if (!CATEGORIA[v.cat]) continue;
    if (new RegExp('(^|[^a-z0-9])' + escapa(palabra) + '($|[^a-z0-9])').test(t)) {
      // Una palabra aprendida una sola vez vale 1 (sola no cambia el tipo); confirmada dos veces o más, vale 2.
      puntos[v.cat] = (puntos[v.cat] || 0) + Math.min(v.n || 1, 2);
      (pistas[v.cat] ||= []).push(palabra + ' (aprendida)');
    }
  }
  let mejor = 'general', max = 0;
  for (const c of CATEGORIAS) if ((puntos[c.id] || 0) > max) { max = puntos[c.id]; mejor = c.id; }
  if (max < 2) mejor = 'general';
  const secundarias = CATEGORIAS.filter((c) => c.id !== mejor && (puntos[c.id] || 0) >= 3 && c.faltan.length).map((c) => c.id);
  return { categoria: mejor, puntos, pistas: pistas[mejor] || [], secundarias: ['rapida', 'traduccion'].includes(mejor) ? [] : secundarias };
}

/* ---------- señales de dificultad ---------- */

export function senales(texto, cat) {
  const t = normaliza(texto), lista = [];
  let delta = 0;
  const suma = (n, motivo) => { delta += n; lista.push(motivo); };
  const largo = texto.length;
  if (largo > 3500) suma(2, 'borrador muy largo'); else if (largo > 1200) suma(1, 'borrador largo');
  if ((texto.match(/^\s*(\d+[.)]|[-*•])\s+/gm) || []).length >= 4) suma(1, 'varios pasos');
  else if ((t.match(/\b(y luego|despues|ademas|tambien|por ultimo|finalmente)\b/g) || []).length >= 3) suma(1, 'tareas encadenadas');
  if (/varios archivos|todo el (repo|proyecto)|desde cero|de punta a punta|end.?to.?end|\bcompleto\b|\bcompleta\b/.test(t)) suma(1, 'alcance grande');
  if (/otra vez|sigue fallando|ya probe|ya intente|sin exito|no hay forma|llevo (horas|dias)/.test(t)) suma(1, 'ya falló antes');
  if (/produccion|cliente real|no puedo perder|datos importantes|irreversible|\bborrar\b|formatear/.test(t)) suma(1, 'un error sale caro');
  delta = Math.min(delta, 3);
  if (!delta && largo < 60 && cat.base >= 3) { delta = -1; lista.push('texto muy corto'); }
  return { delta, lista };
}

export function rungDe(modelo, esfuerzo) {
  const exacto = ESCALERA.findIndex((p) => p.modelo === modelo && p.esfuerzo === esfuerzo);
  if (exacto >= 0) return exacto;
  const orden = ESFUERZOS.map((e) => e.id), ie = orden.indexOf(esfuerzo);
  const candidatos = ESCALERA.map((p, i) => ({ p, i })).filter((x) => x.p.modelo === modelo);
  if (!candidatos.length) return 3;
  return candidatos.sort((a, b) => Math.abs(orden.indexOf(a.p.esfuerzo) - ie) - Math.abs(orden.indexOf(b.p.esfuerzo) - ie))[0].i;
}

const complejidadDe = (rung) => (rung <= 1 ? 'baja' : rung <= 4 ? 'media' : 'alta');
const nombreEsfuerzo = (id) => (ESFUERZOS.find((e) => e.id === id) || { es: id }).es.toLowerCase();

/* ---------- prompt mejorado ---------- */

export function dividirPerfil(perfil) {
  const frases = (String(perfil || '').match(/[^.!?\n]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
  const contexto = [], reglas = [];
  for (const f of frases) (/\b(quiero|avisame|nunca|siempre|no me|debe|deben|evita|prefiero|sin)\b/.test(normaliza(f)) ? reglas : contexto).push(f);
  return { contexto, reglas };
}

export function construirMejorado({ texto, cat, complejidad, faltan, perfil, habitos }) {
  const limpio = texto.trim();
  const hab = habitosActivos(habitos, cat.id).map((h) => h.texto);
  if (complejidad === 'baja' && limpio.length < 280) {
    return [limpio, ['Responde en español, breve y directo.', ...hab].join('\n')].join('\n\n');
  }
  const bloques = limpio.split(/\n\s*\n/);
  let objetivo = bloques[0], detalles = bloques.slice(1).join('\n\n');
  if (!detalles && objetivo.length > 400) {
    const m = objetivo.match(/^[\s\S]{40,300}?[.!?](?=\s)/);
    if (m) { detalles = objetivo.slice(m[0].length).trim(); objetivo = m[0].trim(); }
  }
  const { contexto, reglas } = dividirPerfil(perfil);
  const lineasContexto = [
    ...contexto.filter((f, i) => i === 0 || cat.perfilClaves.test(normaliza(f))).map((f) => '- ' + f),
    ...faltan.map((f) => '- [COMPLETAR: ' + f + ']')
  ];
  const lineasReglas = [...reglas.map((f) => '- ' + f), ...hab.map((h) => '- ' + h)];
  const partes = ['Objetivo:\n' + objetivo];
  if (detalles) partes.push('Detalles:\n' + detalles);
  if (lineasContexto.length) partes.push('Contexto:\n' + lineasContexto.join('\n'));
  if (lineasReglas.length) partes.push('Restricciones:\n' + lineasReglas.join('\n'));
  partes.push('Formato de respuesta:\n' + cat.formato);
  if (cat.comprobar) partes.push('Cómo comprobar que quedó bien:\n' + cat.comprobar);
  return partes.join('\n\n');
}

export const contarPendientes = (t) => (String(t || '').match(/\[COMPLETAR/g) || []).length;

/* ---------- resultado ---------- */

function faltantes(cat, texto, perfil, secundarias) {
  const t = normaliza(texto), p = normaliza(perfil), lista = [];
  const revisar = (c) => {
    for (const f of c.faltan) if (!f.tiene.test(t) && !(f.perfil && f.perfil.test(p)) && !lista.includes(f.texto)) lista.push(f.texto);
  };
  // Lo que delatan las otras señales (p. ej. "da error" dentro de un script) va primero: es lo más urgente de pedir.
  for (const s of secundarias) revisar(CATEGORIA[s]);
  revisar(cat);
  return lista.slice(0, 4);
}

function alternativa(rung, cat) {
  if (rung <= 0) return null;
  const r = rung >= 5 ? rung - 2 : rung - 1;
  return { rung: r, ...ESCALERA[r], riesgo: cat.riesgo };
}

function motivoLocal({ cat, pistas, sen, base }) {
  const p = ESCALERA[base], m = MODELOS[p.modelo];
  const partes = ['Parece «' + cat.nombre + '»' + (pistas.length ? ' (por: ' + pistas.slice(0, 3).join(', ') + ')' : '') + '.'];
  let punto = 'Punto de partida: ' + m.nombre + ' con esfuerzo ' + nombreEsfuerzo(p.esfuerzo);
  if (sen.delta > 0) punto += '; subí el nivel por: ' + sen.lista.join(', ');
  else if (sen.delta < 0) punto += '; bajé el nivel porque el texto es muy corto';
  partes.push(punto + '.');
  return partes.join(' ');
}

// Arma el resultado final. "ia" trae lo que decidió Gemini (motivo, alt, faltan, mejorado); sin "ia" todo sale de reglas locales.
export function armarResultado({ texto, secretos = 0, categoria, base, sen = { delta: 0, lista: [] }, pistas = [], secundarias = [], ctx = {}, fuente = 'local', ia = null }) {
  const cat = CATEGORIA[categoria] || CATEGORIA.general;
  const info = ajusteDe(cat.id, ctx.items || [], ctx.ahora);
  const tope = base >= ESCALERA.length - 1 ? ESCALERA.length - 1 : TOPE_AUTOMATICO;
  const rung = clamp(base + info.ajuste, 0, tope);
  const { modelo, esfuerzo } = ESCALERA[rung];
  const complejidad = complejidadDe(rung);
  const perfil = ctx.perfil || '';
  let faltan = ia && ia.faltan && ia.faltan.length ? ia.faltan : faltantes(cat, texto, perfil, secundarias);
  const alt = ia && ia.alt && ia.alt.rung < rung ? ia.alt : alternativa(rung, cat);
  const pedirCompletar = faltan.slice(0, 4);
  if (secretos) faltan = ['Quité ' + (secretos === 1 ? 'un dato secreto' : secretos + ' datos secretos') + ' del texto. Dalos por otro medio: nunca dentro de un prompt.', ...faltan].slice(0, 5);
  const mejorado = ia && ia.mejorado ? ia.mejorado : construirMejorado({ texto, cat, complejidad, faltan: pedirCompletar, perfil, habitos: ctx.habitos });
  const motivo = ia && ia.motivo ? ia.motivo : motivoLocal({ cat, pistas, sen, base });
  const aprendido = rung !== base && info.ajuste ? describirAjuste(info, cat.nombre) : '';
  return {
    categoria: cat.id, tipo: cat.nombre, complejidad, rung, base, modelo, esfuerzo, motivo, aprendido, alt,
    faltan, mejorado, secretos, fuente, ajuste: rung - base, nValoraciones: info.n
  };
}

export function analizarLocal(textoOriginal, ctx = {}, { categoria: forzada } = {}) {
  const { texto, n: secretos } = ocultarSecretos(textoOriginal);
  const cl = clasificar(texto, ctx.tokens);
  const categoria = forzada && CATEGORIA[forzada] ? forzada : cl.categoria;
  const cat = CATEGORIA[categoria];
  const sen = senales(texto, cat);
  const base = clamp(cat.base + sen.delta, 0, TOPE_AUTOMATICO);
  const secundarias = forzada ? [] : cl.secundarias;
  return armarResultado({ texto, secretos, categoria, base, sen, pistas: forzada ? [] : cl.pistas, secundarias, ctx });
}

// Convierte lo que devuelve Gemini (ya validado en ia.js) en el mismo resultado que el motor local.
export function resultadoDesdeIA(textoOriginal, r, ctx = {}) {
  const { texto, n: secretos } = ocultarSecretos(textoOriginal);
  const local = clasificar(texto, ctx.tokens);
  const categoria = CATEGORIA[r.categoria] ? r.categoria : local.categoria;
  const cat = CATEGORIA[categoria];
  const base = MODELOS[r.modelo] ? rungDe(r.modelo, r.esfuerzo) : clamp(cat.base + senales(texto, cat).delta, 0, TOPE_AUTOMATICO);
  let alt = null;
  if (r.alt && MODELOS[r.alt.modelo]) {
    const ra = rungDe(r.alt.modelo, r.alt.esfuerzo);
    alt = { rung: ra, ...ESCALERA[ra], riesgo: r.alt.riesgo || cat.riesgo };
  }
  const mejorado = r.mejorado ? ocultarSecretos(r.mejorado).texto : '';
  return armarResultado({
    texto, secretos, categoria, base, ctx, fuente: 'gemini',
    ia: { motivo: r.motivo, alt, faltan: r.faltan, mejorado }
  });
}
