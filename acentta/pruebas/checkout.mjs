/**
 * acentta · el checkout, con el teléfono en la mano
 * ---------------------------------------------------------------
 * Esta prueba nace de un defecto que estuvo publicado y que ninguna
 * de las otras cuatro auditorías podía ver.
 *
 * En pantalla angosta el resumen del pedido arranca plegado: mostrar
 * la lista de productos mientras se completa un formulario es un
 * estorbo. El problema era qué se plegaba junto con la lista. El
 * botón «Confirmar compra» y el plan de cuotas vivían adentro del
 * bloque plegable, así que en un teléfono no existían: para poder
 * pagar había que descubrir un botón que dice «Ver el detalle».
 *
 * Un callejón sin salida en la última pantalla del embudo, invisible
 * para axe —el botón está en el HTML, correctamente etiquetado— e
 * invisible para la prueba de teclado, que corre con el ancho de
 * escritorio, donde el resumen nunca se pliega.
 *
 * Lo que se verifica, en los dos anchos:
 *
 *   1. Que se pueda pagar sin desplegar nada.
 *   2. Que el código postal y la provincia muestren un ejemplo y no
 *      un valor: un ejemplo se borra solo al escribir.
 *   3. Que la provincia no se autocomplete con la zona tarifaria.
 *      «Centro y Cuyo» no es una provincia, y terminaba en la
 *      dirección del pedido.
 *   4. Que la tarjeta muestre lo elegido —entrega, dirección, pago—
 *      y no sólo el precio.
 *   5. Que cada fila aparezca recién cuando hay algo que decir.
 *
 * Corre sobre la vista previa, que es la única versión con los
 * guiones en un formato que jsdom puede ejecutar.
 *
 *     node pruebas/checkout.mjs
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

const CARRO = JSON.stringify([{
  id: 'p01', slug: 'lampara-de-pie-arco',
  nombre: 'Lámpara de pie Arco con base de mármol de Carrara',
  precio: 89900, imagen: 'photo-1673939859210-23d8444237ff',
  variante: 'Negro mate', stockMax: 12, peso: 14.2, cantidad: 1,
}]);

/** Abre el checkout simulando un ancho de pantalla. */
function abrir(esMovil) {
  return new Promise((res) => {
    const dom = new JSDOM(fs.readFileSync(path.join(VISTA, 'checkout', 'index.html'), 'utf8'), {
      runScripts: 'dangerously',
      url: 'https://acentta.test/checkout/',
      pretendToBeVisual: true,
      beforeParse(w) {
        w.localStorage.setItem('acentta:carrito:v1', CARRO);
        w.localStorage.setItem('acentta:cp:v1', '1425');
        /* La única diferencia entre las dos corridas. El resumen se
           pliega con esta consulta y con ninguna otra cosa. */
        w.matchMedia = (q) => ({
          matches: esMovil && /max-width:\s*899/.test(q),
          addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
        });
        w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
        w.scrollTo = () => {};
        w.HTMLElement.prototype.scrollIntoView = () => {};
      },
    });
    dom.window.addEventListener('load', () => res(dom));
  });
}

/** Devuelve el ancestro que lo esconde, o null si se ve. */
function tapadoPor(el) {
  for (let n = el; n; n = n.parentElement) if (n.hidden) return n;
  return null;
}

for (const esMovil of [true, false]) {
  const donde = esMovil ? 'móvil' : 'escritorio';
  const dom = await abrir(esMovil);
  const d = dom.window.document;
  const escribir = (id, v) => {
    const e = d.querySelector(`#${id}`);
    if (!e) { ok(false, `${donde} · no existe el campo #${id}`); return; }
    e.value = v;
    e.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const texto = (s) => d.querySelector(s)?.textContent?.trim() ?? '';
  const enviar = (n) => d.querySelector(`[data-paso-forma="${n}"]`)
    .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  /* ---- 2 · Ejemplo, no valor ---- */
  for (const [id, ejemplo] of [['cp-checkout', '5000'], ['provincia', 'Córdoba']]) {
    const campo = d.querySelector(`#${id}`);
    ok(campo?.value === '', `${donde} · #${id} arranca con el valor «${campo?.value}» escrito; tiene que arrancar vacío`);
    ok(campo?.placeholder === ejemplo, `${donde} · #${id} muestra «${campo?.placeholder}» de ejemplo y debería mostrar «${ejemplo}»`);
  }

  /* ---- 5 · Nada de rótulos vacíos en el primer paso ---- */
  ok(d.querySelector('[data-ck-datos]')?.hidden === true,
    `${donde} · la tarjeta muestra las filas de «lo elegido» antes de que haya nada elegido`);
  ok(d.querySelector('[data-ck-accion]')?.hidden === true,
    `${donde} · «Confirmar compra» aparece en el paso 1, donde todavía no hay nada que confirmar`);

  /* ---- Paso 1 ---- */
  for (const [id, v] of [['email', 'martin@ejemplo.com'], ['nombre', 'Martín'],
    ['apellido', 'Bazán'], ['dni', '30111222'], ['telefono', '3511234567']]) escribir(id, v);
  enviar(1);

  /* ---- Paso 2 ---- */
  escribir('cp-checkout', '5000');
  ok(d.querySelector('#provincia').value === '',
    `${donde} · escribir el código postal autocompletó la provincia con «${d.querySelector('#provincia').value}». La zona tarifaria no es una provincia.`);
  for (const [id, v] of [['provincia', 'Córdoba'], ['ciudad', 'Córdoba'],
    ['calle', 'Av. Colón'], ['numero', '1234'], ['piso', '3° B']]) escribir(id, v);
  enviar(2);

  /* ---- 1 · Se puede pagar sin desplegar nada ---- */
  const accion = d.querySelector('[data-ck-accion]');
  const tapa = tapadoPor(accion);
  ok(!tapa, `${donde} · «Confirmar compra» está tapado por <${tapa?.tagName.toLowerCase()} class="${tapa?.className}">. En un teléfono eso deja la compra sin salida.`);
  ok(!tapadoPor(d.querySelector('[data-ck-cuotas]')), `${donde} · el plan de cuotas está tapado`);
  ok(!tapadoPor(d.querySelector('[data-ck-total]')) || !tapadoPor(d.querySelector('[data-ck-total-2]')),
    `${donde} · no se ve el total por ningún lado`);

  /* El botón manda el formulario del paso 3 aunque viva afuera. */
  const boton = d.querySelector('[data-pagar]');
  ok(boton?.getAttribute('form') === 'forma-pago',
    `${donde} · el botón de confirmar vive fuera del formulario y no lo declara con el atributo form: no enviaría nada`);

  /* ---- 4 · Lo elegido ---- */
  ok(d.querySelector('[data-ck-datos]')?.hidden === false, `${donde} · la tarjeta no muestra lo elegido`);
  ok(texto('[data-ck-metodo-envio]') === 'A domicilio', `${donde} · entrega: «${texto('[data-ck-metodo-envio]')}»`);
  const dir = texto('[data-ck-direccion]');
  for (const parte of ['Av. Colón 1234', '3° B', 'Córdoba', 'CP 5000']) {
    ok(dir.includes(parte), `${donde} · a la dirección le falta «${parte}»: ${dir}`);
  }
  ok(/^Tarjeta/.test(texto('[data-ck-metodo-pago]')), `${donde} · pago: «${texto('[data-ck-metodo-pago]')}»`);
  ok(/Llega/.test(texto('[data-ck-entrega]')), `${donde} · no dice cuándo llega`);

  /* Cambiar de forma de pago tiene que reflejarse ahí mismo. */
  const transferencia = d.querySelector('[name="metodo-pago"][value="transferencia"]');
  transferencia.checked = true;
  transferencia.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  ok(/[Tt]ransferencia/.test(texto('[data-ck-metodo-pago]')),
    `${donde} · se eligió transferencia y la tarjeta sigue diciendo «${texto('[data-ck-metodo-pago]')}»`);

  /* Y el retiro en sucursal, también. */
  const sucursal = d.querySelector('[name="metodo-envio"][value="sucursal"]');
  sucursal.checked = true;
  sucursal.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  ok(/sucursal/i.test(texto('[data-ck-metodo-envio]')),
    `${donde} · se eligió retiro en sucursal y la tarjeta dice «${texto('[data-ck-metodo-envio]')}»`);

  /* ---- 6 · Apretar «Confirmar compra» tiene que hacer algo ----

     Esta comprobación nace de un defecto que introduje yo. El
     checkout intenta cobrar de verdad llamando a una función de
     servidor, y esa función no existe ni en la vista previa local
     —que se abre como archivo— ni en un despliegue anterior a que la
     agregáramos. La primera versión trataba eso como un error y
     mostraba un aviso rojo en lugar de seguir por el camino simulado.

     Visto desde afuera: «aprieto confirmar y no pasa nada». El peor
     defecto posible en el último botón del embudo, y ninguna de las
     otras pruebas lo veía porque ninguna apretaba el botón.

     Acá se simula lo mismo que pasa en esos dos escenarios: `fetch`
     falla. Lo que tiene que quedar es un pedido guardado —la prueba
     de que el camino simulado corrió— y el botón utilizable. */
  /* ---- 6.a · Un envío bloqueado tiene que decir por qué ----

     Sin tildar los términos, el envío se corta. Eso está bien; lo que
     estaba mal era que se cortara en silencio: una clase sin reglas
     de estilo y el foco en una casilla oculta. Nada visible, y el
     botón de confirmar está lejos de la casilla. El síntoma era
     «aprieto Confirmar compra y no pasa nada», y era literal. */
  {
    d.querySelector('#acepto').checked = false;
    dom.window.localStorage.removeItem('acentta:pedido:v1');
    enviar(3);
    await new Promise((r) => setTimeout(r, 40));

    const aviso = d.querySelector('.aviso-pago')?.textContent?.trim() ?? '';
    ok(/término/i.test(aviso),
      `${donde} · sin aceptar los términos, el envío se corta sin decir por qué. Aviso: «${aviso || '(ninguno)'}»`);
    ok(d.querySelector('.acuerdo')?.classList.contains('acuerdo--error'),
      `${donde} · la casilla de términos no queda marcada`);
    ok(!dom.window.localStorage.getItem('acentta:pedido:v1'),
      `${donde} · se armó un pedido sin aceptar los términos`);
  }

  {
    const marcaAntes = d.querySelector('#acepto');
    marcaAntes.checked = true;
    marcaAntes.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    dom.window.localStorage.removeItem('acentta:pedido:v1');
    /* Sin función del otro lado, como en la vista previa local. */
    dom.window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));

    enviar(3);
    /* El camino simulado espera 1,4 s antes de ir a la confirmación;
       el pedido se guarda antes de esa espera. */
    await new Promise((r) => setTimeout(r, 120));

    const guardado = dom.window.localStorage.getItem('acentta:pedido:v1');
    ok(guardado, `${donde} · sin cobro conectado, «Confirmar compra» no dejó ningún pedido: el camino simulado no corrió`);

    const boton = d.querySelector('[data-pagar]');
    const avisoRojo = d.querySelector('.aviso-pago')?.textContent?.trim();
    ok(!avisoRojo, `${donde} · apareció un error donde debía seguir la simulación: «${avisoRojo}»`);
    ok(!(boton.disabled && !guardado), `${donde} · el botón quedó deshabilitado y no pasó nada`);
  }

  dom.window.close();
}

console.log('\n=== CHECKOUT · móvil y escritorio ===');
if (fallos.length) {
  console.log(`  ${fallos.length} problema(s):`);
  for (const f of fallos) console.log(`   · ${f}`);
  process.exit(1);
}
console.log('  se puede pagar sin desplegar nada, en los dos anchos');
console.log('  código postal y provincia muestran ejemplo, no valor');
console.log('  la tarjeta muestra entrega, dirección, pago y fecha\n');
console.log('✓ el checkout responde igual en teléfono que en escritorio\n');
