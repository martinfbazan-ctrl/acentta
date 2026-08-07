/** acentta · confirmación */
import { leerPedido } from '@lib/pedido';
import { precio as fPrecio, rangoDeEntrega } from '@lib/formato';

const pedido = leerPedido();

if (pedido) {
  document.querySelector<HTMLElement>('[data-numero-pedido]')!.textContent = pedido.numero;
  if (pedido.email) {
    document.querySelector<HTMLElement>('[data-email-pedido]')!.textContent = pedido.email;
  }

  const extra = pedido.diasExtra ?? 0;
  document.querySelector<HTMLElement>('[data-fecha-entrega]')!.textContent =
    ' ' + rangoDeEntrega(5 + extra, 10 + extra, new Date(pedido.fecha));

  const caja = document.querySelector<HTMLElement>('[data-resumen-pedido]')!;
  caja.hidden = false;
  document.querySelector<HTMLElement>('[data-total-pedido]')!.textContent = fPrecio(pedido.total);
  document.querySelector<HTMLElement>('[data-envio-pedido]')!.textContent =
    pedido.envio === 0 ? 'Gratis' : fPrecio(pedido.envio);

  document.querySelector<HTMLElement>('[data-items-pedido]')!.innerHTML = pedido.items.map((i) => `
    <article class="cf-item">
      <img class="cf-item__foto" src="https://images.unsplash.com/${i.imagen}?auto=format&fit=crop&w=150&q=72" alt="" width="52" height="65" loading="lazy" />
      <div class="cf-item__datos">
        <p class="cf-item__nombre">${i.nombre}</p>
        <p class="cf-item__meta">${i.variante ? i.variante + ' · ' : ''}${i.cantidad} u.</p>
      </div>
      <span class="cf-item__precio">${fPrecio(i.precio * i.cantidad)}</span>
    </article>`).join('');
} else {
  /* Entrar directo a /confirmacion sin haber comprado no debería
     mostrar un pedido inventado. */
  document.querySelector<HTMLElement>('[data-numero-pedido]')!.textContent = 'sin pedido reciente';
  document.querySelector<HTMLElement>('[data-fecha-entrega]')!.textContent = ' según tu zona';
}
