/**
 * acentta · lo mínimo de Mercado Pago, escrito a mano
 * ---------------------------------------------------------------
 * Tres cosas: crear una preferencia, consultar un pago y validar la
 * firma de un aviso. Son tres llamadas HTTP y un HMAC, así que no se
 * suma el SDK oficial: en una función que maneja plata, cada
 * dependencia es código que hay que confiar sin leer.
 *
 * CHECKOUT PRO, NO CHECKOUT API
 *
 * La persona salta al entorno de Mercado Pago, paga ahí y vuelve.
 * Este sitio nunca ve un número de tarjeta, así que no entra en las
 * obligaciones de seguridad de datos de tarjeta. Con Checkout API el
 * formulario quedaría acá y el problema más grande de todo el
 * proyecto sería nuestro.
 *
 * El costo es real: se pierde el paso 3 del checkout tal como estaba,
 * que era lindo. Se cambia por un resumen y un botón.
 */

import crypto from 'node:crypto';

const API = 'https://api.mercadopago.com';

/** Igual que en el almacén: se lee al usarse, y de las dos fuentes. */
export function variable(nombre: string): string {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const proceso = typeof process !== 'undefined' ? (process.env ?? {}) : {};
  return proceso[nombre] ?? meta[nombre] ?? '';
}

function token(): string {
  const t = variable('MP_ACCESS_TOKEN');
  if (!t) throw new Error('Falta MP_ACCESS_TOKEN en las variables de entorno.');
  return t;
}

/** ¿Estamos con credenciales de prueba? Las de prueba empiezan así. */
export function esModoPrueba(): boolean {
  return variable('MP_ACCESS_TOKEN').startsWith('TEST-');
}

export function hayCredenciales(): boolean {
  return Boolean(variable('MP_ACCESS_TOKEN'));
}

export interface ItemPreferencia {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
}

/**
 * Crea la preferencia y devuelve el enlace al que hay que mandar a
 * la persona.
 *
 * `external_reference` es el número de pedido nuestro. Es el hilo que
 * une el pago de Mercado Pago con nuestro registro: sin eso, cuando
 * llega el aviso no hay forma de saber qué pedido confirmar.
 */
export async function crearPreferencia(opciones: {
  numeroPedido: string;
  items: ItemPreferencia[];
  envio: number;
  descuento: number;
  emailComprador: string;
  urlSitio: string;
}): Promise<{ id: string; enlace: string }> {
  const { numeroPedido, items, envio, descuento, emailComprador, urlSitio } = opciones;

  /* El descuento por transferencia se aplica como una línea negativa
     y no bajando el precio de los productos: así el comprobante de
     Mercado Pago muestra el precio de lista y el descuento aparte,
     que es lo que se espera ver en un resumen de compra. */
  const lineas: ItemPreferencia[] = [...items];
  if (descuento > 0) {
    lineas.push({ id: 'descuento', title: 'Descuento por transferencia', quantity: 1, unit_price: -descuento });
  }

  const cuerpo = {
    items: lineas.map((i) => ({ ...i, currency_id: 'ARS' })),
    payer: { email: emailComprador },
    external_reference: numeroPedido,
    statement_descriptor: 'ACENTTA',
    back_urls: {
      success: `${urlSitio}/confirmacion?pedido=${numeroPedido}`,
      pending: `${urlSitio}/confirmacion?pedido=${numeroPedido}`,
      failure: `${urlSitio}/checkout?pago=rechazado&pedido=${numeroPedido}`,
    },
    auto_return: 'approved',
    notification_url: `${urlSitio}/api/aviso-de-pago`,
    /* El envío va como costo de envío y no como un producto más:
       Mercado Pago lo muestra en su propia línea y el comprobante
       queda legible. */
    shipments: envio > 0 ? { cost: envio, mode: 'not_specified' } : undefined,
    /* Sin esto, una preferencia vieja sigue siendo pagable para
       siempre. Media hora es de sobra para completar un pago y corto
       para que un enlace filtrado sirva de algo. */
    expires: true,
    expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  const r = await fetch(`${API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      /* Si la red corta y el navegador reintenta, esta clave hace que
         Mercado Pago devuelva la preferencia que ya creó en vez de
         crear una segunda para el mismo pedido. */
      'X-Idempotency-Key': numeroPedido,
    },
    body: JSON.stringify(cuerpo),
  });

  const datos = (await r.json()) as { id?: string; init_point?: string; sandbox_init_point?: string; message?: string };
  if (!r.ok || !datos.id) {
    throw new Error(`Mercado Pago rechazó la preferencia (${r.status}): ${datos.message ?? 'sin detalle'}`);
  }

  /* Con credenciales de prueba hay que mandar a la persona al enlace
     de prueba; el de producción pediría una tarjeta real. */
  const enlace = esModoPrueba()
    ? (datos.sandbox_init_point ?? datos.init_point!)
    : datos.init_point!;

  return { id: datos.id, enlace };
}

export interface PagoConsultado {
  id: string;
  estado: 'approved' | 'pending' | 'in_process' | 'rejected' | 'refunded' | 'cancelled' | 'charged_back' | string;
  detalle: string;
  monto: number;
  referenciaExterna: string;
}

/**
 * Consulta el estado real del pago.
 *
 * El aviso trae un identificador y nada más: no dice si el pago se
 * aprobó. Aunque lo dijera, no habría que creerle — el aviso es un
 * mensaje que llega por la red y esto es una pregunta directa a la
 * fuente, autenticada con nuestro token.
 */
export async function consultarPago(id: string): Promise<PagoConsultado> {
  const r = await fetch(`${API}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!r.ok) throw new Error(`No se pudo consultar el pago ${id}: ${r.status}`);
  const d = (await r.json()) as Record<string, unknown>;
  return {
    id: String(d.id ?? id),
    estado: String(d.status ?? 'desconocido'),
    detalle: String(d.status_detail ?? ''),
    monto: Number(d.transaction_amount ?? 0),
    referenciaExterna: String(d.external_reference ?? ''),
  };
}

/**
 * Valida que el aviso lo haya mandado Mercado Pago.
 *
 * Sin esto, cualquiera que descubra la dirección de la función manda
 * un «pago aprobado» y se lleva mercadería gratis. Es la validación
 * más importante de todo el circuito.
 *
 * El manifiesto que se firma es exactamente:
 *
 *     id:{data.id};request-id:{x-request-id};ts:{ts};
 *
 * con dos detalles que no se pueden improvisar: el identificador va
 * en minúsculas, y los pares cuyo valor no vino en la petición se
 * omiten del manifiesto en lugar de ir vacíos. Si se arma mal, la
 * firma nunca coincide y todos los avisos legítimos se rechazan.
 *
 * La comparación es en tiempo constante. Comparar dos textos con `===`
 * corta en el primer carácter distinto, y ese tiempo distinto es
 * suficiente para adivinar una firma byte por byte.
 */
export function firmaValida(opciones: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secreto: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secreto } = opciones;
  if (!xSignature || !secreto) return false;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const parte of xSignature.split(',')) {
    const corte = parte.indexOf('=');
    if (corte === -1) continue;
    const clave = parte.slice(0, corte).trim();
    const valor = parte.slice(corte + 1).trim();
    if (clave === 'ts') ts = valor;
    if (clave === 'v1') v1 = valor;
  }
  if (!ts || !v1) return false;

  const partes: string[] = [];
  if (dataId) partes.push(`id:${dataId.toLowerCase()}`);
  if (xRequestId) partes.push(`request-id:${xRequestId}`);
  partes.push(`ts:${ts}`);
  const manifiesto = `${partes.join(';')};`;

  const calculada = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');

  const a = Buffer.from(calculada, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
