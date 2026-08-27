/**
 * acentta · cobrar con Mobbex
 * ---------------------------------------------------------------
 * Implementa el contrato de `pasarela.ts`. Tres llamadas HTTP y una
 * comparación de textos; no se suma el SDK oficial por lo mismo que
 * no se sumó el de Mercado Pago: en el código que maneja plata, cada
 * dependencia es algo que hay que confiar sin haberlo leído.
 *
 * CHECKOUT ALOJADO, NO FORMULARIO PROPIO
 *
 * La persona salta al entorno de Mobbex, paga ahí y vuelve. Este
 * sitio nunca ve un número de tarjeta y por lo tanto no entra en las
 * obligaciones de seguridad de datos de tarjeta. Mobbex ofrece además
 * un modo embebido, que se ve mejor porque no saca a la persona del
 * sitio; no se usa acá porque el iframe sigue siendo suyo pero el
 * dominio pasa a ser nuestro, y esa distinción es justamente la que
 * después hay que explicarle a un auditor.
 *
 * ─────────────────────────────────────────────────────────────────
 * LA DIFERENCIA IMPORTANTE CON MERCADO PAGO
 *
 * **Mobbex no firma los avisos.** Mercado Pago manda una cabecera
 * `x-signature` con un HMAC que se puede recalcular; Mobbex manda
 * `content-type: application/json` y nada más. No hay firma que
 * verificar porque no hay firma.
 *
 * Eso obliga a apoyarse en dos cosas en lugar de una:
 *
 *   1 · Un token secreto en la propia dirección del aviso. Es más
 *       débil que una firma —viaja en la URL, y las URLs terminan en
 *       registros— así que se trata como una molestia para el que
 *       tantea, no como la defensa.
 *
 *   2 · **La defensa de verdad: no creerle al aviso.** El cuerpo del
 *       aviso sólo dice por cuál pedido preguntar. El estado y el
 *       monto salen siempre de una consulta a la API de Mobbex,
 *       autenticada con nuestras credenciales, y el monto se compara
 *       contra el cotizado antes de aprobar nada.
 *
 * Con la regla 2 puesta, lo peor que consigue un aviso falsificado es
 * que consultemos un pago que ya existe y volvamos a escribir el
 * mismo estado. No hay forma de que un mensaje inventado apruebe un
 * pedido, porque ningún dato del mensaje llega a escribirse.
 * ─────────────────────────────────────────────────────────────────
 */

import crypto from 'node:crypto';
import { variable } from '@lib/entorno';
import type {
  Aviso, CobroCreado, DatosDeCobro, EstadoPago, PagoConsultado, Pasarela,
} from '@lib/pasarela';

const API = 'https://api.mobbex.com';

/* ------------------------------------------------------------------ *
 * Credenciales y modo
 * ------------------------------------------------------------------ */

/* Se recortan los extremos a propósito.
 *
 * Un espacio o un salto de línea que viajó con el copiar y pegar
 * desde el panel de Mobbex al de Vercel convierte una credencial
 * válida en un 401, y el mensaje que devuelve Mobbex —«el API Key es
 * obligatorio»— manda a buscar en el lugar equivocado: parece que la
 * variable no está cargada cuando en realidad está de más.
 *
 * Recortar acá no esconde nada: `/api/estado` avisa igual cuando
 * detecta el sobrante, para que se corrija en el origen. */
const apiKey = () => variable('MOBBEX_API_KEY').trim();
const accessToken = () => variable('MOBBEX_ACCESS_TOKEN').trim();

export function hayCredenciales(): boolean {
  return Boolean(apiKey() && accessToken());
}

function cabeceras(): Record<string, string> {
  if (!hayCredenciales()) {
    throw new Error('Faltan MOBBEX_API_KEY y MOBBEX_ACCESS_TOKEN en las variables de entorno.');
  }
  return {
    'x-api-key': apiKey(),
    'x-access-token': accessToken(),
    'Content-Type': 'application/json',
  };
}

/**
 * En qué entorno decimos que estamos.
 *
 * El valor de fábrica es «prueba», y es a propósito: si alguien
 * olvida declararlo, lo que falla es un cobro de mentira y no uno de
 * verdad.
 */
export function modoDeclarado(): 'prueba' | 'produccion' {
  return variable('MOBBEX_MODO').toLowerCase().startsWith('produc') ? 'produccion' : 'prueba';
}

/**
 * Acá el seguro es mejor que en Mercado Pago, y vale la pena decir
 * por qué.
 *
 * Con Mercado Pago el entorno lo decidían las credenciales: si por
 * error subías las de producción, el cobro era real y lo único que
 * podíamos hacer era darnos cuenta después, mirando `live_mode` en la
 * respuesta, y cancelar el pedido. El cobro ya existía.
 *
 * Mobbex tiene un campo `test` en el propio pedido de cobro. Mientras
 * `MOBBEX_MODO` no diga producción, ese campo va en `true` y el cobro
 * **no puede** ser real, ni siquiera con credenciales de producción
 * cargadas. Deja de ser una alarma y pasa a ser un impedimento.
 *
 * La función se mantiene igual para que la ruta no tenga que saber
 * cuál de las dos pasarelas está usando.
 */
export function cobroPermitido(real: boolean, declarado = modoDeclarado()): boolean {
  return !(real && declarado !== 'produccion');
}

/* ------------------------------------------------------------------ *
 * Traducción de estados
 * ------------------------------------------------------------------ */

/**
 * Los códigos de Mobbex a nuestros cinco estados.
 *
 * La tabla completa está en su documentación y tiene más de treinta
 * códigos. Acá interesan los grupos, no cada uno, con una regla que
 * no se negocia: **lo que no está claramente cobrado, es pendiente.**
 * Un pedido pendiente de más se revisa a mano; uno aprobado de más se
 * despacha y la mercadería no vuelve.
 *
 * Dos códigos merecen atención porque parecen aprobados y no lo son:
 *
 *   3 · «autorizada» — es la operatoria en dos pasos: la tarjeta
 *       aceptó pero la plata todavía no se capturó. Si esto contara
 *       como aprobado, se despacharía contra una autorización que
 *       puede caducar sin cobrarse nunca.
 *
 *   2 · «en espera» — es el cupón de efectivo emitido y todavía sin
 *       pagar. Es exactamente el estado de alguien que imprimió un
 *       Rapipago y no fue.
 */
export function traducirCodigo(codigo: string | number): EstadoPago {
  const c = String(codigo).trim();
  switch (c) {
    /* Cobrado, con la plata efectivamente tomada. */
    case '4':    // entregada
    case '200':  // paga
    case '201':  // aceptada
    case '300':  // acreditado
    case '301':  // liquidado
    case '302':  // conciliada
      return 'aprobado';

    /* La plata volvió, entera o en parte. */
    case '602':  // devuelta
    case '605':  // parcialmente devuelta
      return 'devuelto';

    /* No se va a cobrar, y el motivo es del lado del pago. */
    case '400':  // declinada
    case '403':  // fallida
    case '410': case '411': case '412': case '413': case '414':
    case '415': case '416': case '417': case '418': case '419':
    case '500':  // error
    case '604':  // transacción denegada
      return 'rechazado';

    /* No se va a cobrar, y el motivo es que la operación se abandonó. */
    case '401':  // expirada
    case '402':  // abandonada
    case '600':  // cancelación en proceso
    case '601':  // cancelada
    case '610':  // cancelada por operatoria inválida
      return 'cancelado';

    /* 0, 1, 2, 3, 100, 210, 299, 303, 603, 800 y cualquier código que
       Mobbex agregue el año que viene. */
    default:
      return 'pendiente';
  }
}

/* ------------------------------------------------------------------ *
 * Abrir el cobro
 * ------------------------------------------------------------------ */

/**
 * La dirección a la que Mobbex tiene que avisar.
 *
 * Lleva el token en la propia dirección porque Mobbex no permite
 * agregar cabeceras propias a sus avisos. Cuando no hay token
 * configurado la dirección va igual: el aviso va a llegar y va a ser
 * rechazado, que es preferible a no pedir avisos y quedarse esperando
 * uno que nunca se pidió.
 */
export function urlDeAviso(urlSitio: string): string {
  const token = variable('MOBBEX_WEBHOOK_TOKEN');
  const t = token ? `&token=${encodeURIComponent(token)}` : '';
  return `${urlSitio}/api/aviso-de-pago?fuente=mobbex${t}`;
}

export async function crearCobro(datos: DatosDeCobro): Promise<CobroCreado> {
  const { numeroPedido, lineas, envio, descuento, total, comprador, entrega, urlSitio } = datos;

  const modo = modoDeclarado();
  const enPrueba = modo !== 'produccion';

  /* Los ítems son el detalle que se ve en la pantalla de pago. En
     Mobbex no deciden cuánto se cobra —eso lo hace `total`— así que
     el envío y el descuento pueden ir como dos líneas más y el
     comprobante queda leyéndose como el resumen del carrito. */
  const items: { description: string; quantity: number; total: number }[] = lineas.map((l) => ({
    description: l.nombre,
    quantity: l.cantidad,
    total: l.precio * l.cantidad,
  }));
  if (envio > 0) items.push({ description: 'Envío', quantity: 1, total: envio });
  if (descuento > 0) {
    items.push({ description: 'Descuento por transferencia', quantity: 1, total: -descuento });
  }

  const cuerpo: Record<string, unknown> = {
    /* El número que se cobra. Sale de `cotizar()`, en el servidor, y
       nunca del navegador. */
    total,
    currency: 'ARS',
    description: `acentta · pedido ${numeroPedido}`,

    /* Nuestro número de pedido. Es el hilo que une el pago con el
       registro, y además Mobbex se niega a aprobar dos operaciones
       con la misma referencia: el antiduplicado lo hace la pasarela. */
    reference: numeroPedido,

    /* Mientras no estemos declarados en producción, esto impide que
       el cobro sea real. No avisa: impide. */
    test: enPrueba,

    return_url: `${urlSitio}/confirmacion?pedido=${encodeURIComponent(numeroPedido)}`,
    webhook: urlDeAviso(urlSitio),

    items,

    customer: {
      email: comprador.email,
      name: `${comprador.nombre} ${comprador.apellido}`.trim(),
      /* Mobbex exige el documento. El checkout ya lo pide. */
      identification: comprador.dni,
      phone: comprador.telefono || undefined,
    },

    /* Sin esto un cobro abierto sigue siendo pagable durante una hora
       larga. Sesenta minutos es el valor de fábrica y alcanza de
       sobra: nadie tarda una hora en cargar una tarjeta. */
    timeout: 60,

    options: {
      /* Sin correos ni mensajes de Mobbex al comprador. Los avisos
         del pedido los manda acentta, con su propio texto; dos
         remitentes distintos para la misma compra confunden más de lo
         que tranquilizan. */
      embed: false,
    },
  };

  if (entrega) {
    cuerpo.addresses = [{
      type: 'shipping',
      country: 'ARG',
      street: entrega.calle,
      streetNumber: entrega.numero,
      streetNotes: entrega.piso || undefined,
      zipCode: entrega.cp,
      city: entrega.ciudad,
    }];
  }

  const r = await fetch(`${API}/p/checkout`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify(cuerpo),
  });

  const respuesta = (await r.json().catch(() => ({}))) as {
    result?: boolean;
    data?: { id?: string; url?: string };
    error?: string;
  };

  if (!r.ok || respuesta.result === false || !respuesta.data?.url) {
    throw new Error(`Mobbex rechazó el cobro (${r.status}): ${respuesta.error ?? 'sin detalle'}`);
  }

  return {
    id: String(respuesta.data.id ?? numeroPedido),
    enlace: respuesta.data.url,
    /* A diferencia de Mercado Pago, esto no es un dato que devuelva la
       pasarela: es lo que nosotros le pedimos con el campo `test`. Y
       está bien que sea así — es la razón por la que un cobro real no
       puede ocurrir por accidente. */
    real: !enPrueba,
  };
}

/* ------------------------------------------------------------------ *
 * Preguntar por un pago
 * ------------------------------------------------------------------ */

interface OperacionMobbex {
  uid?: string;
  status?: string | number;
  total?: number;
  reference?: string;
  description?: string;
  currency?: string | { value?: string; code?: string };
  totals?: { total?: number; currency?: string };
}

/** El código de moneda, que en el entorno de prueba de Mobbex es `test`. */
function monedaDe(op: OperacionMobbex): string {
  const c = op.currency;
  if (typeof c === 'string') return c;
  return String(c?.value ?? c?.code ?? op.totals?.currency ?? '');
}

function normalizar(op: OperacionMobbex, referenciaSiFalta = ''): PagoConsultado {
  const crudo = String(op.status ?? '');
  let estado = traducirCodigo(crudo);
  let detalle = `estado ${crudo}`;

  /* Un cobro real llegando a un sitio que se cree de prueba.
     No debería poder pasar —el campo `test` lo impide al crear— pero
     si pasa es porque alguien cobró de verdad contra este registro, y
     eso no se aprueba solo: se mira. */
  const moneda = monedaDe(op).toLowerCase();
  if (estado === 'aprobado' && modoDeclarado() === 'prueba' && moneda && moneda !== 'test') {
    estado = 'pendiente';
    detalle = `REVISAR: cobro real (moneda ${moneda}) con el sitio declarado en modo de prueba`;
  }

  return {
    id: String(op.uid ?? ''),
    estado,
    crudo,
    detalle,
    monto: Number(op.totals?.total ?? op.total ?? 0),
    referenciaExterna: String(op.reference ?? referenciaSiFalta),
  };
}

/**
 * Busca el pago de un pedido preguntando por NUESTRO número.
 *
 * Se usa el listado con filtro por referencia y no la consulta por
 * identificador de operación, y hay un motivo: la referencia es un
 * dato nuestro, que controlamos y que sabemos que es único. El
 * identificador de operación lo inventa Mobbex y sólo lo conocemos
 * porque nos lo dijo un mensaje que llegó por la red.
 *
 * Si hay varios intentos para el mismo pedido —uno rechazado y
 * después uno aprobado— gana el aprobado. Es el mismo criterio que en
 * Mercado Pago y por la misma razón: lo que importa es si en algún
 * momento entró la plata.
 */
export async function buscarPagoPorPedido(numeroPedido: string): Promise<PagoConsultado | null> {
  const url = `${API}/p/entity/operations`
    + `?page=0&limit=20&reference=${encodeURIComponent(numeroPedido)}`;

  const r = await fetch(url, { headers: cabeceras() });
  if (!r.ok) return null;

  const d = (await r.json().catch(() => ({}))) as {
    result?: boolean;
    data?: { docs?: OperacionMobbex[] };
  };

  const docs = d.data?.docs ?? [];
  /* El filtro por referencia de Mobbex busca por coincidencia, así
     que se vuelve a comparar de este lado. Sin esto, un pedido
     `AC-260826-AB12CD` podría quedarse con el pago de otro cuyo
     número lo contenga. */
  const propias = docs.filter((op) => String(op.reference ?? '') === numeroPedido);
  if (propias.length === 0) return null;

  const aprobada = propias.find((op) => traducirCodigo(String(op.status ?? '')) === 'aprobado');
  return normalizar(aprobada ?? propias[0]!, numeroPedido);
}

/* ------------------------------------------------------------------ *
 * El aviso
 * ------------------------------------------------------------------ */

/** Compara dos textos sin filtrar información por el tiempo que tarda. */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

export function hayAvisoVerificable(): boolean {
  return variable('MOBBEX_WEBHOOK_TOKEN').length >= 24;
}

/**
 * ¿Este aviso lo mandó Mobbex?
 *
 * Se compara el token de la dirección contra el configurado. Es más
 * débil que una firma y no se pretende otra cosa: la defensa real es
 * que nada de lo que trae el aviso se escribe sin preguntarle antes a
 * la API.
 *
 * El token se exige de al menos 24 caracteres. Uno corto se puede
 * probar a fuerza bruta contra una dirección pública, y un token
 * corto da la misma sensación de seguridad que uno largo.
 */
export function avisoLegitimo(aviso: Aviso): boolean {
  const esperado = variable('MOBBEX_WEBHOOK_TOKEN');
  if (esperado.length < 24) return false;
  const recibido = aviso.url.searchParams.get('token') ?? '';
  return igualesEnTiempoConstante(recibido, esperado);
}

/** El pago del que habla el aviso, tal como Mobbex lo escribe. */
function pagoDelCuerpo(aviso: Aviso): { id: string; estado: string; referencia: string } {
  const data = (aviso.cuerpo.data ?? {}) as Record<string, unknown>;
  const payment = (data.payment ?? {}) as Record<string, unknown>;
  const status = (payment.status ?? {}) as Record<string, unknown>;
  const checkout = (data.checkout ?? {}) as Record<string, unknown>;

  return {
    id: String(payment.id ?? checkout.uid ?? ''),
    estado: String(status.code ?? ''),
    /* La referencia está en el pago; cuando el aviso es de un checkout
       vencido no hay pago, y está en el checkout. */
    referencia: String(payment.reference ?? checkout.reference ?? ''),
  };
}

export function claveDeAviso(aviso: Aviso): string | null {
  const { id, estado, referencia } = pagoDelCuerpo(aviso);
  const base = id || referencia;
  if (!base) return null;
  const tipo = String(aviso.cuerpo.type ?? 'checkout');
  return `mobbex:${base}:${tipo}:${estado}`;
}

/**
 * El pago del aviso, preguntado a la API.
 *
 * Del cuerpo se saca una sola cosa: el número de pedido. Todo lo
 * demás —estado, monto— sale de la consulta. Es la regla que hace que
 * la falta de firma no sea un agujero.
 */
export async function pagoDelAviso(aviso: Aviso): Promise<PagoConsultado | null> {
  const { referencia } = pagoDelCuerpo(aviso);
  if (!referencia) return null;
  return buscarPagoPorPedido(referencia);
}

/* ------------------------------------------------------------------ *
 * El adaptador
 * ------------------------------------------------------------------ */

export const mobbex: Pasarela = {
  nombre: 'mobbex',
  hayCredenciales,
  hayAvisoVerificable,
  modoDeclarado,
  cobroPermitido,
  crearCobro,
  buscarPagoPorPedido,
  avisoLegitimo,
  claveDeAviso,
  pagoDelAviso,
};
