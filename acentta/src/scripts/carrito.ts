/**
 * acentta · comportamiento del carrito
 * ---------------------------------------------------------------
 * Engancha los botones de agregar, mantiene el contador del
 * encabezado, dibuja el mini-carrito y hace volar la imagen.
 * Se carga en todas las páginas: el carrito tiene que estar vivo
 * en la home, en el listado y en la ficha.
 */

import {
  agregar, leer, quitar, reponer, cambiarCantidad,
  cantidadTotal, subtotal, suscribir, resumen,
  type ItemCarrito,
} from '@lib/carrito';
import { precio as fPrecio, estadoEnvioGratis } from '@lib/formato';
import { UMBRAL_ENVIO_GRATIS } from '@tipos/catalogo';

const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   CONTADOR DEL ENCABEZADO
   ============================================================ */
function pintarContador(items: ItemCarrito[]) {
  const total = cantidadTotal(items);
  for (const enlace of document.querySelectorAll<HTMLAnchorElement>('[data-carrito-enlace]')) {
    const cuenta = enlace.querySelector<HTMLElement>('[data-bolsa-cuenta]');
    if (cuenta) {
      /* Más de 99 no entra en la bolsa ni le sirve a nadie: lo que
         importa a esa altura es "muchos", no cuántos exactamente. */
      const texto = total === 0 ? '' : total > 99 ? '99+' : String(total);
      cuenta.textContent = texto;
      cuenta.dataset.largo = String(texto.length);
    }
    enlace.setAttribute(
      'aria-label',
      `Carrito, ${total} ${total === 1 ? 'producto' : 'productos'}`
    );

    /* La bolsa sólo llama la atención si hay algo que pagar. Animar
       un carrito vacío es pedir una acción imposible. */
    if (total > 0) enlace.dataset.conItems = 'true';
    else delete enlace.dataset.conItems;
  }
}

/* ============================================================
   MINI-CARRITO
   ============================================================ */
const mini = document.querySelector<HTMLElement>('[data-mini]');
const veloMini = document.querySelector<HTMLElement>('[data-velo-carrito]');
let ultimoFoco: HTMLElement | null = null;

function abrirMini() {
  if (!mini || !veloMini) return;
  ultimoFoco = document.activeElement as HTMLElement;
  veloMini.hidden = false;
  requestAnimationFrame(() => veloMini.dataset.visible = 'true');
  mini.dataset.abierto = 'true';
  mini.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  mini.querySelector<HTMLElement>('[data-cerrar-mini]')?.focus();
}

function cerrarMini() {
  if (!mini || !veloMini) return;
  delete mini.dataset.abierto;
  mini.setAttribute('aria-hidden', 'true');
  delete veloMini.dataset.visible;
  window.setTimeout(() => { veloMini.hidden = true; }, 220);
  document.body.style.overflow = '';
  ultimoFoco?.focus();
}

function pintarMini(items: ItemCarrito[]) {
  if (!mini) return;

  const lista = mini.querySelector<HTMLElement>('[data-mini-lista]')!;
  const vacio = mini.querySelector<HTMLElement>('[data-mini-vacio]')!;
  const pie = mini.querySelector<HTMLElement>('[data-mini-pie]')!;
  const envio = mini.querySelector<HTMLElement>('[data-mini-envio]')!;
  const cuenta = mini.querySelector<HTMLElement>('[data-mini-cuenta]')!;

  cuenta.textContent = String(cantidadTotal(items));

  const hayItems = items.length > 0;
  lista.hidden = !hayItems;
  vacio.hidden = hayItems;
  pie.hidden = !hayItems;
  envio.hidden = !hayItems;

  if (!hayItems) return;

  lista.innerHTML = items.map((i) => `
    <article class="mini-item">
      <img class="mini-item__foto" src="https://images.unsplash.com/${i.imagen}?auto=format&fit=crop&w=200&q=72" alt="" width="68" height="85" loading="lazy" />
      <div class="mini-item__datos">
        <p class="mini-item__nombre"><a href="/producto/${i.slug}">${i.nombre}</a></p>
        ${i.variante ? `<p class="mini-item__variante">${i.variante}</p>` : ''}
        <p class="mini-item__variante">Cantidad: ${i.cantidad}</p>
        <div class="mini-item__pie">
          <span class="mini-item__precio">${fPrecio(i.precio * i.cantidad)}</span>
          <button class="mini-item__quitar" type="button" data-quitar="${i.id}" data-variante="${i.variante}">Quitar</button>
        </div>
      </div>
    </article>
  `).join('');

  for (const b of lista.querySelectorAll<HTMLButtonElement>('[data-quitar]')) {
    b.addEventListener('click', () => quitarConDeshacer(b.dataset.quitar!, b.dataset.variante!));
  }

  /* Barra de envío gratis */
  const sub = subtotal(items);
  const estado = estadoEnvioGratis(sub, UMBRAL_ENVIO_GRATIS);
  const caja = envio.querySelector<HTMLElement>('.envio-gratis')!;
  const texto = envio.querySelector<HTMLElement>('[data-mini-envio-texto]')!;
  const barra = envio.querySelector<HTMLElement>('[data-mini-barra]')!;
  const relleno = barra.querySelector<HTMLElement>('.envio-gratis__relleno')!;

  caja.dataset.logrado = String(estado.logrado);
  texto.innerHTML = estado.logrado
    ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M6.2 11.4 3.3 8.5l-1.1 1.1 4 4 7.6-7.6-1.1-1.1z"/></svg> Tienes envío gratis'
    : `Te faltan <b>${fPrecio(estado.falta)}</b> para el envío gratis`;
  barra.setAttribute('aria-valuenow', String(estado.progreso));
  relleno.style.setProperty('--progreso', `${estado.progreso}%`);

  /* Subtotal y aviso de envío */
  mini.querySelector<HTMLElement>('[data-mini-subtotal]')!.textContent = fPrecio(sub);
  const r = resumen(undefined, items);
  mini.querySelector<HTMLElement>('[data-mini-nota]')!.textContent = r.envioGratis
    ? 'Envío gratis incluido. El total no cambia en el checkout.'
    : 'El envío se calcula en el carrito, antes de pagar. Sin sorpresas en el último paso.';
}

/* ============================================================
   QUITAR CON DESHACER
   Un carrito sin deshacer castiga el error de un toque con el
   trabajo de volver a buscar el producto.
   ============================================================ */
export function quitarConDeshacer(id: string, variante: string) {
  const quitado = quitar(id, variante);
  if (!quitado) return;
  mostrarAviso(
    `Quitaste ${quitado.item.nombre}`,
    'Deshacer',
    () => reponer(quitado.item, quitado.posicion)
  );
}

/* ============================================================
   AVISOS (toast)
   ============================================================ */
let contenedorAvisos: HTMLElement | null = null;

export function mostrarAviso(titulo: string, accion?: string, alAccionar?: () => void) {
  if (!contenedorAvisos) {
    contenedorAvisos = document.createElement('div');
    contenedorAvisos.className = 'avisos';
    contenedorAvisos.setAttribute('role', 'status');
    contenedorAvisos.setAttribute('aria-live', 'polite');
    document.body.appendChild(contenedorAvisos);
  }

  const aviso = document.createElement('div');
  aviso.className = 'toast toast--exito';
  aviso.innerHTML = `
    <svg class="toast__icono" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
      <path d="M7.8 14.2 4 10.4l1.4-1.4 2.4 2.4 6.8-6.8L16 6z"/>
    </svg>
    <div class="toast__cuerpo">
      <p class="toast__titulo">${titulo}</p>
      ${accion ? `<button class="toast__accion" type="button">${accion}</button>` : ''}
    </div>`;

  contenedorAvisos.appendChild(aviso);

  const cerrar = () => { aviso.style.opacity = '0'; window.setTimeout(() => aviso.remove(), 200); };
  const reloj = window.setTimeout(cerrar, 6000);

  aviso.querySelector('.toast__accion')?.addEventListener('click', () => {
    window.clearTimeout(reloj);
    alAccionar?.();
    cerrar();
  });
}

/* ============================================================
   LA IMAGEN QUE VUELA
   Confirma dónde terminó lo que se agregó sin tapar la página.
   Con prefers-reduced-motion no ocurre: el mini-carrito abriéndose
   ya dice lo mismo.
   ============================================================ */
function pulsoDelIcono() {
  const destino = document.querySelector<HTMLElement>('[data-carrito-enlace]');
  if (!destino || sinMovimiento) return;
  destino.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.28)' },
      { transform: 'scale(1)' },
    ],
    { duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)' }
  );
}

/**
 * Devuelve una promesa que se resuelve cuando el vuelo terminó, para
 * que el mini-carrito se abra recién ahí. Abrirlo antes tapaba el
 * final del recorrido, que es justo la parte que explica dónde quedó
 * lo que se agregó.
 */
function volar(origen: HTMLElement): Promise<void> {
  return new Promise((listo) => {
    if (sinMovimiento) return listo();

    const foto = origen
      .closest('.ficha-prod, .ficha__cuerpo, .bento__destacado')
      ?.querySelector<HTMLImageElement>('img');
    const destino = document.querySelector<HTMLElement>('[data-carrito-enlace]');

    /* Si la foto todavía no terminó de cargar, no hay nada que volar:
       el clon saldría en blanco y sería peor que no animar. */
    if (!foto || !destino || !foto.complete || foto.naturalWidth === 0) return listo();

    const a = foto.getBoundingClientRect();
    const b = destino.getBoundingClientRect();
    if (a.width === 0) return listo();

    const clon = new Image();

    /* Acá estaba el error: al clonar el <img> con su srcset y su
       atributo sizes, el navegador reevaluaba sizes contra el tamaño
       nuevo del clon, elegía otra variante y arrancaba una descarga.
       El clon volaba vacío. Ahora se usa currentSrc — exactamente el
       archivo que el navegador ya decodificó — sin srcset ni sizes. */
    clon.src = foto.currentSrc || foto.src;
    clon.alt = '';

    Object.assign(clon.style, {
      position: 'fixed',
      left: `${a.left}px`,
      top: `${a.top}px`,
      width: `${a.width}px`,
      height: `${a.height}px`,
      objectFit: 'cover',
      borderRadius: '10px',
      boxShadow: '0 10px 30px rgba(60,42,22,.28)',
      zIndex: '90',
      pointerEvents: 'none',
      margin: '0',
      willChange: 'transform, opacity',
    });
    document.body.appendChild(clon);

    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);

    const vuelo = clon.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(.55)`, opacity: .95, offset: .55 },
        { transform: `translate(${dx}px, ${dy}px) scale(.14)`, opacity: 0, offset: 1 },
      ],
      { duration: 700, easing: 'cubic-bezier(.45,.05,.3,1)' }
    );

    vuelo.onfinish = () => {
      clon.remove();
      pulsoDelIcono();
      listo();
    };
    /* Si el navegador cancela la animación (pestaña en segundo plano,
       por ejemplo), el flujo sigue igual. */
    vuelo.oncancel = () => { clon.remove(); listo(); };
  });
}

/* ============================================================
   ENGANCHES
   ============================================================ */
document.addEventListener('click', (e) => {
  const boton = (e.target as HTMLElement).closest<HTMLElement>('[data-agregar]');
  if (!boton) return;

  const crudo = boton.dataset.producto;
  if (!crudo) return;

  const datos = JSON.parse(crudo) as Omit<ItemCarrito, 'cantidad'>;

  /* En la ficha, la variante y la cantidad elegidas mandan sobre
     el valor por defecto que vino del servidor. */
  const radio = document.querySelector<HTMLInputElement>('[data-variantes] input[type="radio"]:checked');
  if (radio) {
    datos.variante = radio.value;
    datos.stockMax = Number(radio.dataset.stock ?? datos.stockMax);
  }
  const campoCantidad = document.querySelector<HTMLInputElement>('#cantidad');
  const cantidad = campoCantidad ? Number(campoCantidad.value) || 1 : 1;

  /* El carrito se actualiza primero: si la animación fallara por lo
     que sea, el producto ya está adentro. La animación es adorno; el
     agregado, no. */
  agregar(datos, cantidad);
  volar(boton).then(abrirMini);
});

document.querySelectorAll('[data-cerrar-mini]').forEach((b) => b.addEventListener('click', cerrarMini));
veloMini?.addEventListener('click', cerrarMini);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mini?.dataset.abierto) cerrarMini();
});

/* El ícono del encabezado abre el mini-carrito en vez de navegar,
   salvo que ya estemos en la página del carrito — ahí navegar sería
   recargar la misma pantalla. La detección es por contenido de la
   página y no por la URL: así funciona igual publicado que abierto
   como archivo local. */
const estamosEnElCarrito = document.querySelector('[data-carro]') !== null;
for (const enlace of document.querySelectorAll<HTMLAnchorElement>('[data-carrito-enlace]')) {
  enlace.addEventListener('click', (e) => {
    if (estamosEnElCarrito) return;
    e.preventDefault();
    abrirMini();
  });
}

suscribir((items) => {
  pintarContador(items);
  pintarMini(items);
});

export { abrirMini, cerrarMini, cambiarCantidad, leer };
