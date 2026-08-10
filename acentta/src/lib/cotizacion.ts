/**
 * acentta · cotización de un pedido
 * ---------------------------------------------------------------
 * Ésta es LA función del cobro, y conviene entender por qué existe
 * antes de leerla.
 *
 * Hasta acá el carrito vivía entero en el navegador: el precio de
 * cada producto viajaba adentro del almacenamiento local y el total
 * lo sumaba el guion de la página. Para una simulación está perfecto.
 * Para cobrar es la vulnerabilidad clásica de las tiendas hechas a
 * mano:
 *
 *     Cualquiera abre las herramientas del navegador, cambia el
 *     precio de la lámpara de $ 89.900 a $ 1, y Mercado Pago le va a
 *     cobrar exactamente lo que el sitio le pidió que cobre.
 *
 * La regla que sale de ahí ordena todo lo demás:
 *
 *     El navegador manda QUÉ se compra —identificadores y
 *     cantidades— y NUNCA cuánto sale.
 *
 * Esta función recibe sólo identificadores y cantidades, busca cada
 * precio en el catálogo compilado, suma el envío con la misma tabla
 * de zonas que usa el resto del sitio, y devuelve un total. Lo que
 * haya escrito el navegador es irrelevante porque no se lee.
 *
 * POR QUÉ ES PURA Y VIVE ACÁ, Y NO ADENTRO DE LA FUNCIÓN DE SERVIDOR
 *
 * Para que el navegador pueda usar la misma. La página de checkout
 * necesita mostrar un total mientras la persona completa los datos,
 * y ese total tiene que ser el mismo que se va a cobrar: si el
 * resumen dice una cosa y Mercado Pago cobra otra, la venta está
 * perdida aunque el número de arriba fuera el correcto.
 *
 * Misma función, dos usos, y una sola asimetría que importa:
 * **la respuesta del servidor es la que vale**. La del navegador es
 * una vista previa.
 *
 * No importa nada del DOM ni del almacenamiento: es aritmética sobre
 * datos, así que corre igual en una función de Vercel, en el
 * navegador y en una prueba.
 */

import { porId } from '@lib/catalogo';
import { calcularEnvio } from '@lib/envio';
import { UMBRAL_ENVIO_GRATIS } from '@tipos/catalogo';

/** Lo único que el navegador tiene derecho a decidir. */
export interface LineaPedida {
  id: string;
  cantidad: number;
  variante?: string;
}

export interface LineaCotizada {
  id: string;
  slug: string;
  nombre: string;
  variante: string;
  cantidad: number;
  /** Precio unitario tomado del catálogo, no del navegador. */
  precio: number;
  subtotal: number;
  imagen: string;
}

export type MetodoEnvio = 'domicilio' | 'sucursal';
export type MetodoPago = 'tarjeta' | 'transferencia';

export interface Cotizacion {
  lineas: LineaCotizada[];
  subtotal: number;
  envio: number;
  envioGratis: boolean;
  zona?: string;
  diasExtra: number;
  descuento: number;
  total: number;
}

export class ErrorDeCotizacion extends Error {
  constructor(public readonly motivo: string, public readonly detalle?: string) {
    super(motivo);
    this.name = 'ErrorDeCotizacion';
  }
}

/* El retiro en sucursal descuenta un monto fijo; la transferencia,
   un porcentaje. Los dos viven acá y no en la página, porque son
   parte del precio y el precio se decide en un solo lugar. */
export const DESCUENTO_SUCURSAL = 1200;
export const DESCUENTO_TRANSFERENCIA = 0.1;

/** Tope de unidades por línea. No es una regla de negocio: es un
 *  freno a un pedido absurdo que vacíe el stock del proveedor por un
 *  error de tipeo o por alguien probando. */
export const MAXIMO_POR_LINEA = 20;

/**
 * Cotiza un pedido a partir de identificadores y cantidades.
 *
 * Lanza `ErrorDeCotizacion` en vez de devolver un total dudoso: un
 * producto que no existe, una cantidad imposible o un código postal
 * sin cobertura tienen que cortar el circuito, no seguir con un
 * número inventado.
 */
export function cotizar(
  pedidas: LineaPedida[],
  cp: string,
  metodoEnvio: MetodoEnvio = 'domicilio',
  metodoPago: MetodoPago = 'tarjeta',
): Cotizacion {
  if (!Array.isArray(pedidas) || pedidas.length === 0) {
    throw new ErrorDeCotizacion('El pedido no tiene productos.');
  }
  if (pedidas.length > 50) {
    throw new ErrorDeCotizacion('El pedido tiene demasiadas líneas.');
  }

  const lineas: LineaCotizada[] = [];
  let peso = 0;

  for (const p of pedidas) {
    /* Entero estricto, sin redondear. Redondear 1,5 a 1 «funciona» y
       esconde que llegó algo que ninguna pantalla del sitio puede
       producir: un pedido armado a mano. Es preferible cortar y
       mirarlo. */
    const cantidad = Number(p?.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAXIMO_POR_LINEA) {
      throw new ErrorDeCotizacion('Cantidad inválida.', `${p?.id}: ${p?.cantidad}`);
    }

    const producto = porId(String(p?.id ?? ''));
    if (!producto) {
      throw new ErrorDeCotizacion('Ese producto ya no está disponible.', String(p?.id));
    }

    /* La variante también se valida contra el catálogo. Si se acepta
       cualquier texto, termina en el remito del proveedor un color
       que no existe y el pedido se despacha mal. */
    const variante = p.variante
      ? producto.variantes.find((v) => v.nombre === p.variante)
      : producto.variantes.find((v) => v.stock > 0) ?? producto.variantes[0];
    if (!variante) {
      throw new ErrorDeCotizacion('Esa variante no existe.', `${producto.nombre}: ${p.variante}`);
    }

    /* El stock del catálogo es lo que el proveedor dice tener, así
       que acá se usa como tope y no como promesa. Lo que no se hace
       es dejar pasar un pedido de treinta unidades de algo que
       declara tres. */
    if (variante.stock <= 0) {
      throw new ErrorDeCotizacion('Ese producto se quedó sin stock.', producto.nombre);
    }
    if (cantidad > variante.stock) {
      throw new ErrorDeCotizacion(
        `Quedan ${variante.stock} unidades de ${producto.nombre}.`,
        `pedidas ${cantidad}`,
      );
    }

    lineas.push({
      id: producto.id,
      slug: producto.slug,
      nombre: producto.nombre,
      variante: variante.nombre,
      cantidad,
      precio: producto.precio,
      subtotal: producto.precio * cantidad,
      imagen: producto.imagenes[0]!.src,
    });
    peso += producto.peso * cantidad;
  }

  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  const envioGratis = subtotal >= UMBRAL_ENVIO_GRATIS;

  /* [ERROR CORREGIDO] El código postal se valida SIEMPRE, cobre o no
     cobre el envío.

     Antes esta validación estaba adentro del `if (!envioGratis)`, y
     la consecuencia no era de precio sino de promesa: un pedido de
     más de $ 50.000 a un código postal sin cobertura entraba sin
     protestar, se cobraba, y recién al ir a despacharlo aparecía que
     ahí no llegamos. El envío gratis no cambia dónde llega el correo.

     Lo encontró la prueba, no una persona: en la corrida el producto
     elegido superaba el umbral y los dos casos —sin código postal y
     con uno inexistente— pasaban limpios. */
  const calculo = calcularEnvio(cp, peso);
  if (!calculo.ok) {
    throw new ErrorDeCotizacion(
      calculo.error ?? 'No podemos entregar en ese código postal.',
      cp,
    );
  }

  const zona = calculo.zona;
  const diasExtra = calculo.diasExtra!;
  let envio = 0;

  if (!envioGratis) {
    envio = calculo.costo!;
    if (metodoEnvio === 'sucursal') envio = Math.max(0, envio - DESCUENTO_SUCURSAL);
  }

  const descuento = metodoPago === 'transferencia'
    ? Math.round(subtotal * DESCUENTO_TRANSFERENCIA)
    : 0;

  const total = subtotal + envio - descuento;

  /* Una red de seguridad, no una validación de negocio. Si alguna vez
     una combinación de descuentos diera cero o negativo, es preferible
     cortar acá que crear un cobro de un peso. */
  if (!Number.isFinite(total) || total <= 0) {
    throw new ErrorDeCotizacion('El total del pedido no es válido.');
  }

  return { lineas, subtotal, envio, envioGratis, zona, diasExtra, descuento, total };
}
