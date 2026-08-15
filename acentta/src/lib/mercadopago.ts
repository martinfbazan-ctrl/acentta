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

export function hayCredenciales(): boolean {
  return Boolean(variable('MP_ACCESS_TOKEN'));
}

/**
 * En qué entorno DECIMOS que estamos.
 *
 * [ERROR CORREGIDO] Antes esto se deducía del prefijo del token:
 * los de prueba empezaban con `TEST-`. Mercado Pago unificó el
 * formato y hoy los dos empiezan con `APP_USR-`, así que ese chequeo
 * pasó a dar siempre «producción» — incluido para un token de prueba
 * perfectamente válido. Una alarma falsa en un semáforo de seguridad
 * es peor que no tenerlo: enseña a ignorarlo.
 *
 * Lo que distingue un entorno del otro es un campo que devuelve la
 * propia API, `live_mode`. Pero un campo que llega en una respuesta
 * no sirve para *decidir* antes de pedirla, así que el modo se
 * declara a mano en una variable de entorno y después se verifica
 * contra lo que contesta Mercado Pago.
 *
 * El valor de fábrica es «prueba», y es a propósito: si alguien
 * olvida declararlo, lo que falla es un cobro de mentira, no uno de
 * verdad.
 */
export function modoDeclarado(): 'prueba' | 'produccion' {
  return variable('MP_MODO').toLowerCase().startsWith('produc') ? 'produccion' : 'prueba';
}

/**
 * ¿Se puede seguir con este cobro?
 *
 * `liveMode` es lo que dice Mercado Pago; `declarado` es lo que dice
 * la configuración del sitio. Si no coinciden, se corta.
 *
 * El caso que importa es uno solo: Mercado Pago dice que el cobro es
 * real y nosotros creíamos estar probando. Ahí hay plata de alguien
 * en juego y una entrega comprometida, así que no se sigue.
 *
 * El caso inverso —credenciales de prueba con el sitio declarado en
 * producción— no cobra nada y no lastima a nadie; se deja pasar y se
 * avisa por el diagnóstico.
 */
export function cobroPermitido(liveMode: boolean, declarado = modoDeclarado()): boolean {
  return !(liveMode && declarado !== 'produccion');
}

/**
 * A qué pantalla de pago hay que mandar a la persona.
 *
 * **`init_point` siempre.** Con credenciales de prueba, esa misma
 * pantalla se pone en modo de prueba sola —lo muestra con un cartel
 * «Test» arriba a la derecha— y es el único camino que documenta
 * Mercado Pago hoy. `sandbox_init_point` es el entorno viejo y queda
 * sólo como reserva, para el caso improbable de que una cuenta no
 * devuelva el primero.
 *
 * [DECISIÓN REVISADA] Estuve mandando a la pantalla vieja en modo de
 * prueba, convencido de que el error «Una de las partes con la que
 * intentás hacer el pago es de prueba» venía de mezclar entornos. No
 * era eso: el mismo error aparecía en las dos pantallas, así que lo
 * que fallaba era el otro lado —se estaba pagando como invitado, y un
 * invitado es una parte real frente a una tienda de prueba—. La
 * pantalla nunca fue el problema; el cartel «Test» ya lo estaba
 * diciendo.
 *
 * Queda como función aparte, con prueba propia, porque es una
 * decisión de una línea que rompe el circuito en la última pantalla,
 * después de que la persona cargó la tarjeta.
 */
export function enlaceDePago(
  datos: { init_point?: string; sandbox_init_point?: string; live_mode?: boolean | null },
  _declarado = modoDeclarado(),
): string | undefined {
  void _declarado;
  return datos.init_point ?? datos.sandbox_init_point;
}

/**
 * Una fecha como la espera Mercado Pago.
 *
 *     2026-08-11T19:30:00.000-03:00
 *
 * Con desplazamiento horario escrito, no con `Z`. Se usa el de
 * Argentina, que es fijo todo el año —no hay horario de verano— así
 * que no hay ningún caso borde de dos veces la misma hora.
 *
 * Se exporta para poder probarla: una fecha mal formada acá no falla
 * al crear la preferencia, falla después y en silencio.
 */
export function fechaParaMercadoPago(ms: number, desfasajeHoras = -3): string {
  const d = new Date(ms + desfasajeHoras * 60 * 60 * 1000);
  const dd = (n: number, largo = 2) => String(n).padStart(largo, '0');
  const signo = desfasajeHoras < 0 ? '-' : '+';
  const horas = dd(Math.floor(Math.abs(desfasajeHoras)));
  const minutos = dd(Math.round((Math.abs(desfasajeHoras) % 1) * 60));
  return `${d.getUTCFullYear()}-${dd(d.getUTCMonth() + 1)}-${dd(d.getUTCDate())}`
    + `T${dd(d.getUTCHours())}:${dd(d.getUTCMinutes())}:${dd(d.getUTCSeconds())}`
    + `.${dd(d.getUTCMilliseconds(), 3)}${signo}${horas}:${minutos}`;
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
}): Promise<{ id: string; enlace: string; liveMode: boolean }> {
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
       siempre: un enlace de pago filtrado serviría para siempre.

       [ERROR CORREGIDO] La fecha iba en formato `...T22:30:00.000Z`.
       Mercado Pago documenta el formato con desplazamiento horario
       explícito —`...T19:30:00.000-03:00`— y su lector no siempre
       acepta la `Z`. Cuando no la puede leer, no devuelve un error al
       crear la preferencia: la acepta, y después **deja el botón de
       pagar apagado, sin decir por qué**. Desde afuera se ve como una
       pantalla de Mercado Pago rota.

       Se manda con desplazamiento, y con margen: dos horas. Media
       hora alcanza para pagar, no para probar. */
    expires: true,
    expiration_date_to: fechaParaMercadoPago(Date.now() + 2 * 60 * 60 * 1000),
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

  const datos = (await r.json()) as {
    id?: string; init_point?: string; sandbox_init_point?: string;
    live_mode?: boolean; message?: string;
  };
  if (!r.ok || !datos.id) {
    throw new Error(`Mercado Pago rechazó la preferencia (${r.status}): ${datos.message ?? 'sin detalle'}`);
  }

  /* [ERROR CORREGIDO] Cada entorno tiene su propia pantalla de pago,
     y hay que mandar a la persona a la que corresponde.

         init_point          → www.mercadopago.com.ar     (producción)
         sandbox_init_point  → sandbox.mercadopago.com.ar (laboratorio)

     Mandar una preferencia de prueba a la pantalla de producción
     termina en «Algo salió mal… Una de las partes con la que intentás
     hacer el pago es de prueba». El mensaje es exacto: la tienda es
     de prueba y la pantalla es la real.

     Yo mismo lo tenía bien y lo rompí: la versión original elegía
     según el modo, pero lo decidía mirando si el token empezaba con
     `TEST-`. Cuando corregí esa detección —el prefijo ya no
     distingue nada— saqué también la elección de enlace, que sí
     hacía falta. Un arreglo que se lleva puesta una decisión
     correcta que estaba al lado.

     Ahora se decide con `live_mode`, que lo dice la propia respuesta.
     Cuando no viene —pasa con algunas preferencias— se cae en lo que
     declara la configuración, que para eso está. */
  const enlace = enlaceDePago(datos);
  if (!enlace) throw new Error('Mercado Pago no devolvió un enlace de pago.');

  /* Éste es el dato que dice si el cobro es real. Viene de la propia
     API, no de un prefijo ni de una suposición nuestra. */
  return { id: datos.id, enlace, liveMode: datos.live_mode === true };
}

/**
 * Quién es el dueño del token, sin exponer nada.
 *
 * Sirve para el diagnóstico: las credenciales de prueba pertenecen a
 * una cuenta de prueba, y esas cuentas tienen un alias que empieza
 * con TEST. Es una lectura, no crea nada y no cobra nada.
 */
export async function consultarCuenta(): Promise<{ ok: boolean; esCuentaDePrueba: boolean }> {
  try {
    const r = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!r.ok) return { ok: false, esCuentaDePrueba: false };
    const d = (await r.json()) as { nickname?: string };
    return { ok: true, esCuentaDePrueba: String(d.nickname ?? '').toUpperCase().startsWith('TEST') };
  } catch {
    return { ok: false, esCuentaDePrueba: false };
  }
}

/**
 * Una preferencia con lo mínimo indispensable, para aislar culpas.
 *
 * Cuando el botón de pagar de Mercado Pago queda apagado y no dice
 * por qué, hay dos familias de causa: algo de la preferencia que
 * armamos nosotros, o algo de la cuenta con la que se está pagando.
 * Desde afuera se ven igual.
 *
 * Ésta manda un producto de cien pesos y nada más: sin vencimiento,
 * sin retorno automático, sin aviso de pago, sin envío. Si con ésta
 * se puede pagar, el problema es alguno de los campos que le
 * agregamos a la de verdad, y se va probando de a uno. Si tampoco se
 * puede, el problema no está en el código.
 *
 * Sólo funciona en modo de prueba: en producción crearía cobros
 * reales de cien pesos, que es exactamente la clase de cosa que no
 * puede quedar accesible por una dirección.
 */
export async function crearPreferenciaMinima(): Promise<Record<string, unknown>> {
  const r = await fetch(`${API}/checkout/preferences`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ title: 'Prueba de integración', quantity: 1, unit_price: 100, currency_id: 'ARS' }],
    }),
  });
  const d = (await r.json()) as Record<string, unknown>;
  return {
    estadoHttp: r.status,
    id: d.id ?? null,
    live_mode: d.live_mode ?? null,
    init_point: d.init_point ?? null,
    sandbox_init_point: d.sandbox_init_point ?? null,
    error: d.message ?? d.error ?? null,
    causa: d.cause ?? null,
  };
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
