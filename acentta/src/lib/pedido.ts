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

/**
 * Dónde rastrea el comprador su envío de OCA.
 *
 * Vive acá y no en `oca.ts` a propósito: `oca.ts` es código de
 * servidor —lee credenciales, llama a la API— y los guiones del
 * navegador que muestran el seguimiento no pueden importarlo sin
 * arrastrar todo eso al paquete que descarga el visitante.
 *
 * Es la página de búsqueda, no una dirección con el número adentro:
 * **OCA rastrea con un formulario**. Armar algo como
 * `.../Seguimiento?numero=123` sería inventar una dirección que
 * devuelve 404, y le tocaría descubrirlo al comprador justo en el
 * momento en que está ansioso por saber dónde está su pedido. Por
 * eso el número se muestra al lado, listo para copiar.
 */
export const URL_RASTREO_OCA = 'https://www.oca.com.ar/Seguimiento/BuscarEnvio/paquetes';

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
    detalle: 'Llegó. Desde hoy tienes 30 días para devolverlo sin cargo si no te convence.',
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
  /**
   * El número que le dio el correo, cuando el pedido ya salió.
   *
   * Los dos son opcionales porque en el momento de comprar no
   * existen: se conocen recién al despachar, uno o dos días después.
   * Un campo obligatorio los habría obligado a nacer vacíos, y un
   * seguimiento en blanco se lee como «se perdió el dato».
   */
  seguimiento?: string | null;
  /** Qué correo lo lleva: «OCA». Sin esto, el número no sirve. */
  correo?: string | null;
  /**
   * Cómo se pagó. Sólo hace falta distinguir la transferencia, que
   * es la única que deja algo pendiente del lado del comprador: con
   * tarjeta la plata ya salió, con transferencia todavía la tiene
   * que mandar él, y la confirmación tiene que decirle a dónde.
   */
  metodoPago?: 'tarjeta' | 'transferencia';
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
