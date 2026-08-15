/**
 * acentta · consulta de pedido sin cuenta
 * ---------------------------------------------------------------
 * Número más correo. Nada que recordar, nada que recuperar.
 */

import { precio as fPrecio, rangoDeEntrega } from '@lib/formato';

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

interface Respuesta {
  numero: string;
  estado: string;
  creado: string;
  total: number;
  envio: number;
  envioGratis: boolean;
  diasExtra: number;
  ciudad: string;
  provincia: string;
  seguimiento: string | null;
  verificado?: boolean;
  entrega?: { calle: string; numero: string; piso: string | null; ciudad: string; provincia: string; cp: string; metodo: string };
  items: { nombre: string; variante: string; cantidad: number; precio: number }[];
}

const QUE_SIGNIFICA: Record<string, string> = {
  aprobado: 'El pago entró. Estamos preparando el pedido.',
  pendiente: 'El pago todavía se está acreditando. Si pagaste en efectivo o por transferencia, puede tardar hasta 3 días hábiles.',
  rechazado: 'El pago no se completó. Podés intentar de nuevo desde el carrito.',
  cancelado: 'Este pedido se canceló. No se cobró nada.',
  devuelto: 'Se devolvió el dinero al medio de pago que usaste.',
};

function tarjeta(p: Respuesta): string {
  const extra = p.diasExtra ?? 0;
  const llega = rangoDeEntrega(5 + extra, 10 + extra, new Date(p.creado));

  const dir = p.entrega
    ? [`${p.entrega.calle} ${p.entrega.numero}`, p.entrega.piso, `${p.entrega.ciudad}, ${p.entrega.provincia}`, `CP ${p.entrega.cp}`]
      .filter(Boolean).map(esc).join(' · ')
    : `${esc(p.ciudad)}, ${esc(p.provincia)}`;

  const items = p.items
    .map((i) => `${i.cantidad} × ${esc(i.nombre)}${i.variante ? ` (${esc(i.variante)})` : ''}`)
    .join('<br>');

  return `
  <article class="pedido-visto">
    <div class="pedido-visto__cabeza">
      <span class="pedido-visto__numero">${esc(p.numero)}</span>
      <span class="pedido-visto__estado" data-e="${esc(p.estado)}">${esc(p.estado)}</span>
    </div>

    <p class="pedido-visto__linea">${esc(QUE_SIGNIFICA[p.estado] ?? '')}</p>

    ${p.seguimiento
      ? `<p class="pedido-visto__seguimiento">
           <b>Ya salió.</b> Número de seguimiento: <b>${esc(p.seguimiento)}</b>
         </p>`
      : p.estado === 'aprobado'
        ? `<p class="pedido-visto__linea">Todavía no salió del depósito. Cuando salga, acá va a aparecer el número de seguimiento.</p>`
        : ''}

    <p class="pedido-visto__linea">
      <b>Llega</b> ${esc(llega)}<br>
      <b>A</b> ${dir}<br>
      <b>Total</b> ${esc(fPrecio(p.total))} ${p.envioGratis || p.envio === 0 ? '· envío gratis' : `· envío ${esc(fPrecio(p.envio))}`}
    </p>

    <div class="pedido-visto__items">${items}</div>
  </article>`;
}

$<HTMLFormElement>('[data-forma]')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const numero = $<HTMLInputElement>('#numero')!.value.trim().toUpperCase();
  const email = $<HTMLInputElement>('#email')!.value.trim();
  const error = $('[data-error]')!;
  const salida = $('[data-resultado]')!;

  error.hidden = true;
  salida.hidden = true;

  if (!/^AC-\d{6}-[A-Z0-9]{6}$/.test(numero)) {
    error.textContent = 'Ese número no tiene el formato correcto. Empieza con AC- y sigue con dos bloques, por ejemplo AC-260811-K7M2QX.';
    error.hidden = false;
    return;
  }

  try {
    const r = await fetch(`/api/pedido?numero=${encodeURIComponent(numero)}&email=${encodeURIComponent(email)}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      /* El mismo mensaje para «no existe» y para «el correo no
         coincide». Distinguirlos le confirmaría a un desconocido qué
         números de pedido existen. */
      error.textContent = 'No encontramos un pedido con ese número y ese correo. Revisá los dos datos.';
      error.hidden = false;
      return;
    }

    const datos = (await r.json()) as Respuesta;
    if (!datos.verificado) {
      error.textContent = 'No encontramos un pedido con ese número y ese correo. Revisá los dos datos.';
      error.hidden = false;
      return;
    }

    salida.innerHTML = tarjeta(datos);
    salida.hidden = false;
    salida.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch {
    error.textContent = 'No pudimos consultar el pedido en este momento. Probá de nuevo en un rato.';
    error.hidden = false;
  }
});
