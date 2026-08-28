/**
 * acentta · cotizar con el correo, sin depender de que conteste
 * ---------------------------------------------------------------
 * La pieza que une `cotizar()` —pura, sincrónica, sin red— con
 * Envíopack, que es lo contrario de las tres cosas.
 *
 * EL CIRCUITO, Y POR QUÉ SON DOS PASADAS
 *
 *   1. Se cotiza con la tabla propia. Es instantáneo y valida el
 *      pedido entero: productos, variantes, stock, cobertura. De ahí
 *      salen el peso y las cajas.
 *   2. Con esos datos se le pregunta a Envíopack cuánto sale.
 *   3. Se vuelve a cotizar, ahora con la tarifa puesta.
 *
 * Dos pasadas de una función pura no le cuestan nada a nadie, y a
 * cambio la validación del pedido vive en un solo lugar. La
 * alternativa —extraer «medir el pedido» a una función aparte que
 * repita la búsqueda en el catálogo y las reglas de stock— habría
 * creado un segundo lugar donde equivocarse.
 *
 * SI ENVÍOPACK NO CONTESTA, SE VENDE IGUAL
 *
 * Esto corre dentro del checkout. Un operador logístico caído no
 * puede ser una tienda caída: se cotiza con la tabla, se registra que
 * la tarifa salió de ahí, y la venta sigue. La tabla dejó de ser la
 * verdad y pasó a ser la red de seguridad.
 *
 * El riesgo de esa decisión es real y conviene nombrarlo: si la tabla
 * cotiza menos que el correo, la diferencia la paga el vendedor. Por
 * eso `fuenteEnvio` viaja hasta el pedido guardado — en la pantalla
 * de despacho se ve cuáles se cotizaron con la tabla, que son los que
 * pueden haber salido de menos.
 *
 * LO QUE NO CAMBIA
 *
 * La cobertura la sigue decidiendo nuestra tabla. Que un correo llegue
 * a un código postal no significa que queramos vender ahí; eso es una
 * decisión de negocio y vive donde vivía.
 */

import {
  cotizar, ErrorDeCotizacion,
  type Cotizacion, type LineaPedida, type MetodoEnvio, type MetodoPago,
} from '@lib/cotizacion';
import { cotizarDomicilio, hayCredenciales } from '@lib/enviopack';

export interface DatosDeEnvio {
  cp: string;
  provincia: string;
  ciudad?: string;
}

/**
 * Cotiza un pedido usando la tarifa real del correo cuando se puede.
 *
 * Es `cotizar()` con una llamada de red en el medio. Todo lo que
 * `cotizar()` rechaza, esto rechaza igual y por el mismo camino: el
 * `ErrorDeCotizacion` de la primera pasada sale sin haber tocado la
 * red.
 */
export async function cotizarConCorreo(
  pedidas: LineaPedida[],
  envio: DatosDeEnvio,
  metodoEnvio: MetodoEnvio = 'domicilio',
  metodoPago: MetodoPago = 'tarjeta',
): Promise<Cotizacion> {
  /* Pasada 1. Si algo del pedido no cierra, corta acá y no se gastó
     una llamada a Envíopack para nada. */
  const conTabla = cotizar(pedidas, envio.cp, metodoEnvio, metodoPago);

  /* Con envío gratis no hay nada que cotizar: el comprador paga cero
     salga lo que salga. Se ahorra la llamada.

     Ojo con la tentación de saltear también la validación de código
     postal cuando el envío es gratis: eso ya se probó, ya falló, y
     está corregido dentro de `cotizar()`. El envío gratis no cambia
     a dónde llega el correo. */
  if (conTabla.envioGratis) return conTabla;

  if (!hayCredenciales() || !envio.provincia) return conTabla;

  try {
    const tarifa = await cotizarDomicilio({
      provincia: envio.provincia,
      cp: envio.cp,
      peso: conTabla.peso,
      paquetes: conTabla.paquetes,
    });

    if (!tarifa) return conTabla;

    /* Pasada 2, con la tarifa del correo. */
    return cotizar(pedidas, envio.cp, metodoEnvio, metodoPago, tarifa);
  } catch (err) {
    /* Un error de cotización que se cuele desde la segunda pasada sí
       es nuestro y tiene que subir; cualquier otra cosa —red, tiempo
       agotado, un 500 de ellos— es del operador y no frena la venta. */
    if (err instanceof ErrorDeCotizacion) throw err;
    console.error('tarifa: Envíopack no cotizó, se usa la tabla —', err);
    return conTabla;
  }
}
