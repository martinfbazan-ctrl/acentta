/**
 * acentta · formato para Argentina
 * ---------------------------------------------------------------
 * Un solo lugar donde se decide cómo se ve un precio o una fecha.
 * Si mañana el sitio vende en otro país, se cambia acá.
 */

export const LOCALE = 'es-AR';
export const MONEDA = 'ARS';

const formateadorPrecio = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: MONEDA,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formateadorNumero = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});

/** 45900 → "$ 45.900" */
export function precio(valor: number): string {
  return formateadorPrecio.format(valor);
}

/** 128 → "128" · 1250 → "1.250" */
export function numero(valor: number): string {
  return formateadorNumero.format(valor);
}

/* ============================================================
   Transparencia fiscal
   ============================================================ */

/**
 * Alícuota general de IVA en Argentina.
 *
 * La mayoría de lo que vende acentta —vasos, botellas, termos, mates—
 * va al 21 %. Hay bienes al 10,5 % y exentos, y por eso el producto
 * puede declarar la suya: aplicar 21 % a algo que va al 10,5 %
 * informa un impuesto que no se cobró, y el número queda escrito en
 * la página como si fuera un dato.
 */
export const IVA_GENERAL = 0.21;

/**
 * Si el sitio muestra o no el precio sin impuestos nacionales.
 *
 * Está apagado a propósito y la decisión NO es técnica.
 *
 * El régimen de transparencia fiscal obliga a informar el IVA
 * contenido a quien lo discrimina, y un monotributista no discrimina
 * IVA: emite factura C, donde el total es el precio y no hay impuesto
 * desagregado. Mostrar «precio sin impuestos: $ 111.570» siendo
 * monotributista informa un IVA que no se cobra ni se ingresa como
 * tal — y lo informa con la autoridad de un número calculado.
 *
 * Se enciende poniendo esto en `true` el día que un contador lo
 * confirme, o el día que acentta pase a responsable inscripto.
 * Encender un renglón es una línea; desdecirse de un precio publicado
 * es otra cosa.
 */
export const MOSTRAR_PRECIO_SIN_IMPUESTOS = false;

/**
 * El precio sin el IVA contenido.
 *
 * En Argentina los precios se publican con IVA incluido, así que el
 * neto se obtiene DIVIDIENDO, no restando: $ 135.000 con 21 %
 * adentro son $ 135.000 / 1,21 = $ 111.570.
 *
 * Restar el 21 % daría $ 106.650, que es otro número y está mal.
 * Es el error clásico de este cálculo y por eso está escrito acá una
 * sola vez, con prueba propia.
 */
export function precioSinImpuestos(valor: number, alicuota = IVA_GENERAL): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  if (!Number.isFinite(alicuota) || alicuota < 0) return valor;
  return Math.round(valor / (1 + alicuota));
}

/** 4.6 → "4,6" — coma decimal, como se escribe en Argentina. */
export function decimal(valor: number, digitos = 1): string {
  return valor.toLocaleString(LOCALE, {
    minimumFractionDigits: digitos,
    maximumFractionDigits: digitos,
  });
}

/**
 * Cuántas cuotas sin interés se ofrecen con tarjeta de crédito.
 *
 * Un solo lugar, y no es prolijidad: este número estaba escrito a
 * mano en once archivos —ficha, tarjeta, carrito, checkout, pie,
 * marquesina, ayuda, términos, barra móvil…— y bastaba olvidarse de
 * uno para que el sitio prometiera doce en la portada y cobrara seis
 * en el checkout. Nada de eso da error: son dos números plausibles
 * en dos pantallas distintas, y el que se entera es el comprador.
 *
 * Hay una verificación en `pruebas/publicacion.mjs` que falla si
 * aparece «N cuotas» escrito a mano en cualquier archivo.
 *
 * El valor real lo definen el banco y la promoción vigente, así que
 * los textos dicen «hasta N» y no «N».
 */
export const CUOTAS_SIN_INTERES = 6;

/**
 * Cuotas sin interés.
 * En Latam la decisión de compra muchas veces no es el precio: es la cuota.
 * Por eso el monto de la cuota se muestra con el mismo peso visual que el total.
 */
export function cuota(total: number, cantidad: number = CUOTAS_SIN_INTERES): string {
  return precio(Math.round(total / cantidad));
}

/* ============================================================
   Fechas de entrega en lenguaje humano
   "llega entre el 12 y el 18 de agosto", no "7 a 14 días hábiles".
   El comprador no calcula días hábiles: quiere saber qué día llega.
   ============================================================ */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Suma días hábiles salteando sábados y domingos. */
export function sumarDiasHabiles(desde: Date, dias: number): Date {
  const fecha = new Date(desde);
  let restantes = dias;
  while (restantes > 0) {
    fecha.setDate(fecha.getDate() + 1);
    const dia = fecha.getDay();
    if (dia !== 0 && dia !== 6) restantes--;
  }
  return fecha;
}

/**
 * "entre el 12 y el 18 de agosto"
 * Si el rango cruza de mes: "entre el 29 de agosto y el 4 de septiembre".
 */
export function rangoDeEntrega(
  minDias: number,
  maxDias: number,
  desde: Date = new Date()
): string {
  const inicio = sumarDiasHabiles(desde, minDias);
  const fin = sumarDiasHabiles(desde, maxDias);

  const mismoMes = inicio.getMonth() === fin.getMonth();
  if (mismoMes) {
    return `entre el ${inicio.getDate()} y el ${fin.getDate()} de ${MESES[fin.getMonth()]}`;
  }
  return `entre el ${inicio.getDate()} de ${MESES[inicio.getMonth()]} y el ${fin.getDate()} de ${MESES[fin.getMonth()]}`;
}

/** "12 de agosto" */
export function fechaCorta(fecha: Date): string {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

/** "3 de agosto de 2026" */
export function fechaLarga(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/* ============================================================
   Envío gratis
   ============================================================ */

export interface EstadoEnvio {
  logrado: boolean;
  /** Cuánto falta en pesos. 0 si ya se alcanzó. */
  falta: number;
  /** 0 a 100, para la barra de progreso. */
  progreso: number;
  /** Texto listo para mostrar. */
  mensaje: string;
}

export function estadoEnvioGratis(subtotal: number, umbral: number): EstadoEnvio {
  const logrado = subtotal >= umbral;
  const falta = logrado ? 0 : umbral - subtotal;
  const progreso = Math.min(100, Math.round((subtotal / umbral) * 100));
  return {
    logrado,
    falta,
    progreso,
    mensaje: logrado
      ? 'Tienes envío gratis'
      : `Te faltan ${precio(falta)} para el envío gratis`,
  };
}
