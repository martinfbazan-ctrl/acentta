/**
 * acentta · Envíopack
 * ---------------------------------------------------------------
 * Cotizar el envío de verdad y despachar sin copiar números a mano.
 *
 * Envíopack es un agregador: habla con OCA, Andreani, Urbano y otros,
 * y nos deja una sola API. Eso importa más de lo que parece — cambiar
 * de correo deja de ser una integración nueva y pasa a ser un
 * parámetro.
 *
 * ─────────────────────────────────────────────────────────────────
 * TRES COSAS DE SU DISEÑO QUE CONDICIONAN ESTE ARCHIVO
 *
 * 1 · EL TOKEN VIAJA EN LA URL, no en una cabecera. Es su decisión y
 *     no hay alternativa. Las URLs terminan en registros de servidor,
 *     de proxies y de cualquier intermediario, así que el token se
 *     trata como algo expuesto: dura cuatro horas, se renueva solo, y
 *     nunca se escribe en un registro nuestro.
 *
 * 2 · EL TOKEN DURA CUATRO HORAS. Pedir uno nuevo en cada llamada
 *     sería duplicar el tiempo de respuesta de cada cotización, y el
 *     checkout es justo donde no sobra tiempo. Se guarda en memoria
 *     del proceso con un margen de cinco minutos.
 *
 *     En Vercel cada función vive por su cuenta y el token se pide de
 *     nuevo cuando arranca una instancia fría. Es correcto: guardar
 *     un token de cuatro horas en Redis para ahorrar una llamada
 *     agregaría una credencial más para custodiar a cambio de muy
 *     poco.
 *
 * 3 · LAS PROVINCIAS VAN EN CÓDIGO ISO, no por nombre. «Córdoba» no
 *     es un valor válido; «X» sí. La traducción está más abajo y es
 *     el detalle que más silenciosamente rompe una integración con
 *     ellos: mandar el nombre no da error, da cero cotizaciones.
 * ─────────────────────────────────────────────────────────────────
 */

import { variable } from '@lib/entorno';
import type { TarifaExterna } from '@lib/cotizacion';

const API = 'https://api.enviopack.com';

/* ------------------------------------------------------------------ *
 * Credenciales
 * ------------------------------------------------------------------ */

const apiKey = () => variable('ENVIOPACK_API_KEY').trim();
const secretKey = () => variable('ENVIOPACK_SECRET_KEY').trim();

/**
 * El depósito desde el que sale la mercadería.
 *
 * Sin esto Envíopack usa la dirección por defecto de la cuenta, y si
 * no hay ninguna **no devuelve cotizaciones**: contesta una lista
 * vacía, sin error. Desde afuera se ve como «el correo no llega a ese
 * código postal», que es un diagnóstico completamente equivocado.
 */
const deposito = () => variable('ENVIOPACK_DEPOSITO').trim();

export function hayCredenciales(): boolean {
  return Boolean(apiKey() && secretKey());
}

/* ------------------------------------------------------------------ *
 * El token
 * ------------------------------------------------------------------ */

let tokenEnMemoria: { valor: string; vence: number } | null = null;

/** Cinco minutos de margen: un token que vence en camino es un error raro de diagnosticar. */
const MARGEN_MS = 5 * 60 * 1000;
const DURACION_MS = 4 * 60 * 60 * 1000;

async function token(): Promise<string> {
  if (!hayCredenciales()) {
    throw new Error('Faltan ENVIOPACK_API_KEY y ENVIOPACK_SECRET_KEY.');
  }
  if (tokenEnMemoria && Date.now() < tokenEnMemoria.vence - MARGEN_MS) {
    return tokenEnMemoria.valor;
  }

  const cuerpo = new URLSearchParams({
    'api-key': apiKey(),
    'secret-key': secretKey(),
  });

  const r = await fetch(`${API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo.toString(),
  });

  if (!r.ok) {
    /* Sin el cuerpo de la respuesta: puede traer parte de la
       credencial y esto termina en un registro. */
    throw new Error(`Envíopack no autenticó (${r.status}).`);
  }

  const d = (await r.json().catch(() => ({}))) as { access_token?: string };
  if (!d.access_token) throw new Error('Envíopack no devolvió un token.');

  tokenEnMemoria = { valor: d.access_token, vence: Date.now() + DURACION_MS };
  return d.access_token;
}

/** Para las pruebas: olvidarse del token guardado. */
export function olvidarToken(): void {
  tokenEnMemoria = null;
}

/* ------------------------------------------------------------------ *
 * Llamadas
 * ------------------------------------------------------------------ */

/**
 * Una llamada a la API, con el token puesto donde ellos lo esperan.
 *
 * `tiempoLimite` existe porque esto corre dentro del checkout. Si
 * Envíopack tarda, la respuesta correcta no es esperar: es cotizar
 * con la tabla propia y seguir. Una venta perdida por lentitud es
 * peor que un envío cotizado con la tabla.
 */
async function llamar(
  ruta: string,
  opciones: { metodo?: string; parametros?: Record<string, string>; cuerpo?: unknown; tiempoLimite?: number } = {},
): Promise<unknown> {
  const { metodo = 'GET', parametros = {}, cuerpo, tiempoLimite = 8000 } = opciones;

  const url = new URL(`${API}${ruta}`);
  url.searchParams.set('access_token', await token());
  for (const [k, v] of Object.entries(parametros)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }

  const cortar = AbortSignal.timeout(tiempoLimite);
  const r = await fetch(url, {
    method: metodo,
    signal: cortar,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const texto = await r.text();
  if (!r.ok) {
    /* La dirección lleva el token adentro, así que no se incluye en
       el mensaje: este texto va a parar a un registro. */
    throw new Error(`Envíopack ${metodo} ${ruta} respondió ${r.status}: ${texto.slice(0, 300)}`);
  }
  try { return JSON.parse(texto); } catch { return texto; }
}

/* ------------------------------------------------------------------ *
 * Provincias
 * ------------------------------------------------------------------ */

/* Las marcas de acento combinantes, escritas con escapes.
   Puestas literalmente en el archivo son caracteres invisibles:
   nadie las ve al leer el codigo y no sobreviven bien a un
   copiar y pegar entre editores. */
const ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Del nombre de provincia al código ISO 3166-2:AR sin el prefijo.
 *
 * El checkout pide la provincia escrita porque es lo que una persona
 * sabe contestar. Envíopack quiere el código. La traducción vive acá,
 * y tolera acentos, mayúsculas y las formas en que la gente escribe
 * de verdad: «caba», «Capital Federal» y «Ciudad de Buenos Aires» son
 * todas la misma cosa.
 *
 * Si no se reconoce la provincia, se devuelve vacío y quien llama
 * cotiza con la tabla. Nunca se adivina: mandar la provincia
 * equivocada devuelve una tarifa de otro lado del país, y esa sí se
 * cobra.
 */
const PROVINCIAS: Record<string, string> = {
  'ciudad autonoma de buenos aires': 'C',
  'capital federal': 'C',
  'ciudad de buenos aires': 'C',
  caba: 'C',
  'buenos aires': 'B',
  catamarca: 'K',
  chaco: 'H',
  chubut: 'U',
  cordoba: 'X',
  corrientes: 'W',
  'entre rios': 'E',
  formosa: 'P',
  jujuy: 'Y',
  'la pampa': 'L',
  'la rioja': 'F',
  mendoza: 'M',
  misiones: 'N',
  neuquen: 'Q',
  'rio negro': 'R',
  salta: 'A',
  'san juan': 'J',
  'san luis': 'D',
  'santa cruz': 'Z',
  'santa fe': 'S',
  'santiago del estero': 'G',
  'tierra del fuego': 'V',
  tucuman: 'T',
};

export function codigoDeProvincia(nombre: string): string {
  const limpio = String(nombre ?? '')
    .trim()
    .toLowerCase()
    /* Se sacan los acentos en vez de listar cada variante escrita:
       «Córdoba» y «Cordoba» tienen que dar lo mismo. */
    .normalize('NFD')
    /* Escrito con escapes y no con los caracteres literales: un rango
       de marcas de acento pegado tal cual en el archivo es invisible
       en cualquier editor y sobrevive mal a un copiar y pegar. */
    .replace(ACENTOS, '')
    .replace(/\s+/g, ' ');

  if (!limpio) return '';
  if (PROVINCIAS[limpio]) return PROVINCIAS[limpio]!;

  /* Un código de una letra ya escrito, por si alguna vez llega así. */
  if (/^[A-Z]$/.test(nombre.trim().toUpperCase())) return nombre.trim().toUpperCase();

  /* Coincidencia parcial, para «Provincia de Córdoba» y parecidos.
     Sólo si es inequívoca: si dos provincias coinciden, no se elige. */
  const candidatas = Object.keys(PROVINCIAS).filter((p) => limpio.includes(p));
  const codigos = new Set(candidatas.map((c) => PROVINCIAS[c]!));
  return codigos.size === 1 ? [...codigos][0]! : '';
}

/* ------------------------------------------------------------------ *
 * Cotizar
 * ------------------------------------------------------------------ */

interface CotizacionCruda {
  valor?: string | number;
  horas_entrega?: number;
  servicio?: string;
  modalidad?: string;
  correo?: { id?: string; nombre?: string };
  sucursal?: Record<string, unknown>;
}

/** De horas de entrega a días hábiles, redondeando para arriba. */
function diasDesdeHoras(horas: number | undefined): number {
  if (!horas || horas <= 0) return 0;
  return Math.max(1, Math.ceil(horas / 24));
}

/**
 * Lo que paga el comprador por un envío a domicilio.
 *
 * Se usa `/cotizar/precio/a-domicilio` y no `/cotizar/costo`: el
 * primero devuelve el precio de venta, que es el que se le muestra a
 * la persona y respeta las tarifas que hayas configurado en
 * «Correos y Tarifas». El segundo devuelve lo que pagás vos al
 * correo, y mostrarle eso al comprador sería vender el envío al
 * costo sin haberlo decidido.
 *
 * Devuelve la más barata. Si no hay ninguna, devuelve null y quien
 * llama cae a la tabla.
 */
export async function cotizarDomicilio(datos: {
  provincia: string;
  cp: string;
  peso: number;
  paquetes: string;
}): Promise<TarifaExterna | null> {
  const provincia = codigoDeProvincia(datos.provincia);
  if (!provincia) return null;

  const lista = (await llamar('/cotizar/precio/a-domicilio', {
    parametros: {
      provincia,
      codigo_postal: String(datos.cp).trim(),
      peso: datos.peso.toFixed(2),
      paquetes: datos.paquetes,
      ...(deposito() ? { direccion_envio: deposito() } : {}),
    },
  })) as CotizacionCruda[];

  return masBarata(lista);
}

/**
 * Lo que paga el comprador por un envío a sucursal, con las sucursales.
 *
 * Devuelve la lista entera y no sólo la más barata: la idea es que la
 * persona elija dónde retirar, y para eso necesita verlas.
 */
export async function cotizarSucursal(datos: {
  provincia: string;
  localidad: string;
  peso: number;
  paquetes: string;
}): Promise<{ tarifa: TarifaExterna; sucursal: Record<string, unknown> }[]> {
  const provincia = codigoDeProvincia(datos.provincia);
  if (!provincia || !datos.localidad) return [];

  const lista = (await llamar('/cotizar/precio/a-sucursal', {
    parametros: {
      provincia,
      localidad: String(datos.localidad),
      peso: datos.peso.toFixed(2),
      paquetes: datos.paquetes,
      ...(deposito() ? { direccion_envio: deposito() } : {}),
    },
  })) as CotizacionCruda[];

  return (Array.isArray(lista) ? lista : [])
    .filter((c) => c.sucursal && Number(c.valor) >= 0)
    .map((c) => ({ tarifa: aTarifa(c)!, sucursal: c.sucursal! }))
    .sort((a, b) => a.tarifa.costo - b.tarifa.costo);
}

function aTarifa(c: CotizacionCruda): TarifaExterna | null {
  const costo = Number(c.valor);
  if (!Number.isFinite(costo) || costo < 0) return null;
  return {
    costo,
    diasExtra: diasDesdeHoras(c.horas_entrega),
    correo: c.correo?.nombre,
    correoId: c.correo?.id,
    servicio: c.servicio,
  };
}

function masBarata(lista: unknown): TarifaExterna | null {
  if (!Array.isArray(lista) || lista.length === 0) return null;
  const tarifas = (lista as CotizacionCruda[])
    .map(aTarifa)
    .filter((t): t is TarifaExterna => t !== null);
  if (tarifas.length === 0) return null;
  return tarifas.reduce((mejor, t) => (t.costo < mejor.costo ? t : mejor));
}

/* ------------------------------------------------------------------ *
 * Despachar
 * ------------------------------------------------------------------ */

export interface DatosDeDespacho {
  numeroPedido: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  total: number;
  fechaAlta: string;
  entrega: {
    calle: string;
    numero: string;
    piso?: string;
    cp: string;
    provincia: string;
    ciudad: string;
    referencias?: string;
  };
  peso: number;
  cajas: { alto: number; ancho: number; largo: number; peso: number }[];
  correoId?: string;
  servicio?: string;
}

export interface Despacho {
  pedidoId: number;
  envioId: number;
  estado: string;
  seguimiento: string | null;
}

/**
 * Crea el pedido y el envío, y lo confirma.
 *
 * Envíopack separa las dos entidades a propósito: un pedido puede
 * tener varios envíos —el original, un reintento, una devolución— y
 * cada uno es un movimiento real del correo. Para el caso simple de
 * acá es siempre uno.
 *
 * `id_externo` es nuestro número de pedido, y tiene tope de 30
 * caracteres: los nuestros miden 16, así que entran holgados. Es lo
 * que permite reconocer el pedido cuando llega su webhook.
 *
 * Se crea confirmado. Un envío en borrador es una tarea pendiente que
 * hay que terminar a mano en su panel, y toda la razón de esto es no
 * tener tareas pendientes en dos lugares.
 */
export async function despachar(datos: DatosDeDespacho): Promise<Despacho> {
  const provincia = codigoDeProvincia(datos.entrega.provincia);
  if (!provincia) {
    throw new Error(`No reconozco la provincia «${datos.entrega.provincia}» para despachar.`);
  }
  if (!deposito()) {
    throw new Error(
      'Falta ENVIOPACK_DEPOSITO: sin depósito de salida, Envíopack no puede dar de alta el envío.',
    );
  }

  const pedido = (await llamar('/pedidos', {
    metodo: 'POST',
    tiempoLimite: 15000,
    cuerpo: {
      id_externo: datos.numeroPedido,
      nombre: datos.nombre.slice(0, 30),
      apellido: datos.apellido.slice(0, 30),
      email: datos.email.slice(0, 100),
      telefono: datos.telefono?.slice(0, 30),
      monto: Number(datos.total.toFixed(2)),
      fecha_alta: datos.fechaAlta,
      /* Ya cobramos antes de llegar acá: sólo se despacha lo pagado. */
      pagado: true,
      provincia,
      localidad: datos.entrega.ciudad.slice(0, 50),
    },
  })) as { id?: number };

  if (!pedido?.id) throw new Error('Envíopack no devolvió el id del pedido.');

  const envio = (await llamar('/envios', {
    metodo: 'POST',
    tiempoLimite: 15000,
    cuerpo: {
      pedido: pedido.id,
      direccion_envio: Number(deposito()),
      destinatario: `${datos.nombre} ${datos.apellido}`.trim().slice(0, 50),
      observaciones: datos.entrega.referencias?.slice(0, 200),
      modalidad: 'D',
      correo: datos.correoId ?? null,
      servicio: datos.servicio ?? null,
      confirmado: true,
      paquetes: datos.cajas,
      calle: datos.entrega.calle,
      numero: datos.entrega.numero,
      piso: datos.entrega.piso ?? '',
      codigo_postal: datos.entrega.cp,
      provincia,
      localidad: datos.entrega.ciudad,
    },
  })) as { id?: number; estado?: string; tracking_number?: string | null };

  if (!envio?.id) throw new Error('Envíopack no devolvió el id del envío.');

  return {
    pedidoId: pedido.id,
    envioId: envio.id,
    estado: String(envio.estado ?? 'E'),
    /* Al confirmar todavía no hay número: aparece cuando el correo lo
       informa, y eso llega por webhook. Que sea null acá es lo
       esperado, no una falla. */
    seguimiento: envio.tracking_number ?? null,
  };
}

/** El estado actual de un envío, para cuando el aviso se pierde. */
export async function consultarEnvio(envioId: number): Promise<{
  estado: string;
  seguimiento: string | null;
} | null> {
  try {
    const e = (await llamar(`/envios/${envioId}`)) as {
      estado?: string; tracking_number?: string | null;
    };
    return { estado: String(e?.estado ?? ''), seguimiento: e?.tracking_number ?? null };
  } catch {
    return null;
  }
}

/**
 * La etiqueta, en PDF.
 *
 * Devuelve la dirección y no el archivo: bajarlo en la función para
 * volver a servirlo sería mover un PDF por gusto. La dirección lleva
 * el token, así que se genera en el momento y no se guarda.
 */
export async function urlDeEtiqueta(envioId: number): Promise<string> {
  const url = new URL(`${API}/envios/${envioId}/etiqueta`);
  url.searchParams.set('access_token', await token());
  url.searchParams.set('formato', 'pdf');
  return url.toString();
}
