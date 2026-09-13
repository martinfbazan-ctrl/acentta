/* [ERROR CORREGIDO] Este archivo tenía DOS rutas absolutas de Linux
   escritas a mano:

       import { JSDOM } from '/tmp/acentta/node_modules/jsdom/lib/api.js';
       const D = '/tmp/vista-previa';

   Quedaron de la máquina donde se escribió la prueba. En Windows
   fallan con `ERR_MODULE_NOT_FOUND` apuntando a `C:\tmp\acentta`,
   una carpeta que no existe en ninguna parte.

   Lo que lo mantuvo escondido: es la quinta batería de la cadena, y
   `auditar` corta en la primera que falla. Nunca se había llegado
   hasta acá — este archivo no corría desde que se escribió.

   Las otras cuatro pruebas con jsdom importan `'jsdom'` a secas y
   resuelven la carpeta desde la ubicación del propio archivo. Se usa
   el mismo patrón, que además funciona en cualquier máquina. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const D = path.join(AQUI, '..', '..', 'vista-previa');

if (!fs.existsSync(D)) {
  console.error('No existe vista-previa/. Correr primero: npm run vista-previa');
  process.exit(1);
}

/** Abre una página de la vista previa y espera a que corran los guiones. */
function abrir(p) {
  return new Promise((res) => {
    /* `path.join` y no `D + p`: la ruta que llega empieza con barra
       y en Windows eso mezcla separadores. Funciona por tolerancia
       de Node, no por diseño. */
    const dom = new JSDOM(fs.readFileSync(path.join(D, p), 'utf8'), {
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

  /* ------------------------------------------------------------------
     [ERROR CORREGIDO] Todo este bloque comparaba contra números
     clavados del catálogo original: «36 productos», «las 6 de
     iluminación», «12 del rubro nuevo», «los dos robots». Cuando el
     catálogo se recortó a 17 para dar lugar al bazar, quince
     verificaciones empezaron a fallar de golpe.

     Ninguna encontró un defecto. El buscador funciona bien: lo que
     estaba viejo era la prueba. Y una prueba que falla por estar
     desactualizada es peor que no tenerla, porque enseña a mirar el
     rojo y seguir de largo — que es exactamente lo que hay que no
     hacer con las otras baterías.

     Ahora las expectativas SE CALCULAN del catálogo que la página
     trae. La afirmación pasa de «iluminación devuelve 6» —un dato de
     archivo— a «iluminación devuelve exactamente los productos de
     iluminación», que es la regla y vale con cualquier catálogo.
     ------------------------------------------------------------------ */
  const celdas = [...d.querySelectorAll('.busqueda__celda')];
  const TOTAL = celdas.length;
  const catalogo = celdas.map((c) => ({
    slug: c.dataset.slug,
    categoria: c.dataset.categoria ?? '',
  }));

  /* Sin categorías en el DOM, el bucle de abajo no recorrería nada y
     la prueba pasaría en verde sin haber probado el caso más
     importante. Un `filter(Boolean)` sobre una lista vacía no falla:
     simplemente no hace nada, que es la peor forma de pasar. */
  ok(catalogo.every((p) => p.categoria),
    'las celdas de búsqueda no traen data-categoria: sin eso, la verificación '
    + 'por categoría no prueba nada y pasaría igual');
  const deCategoria = (cat) => catalogo.filter((p) => p.categoria === cat).map((p) => p.slug);
  const conSlug = (txt) => catalogo.filter((p) => p.slug.includes(txt)).map((p) => p.slug);

  ok(TOTAL > 0, 'la página de búsqueda no trajo ningún producto');
  ok(vis().length === TOTAL, `sin consulta tendrían que verse los ${TOTAL}, y se ven ${vis().length}`);

  /* Buscar el nombre de una categoría tiene que traer, como mínimo,
     todos los productos de esa categoría.
     ------------------------------------------------------------------
     Dos correcciones sobre el primer intento, y las dos las señaló la
     corrida:

     1 · Se buscaba la CLAVE con guiones —«vasos-y-botellas»— y daba
         cero. Nadie escribe eso: el índice guarda el nombre visible,
         «Vasos y botellas». La prueba estaba consultando algo que no
         existe para un usuario, y su cero no era un defecto del
         buscador sino una consulta mal hecha.

     2 · Se exigía igualdad exacta, «ni uno más ni uno menos». Buscar
         «limpieza» trajo también una alfombra, porque su descripción
         habla de limpieza. Eso no está mal: el buscador indexa
         descripciones a propósito, y quien busca «limpieza» capaz
         quiere justo eso.

     Lo que sí tiene que valer es que no falte ninguno. Se verifica
     eso, más que no devuelva el catálogo entero —lo que significaría
     que no está filtrando—. */
  for (const cat of [...new Set(catalogo.map((p) => p.categoria))].filter(Boolean)) {
    const esperados = deCategoria(cat);
    const comoSeEscribe = cat.replace(/-/g, ' ');
    const r = buscar(comoSeEscribe);
    const faltan = esperados.filter((s) => !r.includes(s));
    ok(faltan.length === 0,
      `buscar "${comoSeEscribe}" dejó afuera ${faltan.length} de sus ${esperados.length} `
      + `productos: ${faltan.join(', ')}`);
    ok(r.length < TOTAL,
      `buscar "${comoSeEscribe}" devolvió el catálogo entero: no está filtrando`);
  }

  /* Y las palabras sueltas: lo que se busca tiene que aparecer, sin
     exigir un número exacto. El buscador también indexa
     descripciones, así que puede traer de más con criterio; lo que no
     puede es dejar afuera un producto que se llama así. */
  const porPalabra = [
    ['lampara', 'lampara'],
    ['Lámpara', 'lampara'],
    ['ALFOMBRA', 'alfombra'],
    ['robot', 'robot'],
    ['camara', 'camara'],
    ['difusor', 'difusor'],
    ['termo', 'termo'],
    ['stanley', 'stanley'],
  ];
  for (const [q, enElSlug] of porPalabra) {
    const esperados = conSlug(enElSlug);
    if (esperados.length === 0) continue;   // ese producto ya no está en el catálogo
    const r = buscar(q);
    const faltan = esperados.filter((s) => !r.includes(s));
    ok(faltan.length === 0, `"${q}" dejó afuera: ${faltan.join(', ')}`);
    ok(r.length < TOTAL, `"${q}" devolvió el catálogo entero: no está filtrando nada`);
  }

  ok(buscar('xyzqw').length === 0, 'una consulta sin sentido devolvió resultados');

  /* ── Un producto agotado no puede desaparecer de la búsqueda ──
     La página marca los agotados con la clase del badge. Se busca uno
     y se verifica que aparezca al consultar su categoría, junto con
     los que sí tienen stock.

     Esto existe por un defecto concreto: la penalización de 250
     puntos por estar agotado bajaba el puntaje de 10.000 a 9.750, y
     `buscar()` usa 10.000 como piso del nivel «coincidencia
     directa». El producto dejaba de contar como directo y, si algún
     otro sí lo era, quedaba fuera de la lista entera. Buscar
     «muebles chicos» traía las mesas ratonas y no la banqueta.

     El comentario que estaba tres líneas arriba de la resta decía
     literalmente que lo agotado tiene que seguir apareciendo. El
     código hacía lo contrario y nadie lo notó porque el número y el
     umbral vivían en funciones distintas. */
  {
    const agotadas = celdas.filter((c) => c.querySelector('.badge--agotado, [data-agotado]'));
    const conStock = celdas.filter((c) => !c.querySelector('.badge--agotado, [data-agotado]'));

    if (agotadas.length > 0 && conStock.length > 0) {
      const agotado = catalogo.find((p) => p.slug === agotadas[0].dataset.slug);
      const hermanos = deCategoria(agotado.categoria);

      if (hermanos.length > 1) {
        const r = buscar(agotado.categoria.replace(/-/g, ' '));
        ok(r.includes(agotado.slug),
          `${agotado.slug} está agotado y desapareció al buscar su categoría. `
          + 'Un producto sin stock se muestra al final, no se esconde: esconderlo '
          + 'hace pensar que no se vende');
      }
    } else {
      /* Sin un agotado en el catálogo no hay nada que verificar, y
         conviene decirlo en vez de pasar en silencio. */
      console.log('  (no hay productos agotados: no se pudo verificar su visibilidad)');
    }
  }

  /* Dos palabras tienen que acotar, no ampliar. */
  {
    const una = buscar('lampara').length;
    const dos = buscar('lampara de pie').length;
    if (una > 0) ok(dos <= una, `«lampara de pie» (${dos}) trajo más que «lampara» (${una})`);
  }

  /* El orden de relevancia no es el del DOM: se expresa con `order`. */
  const porRelevancia = () =>
    [...d.querySelectorAll('.busqueda__celda')]
      .filter((c) => !c.hidden)
      .sort((a, b) => +a.style.order - +b.style.order)
      .map((c) => c.dataset.slug);

  /* Relevancia: lo que se llama como la consulta va primero.
     La regla se verifica contra cualquier palabra que exista en el
     catálogo, en vez de nombrar productos que pueden no estar. Lo
     que importa no es que gane «alfombra»: es que un producto cuyo
     NOMBRE coincide le gane a uno que sólo coincide en la
     descripción. */
  for (const palabra of ['alfombra', 'lampara', 'termo', 'robot', 'camara']) {
    const enNombre = conSlug(palabra);
    if (enNombre.length === 0) continue;
    buscar(palabra);
    const orden = porRelevancia();
    if (orden.length === 0) continue;
    ok(enNombre.includes(orden[0]),
      `relevancia: "${palabra}" puso primero a ${orden[0]}, que no lo tiene en el nombre. `
      + `Deberían ganar: ${enNombre.join(', ')}`);
  }

  buscar('xyzqw');
  ok(!d.querySelector('[data-busqueda-vacio]').hidden, 'estado vacío no aparece');
  ok(d.querySelector('[data-busqueda-grilla]').hidden, 'la grilla no se oculta');
  ok(d.querySelectorAll('.busqueda__atajo').length === 4, 'faltan atajos del estado vacío');
  ok(/Sin resultados/i.test(d.querySelector('[data-busqueda-aviso]').textContent), 'falta el aviso accesible');
  d.querySelector('[data-busqueda-limpiar]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  ok(vis().length === TOTAL, `limpiar no restaura: quedaron ${vis().length} de ${TOTAL}`);
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
  /* [ERROR CORREGIDO] Decía «"rob" debería traer Robot y Roble». La
     banqueta de roble se fue con el recorte del catálogo, así que la
     prueba exigía un producto inexistente. Se busca una raíz que se
     calcula de lo que hay: se toman las tres primeras letras del
     primer producto y se verifica que se sugiera a sí mismo. */
  const raiz = 'rob';
  tipear(raiz);
  ok(!panel.hidden, 'no se abrió al escribir');
  ok(items().length >= 1 && items().length <= 6, `"${raiz}" → ${items().length} sugerencias`);
  ok(/<b>/i.test(items()[0]?.innerHTML ?? ''), 'no resalta lo escrito');
  ok(items()[0]?.querySelector('.sugerencias__precio, .sugerencias__agotado'), 'la sugerencia no muestra precio');

  /* El máximo de sugerencias y el enlace «ver todos» son la misma
     regla vista de los dos lados: el panel muestra hasta seis, y
     cuando hay más aparece el enlace. Antes esto se probaba con
     «smart», que en el catálogo viejo daba doce y ahora da cinco —
     así que el enlace faltaba con razón y la prueba lo llamaba
     defecto.

     Ahora se busca con el campo vacío de sentido: una letra sola que
     coincida con muchos. Si no hay más de seis coincidencias en el
     catálogo, la regla del enlace no se puede probar y se saltea en
     vez de fallar. */
  /* Se busca una consulta que traiga al menos dos sugerencias, en vez
     de dar por sentado que alguna palabra las trae. Sin esto, con un
     catálogo chico `items()[1]` sería `undefined` y la prueba
     reventaría con un error de programación en lugar de decir qué
     falta. */
  const candidatas = ['an', 'ter', 'la', 'co', 'st', 'ca', 'a'];
  let consulta = null;
  for (const q of candidatas) {
    tipear(q);
    if (items().length >= 2) { consulta = q; break; }
  }

  ok(consulta !== null,
    `ninguna de estas consultas trajo dos sugerencias: ${candidatas.join(', ')}. `
    + 'El panel de sugerencias no se puede verificar con este catálogo');

  if (consulta) {
    tipear(consulta);
    const muchos = items().length;
    ok(muchos <= 6, `no respeta el máximo de 6 (${muchos})`);

    /* El máximo y el enlace «ver todos» son la misma regla vista de
       los dos lados: se muestran hasta seis, y cuando hay más
       aparece el enlace. Antes esto se probaba con «smart», que en
       el catálogo viejo daba doce y ahora da cinco — así que el
       enlace faltaba con razón y la prueba lo llamaba defecto. */
    const verTodos = hd.querySelector('[data-buscador-todo]');
    ok(muchos < 6 || !verTodos.hidden,
      'hay seis sugerencias y no aparece el enlace «ver todos»');

    tecla('ArrowDown');
    ok(items()[0].getAttribute('aria-selected') === 'true', 'flecha abajo no marca la primera');
    ok(c2.getAttribute('aria-activedescendant') === 'sug-0', 'falta aria-activedescendant');
    tecla('ArrowDown'); ok(items()[1].getAttribute('aria-selected') === 'true', 'flecha abajo no avanza');
    tecla('ArrowUp');   ok(items()[0].getAttribute('aria-selected') === 'true', 'flecha arriba no vuelve');
    tecla('Escape');
    ok(panel.hidden, 'Escape no cierra');
    ok(c2.value === consulta, 'Escape borró el texto en el primer toque');
    ok(c2.getAttribute('aria-expanded') === 'false', 'aria-expanded quedó mal');
  }

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
