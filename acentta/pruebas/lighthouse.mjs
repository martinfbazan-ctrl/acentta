/**
 * acentta · Lighthouse contra el sitio construido
 * ---------------------------------------------------------------
 * Lo que las otras pruebas no pueden medir: LCP, INP, CLS y el puntaje
 * de rendimiento. Eso necesita un navegador de verdad, con motor de
 * layout, red simulada y CPU limitada. jsdom no tiene nada de eso, y
 * un número inventado es peor que ningún número.
 *
 * Levanta el sitio con `astro preview`, corre Lighthouse en móvil
 * sobre las cuatro pantallas que importan y guarda los informes en
 * pruebas/informes/. Después compara contra las metas del brief y
 * termina con error si alguna no se cumple, para que sirva también en
 * integración continua.
 *
 *   npm run auditar:lighthouse
 *
 * Requiere Chrome instalado y estas dos dependencias, que no están en
 * package.json porque pesan más de 100 MB y sólo hacen falta acá:
 *
 *   npm i -D lighthouse chrome-launcher
 *
 * En Windows, si PowerShell contesta "la ejecución de scripts está
 * deshabilitada en este sistema", usá `npm.cmd` en lugar de `npm`. Es
 * el mismo programa: `npm` a secas resuelve al envoltorio npm.ps1, que
 * la política de ejecución bloquea de fábrica.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const INFORMES = path.join(AQUI, 'informes');

/* Las metas del brief §8. */
const METAS = {
  performance: 95,
  accessibility: 100,
  'best-practices': 95,
  seo: 100,
};
const VITALES = {
  'largest-contentful-paint': { max: 2000, nombre: 'LCP', unidad: 'ms' },
  'cumulative-layout-shift': { max: 0.05, nombre: 'CLS', unidad: '' },
  'total-blocking-time': { max: 200, nombre: 'TBT', unidad: 'ms' },
};

/* Las cuatro pantallas del circuito de compra. Auditar las 64 tarda
   veinte minutos y no dice nada nuevo: las de producto son iguales
   entre sí, y las de texto legal no tienen nada que medir. */
const RUTAS = ['/', '/categoria/iluminacion', '/producto/lampara-de-pie-arco', '/carrito'];

let lighthouse, launch;
try {
  ({ default: lighthouse } = await import('lighthouse'));
  ({ launch } = await import('chrome-launcher'));
} catch {
  console.error(
    'Faltan las dependencias de Lighthouse. Instalalas con:\n' +
    '  npm i -D lighthouse chrome-launcher\n' +
    'Pesan bastante, por eso no vienen con el proyecto.'
  );
  process.exit(1);
}

/* ---- Servidor ---- */
const PUERTO = 4321;

/* En Windows hay que invocar `npx.cmd` y no `npx`. El segundo resuelve
   a npx.ps1, y PowerShell lo bloquea si la política de ejecución está
   restringida —que es lo que viene de fábrica—: "no se puede cargar el
   archivo porque la ejecución de scripts está deshabilitada". La
   versión .cmd hace exactamente lo mismo sin pasar por esa puerta. */
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const servidor = spawn(NPX, ['astro', 'preview', '--port', String(PUERTO)], {
  cwd: path.join(AQUI, '..'),
  stdio: 'ignore',
  shell: process.platform === 'win32',
});
const cerrar = () => servidor.kill();
process.on('exit', cerrar);
process.on('SIGINT', () => { cerrar(); process.exit(130); });

/** Espera a que el servidor conteste, sin dormir un tiempo fijo a ciegas. */
async function esperar(url, intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* todavía no levantó */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const base = `http://localhost:${PUERTO}`;
if (!(await esperar(base))) {
  console.error('El servidor de vista previa no levantó. ¿Corriste npm run build?');
  cerrar();
  process.exit(1);
}

fs.mkdirSync(INFORMES, { recursive: true });
const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });

const fallos = [];
const tabla = [];

for (const ruta of RUTAS) {
  const r = await lighthouse(base + ruta, {
    port: chrome.port,
    output: ['html', 'json'],
    logLevel: 'error',
    /* Móvil, que es donde el brief pone la meta: es el escenario más
       exigente y el que corresponde a un e-commerce en Latam. */
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 2.625, disabled: false },
    throttlingMethod: 'simulate',
  });

  const nombre = (ruta === '/' ? 'home' : ruta.replace(/\//g, '-').replace(/^-/, ''));
  fs.writeFileSync(path.join(INFORMES, `${nombre}.html`), r.report[0]);

  const cat = Object.fromEntries(
    Object.entries(r.lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)])
  );
  const fila = { ruta, ...cat };

  for (const [clave, meta] of Object.entries(METAS)) {
    if (cat[clave] === undefined) continue;
    if (cat[clave] < meta) fallos.push(`${ruta} · ${clave}: ${cat[clave]} (meta ${meta})`);
  }
  for (const [clave, { max, nombre: n, unidad }] of Object.entries(VITALES)) {
    const v = r.lhr.audits[clave]?.numericValue;
    if (v === undefined) continue;
    fila[n] = unidad === 'ms' ? Math.round(v) : +v.toFixed(3);
    if (v > max) fallos.push(`${ruta} · ${n}: ${fila[n]}${unidad} (meta ${max}${unidad})`);
  }
  tabla.push(fila);
}

await chrome.kill();
cerrar();

console.table(tabla);
console.log(`\nInformes completos en pruebas/informes/`);
console.log(fallos.length ? '\n✗ metas incumplidas:\n  · ' + fallos.join('\n  · ') : '\n✓ todas las metas del brief se cumplen');
process.exit(fallos.length ? 1 : 0);
