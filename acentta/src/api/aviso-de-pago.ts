/**
 * POST /api/aviso-de-pago
 * ---------------------------------------------------------------
 * Lo que Mercado Pago llama webhook. Es la parte del circuito donde
 * un descuido cuesta plata, así que vale la pena el detalle.
 *
 * Cuatro reglas, y ninguna es opcional:
 *
 * 1 · SE VERIFICA LA FIRMA.
 *     El aviso llega por internet a una dirección pública. Sin
 *     verificar, cualquiera que la descubra manda «pago aprobado» y
 *     se lleva mercadería gratis.
 *
 * 2 · NO SE LE CREE AL AVISO.
 *     El aviso trae un identificador. El estado se pregunta después,
 *     directo a la API de Mercado Pago, con nuestro token. Aunque el
 *     mensaje viniera firmado y dijera «aprobado», la fuente de
 *     verdad está de aquel lado.
 *
 * 3 · SE PROCESA UNA SOLA VEZ.
 *     Mercado Pago reintenta a los 0, 15 y 30 minutos, a las 6, 48 y
 *     96 horas, y tres veces más, hasta recibir un 200. Sin marca de
 *     procesado, un pedido se confirma ocho veces.
 *
 * 4 · SE CONTESTA 200 CASI SIEMPRE.
 *     Contestar error hace que reintenten. Eso está bien cuando el
 *     problema es nuestro y transitorio —el almacén no responde— y
 *     está mal cuando el aviso es de algo que no nos incumbe: un
 *     pago que no es de este sitio reintentaría durante días. Lo que
 *     no se puede procesar y no se va a poder procesar nunca, se
 *     acepta y se descarta.
 *
 * El límite de Mercado Pago para contestar es de 22 segundos.
 */

import type { APIRoute } from 'astro';
import { consultarPago, firmaValida, hayCredenciales } from '@lib/mercadopago';
import {
  actualizarPedido, desmarcarProcesado, hayAlmacen, leerPedido, marcarProcesado,
  type EstadoPedido,
} from '@lib/pedidos';

export const prerender = false;

/** Aceptado y cerrado: no reintentar. */
const listo = (nota: string) =>
  new Response(nota, { status: 200, headers: { 'Cache-Control': 'no-store' } });

/** Nuestro problema y puede pasar solo: que reintenten. */
const reintentar = (nota: string) => new Response(nota, { status: 500 });

/** Cómo se traduce el estado de Mercado Pago al nuestro. */
function traducirEstado(estado: string): EstadoPedido {
  switch (estado) {
    case 'approved': return 'aprobado';
    case 'rejected': return 'rechazado';
    case 'cancelled': return 'cancelado';
    case 'refunded':
    case 'charged_back': return 'devuelto';
    default: return 'pendiente'; // pending, in_process y cualquier novedad
  }
}

export const POST: APIRoute = async ({ request, url }) => {
  if (!hayCredenciales() || !hayAlmacen()) {
    /* Sin configuración no hay nada que hacer, pero tampoco tiene
       sentido que reintenten durante días. */
    return listo('sin configurar');
  }

  const secreto = process.env.MP_WEBHOOK_SECRET ?? '';
  if (!secreto) {
    console.error('aviso-de-pago: falta MP_WEBHOOK_SECRET, no se puede verificar la firma');
    return listo('sin secreto');
  }

  /* El identificador viene en la dirección y también en el cuerpo. El
     que se firma es el de la dirección, así que ése es el que se usa
     para verificar. */
  const idEnLaUrl = url.searchParams.get('data.id') ?? url.searchParams.get('id');

  let cuerpo: { type?: string; action?: string; data?: { id?: string } } = {};
  try { cuerpo = await request.json(); } catch { /* puede venir vacío */ }

  if (!firmaValida({
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    dataId: idEnLaUrl,
    secreto,
  })) {
    /* 401 y no 200: que Mercado Pago sepa que lo rechazamos, y que
       quien lo haya falsificado no reciba una confirmación. */
    return new Response('Firma inválida', { status: 401 });
  }

  /* Sólo interesan los avisos de pago. Los demás se aceptan para que
     no reintenten. */
  const tipo = cuerpo.type ?? url.searchParams.get('type') ?? '';
  if (tipo !== 'payment') return listo('no es un pago');

  const pagoId = String(cuerpo.data?.id ?? idEnLaUrl ?? '');
  if (!pagoId) return listo('sin identificador de pago');

  /* La marca se toma antes de trabajar. Si dos avisos llegan a la
     vez, uno solo pasa: `SET NX` es atómico. */
  let tomado = false;
  try {
    tomado = await marcarProcesado(pagoId);
  } catch {
    return reintentar('el almacén no contestó');
  }
  if (!tomado) return listo('ya se había procesado');

  try {
    const pago = await consultarPago(pagoId);

    /* `external_reference` es nuestro número de pedido: es lo único
       que une el pago con el registro. Sin él no hay nada que
       actualizar, y no lo va a haber en un reintento. */
    if (!pago.referenciaExterna) return listo('el pago no trae número de pedido');

    const pedido = await leerPedido(pago.referenciaExterna);
    if (!pedido) return listo(`no existe el pedido ${pago.referenciaExterna}`);

    const estado = traducirEstado(pago.estado);

    /* Comparación de montos. Si lo cobrado no coincide con lo
       cotizado, el pedido NO se aprueba: se marca para revisar a
       mano. Puede ser un cambio de precio entre la creación y el
       pago, o puede ser un intento de manipulación; en los dos casos
       la respuesta correcta es mirar antes de despachar.
       Se tolera un peso de diferencia por redondeo de Mercado Pago. */
    const esperado = pedido.cotizacion.total;
    const diferencia = Math.abs(pago.monto - esperado);
    if (estado === 'aprobado' && diferencia > 1) {
      await actualizarPedido(pedido.numero, {
        estado: 'pendiente',
        pagoId,
        detallePago: `REVISAR: se cobraron ${pago.monto} y el pedido decía ${esperado}`,
      });
      console.error(`aviso-de-pago: monto distinto en ${pedido.numero}: ${pago.monto} vs ${esperado}`);
      return listo('monto distinto, queda para revisar');
    }

    await actualizarPedido(pedido.numero, {
      estado,
      pagoId,
      detallePago: `${pago.estado}${pago.detalle ? ` · ${pago.detalle}` : ''}`,
    });

    /* Acá va el correo al comprador cuando el estado sea aprobado.
       Todavía no está: mandar correo pide un proveedor y una clave
       más, y el circuito de cobro tiene que estar verificado antes de
       sumarle piezas. Mientras tanto el pedido queda registrado y se
       consulta por número. */

    return listo(`pedido ${pedido.numero} → ${estado}`);
  } catch (err) {
    /* Falló después de tomar la marca. Se devuelve la marca para que
       el reintento pueda trabajar: es preferible arriesgar un aviso
       repetido —que este mismo código sabe manejar— a perder para
       siempre la confirmación de un pago cobrado. */
    await desmarcarProcesado(pagoId);
    console.error('aviso-de-pago:', err);
    return reintentar('error al procesar');
  }
};

/* Mercado Pago a veces verifica la dirección con un GET. Que conteste
   algo, sin hacer nada. */
export const GET: APIRoute = () => listo('acentta · receptor de avisos de pago');
