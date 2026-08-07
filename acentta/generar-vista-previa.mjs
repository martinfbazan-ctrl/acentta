/**
 * acentta · generador de la vista previa local
 * ---------------------------------------------------------------
 * Convierte la salida de `astro build` en una copia que funciona
 * abriendo un archivo con doble clic, sin servidor.
 *
 * Hay dos obstáculos y este archivo existe para resolverlos:
 *
 * 1. Rutas absolutas. En el sitio publicado, /_astro/... y
 *    /producto/... resuelven contra la raíz del dominio. Con file://
 *    la raíz es la raíz del disco. Se reescriben a rutas relativas
 *    según la profundidad de cada página.
 *
 * 2. Módulos ES. Chrome bloquea <script type="module"> servido desde
 *    file:// por política CORS — el origen es "null" y el módulo no
 *    se carga. El resultado es una página sin nada de JavaScript:
 *    ni carrito, ni filtros, ni galería. Acá se re-empaquetan los
 *    módulos a formato IIFE y se incrustan en la página, que sí
 *    corre en file://.
 *
 * Esto es andamiaje para revisar el sitio sin instalar nada. El
 * sitio publicado no lo usa: ahí los módulos se sirven por HTTP
 * como corresponde.
 *
 * Uso:  node generar-vista-previa.mjs
 */

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(aqui, 'dist');
const SALIDA = path.join(aqui, '..', 'vista-previa');

if (!fs.existsSync(DIST)) {
  console.error('No existe dist/. Corré primero: npm run build');
  process.exit(1);
}

fs.rmSync(SALIDA, { recursive: true, force: true });
fs.cpSync(DIST, SALIDA, { recursive: true });

/* ------------------------------------------------------------
   Rutas que existen como página
   ------------------------------------------------------------ */
function paginas(dir, base = '') {
  const salida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) salida.push(...paginas(path.join(dir, e.name), `${base}/${e.name}`));
    else if (e.name === 'index.html') salida.push(base || '/');
  }
  return salida;
}
const RUTAS = new Set(paginas(SALIDA));

/* ------------------------------------------------------------
   Re-empaquetado de los módulos a IIFE
   ------------------------------------------------------------ */
const cache = new Map();

async function aIIFE(rutaModulo) {
  if (cache.has(rutaModulo)) return cache.get(rutaModulo);
  const entrada = path.join(DIST, rutaModulo.replace(/^\//, ''));
  const r = await build({
    entryPoints: [entrada],
    bundle: true,
    format: 'iife',
    write: false,
    minify: true,
    target: 'es2020',
    logLevel: 'silent',
  });
  const codigo = r.outputFiles[0].text;
  cache.set(rutaModulo, codigo);
  return codigo;
}

/* ------------------------------------------------------------
   Reescritura de una página
   ------------------------------------------------------------ */
function relativo(profundidad) {
  return profundidad ? '../'.repeat(profundidad) : './';
}

function rutaDePagina(ruta, raiz) {
  return ruta === '/' ? `${raiz}index.html` : `${raiz}${ruta.replace(/^\//, '')}/index.html`;
}

async function procesar(archivo) {
  const rel = path.relative(SALIDA, archivo);
  const raiz = relativo(rel.split(path.sep).length - 1);
  let h = fs.readFileSync(archivo, 'utf8');

  /* 1 · Recursos estáticos */
  h = h.replace(
    /(href|src)="\/(_astro|fuentes|logo-acentta\.svg|favicon\.svg)/g,
    (_, attr, recurso) => `${attr}="${raiz}${recurso}`
  );
  h = h.replace(/url\(\/fuentes\//g, `url(${raiz}fuentes/`);

  /* 2 · Enlaces internos */
  h = h.replace(/href="(\/[^"#]*)"/g, (_, ruta) => {
    const base = ruta.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
    if (RUTAS.has(base)) return `href="${rutaDePagina(base, raiz)}"`;
    return 'href="#" data-sin-pagina title="Esta pagina llega en una etapa posterior"';
  });

  /* 3 · Módulos ES → guiones clásicos incrustados */
  const modulos = [...h.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)];
  for (const [etiqueta, src] of modulos) {
    const original = src.replace(new RegExp('^' + raiz.replace(/\./g, '\\.')), '/');
    let codigo = await aIIFE(original.startsWith('/') ? original : '/' + original);

    /* Las rutas que el JavaScript arma a mano también necesitan
       resolverse contra la raíz de la copia. */
    codigo = codigo
      .replace(/`\/carrito`|"\/carrito"/g, '(window.__raiz+"carrito/index.html")')
      .replace(/`\/confirmacion`|"\/confirmacion"/g, '(window.__raiz+"confirmacion/index.html")')
      .replace(/href="\/producto\/\$\{/g, 'href="${window.__raiz}producto/${')
      .replace(/\.slug\}"/g, '.slug}/index.html"');

    /* Un <script type="module"> es diferido por definición: corre
       después de armado el DOM. Un <script> clásico en el <head>
       corre antes, y todo querySelector devuelve null. Se envuelve
       en DOMContentLoaded para conservar el momento de ejecución. */
    h = h.replace(etiqueta, `<script>window.addEventListener("DOMContentLoaded",function(){${codigo}});</script>`);
  }

  /* Los módulos ya incrustados (los que Astro puso en línea) tampoco
     corren en file://: se convierten a guión clásico envuelto. */
  h = h.replace(/<script type="module">([\s\S]*?)<\/script>/g, (_, cuerpo) =>
    `<script>window.addEventListener("DOMContentLoaded",function(){${cuerpo}});</script>`
  );

  /* 4 · Raíz para el JavaScript */
  h = h.replace('<head>', `<head><script>window.__raiz="${raiz}";</script>`);

  /* 5 · Sello de vista previa */
  h = h.replace(
    '</body>',
    '<div style="position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:99;' +
      'background:#1C1814;color:#FFFCF7;padding:8px 14px;border-radius:10px;' +
      'font:500 12px/1.4 system-ui;box-shadow:0 6px 16px rgba(60,42,22,.2);pointer-events:none">' +
      'Vista previa local · el sitio real corre con npm run dev</div></body>'
  );

  fs.writeFileSync(archivo, h, 'utf8');
}

function todosLosHtml(dir) {
  const salida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...todosLosHtml(p));
    else if (e.name.endsWith('.html')) salida.push(p);
  }
  return salida;
}

const archivos = todosLosHtml(SALIDA);
for (const a of archivos) await procesar(a);

/* Atajo en la raíz del proyecto */
fs.writeFileSync(
  path.join(aqui, '..', 'ABRIR-VISTA-PREVIA.html'),
  '<!doctype html><meta charset="utf-8"><title>acentta</title>' +
    '<meta http-equiv="refresh" content="0; url=./vista-previa/index.html">' +
    '<p style="font:400 16px/1.6 system-ui;padding:40px">Abriendo la vista previa… ' +
    'Si no pasa nada, <a href="./vista-previa/index.html">entrá acá</a>.</p>',
  'utf8'
);

console.log(`Vista previa lista: ${archivos.length} páginas, ${cache.size} guiones re-empaquetados.`);
