/**
 * acentta · pasar un pago al pedido
 * ---------------------------------------------------------------
 * Hay dos caminos por los que se entera el sitio de que un pago
 * cambió de estado:
 *
 *   · el aviso de Mercado Pago, que llega solo;
 *   · la consulta a mano desde la pantalla de pedidos, para los que
 *     quedaron pendientes porque el aviso nunca llegó.
 *
 * Los dos terminan haciendo lo mismo, y por eso lo hacen acá. Si cada
 * uno tuviera su propia copia, tarde o temprano una de las dos se
 * quedaría sin la comprobación de monto, y sería la que se usa poco
 * —o sea, la que nadie mira— la que apruebe un pedido mal cobrado.
 *
 * Una regla vale la pena repetirla: **si el monto cobrado no coincide
 * con el cotizado, el pedido NO se aprueba.** Queda pendiente y
 * marcado para revisar. Puede ser un cambio de precio entre la
 * creación y el pago, o puede ser un intento de manipulación; en los
 * dos casos la respuesta correcta es mirar antes de despachar.
 */

import { actualizarPedido, type EstadoPedido, type Pedido } from '@lib/pedidos';
import type { PagoConsultado } from '@lib/mercadopago';

/** Diferencia tolerada por redondeo de Mercado Pago, en pesos. */
const TOLERANCIA = 1;

export function traducirEstado(estado: string): EstadoPedido {
  switch (estado) {
    case 'approved': return 'aprobado';
    case 'rejected': return 'rechazado';
    case 'cancelled': return 'cancelado';
    case 'refunded':
    case 'charged_back': return 'devuelto';
    default: return 'pendiente'; // pending, in_process y cualquier novedad
  }
}

export interface Resultado {
  estado: EstadoPedido;
  cambio: boolean;
  revisar: boolean;
  nota: string;
}

export async function aplicarPago(pedido: Pedido, pago: PagoConsultado): Promise<Resultado> {
  const estado = traducirEstado(pago.estado);
  const esperado = pedido.cotizacion.total;
  const diferencia = Math.abs(pago.monto - esperado);

  if (estado === 'aprobado' && diferencia > TOLERANCIA) {
    await actualizarPedido(pedido.numero, {
      estado: 'pendiente',
      pagoId: pago.id,
      detallePago: `REVISAR: se cobraron ${pago.monto} y el pedido decía ${esperado}`,
    });
    return {
      estado: 'pendiente',
      cambio: pedido.estado !== 'pendiente' || pedido.pagoId !== pago.id,
      revisar: true,
      nota: `monto distinto: ${pago.monto} contra ${esperado}`,
    };
  }

  const cambio = pedido.estado !== estado || pedido.pagoId !== pago.id;

  await actualizarPedido(pedido.numero, {
    estado,
    pagoId: pago.id,
    detallePago: `${pago.estado}${pago.detalle ? ` · ${pago.detalle}` : ''}`,
  });

  return { estado, cambio, revisar: false, nota: pago.estado };
}
