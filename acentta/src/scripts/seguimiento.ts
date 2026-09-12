/** acentta · seguimiento de pedido */

import { leerPedido, estadoActual, fechaDePaso, PASOS, ESTADOS, type EstadoPedido, type PedidoGuardado } from '@lib/pedido';
import { precio as fPrecio, fechaLarga, rangoDeEntrega } from '@lib/formato';
import { foto } from '@lib/imagenes';
import { PREPARACION } from '@tipos/catalogo';

const forma = document.querySelector<HTMLFormElement>('[data-seguimiento-forma]');

if (forma) {
  const entrada = forma.querySelector<HTMLInputElement>('#sg-numero')!;
  const resultado = document.querySelector<HTMLElement>('[data-seguimiento-resultado]')!;
  const vacio = document.querySelector<HTMLElement>('[data-seguimiento-vacio]')!;
  const error = document.querySelector<HTMLElement>('[data-seguimiento-error]')!;

  let forzado: EstadoPedido | undefined;

  function pintar(pedido: PedidoGuardado) {
    resultado.hidden = false;
    error.hidden = true;
    vacio.hidden = true;

    document.querySelector<HTMLElement>('[data-sg-numero]')!.textContent = pedido.numero;
    document.querySelector<HTMLElement>('[data-sg-fecha]')!.textContent = fechaLarga(pedido.fecha);
    document.querySelector<HTMLElement>('[data-sg-total]')!.textContent = fPrecio(pedido.total);

    const extra = pedido.diasExtra ?? 0;
    document.querySelector<HTMLElement>('[data-sg-entrega]')!.textContent =
      rangoDeEntrega(PREPARACION.min + extra, PREPARACION.max + extra, new Date(pedido.fecha));

    /* El número del correo. Sólo se muestra si existe: un recuadro
       rotulado «Seguimiento» con un guion adentro es peor que no
       mostrarlo, porque hace pensar que el dato se perdió. */
    const rastreo = document.querySelector<HTMLElement>('[data-sg-rastreo]');
    if (rastreo) {
      const hay = Boolean(pedido.seguimiento);
      rastreo.hidden = !hay;
      if (hay) {
        const correo = pedido.correo || 'el correo';
        document.querySelector<HTMLElement>('[data-sg-correo-rotulo]')!.textContent =
          `Número de seguimiento de ${correo}`;
        document.querySelector<HTMLElement>('[data-sg-rastreo-numero]')!.textContent =
          pedido.seguimiento!;
        const enlace = document.querySelector<HTMLAnchorElement>('[data-sg-rastreo-enlace]');
        /* OCA rastrea con un formulario, no con una dirección que
           lleve el número adentro, así que el enlace va a la página
           y el número queda a la vista para copiar. Inventar una
           dirección con el número pegado daría un 404 al comprador
           justo cuando está ansioso por saber dónde está su pedido. */
        if (enlace) {
          enlace.querySelector('.boton__texto')!.textContent = `Rastrear en ${correo}`;
        }
      }
    }

    /* Línea de estados */
    const indice = estadoActual(pedido, forzado);
    document.querySelectorAll<HTMLElement>('.linea__paso').forEach((paso, i) => {
      paso.dataset.estado = i < indice ? 'hecho' : i === indice ? 'actual' : 'pendiente';
      const fecha = document.querySelector<HTMLElement>(`[data-paso-fecha="${i}"]`)!;
      if (i <= indice) {
        fecha.textContent = fechaLarga(fechaDePaso(pedido, i));
      } else {
        fecha.textContent = `Estimado: ${fechaLarga(fechaDePaso(pedido, i))}`;
      }
    });
    /* El último paso hecho también se marca como cumplido, no como
       "en curso": si ya está entregado, no hay nada latiendo. */
    if (indice === PASOS.length - 1) {
      document.querySelectorAll<HTMLElement>('.linea__paso')[indice]!.dataset.estado = 'hecho';
    }

    /* Productos */
    document.querySelector<HTMLElement>('[data-sg-items]')!.innerHTML = pedido.items.map((i) => `
      <article class="sg-item">
        <img class="sg-item__foto" src="${foto(i.imagen, 200)}" alt="" width="64" height="64" loading="lazy" />
        <div class="sg-item__datos">
          <p class="sg-item__nombre"><a href="/producto/${i.slug}">${i.nombre}</a></p>
          <p class="sg-item__meta">${i.variante ? i.variante + ' · ' : ''}${i.cantidad} u.</p>
        </div>
        <span class="sg-item__precio">${fPrecio(i.precio * i.cantidad)}</span>
      </article>`).join('');
  }

  /**
   * Le pregunta al servidor lo que el navegador no puede saber.
   *
   * [ERROR CORREGIDO] Esta página leía SÓLO el pedido guardado en el
   * navegador, que se escribió en el momento de comprar. El número de
   * seguimiento no existe en ese momento: aparece uno o dos días
   * después, cuando se despacha y se carga en /pedidos.
   *
   * O sea que el circuito estaba cortado justo en el medio. El
   * vendedor pegaba el número, se guardaba bien, y el comprador
   * entraba a «seguimiento de pedido» y no lo veía nunca — mientras
   * el estado avanzaba solo, derivado del reloj, dando la impresión
   * de que la página estaba viva y al día.
   *
   * Nada falla, nada aparece en la consola. Sólo llega el mail de
   * «¿dónde está mi pedido?» que esta página existe para evitar.
   *
   * Se pinta primero con lo guardado y se refresca después: si el
   * servidor tarda o no contesta, la persona ya está viendo su
   * pedido en vez de un cargador.
   */
  async function refrescar(numero: string, previo: PedidoGuardado) {
    try {
      const r = await fetch(`/api/pedido?numero=${encodeURIComponent(numero)}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return;
      const d = (await r.json()) as { seguimiento?: string | null; correo?: string | null };
      /* Sólo se completa lo que el servidor sabe y el navegador no.
         El resto del pedido ya está en pantalla y volver a pintarlo
         con datos parciales lo borraría. */
      if (!d.seguimiento) return;
      pintar({ ...previo, seguimiento: d.seguimiento, correo: d.correo ?? null });
    } catch {
      /* Sin conexión el seguimiento sigue mostrando lo de siempre.
         Es exactamente lo que había antes de este agregado. */
    }
  }

  /* Si compró en este navegador, se muestra sin pedir nada. */
  const guardado = leerPedido();
  if (guardado) {
    entrada.value = guardado.numero;
    pintar(guardado);
    void refrescar(guardado.numero, guardado);
  }

  forma.addEventListener('submit', (e) => {
    e.preventDefault();
    const buscado = entrada.value.trim().toUpperCase();
    const pedido = leerPedido();

    if (pedido && pedido.numero.toUpperCase() === buscado) {
      pintar(pedido);
      void refrescar(pedido.numero, pedido);
    } else {
      resultado.hidden = true;
      vacio.hidden = true;
      error.hidden = false;
    }
  });

  /* Simulador de estados, para poder revisar el prototipo sin
     esperar una semana. Va rotulado como lo que es. */
  document.querySelector('[data-simulador]')?.addEventListener('click', (e) => {
    const boton = (e.target as HTMLElement).closest<HTMLElement>('[data-forzar]');
    if (!boton) return;
    const valor = boton.dataset.forzar!;
    forzado = valor === 'auto' ? undefined : ESTADOS[Number(valor)];
    for (const b of document.querySelectorAll('[data-forzar]')) b.classList.remove('chip--activo');
    if (valor !== 'auto') boton.classList.add('chip--activo');
    const pedido = leerPedido();
    if (pedido) pintar(pedido);
  });
}
