/**
 * acentta · pasar un pago al pedido
 * ---------------------------------------------------------------
 * Hay dos caminos por los que se entera el sitio de que un pago
 * cambió de estado:
 *
 *   · el aviso de la pasarela, que llega solo;
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
import type { PagoConsultado } from '@lib/pasarela';

/** Diferencia tolerada por redondeo de la pasarela, en pesos. */
const TOLERANCIA = 1;

export interface Resultado {
  estado: EstadoPedido;
  cambio: boolean;
  revisar: boolean;
  nota: string;
}

export async function aplicarPago(pedido: Pedido, pago: PagoConsultado): Promise<Resultado> {
  /* Ya viene traducido. La traducción vive en cada adaptador porque
     es lo único que cambia entre una pasarela y otra: acá llegan los
     mismos cinco estados venga de donde venga el pago. Cuando esto
     traducía por su cuenta, conocía el vocabulario de Mercado Pago —y
     ese conocimiento habría que haberlo duplicado al sumar Mobbex. */
  const estado: EstadoPedido = pago.estado;
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

  /* En el detalle se guarda lo que dijo la pasarela sin traducir. Es
     lo que sirve cuando hay que entender por qué se rechazó algo:
     «rechazado» no dice nada, «cc_rejected_insufficient_amount» o el
     código 410 de Mobbex sí. */
  await actualizarPedido(pedido.numero, {
    estado,
    pagoId: pago.id,
    detallePago: `${pago.crudo}${pago.detalle ? ` · ${pago.detalle}` : ''}`,
  });

  return { estado, cambio, revisar: false, nota: pago.crudo };
}
