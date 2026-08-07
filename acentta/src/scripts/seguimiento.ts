/** acentta · seguimiento de pedido */

import { leerPedido, estadoActual, fechaDePaso, PASOS, ESTADOS, type EstadoPedido, type PedidoGuardado } from '@lib/pedido';
import { precio as fPrecio, fechaLarga, rangoDeEntrega } from '@lib/formato';

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
      rangoDeEntrega(5 + extra, 10 + extra, new Date(pedido.fecha));

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
        <img class="sg-item__foto" src="https://images.unsplash.com/${i.imagen}?auto=format&fit=crop&w=200&q=72" alt="" width="64" height="80" loading="lazy" />
        <div class="sg-item__datos">
          <p class="sg-item__nombre"><a href="/producto/${i.slug}">${i.nombre}</a></p>
          <p class="sg-item__meta">${i.variante ? i.variante + ' · ' : ''}${i.cantidad} u.</p>
        </div>
        <span class="sg-item__precio">${fPrecio(i.precio * i.cantidad)}</span>
      </article>`).join('');
  }

  /* Si compró en este navegador, se muestra sin pedir nada. */
  const guardado = leerPedido();
  if (guardado) {
    entrada.value = guardado.numero;
    pintar(guardado);
  }

  forma.addEventListener('submit', (e) => {
    e.preventDefault();
    const buscado = entrada.value.trim().toUpperCase();
    const pedido = leerPedido();

    if (pedido && pedido.numero.toUpperCase() === buscado) {
      pintar(pedido);
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
