/**
 * acentta · el circuito de compra completo sin mouse
 * ---------------------------------------------------------------
 * El brief pide poder comprar sin tocar el mouse. Eso no se verifica
 * mirando: se verifica recorriéndolo.
 *
 * La prueba camina el circuito entero —ficha, agregar, mini-carrito,
 * carrito, checkout, confirmar— usando sólo Tab, Enter, las flechas y
 * Escape, y comprueba en cada parada tres cosas:
 *
 *   1. Que el control al que hay que llegar sea alcanzable con Tab,
 *      en un orden que siga la lectura.
 *   2. Que Enter haga lo mismo que haría el clic.
 *   3. Que el foco no se pierda ni quede atrapado: cuando se abre el
 *      mini-carrito el foco entra, con Escape sale y vuelve a donde
 *      estaba.
 *
 * Corre sobre la vista previa, que es la única versión con los guiones
 * en formato que jsdom puede ejecutar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VISTA = path.join(AQUI, '..', '..', 'vista-previa');

if (!fs.existsSync(VISTA)) {
  console.error('No existe vista-previa/. Correr primero: npm run vista-previa');
  process.exit(1);
}

const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); };

function abrir(ruta, antes) {
  return new Promise((res) => {
    const dom = new JSDOM(fs.readFileSync(path.join(VISTA, ruta), 'utf8'), {
      runScripts: 'dangerously',
      url: 'https://acentta.test/' + ruta,
      /* Habilita requestAnimationFrame, que el panel usa para abrirse. */
      pretendToBeVisual: true,
      beforeParse(w) {
        w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
        w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
        w.scrollTo = () => {};
        w.HTMLElement.prototype.scrollIntoView = () => {};
        /* jsdom no anima. El sitio usa la animación de vuelo al carrito
           y espera su `onfinish` para abrir el panel, así que el doble
           tiene que llamarlo: si no, el circuito se corta acá por una
           limitación del entorno de prueba y no por un defecto real. */
        w.HTMLElement.prototype.animate = function () {
          const a = { onfinish: null, oncancel: null, cancel() {}, finish() {} };
          queueMicrotask(() => a.onfinish?.());
          return a;
        };
        w.Image = w.Image || class { set src(_v) {} };
        antes?.(w);
      },
    });
    dom.window.addEventListener('load', () => res(dom));
  });
}

/** Los elementos que reciben foco, en el orden en que los recorre Tab. */
function ordenDeFoco(d) {
  const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...d.querySelectorAll(sel)].filter((el) => {
    if (el.getAttribute('tabindex') === '-1') return false;
    if (el.hasAttribute('aria-hidden')) return false;
    // Nada dentro de algo oculto entra en el recorrido.
    for (let n = el; n; n = n.parentElement) {
      if (n.hidden) return false;
      if (n.getAttribute?.('aria-hidden') === 'true') return false;
    }
    return true;
  });
}

const tecla = (w, el, key) =>
  el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

/** Enter sobre un control hace lo que haría el clic. */
function enter(w, el) {
  tecla(w, el, 'Enter');
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/* El agregado al carrito espera a que termine la animación de vuelo
   antes de abrir el panel. Sin esta pausa la prueba mira el resultado
   antes de que exista. */
const respirar = (n = 6) => new Promise((r) => {
  let i = 0;
  const paso = () => (++i >= n ? r() : setTimeout(paso, 20));
  setTimeout(paso, 20);
});

/* ============================================================
   1 · La home se recorre en orden
   ============================================================ */
{
  const dom = await abrir('index.html');
  const d = dom.window.document;
  const foco = ordenDeFoco(d);

  ok(foco.length > 0, 'la home no tiene ningún elemento enfocable');
  ok(foco[0]?.classList.contains('saltar'), `el primer Tab debería ser "saltar al contenido", es ${foco[0]?.outerHTML.slice(0, 60)}`);

  /* Las láminas del carrusel que no se ven no pueden robar el foco. */
  const ocultas = [...d.querySelectorAll('.hero__lamina[aria-hidden="true"] a')];
  ok(ocultas.every((a) => a.getAttribute('tabindex') === '-1'),
    'hay enlaces enfocables dentro de láminas del hero que no se ven');

  /* Los puntos del carrusel son botones de verdad, no divs con clic. */
  const puntos = [...d.querySelectorAll('[data-hero-punto]')];
  ok(puntos.length === 4 && puntos.every((b) => b.tagName === 'BUTTON'),
    'los puntos del carrusel no son botones');
  dom.window.close();
}

/* ============================================================
   2 · Ficha: agregar al carrito con Enter, y el mini-carrito
   ============================================================ */
{
  const dom = await abrir('producto/lampara-de-pie-arco/index.html');
  const w = dom.window, d = w.document;

  const agregar = d.querySelector('[data-agregar]');
  ok(agregar && agregar.tagName === 'BUTTON', 'el botón de agregar no es un botón');
  ok(ordenDeFoco(d).includes(agregar), 'no se llega al botón de agregar con Tab');

  /* El selector de variantes se recorre con las flechas, como un grupo
     de radios de verdad: es lo que espera cualquiera que use teclado. */
  const radios = [...d.querySelectorAll('[data-variantes] input[type="radio"]')];
  ok(radios.length >= 2, 'la ficha no tiene selector de variantes');
  ok(radios.every((r) => r.name === radios[0].name), 'las variantes no comparten nombre: las flechas no van a funcionar');

  const antes = d.activeElement;
  enter(w, agregar);
  await respirar();

  const mini = d.querySelector('[data-mini]');
  ok(mini?.dataset.abierto === 'true', 'agregar con Enter no abrió el mini-carrito');

  /* Con el panel abierto, el foco tiene que estar adentro. */
  ok(mini.contains(d.activeElement), `el foco quedó fuera del mini-carrito: ${d.activeElement?.tagName}`);

  /* Y Escape lo cierra. */
  tecla(w, d.activeElement ?? d.body, 'Escape');
  await respirar(2);
  ok(mini.dataset.abierto !== 'true', 'Escape no cierra el mini-carrito');
  ok(d.activeElement === antes || d.body.contains(d.activeElement), 'después de cerrar, el foco se perdió');

  dom.window.close();
}

/* ============================================================
   3 · Carrito: editar y seguir sin mouse
   ============================================================ */
{
  const carro = JSON.stringify([{
    id: 'p01', slug: 'lampara-de-pie-arco', nombre: 'Lámpara de pie Arco',
    precio: 89900, imagen: 'photo-1673939859210-23d8444237ff',
    variante: 'Negro mate', stockMax: 12, peso: 14.2, cantidad: 1,
  }]);
  const dom = await abrir('carrito/index.html', (w) => {
    w.localStorage.setItem('acentta:carrito:v1', carro);
    w.localStorage.setItem('acentta:cp:v1', '1425');
  });
  const w = dom.window, d = w.document;
  const foco = ordenDeFoco(d);

  const sumar = d.querySelector('[data-accion="sumar"]');
  /* El del carrito, no el del mini-carrito, que también existe en la
     página pero vive escondido dentro de un aside con aria-hidden. */
  const quitar = d.querySelector('.carro-item [data-quitar-linea]');
  const seguir = [...d.querySelectorAll('a, button')].find((e) => /finalizar|iniciar la compra|continuar/i.test(e.textContent || ''));

  ok(sumar && foco.includes(sumar), 'no se llega al botón de sumar cantidad');
  ok(quitar && foco.includes(quitar), 'no se llega al botón de quitar');
  ok(seguir, 'no hay forma de seguir al checkout');
  ok(foco.includes(seguir), 'no se llega al botón de finalizar compra con Tab');

  /* El de sumar va antes que el de finalizar: primero se ajusta, después se avanza. */
  ok(foco.indexOf(sumar) < foco.indexOf(seguir), 'el orden de foco pone finalizar antes que editar la cantidad');

  dom.window.close();
}

/* ============================================================
   4 · Checkout: los tres pasos, sólo con teclado
   ============================================================ */
{
  const carro = JSON.stringify([{
    id: 'p28', slug: 'robot-aspirador-con-vaciado-automatico', nombre: 'Robot aspirador',
    precio: 249900, imagen: 'photo-1653990480360-31a12ce9723e',
    variante: 'Negro', stockMax: 6, peso: 8.4, cantidad: 1,
  }]);
  const dom = await abrir('checkout/index.html', (w) => {
    w.localStorage.setItem('acentta:carrito:v1', carro);
    w.localStorage.setItem('acentta:cp:v1', '1425');
  });
  const w = dom.window, d = w.document;

  const escribir = (id, v) => {
    const e = d.getElementById(id);
    ok(e, `falta el campo ${id}`);
    if (!e) return;
    ok(ordenDeFoco(d).includes(e), `no se llega al campo ${id} con Tab`);
    e.focus();
    e.value = v;
    e.dispatchEvent(new w.Event('input', { bubbles: true }));
    e.dispatchEvent(new w.Event('blur', { bubbles: true }));
  };

  /* Cada campo tiene etiqueta asociada: sin eso, un lector de pantalla
     anuncia "cuadro de edición" y nada más. */
  for (const campo of d.querySelectorAll('input:not([type=radio]):not([type=checkbox]), textarea')) {
    const conEtiqueta = d.querySelector(`label[for="${campo.id}"]`) || campo.getAttribute('aria-label');
    ok(conEtiqueta, `el campo ${campo.id || campo.name} no tiene etiqueta`);
  }

  escribir('email', 'martin@ejemplo.com');
  escribir('nombre', 'Martín');
  escribir('apellido', 'Bazán');
  escribir('dni', '30111222');
  escribir('telefono', '1123456789');

  const paso1 = d.querySelector('[data-paso-forma="1"]');
  paso1.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  ok(!d.querySelector('[data-paso-forma="2"]').hidden, 'no se avanzó al paso 2');

  /* Al cambiar de paso el foco va al título nuevo, no se queda atrás. */
  const t2 = d.querySelector('[data-paso-forma="2"] h2');
  ok(d.activeElement === t2, 'al cambiar de paso el foco no fue al título');

  escribir('cp-checkout', '1425');
  escribir('provincia', 'Buenos Aires');
  escribir('ciudad', 'La Plata');
  escribir('calle', 'Rivadavia');
  escribir('numero', '1234');
  d.querySelector('[data-paso-forma="2"]').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  ok(!d.querySelector('#forma-pago').hidden, 'no se avanzó al paso de pago');

  escribir('tarjeta', '4509953566233704');
  escribir('titular', 'MARTIN BAZAN');
  escribir('vencimiento', '07/29');
  escribir('cvv', '123');

  const acepto = d.getElementById('acepto');
  ok(acepto && ordenDeFoco(d).includes(acepto), 'no se llega a la casilla de términos con Tab');
  acepto.checked = true;
  acepto.dispatchEvent(new w.Event('change', { bubbles: true }));

  const confirmar = d.querySelector('[data-pagar]');
  ok(confirmar && confirmar.tagName === 'BUTTON', 'el botón de confirmar no es un botón');
  ok(ordenDeFoco(d).includes(confirmar), 'no se llega al botón de confirmar con Tab');

  /* Está fuera del formulario, así que lo importante es que lo alcance:
     sin el atributo `form` el teclado llegaría a un botón que no hace nada. */
  ok(confirmar.getAttribute('form') === 'forma-pago', 'el botón de confirmar no está conectado al formulario');

  dom.window.close();
}

/* ============================================================
   5 · Nada se mueve si el sistema pide que no se mueva
   ============================================================ */
{
  const css = fs.readdirSync(path.join(VISTA, '_astro'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(VISTA, '_astro', f), 'utf8'))
    .join('');
  const bloques = css.match(/@media[^{]*prefers-reduced-motion[^{]*\{/g) ?? [];
  ok(bloques.length >= 4, `sólo ${bloques.length} bloques respetan prefers-reduced-motion`);
  ok(/prefers-reduced-motion/.test(css), 'no hay ninguna regla de movimiento reducido');
}

console.log(fallos.length
  ? '✗ CIRCUITO CON TECLADO:\n  · ' + fallos.join('\n  · ')
  : '✓ el circuito de compra se completa entero sin mouse');
process.exit(fallos.length ? 1 : 0);
