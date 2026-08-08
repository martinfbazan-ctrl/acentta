/**
 * acentta · auditoría de accesibilidad y peso
 * ---------------------------------------------------------------
 * Corre sobre la salida compilada (dist/), no sobre el código fuente:
 * lo que hay que auditar es lo que recibe el navegador.
 *
 * Qué mide y qué no.
 *
 *   Mide, y es concluyente:
 *     · axe-core sobre las 64 páginas — roles, nombres accesibles,
 *       orden de encabezados, landmarks, ids repetidos, ARIA inválido.
 *     · Contraste, calculado con la fórmula de WCAG sobre cada par de
 *       colores real del sistema. Esto es aritmética: no necesita
 *       navegador y da el mismo número que cualquier herramienta.
 *     · Peso por página, con y sin comprimir.
 *     · Riesgos de CLS: imágenes sin medidas declaradas.
 *
 *   No mide, y hay que correrlo en un navegador de verdad:
 *     · LCP, INP y CLS reales, que dependen de red y de dispositivo.
 *     · El puntaje de Lighthouse.
 *   Para eso está `npm run auditar:lighthouse`.
 *
 * La regla de color de axe queda desactivada a propósito: jsdom no
 * hace layout ni compone capas, así que el resultado sería inventado.
 * El contraste se verifica aparte, con más rigor que axe: contra los
 * dos fondos reales del sitio y no sólo contra blanco.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(AQUI, '..', 'dist');

if (!fs.existsSync(DIST)) {
  console.error('No existe dist/. Corré primero: npm run build');
  process.exit(1);
}

/* ============================================================
   Utilidades
   ============================================================ */

function paginas(dir = DIST, base = '') {
  const salida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) salida.push(...paginas(path.join(dir, e.name), `${base}/${e.name}`));
    else if (e.name === 'index.html') salida.push({ ruta: base || '/', archivo: path.join(dir, e.name) });
  }
  return salida.sort((a, b) => a.ruta.localeCompare(b.ruta));
}

/** Mete el CSS en la página. Sin esto jsdom no sabe qué está oculto. */
function conEstilos(html) {
  return html.replace(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (etiqueta, href) => {
    const f = path.join(DIST, href.replace(/^\//, ''));
    if (!fs.existsSync(f)) return etiqueta;
    return `<style>${fs.readFileSync(f, 'utf8')}</style>`;
  });
}

/* ============================================================
   1 · axe-core
   ============================================================ */

async function auditarAccesibilidad() {
  const problemas = [];
  const lista = paginas();

  for (const { ruta, archivo } of lista) {
    const dom = new JSDOM(conEstilos(fs.readFileSync(archivo, 'utf8')), {
      url: 'https://acentta.vercel.app' + ruta,
      pretendToBeVisual: true,
      /* 'outside-only' habilita window.eval sin ejecutar los guiones
         de la página: axe audita el HTML tal como llega, antes de que
         nada lo modifique. Es lo que ve un lector de pantalla si el
         JavaScript falla. */
      runScripts: 'outside-only',
    });
    const { window } = dom;

    /* axe se evalúa dentro de la ventana de la página. */
    window.eval(axe.source);
    const r = await window.axe.run(window.document, {
      resultTypes: ['violations'],
      rules: {
        // Necesita composición real de capas; se verifica aparte.
        'color-contrast': { enabled: false },
        // La vista previa no tiene servidor: los enlaces relativos ya
        // se comprueban en las otras pruebas.
        'landmark-unique': { enabled: true },
      },
    });

    for (const v of r.violations) {
      problemas.push({
        ruta,
        id: v.id,
        impacto: v.impact,
        descripcion: v.help,
        nodos: v.nodes.length,
        ejemplo: v.nodes[0]?.html?.slice(0, 120) ?? '',
      });
    }
    window.close();
  }
  return { problemas, total: lista.length };
}

/* ============================================================
   2 · Contraste
   ============================================================ */

const hex = (h) => {
  const n = h.replace('#', '');
  const v = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};

/** Luminancia relativa según WCAG 2.1. */
function luminancia(color) {
  const [r, g, b] = hex(color).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Lee los tokens del CSS compilado: los valores reales, no los que creo
 * recordar.
 *
 * Sólo del bloque `:root`, y esto importa. El sitio redefine varios
 * tokens dentro de `.sobre-oscuro` y `.sobre-oliva` para el texto que
 * va sobre fondos oscuros. Leyendo el archivo entero, esas
 * redefiniciones pisaban a las originales y la auditoría terminaba
 * calculando el contraste de un gris claro sobre un fondo claro:
 * veinticuatro fallas inventadas, ninguna real.
 */
function tokens() {
  const dir = path.join(DIST, '_astro');
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

  const t = {};
  for (const m of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const d of m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)) t[d[1]] = d[2];
  }
  return t;
}

export function auditarContraste() {
  const t = tokens();
  const c = (k) => t[k] ?? '#000000';

  /**
   * Las combinaciones que el sitio usa de verdad, no todas las
   * posibles. Una matriz de todos contra todos suena más rigurosa y es
   * lo contrario: marca como falla el gris de un metadato sobre el
   * verde oliva de la zona de ofertas, donde ese gris nunca aparece, y
   * entierra los dos casos que sí importan entre veinte que no.
   *
   * El mínimo depende de para qué se usa el color:
   *   4,5  texto normal
   *   3    texto grande (más de 24 px, o 19 px en negrita) y todo lo
   *        que no es texto pero hay que poder distinguir: bordes de
   *        campos, íconos con significado, el foco.
   *   1,2  separadores decorativos, que no comunican nada por sí solos.
   */
  const pares = [
    // ---- Texto sobre los fondos claros ----
    ['texto principal',        'tinta',        'arena',        4.5],
    ['texto principal',        'tinta',        'papel',        4.5],
    ['texto principal',        'tinta',        'gris-050',     4.5],
    ['texto principal',        'tinta',        'arena-honda',  4.5],
    ['texto principal',        'tinta',        'oferta-wash',  4.5],
    ['texto secundario',       'gris-800',     'arena',        4.5],
    ['texto secundario',       'gris-800',     'papel',        4.5],
    ['texto secundario',       'gris-800',     'gris-050',     4.5],
    ['texto secundario',       'gris-800',     'oferta-wash',  4.5],
    ['metadatos',              'gris-texto',   'arena',        4.5],
    ['metadatos',              'gris-texto',   'papel',        4.5],
    ['metadatos',              'gris-texto',   'gris-050',     4.5],

    // ---- Precio tachado: texto grande, mínimo 3 ----
    ['precio tachado',         'gris-500',     'papel',        3],
    ['precio tachado',         'gris-500',     'arena',        3],

    // ---- Naranja: sólo donde de verdad se usa ----
    ['enlace y precio',        'naranja-texto', 'arena',       4.5],
    ['enlace y precio',        'naranja-texto', 'papel',       4.5],
    ['enlace y precio',        'naranja-texto', 'gris-050',    4.5],
    ['enlace sobre oliva',     'naranja-texto-oliva', 'oferta-wash', 4.5],
    ['relleno del botón',      'naranja-accion', 'arena',      3],
    ['relleno del botón',      'naranja-accion', 'papel',      3],

    // ---- Estados ----
    ['ahorro y envío gratis',  'verde',        'papel',        4.5],
    ['ahorro y envío gratis',  'verde',        'arena',        4.5],
    ['ahorro sobre su fondo',  'verde',        'verde-wash',   4.5],
    ['agotado y errores',      'rojo',         'papel',        4.5],
    ['agotado y errores',      'rojo',         'arena',        4.5],
    ['error sobre su fondo',   'rojo',         'rojo-wash',    4.5],
    ['borde de la estrella',   'amarillo-borde', 'papel',      3],

    // ---- Bordes y separadores ----
    ['borde de campo',         'gris-500',     'papel',        3],
    ['separador',              'gris-200',     'papel',        1.2],

    // ---- Sobre fondo oscuro: cierre del caso de estudio ----
    ['bajada sobre oscuro',    'gris-200',     'tinta',        4.5],
    ['nota sobre oscuro',      'gris-500',     'tinta',        4.5],
  ];

  const filas = pares.map(([uso, color, fondo, minimo]) => {
    const r = ratio(c(color), c(fondo));
    return { color: `${uso} · ${color}`, hex: c(color), fondo, ratio: +r.toFixed(2), minimo, pasa: r >= minimo };
  });

  /* Texto blanco sobre el relleno del botón: el par más importante del
     sitio, porque es el que se toca. */
  const rBoton = ratio(c('blanco'), c('naranja-accion'));
  filas.push({ color: 'texto del botón · blanco', hex: c('blanco'), fondo: 'naranja-accion', ratio: +rBoton.toFixed(2), minimo: 4.5, pasa: rBoton >= 4.5 });

  /* Y sobre fondos oscuros, donde los tokens cambian de valor. */
  const rHero = ratio(c('blanco'), c('tinta'));
  filas.push({ color: 'titular del hero · blanco', hex: c('blanco'), fondo: 'tinta', ratio: +rHero.toFixed(2), minimo: 4.5, pasa: rHero >= 4.5 });
  const rMarq = ratio(c('blanco'), c('verde'));
  filas.push({ color: 'marquesina · blanco', hex: c('blanco'), fondo: 'verde', ratio: +rMarq.toFixed(2), minimo: 4.5, pasa: rMarq >= 4.5 });

  return filas;
}

/* ============================================================
   3 · Peso
   ============================================================ */

function auditarPeso() {
  const filas = [];
  for (const { ruta, archivo } of paginas()) {
    const html = fs.readFileSync(archivo, 'utf8');
    let bytes = Buffer.byteLength(html);
    let comprimido = zlib.gzipSync(html).length;

    /* Se suman las hojas y los guiones que la página pide de verdad. */
    const recursos = [...html.matchAll(/(?:href|src)="(\/_astro\/[^"]+)"/g)].map((m) => m[1]);
    for (const r of new Set(recursos)) {
      const f = path.join(DIST, r.replace(/^\//, ''));
      if (!fs.existsSync(f)) continue;
      const b = fs.readFileSync(f);
      bytes += b.length;
      comprimido += zlib.gzipSync(b).length;
    }
    filas.push({ ruta, kb: +(bytes / 1024).toFixed(1), gzip: +(comprimido / 1024).toFixed(1) });
  }
  return filas.sort((a, b) => b.kb - a.kb);
}

/* ============================================================
   4 · Riesgos de salto de diseño y de carga
   ============================================================ */

function auditarEstabilidad() {
  const avisos = [];
  for (const { ruta, archivo } of paginas()) {
    const html = fs.readFileSync(archivo, 'utf8');
    const dom = new JSDOM(html);
    const d = dom.window.document;

    /* Sólo las imágenes que participan del flujo pueden mover el
       contenido al cargar. Las que viven dentro de un <dialog> están
       fuera del flujo hasta que el diálogo se abre —y entonces cubre
       la página entera— así que no pueden causar un salto. */
    for (const img of d.querySelectorAll('img')) {
      if (img.closest('dialog')) continue;
      if (!img.getAttribute('width') || !img.getAttribute('height')) {
        avisos.push({ ruta, tipo: 'imagen sin medidas', detalle: (img.getAttribute('src') || '').slice(-42) });
      }
    }

    /* Una sola imagen por página puede pedir prioridad alta: la que va
       a ser el LCP. Si la piden varias, se reparten el mismo ancho de
       banda y ninguna llega antes — sólo se retrasa el CSS. */
    const prioritarias = d.querySelectorAll('img[fetchpriority="high"]').length;
    if (prioritarias > 1) avisos.push({ ruta, tipo: 'más de una imagen con prioridad alta', detalle: String(prioritarias) });

    for (const s of d.querySelectorAll('head script[src]')) {
      if (!s.hasAttribute('defer') && !s.hasAttribute('async') && s.getAttribute('type') !== 'module') {
        avisos.push({ ruta, tipo: 'guion que bloquea el render', detalle: s.getAttribute('src') });
      }
    }
    dom.window.close();
  }
  return avisos;
}

/* ============================================================
   5 · Teclado
   ============================================================ */

function auditarTeclado() {
  const avisos = [];
  for (const { ruta, archivo } of paginas()) {
    const dom = new JSDOM(fs.readFileSync(archivo, 'utf8'));
    const d = dom.window.document;

    /* Un tabindex positivo reordena el foco de toda la página y rompe
       el orden natural. Nunca hay una buena razón. */
    for (const el of d.querySelectorAll('[tabindex]')) {
      const v = Number(el.getAttribute('tabindex'));
      if (v > 0) avisos.push({ ruta, tipo: 'tabindex positivo', detalle: el.outerHTML.slice(0, 80) });
    }

    /* Cosas que se tocan pero no se pueden enfocar. */
    for (const el of d.querySelectorAll('[data-agregar], [data-accion], [data-hero-punto], [data-indice]')) {
      const enfocable = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.hasAttribute('tabindex');
      if (!enfocable) avisos.push({ ruta, tipo: 'control no enfocable', detalle: el.outerHTML.slice(0, 80) });
    }

    /* Cada página tiene que empezar con el atajo al contenido. */
    if (!d.querySelector('.saltar')) avisos.push({ ruta, tipo: 'sin enlace de saltar al contenido', detalle: '' });

    /* Un solo h1 por página y en orden. */
    const h1 = d.querySelectorAll('h1').length;
    if (h1 !== 1) avisos.push({ ruta, tipo: `h1 x${h1}`, detalle: '' });

    dom.window.close();
  }
  return avisos;
}

/* ============================================================
   Informe
   ============================================================ */

const fmt = (n) => String(n).padStart(6);

const { problemas, total } = await auditarAccesibilidad();
const contraste = auditarContraste();
const peso = auditarPeso();
const estabilidad = auditarEstabilidad();
const teclado = auditarTeclado();

console.log(`\n=== ACCESIBILIDAD · axe-core sobre ${total} páginas ===`);
if (problemas.length === 0) console.log('  sin infracciones');
else {
  const porRegla = new Map();
  for (const p of problemas) {
    const k = `${p.id} (${p.impacto})`;
    porRegla.set(k, (porRegla.get(k) ?? []).concat(p));
  }
  for (const [regla, casos] of [...porRegla].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ✗ ${regla} — ${casos.length} página(s): ${casos[0].descripcion}`);
    console.log(`      p. ej. ${casos[0].ruta} → ${casos[0].ejemplo}`);
  }
}

console.log('\n=== CONTRASTE · fórmula WCAG sobre los colores reales ===');
const fallaC = contraste.filter((c) => !c.pasa);
for (const c of fallaC) {
  console.log(`  ✗ ${c.color} (${c.hex}) sobre ${c.fondo}: ${c.ratio}:1 — necesita ${c.minimo}:1`);
}
console.log(`  ${contraste.length - fallaC.length} de ${contraste.length} combinaciones cumplen`);

console.log('\n=== PESO · HTML + CSS + JS, sin imágenes ===');
for (const p of peso.slice(0, 6)) console.log(`  ${fmt(p.kb)} KB  ${fmt(p.gzip)} KB gzip   ${p.ruta}`);
const peor = peso[0];
console.log(`  la más pesada: ${peor.ruta} · ${peor.kb} KB (${peor.gzip} KB comprimida) — meta < 300 KB`);

console.log('\n=== ESTABILIDAD Y CARGA ===');
if (estabilidad.length === 0) console.log('  sin avisos');
else {
  const porTipo = new Map();
  for (const a of estabilidad) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);
  for (const [t, n] of porTipo) console.log(`  ✗ ${t}: ${n}`);
  for (const a of estabilidad.slice(0, 5)) console.log(`      ${a.ruta} · ${a.detalle}`);
}

console.log('\n=== TECLADO ===');
if (teclado.length === 0) console.log('  sin avisos');
else {
  const porTipo = new Map();
  for (const a of teclado) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? []).concat(a));
  for (const [t, casos] of porTipo) {
    console.log(`  ✗ ${t}: ${casos.length}`);
    console.log(`      ${casos.slice(0, 3).map((c) => c.ruta).join(', ')}`);
  }
}

const errores = problemas.length + fallaC.length + estabilidad.length + teclado.length;
console.log(`\n${errores === 0 ? '✓ auditoría limpia' : `✗ ${errores} hallazgo(s)`}\n`);
process.exit(errores === 0 ? 0 : 1);
