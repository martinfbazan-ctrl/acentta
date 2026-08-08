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

/** 4.6 → "4,6" — coma decimal, como se escribe en Argentina. */
export function decimal(valor: number, digitos = 1): string {
  return valor.toLocaleString(LOCALE, {
    minimumFractionDigits: digitos,
    maximumFractionDigits: digitos,
  });
}

/**
 * Cuotas sin interés.
 * En Latam la decisión de compra muchas veces no es el precio: es la cuota.
 * Por eso el monto de la cuota se muestra con el mismo peso visual que el total.
 */
export function cuota(total: number, cantidad: number): string {
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
