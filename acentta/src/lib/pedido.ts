/**
 * acentta · estado del pedido
 * ---------------------------------------------------------------
 * El pedido vive en el navegador porque no hay servidor. Lo que sí
 * es real es el modelo: cinco estados, con fecha y con el texto que
 * corresponde a cada uno.
 *
 * Criterio de redacción: cada estado dice qué pasó y qué sigue. Un
 * seguimiento que sólo dice "En tránsito" obliga a adivinar cuánto
 * falta, y esa incertidumbre es lo que genera el mail de "¿dónde
 * está mi pedido?" que nadie quiere escribir ni responder.
 */

export type EstadoPedido =
  | 'confirmado'
  | 'preparando'
  | 'despachado'
  | 'en-camino'
  | 'entregado';

export const ESTADOS: EstadoPedido[] = [
  'confirmado',
  'preparando',
  'despachado',
  'en-camino',
  'entregado',
];

export interface PasoEstado {
  clave: EstadoPedido;
  nombre: string;
  detalle: string;
  /** Horas desde la compra en que suele ocurrir. */
  horas: number;
}

export const PASOS: PasoEstado[] = [
  {
    clave: 'confirmado',
    nombre: 'Pedido confirmado',
    detalle: 'Recibimos el pago. Ya está en la cola de preparación.',
    horas: 0,
  },
  {
    clave: 'preparando',
    nombre: 'En preparación',
    detalle: 'Lo estamos empaquetando en el depósito. Suele llevar un día hábil.',
    horas: 4,
  },
  {
    clave: 'despachado',
    nombre: 'Despachado',
    detalle: 'Salió del depósito y lo tiene el correo. Te enviamos el número de seguimiento por correo electrónico.',
    horas: 30,
  },
  {
    clave: 'en-camino',
    nombre: 'En camino a tu domicilio',
    detalle: 'Está en la última etapa. El correo intenta la entrega en horario comercial; si no hay nadie, deja aviso y reintenta al día siguiente.',
    horas: 96,
  },
  {
    clave: 'entregado',
    nombre: 'Entregado',
    detalle: 'Llegó. Desde hoy tenés 30 días para devolverlo sin cargo si no te convence.',
    horas: 168,
  },
];

export interface PedidoGuardado {
  numero: string;
  fecha: string;
  total: number;
  envio: number;
  zona: string;
  email: string;
  diasExtra: number;
  items: {
    slug: string;
    nombre: string;
    imagen: string;
    variante: string;
    cantidad: number;
    precio: number;
  }[];
}

const CLAVE = 'acentta:pedido:v1';

export function leerPedido(): PedidoGuardado | null {
  try {
    const bruto = localStorage.getItem(CLAVE);
    return bruto ? (JSON.parse(bruto) as PedidoGuardado) : null;
  } catch {
    return null;
  }
}

/**
 * Estado según las horas transcurridas desde la compra.
 * En una tienda real esto lo devuelve el proveedor de logística;
 * acá se deriva del tiempo para que el seguimiento avance solo en
 * vez de quedar congelado en "confirmado".
 */
export function estadoActual(pedido: PedidoGuardado, forzado?: EstadoPedido): number {
  if (forzado) return ESTADOS.indexOf(forzado);
  const horas = (Date.now() - new Date(pedido.fecha).getTime()) / 36e5;
  let indice = 0;
  PASOS.forEach((p, i) => { if (horas >= p.horas) indice = i; });
  return indice;
}

/** Fecha estimada de cada paso, a partir de la fecha de compra. */
export function fechaDePaso(pedido: PedidoGuardado, indice: number): Date {
  const base = new Date(pedido.fecha).getTime();
  return new Date(base + PASOS[indice]!.horas * 36e5);
}
