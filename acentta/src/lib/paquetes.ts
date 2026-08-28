/**
 * acentta · de qué tamaño es la caja
 * ---------------------------------------------------------------
 * Los correos no cobran por peso: cobran por **peso aforado**, que
 * combina peso y volumen. Un kilo de plumas y un kilo de acero pesan
 * lo mismo y ocupan lugares distintos en el camión, y el precio lo
 * refleja. Cada correo tiene su propia fórmula; Envíopack se ocupa de
 * aplicar la que corresponda, pero para eso necesita saber cuánto
 * mide el paquete.
 *
 * El catálogo tiene las medidas del PRODUCTO, no las de la caja en la
 * que viaja. Son cosas distintas: un termo de 25 cm entra en una caja
 * de 29, y esos 4 cm de diferencia son cartón y relleno que el correo
 * igual transporta.
 *
 * Así que la caja se estima: producto más un margen de embalaje, con
 * un mínimo por debajo del cual ninguna caja existe. Y se puede
 * declarar a mano en el YAML del producto cuando se conoce la caja
 * real, que siempre va a ser mejor que una estimación.
 *
 * POR QUÉ UN PAQUETE POR UNIDAD
 *
 * Dos termos entran en una caja sola, y cotizarlos por separado sale
 * un poco más caro que la verdad. Se hace igual, por una razón
 * asimétrica: cotizar de menos se descubre al despachar, cuando la
 * venta ya se cobró y el envío sale más de lo que se le cobró al
 * comprador — esa diferencia la pone el vendedor. Cotizar de más se
 * descubre antes y se corrige declarando la caja real.
 *
 * Cuando haya cajas de verdad medidas, esto se reemplaza por la
 * combinación real y deja de ser una estimación conservadora.
 */

import type { Producto } from '@tipos/catalogo';

/** Centímetros que se le suman a cada lado por cartón y relleno. */
const MARGEN_CM = 2;

/** Ninguna caja despachable mide menos que esto. */
const MINIMO_CM = 10;

export interface Caja {
  alto: number;
  ancho: number;
  largo: number;
}

/**
 * La caja de un producto.
 *
 * Si el YAML declara `paquete`, gana: un dato medido siempre vale más
 * que uno estimado. Si no, se estima desde las dimensiones.
 */
export function cajaDe(producto: Producto): Caja {
  const declarada = (producto as Producto & { paquete?: Partial<Caja> }).paquete;
  if (declarada?.alto && declarada.ancho && declarada.largo) {
    return {
      alto: Math.ceil(declarada.alto),
      ancho: Math.ceil(declarada.ancho),
      largo: Math.ceil(declarada.largo),
    };
  }

  const d = producto.dimensiones;
  const conMargen = (v: number) => Math.max(MINIMO_CM, Math.ceil((v || 0) + MARGEN_CM));

  return {
    alto: conMargen(d?.alto ?? 0),
    ancho: conMargen(d?.ancho ?? 0),
    /* El catálogo lo llama profundidad; Envíopack, largo. Es la misma
       medida y conviene decirlo acá y no dejar que alguien lo deduzca
       comparando dos archivos. */
    largo: conMargen(d?.profundidad ?? 0),
  };
}

/**
 * El texto que espera Envíopack en el parámetro `paquetes`.
 *
 *     20x2x10,20x2x10   → dos paquetes de 20 alto × 2 ancho × 10 largo
 *
 * Si la lista viniera vacía, Envíopack asume un paquete de 1×1×1 —una
 * caja de un centímetro cúbico— y devuelve una cotización que no
 * tiene nada que ver con la realidad. Por eso nunca se devuelve
 * vacío: sin cajas, no hay cotización que pedir.
 */
export function comoParametro(cajas: Caja[]): string {
  if (cajas.length === 0) {
    throw new Error('No se puede cotizar un envío sin ningún paquete.');
  }
  return cajas.map((c) => `${c.alto}x${c.ancho}x${c.largo}`).join(',');
}
