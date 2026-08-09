/**
 * acentta · el sitio en un teléfono, medido
 * ---------------------------------------------------------------
 * Los dos defectos de móvil que llegaron a estar publicados —una
 * fila de filtros 19 px más ancha que la pantalla, y la tarjeta del
 * pedido cortada por el borde— tienen algo en común: ninguna de las
 * auditorías de este proyecto podía verlos.
 *
 * jsdom no hace layout. Sabe qué elementos existen y qué reglas les
 * aplican, pero no cuánto miden, así que un desborde horizontal le
 * es invisible por definición. Y Lighthouse mide velocidad, no
 * geometría: un sitio puede sacar 100 en rendimiento y aun así
 * desbordarse tres centímetros a la derecha.
 *
 * Esta prueba abre las páginas en un Chrome de verdad, con el
 * viewport de un teléfono, y pregunta dos cosas:
 *
 *   1. ¿La página se puede arrastrar para el costado? Un sitio que
 *      se mueve en horizontal se siente roto aunque todo lo demás
 *      esté bien, y esconde contenido contra el borde.
 *   2. ¿Cuánto hay que bajar para llegar al precio? Es el dato por
 *      el que se entra a una ficha. Si está debajo del pliegue, la
 *      foto está ocupando el lugar de la decisión.
 *
 * Necesita Chrome instalado. Igual que `auditar:lighthouse`, no
 * corre dentro de `npm run auditar`: se pide aparte.
 *
 *     npm run auditar:movil
 *
 * En Windows, `npm.cmd run auditar:movil`.
 */

import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/* Dos anchos reales, no uno. 390 es un iPhone moderno; 360 es el
   ancho más común del Android de gama media, que es la mitad del
   mercado argentino y el que primero se rompe. */
const ANCHOS = [
  { w: 390, h: 844, nombre: 'iPhone 14' },
  { w: 360, h: 800, nombre: 'Android 360' },
];

/* Un carrito cargado, para que el carrito y el checkout tengan algo
   que dibujar. Con el carrito vacío el checkout redirige y la
   medición no mide nada. */
const CARRO = JSON.stringify([{
  id: 'p01', slug: 'lampara-de-pie-arco',
  nombre: 'Lámpara de pie Arco con base de mármol de Carrara',
  precio: 89900, imagen: 'photo-1673939859210-23d8444237ff',
  variante: 'Negro mate', stockMax: 12, peso: 14.2, cantidad: 1,
}, {
  id: 'p14', slug: 'alfombra-lavable-espiga',
  nombre: 'Alfombra lavable espiga 160 × 230',
  precio: 74500, imagen: 'photo-1600166898405-da9535204843',
  variante: '160 × 230', stockMax: 4, peso: 9.1, cantidad: 2,
}]);

const RUTAS = [
  '/',
  '/categoria/iluminacion',
  '/deco-inteligente',
  '/buscar',
  '/producto/lampara-de-pie-arco',
  '/carrito',
  '/checkout',
];

let launch;
try {
  ({ launch } = await import('chrome-launcher'));
} catch {
  console.error('Falta chrome-launcher. Instalar con:\n  npm i -D chrome-launcher');
  process.exit(1);
}

/* ---- Servidor ---- */
const PUERTO = 4321;
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const base = `http://localhost:${PUERTO}`;

async function responde(url) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1500);
    const r = await fetch(url, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

const yaEstaba = await responde(base);
let servidor = null;
if (yaEstaba) console.log(`Uso el servidor que ya está en ${base}.`);
else {
  console.log('Levanto el servidor…');
  servidor = spawn(NPX, ['astro', 'preview', '--port', String(PUERTO)], {
    cwd: path.join(AQUI, '..'), stdio: 'ignore', shell: process.platform === 'win32',
  });
}
const cerrarServidor = () => servidor?.kill();
process.on('exit', cerrarServidor);
process.on('SIGINT', () => { cerrarServidor(); process.exit(130); });

for (let i = 0; i < 40 && !(await responde(base)); i++) {
  await new Promise((r) => setTimeout(r, 500));
}
if (!(await responde(base))) {
  console.error('\nEl servidor no contestó. ¿Corrió `npm run build` antes?\n');
  process.exit(1);
}

/* ---- Chrome por el protocolo de DevTools ----
   Sin puppeteer: son 200 MB para hacer cuatro llamadas. Chrome expone
   un puerto y Node 22 ya trae cliente de WebSocket, así que alcanza
   con hablarle directo. */
const chrome = await launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

const objetivos = await (await fetch(`http://localhost:${chrome.port}/json/list`)).json();
const objetivo = objetivos.find((t) => t.type === 'page');
const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let idc = 0;
const pendientes = new Map();
const eventos = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pendientes.has(d.id)) {
    const { res, rej } = pendientes.get(d.id);
    pendientes.delete(d.id);
    d.error ? rej(new Error(d.error.message)) : res(d.result);
  } else if (d.method && eventos.has(d.method)) {
    eventos.get(d.method)();
    eventos.delete(d.method);
  }
};
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const id = ++idc;
  pendientes.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
const esperarEvento = (m) => new Promise((res) => eventos.set(m, res));

await cdp('Page.enable');
await cdp('Runtime.enable');

/* El carrito se siembra antes de que la página exista: si se hiciera
   después, el guion del carrito ya corrió con el almacenamiento
   vacío y habría que recargar. */
await cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{
    localStorage.setItem('acentta:carrito:v1', ${JSON.stringify(CARRO)});
    localStorage.setItem('acentta:cp:v1','5000');
  }catch(e){}`,
});

/* ---- Lo que se mide dentro de la página ---- */
const MEDIDOR = `(() => {
  const doc = document.documentElement;
  const ancho = doc.clientWidth;
  const desborde = Math.round(doc.scrollWidth - ancho);

  /* Un elemento sólo cuenta si su desborde llega al documento. Los
     carruseles y las tiras de miniaturas se salen de su caja a
     propósito, pero su caja los recorta: eso no mueve la página y no
     es un defecto. */
  function recortado(el) {
    for (let n = el.parentElement; n && n !== doc; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (o.overflowX !== 'visible' || o.overflow !== 'visible') return true;
    }
    return false;
  }

  const culpables = [];
  for (const el of doc.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) continue;
    if (getComputedStyle(el).position === 'fixed') continue;
    if (r.right <= ancho + 1) continue;
    if (recortado(el)) continue;
    /* Si el padre ya está señalado, el hijo es consecuencia, no causa. */
    if (culpables.some((c) => c.nodo.contains(el))) continue;
    culpables.push({
      nodo: el,
      sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''),
      sobra: Math.round(r.right - ancho),
      mide: Math.round(r.width),
    });
  }

  /* ¿A qué altura queda el precio en la ficha? */
  const precio = document.querySelector('.ficha__precio, [data-precio]');
  const alturaPrecio = precio
    ? Math.round(precio.getBoundingClientRect().top + scrollY)
    : null;

  return JSON.stringify({
    ancho, desborde, alto: innerHeight,
    alturaPrecio,
    culpables: culpables.slice(0, 6).map(({ sel, sobra, mide }) => ({ sel, sobra, mide })),
  });
})()`;

const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); };

console.log('');
for (const { w, h, nombre } of ANCHOS) {
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 2, mobile: true,
  });
  console.log(`=== ${nombre} · ${w} × ${h} ===`);

  for (const ruta of RUTAS) {
    const cargado = esperarEvento('Page.loadEventFired');
    await cdp('Page.navigate', { url: base + ruta });
    await cargado;
    /* Un respiro para el guion que pinta el carrito desde el
       almacenamiento: si se mide antes, se mide una página vacía. */
    await new Promise((r) => setTimeout(r, 350));

    const { result } = await cdp('Runtime.evaluate', { expression: MEDIDOR, returnByValue: true });
    const m = JSON.parse(result.value);

    const marca = m.desborde > 0 ? '✗' : '·';
    let linea = `  ${marca} ${ruta.padEnd(34)} ${m.desborde > 0 ? `desborda ${m.desborde} px` : 'entra'}`;
    if (m.alturaPrecio !== null) linea += ` · precio a ${m.alturaPrecio} px`;
    console.log(linea);

    for (const c of m.culpables) {
      console.log(`        ${c.sel} mide ${c.mide} px y se sale ${c.sobra}`);
    }

    ok(m.desborde <= 0, `${nombre} · ${ruta} desborda ${m.desborde} px${m.culpables[0] ? ` (${m.culpables[0].sel})` : ''}`);

    /* El precio de la ficha tiene que entrar en la primera pantalla.
       Se mide contra el alto real del viewport, no contra un número
       inventado. */
    if (m.alturaPrecio !== null) {
      ok(m.alturaPrecio < m.alto,
        `${nombre} · el precio de la ficha queda a ${m.alturaPrecio} px, debajo del pliegue (${m.alto} px). La foto está ocupando el lugar de la decisión.`);
    }
  }
  console.log('');
}

ws.close();
/* En Windows, matar Chrome revienta con EPERM al borrar su perfil
   temporal. Ocurre después de medir, así que no invalida nada. */
try { await chrome.kill(); } catch { /* perfil temporal trabado */ }

if (fallos.length) {
  console.log(`${fallos.length} problema(s):`);
  for (const f of fallos) console.log(` · ${f}`);
  process.exit(1);
}
console.log('✓ ninguna página se desborda y el precio entra en la primera pantalla\n');
