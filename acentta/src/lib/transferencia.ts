/**
 * acentta · cobro por transferencia bancaria
 * ---------------------------------------------------------------
 * POR QUÉ ESTO NO PASA POR LA PASARELA
 *
 * El descuento por transferencia existe por una razón concreta: la
 * plata llega directo al banco, sin comisión de nadie, y parte de
 * ese ahorro se le pasa al comprador.
 *
 * [ERROR CORREGIDO] Eso no era lo que pasaba. Quien elegía
 * transferencia recibía el 10 % de descuento y después el checkout
 * lo mandaba igual a la pasarela, donde terminaba pagando con
 * tarjeta. Las dos pérdidas en la misma venta: el descuento
 * regalado y la comisión pagada sobre el resto.
 *
 * Y no había forma de que funcionara: Mercado Pago ofrece tarjeta,
 * dinero en cuenta y efectivo en Rapipago, pero **no una
 * transferencia a tu CBU**. Esa parte es por fuera, sí o sí.
 *
 * CÓMO FUNCIONA AHORA
 *
 *   1. El pedido se guarda con estado «esperando transferencia».
 *   2. No se crea ningún cobro. La persona ve el CBU, el alias y su
 *      número de pedido, que es la referencia con la que se
 *      reconoce el depósito.
 *   3. Cuando la plata aparece en el banco, se marca pago a mano
 *      desde /pedidos.
 *
 * El paso 3 es manual a propósito: automatizarlo pide leer el
 * resumen del banco, que es una integración aparte y con acceso a
 * mucho más de lo que hace falta.
 *
 * LOS DATOS NO ESTÁN ACÁ
 *
 * CBU y alias viven en variables de entorno. No son secretos —se los
 * das a cualquiera que te compre— pero sí son de una cuenta real, y
 * un repositorio de portfolio no es lugar para el número de cuenta
 * de nadie. Además así se cambian sin tocar código el día que
 * cambies de banco.
 */

import { variable } from '@lib/entorno';

export interface DatosDeTransferencia {
  cbu: string;
  alias: string;
  titular: string;
  banco: string;
  /** El CUIT del titular, para que el banco no rechace por control. */
  cuit: string;
}

/**
 * Los datos para transferir, o `null` si falta alguno.
 *
 * Todo o nada, y no «lo que haya»: una pantalla que muestra el alias
 * pero no el CBU deja a alguien con la plata en la mano y sin poder
 * mandarla. Prefiero que la opción no se ofrezca a que se ofrezca
 * incompleta.
 */
export function datosDeTransferencia(): DatosDeTransferencia | null {
  const cbu = variable('TRANSFERENCIA_CBU').trim();
  const alias = variable('TRANSFERENCIA_ALIAS').trim();
  const titular = variable('TRANSFERENCIA_TITULAR').trim();

  if (!cbu || !alias || !titular) return null;

  /* Un CBU son 22 dígitos exactos. Si el que está cargado no los
     tiene, algo se pegó mal —un espacio, un dígito de menos— y el
     comprador va a intentar transferir a una cuenta que no existe.
     Es mejor no ofrecer la opción que ofrecerla rota. */
  if (cbu.replace(/\D/g, '').length !== 22) return null;

  return {
    cbu: cbu.replace(/\D/g, ''),
    alias,
    titular,
    banco: variable('TRANSFERENCIA_BANCO').trim(),
    cuit: variable('TRANSFERENCIA_CUIT').trim(),
  };
}

/** ¿Se puede ofrecer el pago por transferencia? */
export function hayTransferencia(): boolean {
  return datosDeTransferencia() !== null;
}
