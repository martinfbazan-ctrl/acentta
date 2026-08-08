import fs from 'node:fs';
import { JSDOM } from '/tmp/acentta/node_modules/jsdom/lib/api.js';

const D = '/tmp/vista-previa';

/** Abre una página de la vista previa y espera a que corran los guiones. */
function abrir(p) {
  return new Promise((res) => {
    const dom = new JSDOM(fs.readFileSync(D + p, 'utf8'), {
      runScripts: 'dangerously',
      url: 'https://acentta.test' + p,
      beforeParse(w) {
        // jsdom no trae ninguna de las dos; el navegador sí.
        w.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
        w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
      },
    });
    dom.window.addEventListener('load', () => res(dom));
  });
}

const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); };

/* ============ Página de resultados ============ */
{
  const dom = await abrir('/buscar/index.html');
  const d = dom.window.document;
  const campo = d.querySelector('[data-busqueda-campo]');
  const vis = () => [...d.querySelectorAll('.busqueda__celda')].filter((c) => !c.hidden).map((c) => c.dataset.slug);
  const buscar = (q) => { campo.value = q; campo.dispatchEvent(new dom.window.Event('input', { bubbles: true })); return vis(); };

  ok(vis().length === 36, `sin consulta: ${vis().length} de 36`);
  for (const [q, cond, n] of [
    // Sólo los cuatro productos que se llaman "Lámpara". El velador y
    // el aplique son iluminación, pero no son lámparas: aparecen al
    // buscar "iluminación", que es la categoría.
    ['lampara', (r) => r.length === 4 && r.every((s) => s.includes('lampara') || s.includes('colgante')), 'sin tilde encuentra lámparas'],
    ['Lámpara', (r) => r.length === 4, 'con tilde, lo mismo'],
    ['iluminacion', (r) => r.length === 6, 'por categoría trae las 6 de iluminación'],
    ['seguridad', (r) => r.length === 3, 'por categoría trae las 3 de seguridad'],
    ['ALFOMBRA', (r) => r.length === 6, 'mayúsculas · 6 alfombras'],
    ['robot', (r) => r.length === 2, 'robots'],
    ['aspiradora', (r) => r.includes('robot-aspirador-con-vaciado-automatico'), 'sinónimo aspiradora'],
    // "wi-fi" está en el nombre de los dos de conectividad y en la
    // especificación de conexión de la cámara: los tres son correctos,
    // pero los de red tienen que venir primero.
    ['wifi', (r) => r.length === 3, 'wifi: los dos de red más la cámara, que se conecta por wi-fi'],
    ['camara', (r) => r.length === 3, 'sinónimo camara'],
    ['smart', (r) => r.length === 12, 'sinónimo smart → 12 del rubro nuevo'],
    ["puff", (r) => r.length === 2 && r.every(s=>s.includes("puff")), "puff sólo devuelve puffs"],
    ['lampara de pie', (r) => r.length > 0 && r.every((s) => s.includes('lampara-de-pie')), 'dos palabras acotan'],
    ['difusor', (r) => r.length === 1, 'difusor'],
    ['xyzqw', (r) => r.length === 0, 'sin resultados'],
  ]) {
    const r = buscar(q);
    ok(cond(r), `${n} · "${q}" → ${r.length}: ${r.slice(0, 3).join(', ')}`);
  }

  /* El orden de relevancia no es el del DOM: se expresa con `order`. */
  const porRelevancia = () =>
    [...d.querySelectorAll('.busqueda__celda')]
      .filter((c) => !c.hidden)
      .sort((a, b) => +a.style.order - +b.style.order)
      .map((c) => c.dataset.slug);

  buscar('alfombra');
  ok(porRelevancia()[0].startsWith('alfombra'), 'relevancia: primero ' + porRelevancia()[0]);

  buscar('wifi');
  ok(
    porRelevancia().slice(0, 2).every((s) => /extensor|malla/.test(s)),
    'wifi: los de red tienen que ir antes que la cámara → ' + porRelevancia().join(', ')
  );

  buscar('puff');
  ok(porRelevancia().every((s) => s.includes('puff')), 'puff: se coló algo que no es un puff → ' + porRelevancia().join(', '));

  buscar('xyzqw');
  ok(!d.querySelector('[data-busqueda-vacio]').hidden, 'estado vacío no aparece');
  ok(d.querySelector('[data-busqueda-grilla]').hidden, 'la grilla no se oculta');
  ok(d.querySelectorAll('.busqueda__atajo').length === 4, 'faltan atajos del estado vacío');
  ok(/Sin resultados/i.test(d.querySelector('[data-busqueda-aviso]').textContent), 'falta el aviso accesible');
  d.querySelector('[data-busqueda-limpiar]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  ok(vis().length === 36, 'limpiar no restaura');
}

/* ============ Sugerencias de la barra fija ============ */
{
  const h = await abrir('/index.html');
  const hd = h.window.document;
  const c2 = hd.querySelector('[data-buscador-campo]');
  const panel = hd.querySelector('[data-buscador-panel]');
  const items = () => [...hd.querySelectorAll('.sugerencias__item')];
  const tipear = (v) => { c2.value = v; c2.dispatchEvent(new h.window.Event('input', { bubbles: true })); };
  const tecla = (k) => c2.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  ok(panel.hidden, 'el panel debería arrancar cerrado');
  tipear('r'); ok(panel.hidden, 'con una sola letra no debería abrir');
  tipear('rob');
  ok(!panel.hidden, 'no se abrió al escribir');
  // "rob" coincide con Robot y también con Roble: es correcto que traiga los dos.
  ok(items().length >= 2 && items().length <= 6, `"rob" → ${items().length} sugerencias`);
  ok(items().some((i) => /Robot/.test(i.textContent)) && items().some((i) => /Roble/.test(i.textContent)), '"rob" debería traer Robot y Roble');
  ok(/<b>/i.test(items()[0]?.innerHTML ?? ''), 'no resalta lo escrito');
  ok(items()[0]?.querySelector('.sugerencias__precio, .sugerencias__agotado'), 'la sugerencia no muestra precio');

  tipear('smart');
  ok(items().length <= 6, `no respeta el máximo de 6 (${items().length})`);
  ok(!hd.querySelector('[data-buscador-todo]').hidden, 'falta el enlace "ver todos"');

  tecla('ArrowDown');
  ok(items()[0].getAttribute('aria-selected') === 'true', 'flecha abajo no marca la primera');
  ok(c2.getAttribute('aria-activedescendant') === 'sug-0', 'falta aria-activedescendant');
  tecla('ArrowDown'); ok(items()[1].getAttribute('aria-selected') === 'true', 'flecha abajo no avanza');
  tecla('ArrowUp');   ok(items()[0].getAttribute('aria-selected') === 'true', 'flecha arriba no vuelve');
  tecla('Escape');
  ok(panel.hidden, 'Escape no cierra');
  ok(c2.value === 'smart', 'Escape borró el texto en el primer toque');
  ok(c2.getAttribute('aria-expanded') === 'false', 'aria-expanded quedó mal');

  tipear('xyzqw');
  ok(!hd.querySelector('[data-buscador-vacio]').hidden, 'sin resultados: falta el mensaje del panel');
  ok(/buscar\/index\.html/.test(hd.querySelector('[data-buscador-forma]').getAttribute('action')), 'el formulario no apunta al archivo local');

  /* ============ Hero ============ */
  const laminas = [...hd.querySelectorAll('.hero__lamina')];
  const etiquetas = laminas.map((l) => l.querySelector('.hero__etiqueta').textContent.trim());
  ok(laminas.length === 4, `hero: ${laminas.length} láminas`);
  ok(hd.querySelectorAll('.hero__punto').length === 4, 'hero: los puntos no son 4');
  ok(etiquetas.filter((e) => /Deco inteligente/.test(e)).length === 2, 'hero: no hay 2 del segundo rubro → ' + JSON.stringify(etiquetas));
  ok(etiquetas.filter((e) => !/Deco inteligente/.test(e)).length === 2, 'hero: no hay 2 de decoración');
  ok(laminas[0].querySelector('img').getAttribute('loading') === 'eager', 'hero: la primera no carga con prioridad');
  ok(laminas.slice(1).every((l) => l.querySelector('img').getAttribute('loading') === 'lazy'), 'hero: las otras no van diferidas');
  ok(laminas.filter((l) => l.querySelector('h1')).length === 1, 'hero: debe haber exactamente un h1');
  ok(new Set(laminas.map((l) => l.querySelector('img').getAttribute('src'))).size === 4, 'hero: hay fotos repetidas');
}

console.log(fallos.length ? '✗ FALLOS:\n  · ' + fallos.join('\n  · ') : '✓ buscador y hero: todas las verificaciones pasan');
process.exit(fallos.length ? 1 : 0);
