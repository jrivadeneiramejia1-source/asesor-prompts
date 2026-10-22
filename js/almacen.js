// Guardado en este aparato (localStorage). Si el navegador no deja guardar, sigue en memoria y lo avisa.
// La clave de Gemini va aparte y nunca entra en el archivo que se exporta.

import { VERSION, ESCALERA, CATEGORIA, PERFIL_BASE, RESULTADOS } from './datos.js';

const LLAVE = 'asesor-prompts.v1';
const LLAVE_CLAVE = 'asesor-prompts.clave';
const MAX_ITEMS = 500;
const MAX_IMPORT = 5e6;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? v : null);

const complejidadDe = (rung) => (rung <= 1 ? 'baja' : rung <= 4 ? 'media' : 'alta');

export function sanearItem(x) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(x.id) || num(x.t) === null) return null;
  const rung = Number.isInteger(x.rung) ? clamp(x.rung, 0, ESCALERA.length - 1) : 3;
  const base = Number.isInteger(x.base) ? clamp(x.base, 0, ESCALERA.length - 1) : rung;
  const categoria = CATEGORIA[x.categoria] ? x.categoria : 'general';
  let alt = null;
  if (x.alt && typeof x.alt === 'object' && Number.isInteger(x.alt.rung) && x.alt.rung >= 0 && x.alt.rung < ESCALERA.length) {
    alt = { rung: x.alt.rung, ...ESCALERA[x.alt.rung], riesgo: texto(x.alt.riesgo, 300) };
  }
  const item = {
    id: x.id, t: x.t, mod: num(x.mod) ?? x.t,
    borrador: texto(x.borrador, 4000), categoria, tipo: CATEGORIA[categoria].nombre, complejidad: complejidadDe(rung),
    rung, base, modelo: ESCALERA[rung].modelo, esfuerzo: ESCALERA[rung].esfuerzo,
    motivo: texto(x.motivo, 800), aprendido: texto(x.aprendido, 400), alt,
    faltan: Array.isArray(x.faltan) ? x.faltan.filter((f) => typeof f === 'string').slice(0, 5).map((f) => f.slice(0, 200)) : [],
    mejorado: texto(x.mejorado, 6000), fuente: x.fuente === 'gemini' ? 'gemini' : 'local',
    resultado: RESULTADOS[x.resultado] ? x.resultado : null
  };
  if (num(x.vt) !== null) item.vt = x.vt;
  if (x.copiado === true) item.copiado = true;
  return item;
}

const vacio = () => ({
  v: 1, items: [], perfil: PERFIL_BASE, habitos: {}, tokens: {},
  ajustes: { tema: 'auto', motor: 'local', modelo: 'gemini-flash-lite-latest' }, borrador: ''
});

function almacenamientoDelNavegador() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function crearAlmacen(storage = almacenamientoDelNavegador()) {
  let persistente = !!storage;
  const oyentes = new Set();
  let enMemoriaClave = '';

  const probar = () => {
    if (!storage) return false;
    try { storage.setItem(LLAVE + '.probe', '1'); storage.removeItem(LLAVE + '.probe'); return true; } catch { return false; }
  };
  persistente = probar();

  const estado = vacio();
  if (persistente) {
    try {
      const o = JSON.parse(storage.getItem(LLAVE) || 'null');
      if (o && typeof o === 'object') {
        estado.items = (Array.isArray(o.items) ? o.items : []).map(sanearItem).filter(Boolean);
        if (typeof o.perfil === 'string' && o.perfil.trim()) estado.perfil = o.perfil.slice(0, 4000);
        if (o.habitos && typeof o.habitos === 'object') estado.habitos = o.habitos;
        if (o.tokens && typeof o.tokens === 'object') estado.tokens = o.tokens;
        if (o.ajustes && typeof o.ajustes === 'object') estado.ajustes = { ...estado.ajustes, ...o.ajustes };
        if (typeof o.borrador === 'string') estado.borrador = o.borrador.slice(0, 20000);
      }
    } catch { /* arranca vacío */ }
  }

  const volcar = () => JSON.stringify({ v: 1, items: estado.items, perfil: estado.perfil, habitos: estado.habitos, tokens: estado.tokens, ajustes: estado.ajustes, borrador: estado.borrador });
  function guardar() {
    if (persistente) {
      try { storage.setItem(LLAVE, volcar()); }
      catch {
        try {
          estado.items = estado.items.slice(0, Math.max(0, estado.items.length - 50));
          storage.setItem(LLAVE, volcar());
        } catch { persistente = false; }
      }
    }
    for (const cb of oyentes) cb();
  }

  const api = {
    estado,
    get persistente() { return persistente; },
    suscribir(cb) { oyentes.add(cb); return () => oyentes.delete(cb); },

    agregar(datos) {
      const t = datos.t || Date.now();
      const id = 'p' + t.toString(36) + Math.random().toString(36).slice(2, 5);
      const item = sanearItem({ ...datos, id, t, mod: t });
      estado.items = [item, ...estado.items].slice(0, MAX_ITEMS);
      guardar();
      return item;
    },
    cambiar(id, campos) {
      const i = estado.items.find((x) => x.id === id);
      if (!i) return null;
      Object.assign(i, campos, { mod: Date.now() });
      guardar();
      return i;
    },
    quitar(id) {
      const i = estado.items.find((x) => x.id === id);
      if (!i) return null;
      estado.items = estado.items.filter((x) => x.id !== id);
      guardar();
      return i;
    },
    restaurar(item) {
      if (!item || estado.items.some((x) => x.id === item.id)) return;
      estado.items = [...estado.items, item].sort((a, b) => b.t - a.t).slice(0, MAX_ITEMS);
      guardar();
    },
    borrarHistorial() { estado.items = []; guardar(); },
    olvidarAprendizaje() {
      estado.habitos = {}; estado.tokens = {};
      for (const i of estado.items) { i.resultado = null; delete i.vt; }
      guardar();
    },
    guardarPerfil(t) { estado.perfil = (String(t).trim() || PERFIL_BASE).slice(0, 4000); guardar(); },
    fijarHabitos(h) { estado.habitos = h; guardar(); },
    fijarTokens(t) { estado.tokens = t; guardar(); },
    fijarAjuste(k, v) { estado.ajustes = { ...estado.ajustes, [k]: v }; guardar(); },
    fijarBorrador(t) { estado.borrador = String(t).slice(0, 20000); guardar(); },

    clave() {
      if (!persistente) return enMemoriaClave;
      try { return storage.getItem(LLAVE_CLAVE) || ''; } catch { return enMemoriaClave; }
    },
    fijarClave(c) {
      enMemoriaClave = c;
      if (persistente) { try { storage.setItem(LLAVE_CLAVE, c); } catch { /* queda en memoria */ } }
    },
    borrarClave() {
      enMemoriaClave = '';
      if (persistente) { try { storage.removeItem(LLAVE_CLAVE); } catch { /* nada */ } }
    },

    exportar() {
      return JSON.stringify({
        app: 'asesor-prompts', formato: 1, version: VERSION, exportadoEn: new Date().toISOString(),
        items: estado.items, perfil: estado.perfil, habitos: estado.habitos, tokens: estado.tokens
      }, null, 1);
    },
    importar(cadena) {
      if (typeof cadena !== 'string' || cadena.length > MAX_IMPORT) throw new Error('El archivo es muy grande (más de 5 MB). Exporta de nuevo desde la otra app.');
      let o;
      try { o = JSON.parse(cadena); } catch { throw new Error('Ese archivo no es un respaldo del asesor: no se pudo leer. Escoge el .json que exportaste.'); }
      if (!o || o.app !== 'asesor-prompts') throw new Error('Ese archivo no es un respaldo del asesor de prompts. Escoge el .json que exportaste desde esta app.');
      if (!Array.isArray(o.items)) throw new Error('El respaldo está incompleto (no trae la lista de análisis). Exporta de nuevo.');
      let nuevos = 0, actualizados = 0, ignorados = 0;
      const porId = new Map(estado.items.map((i) => [i.id, i]));
      for (const crudo of o.items) {
        const it = sanearItem(crudo);
        if (!it) { ignorados++; continue; }
        const actual = porId.get(it.id);
        if (!actual) { porId.set(it.id, it); nuevos++; }
        else if (it.mod > actual.mod) { porId.set(it.id, it); actualizados++; }
      }
      estado.items = [...porId.values()].sort((a, b) => b.t - a.t).slice(0, MAX_ITEMS);
      if (o.habitos && typeof o.habitos === 'object') {
        for (const [cat, tabla] of Object.entries(o.habitos)) {
          if (!CATEGORIA[cat] || !tabla || typeof tabla !== 'object') continue;
          const mia = (estado.habitos[cat] ||= {});
          for (const [k, h] of Object.entries(tabla)) {
            if (k === '__proto__' || !h || typeof h.texto !== 'string' || !Number.isFinite(h.n)) continue;
            const m = mia[k];
            mia[k] = { texto: h.texto.slice(0, 200), n: Math.max(m ? m.n : 0, h.n), t: Math.max(m ? m.t : 0, Number.isFinite(h.t) ? h.t : 0) };
          }
        }
      }
      if (o.tokens && typeof o.tokens === 'object') {
        for (const [w, v] of Object.entries(o.tokens)) {
          if (!v || !CATEGORIA[v.cat] || !Number.isFinite(v.n) || !/^[a-z0-9][a-z0-9_.-]{2,40}$/.test(w)) continue;
          if (!estado.tokens[w] || estado.tokens[w].n < v.n) estado.tokens[w] = { cat: v.cat, n: v.n };
        }
      }
      if (estado.perfil === PERFIL_BASE && typeof o.perfil === 'string' && o.perfil.trim()) estado.perfil = o.perfil.slice(0, 4000);
      guardar();
      return { nuevos, actualizados, ignorados };
    }
  };
  return api;
}
