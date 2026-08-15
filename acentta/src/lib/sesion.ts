/**
 * acentta · quién puede ver los pedidos
 * ---------------------------------------------------------------
 * La pantalla de pedidos muestra nombre, DNI, teléfono y dirección de
 * cada persona que compró. Es la información más delicada de todo el
 * sitio: el catálogo es público, los precios son públicos, pero esto
 * no. Una pantalla así abierta a internet no es un descuido menor, es
 * una filtración de datos personales.
 *
 * CÓMO SE PROTEGE, Y POR QUÉ ASÍ
 *
 * Una clave que vos guardás en una variable de entorno, y una sesión
 * con vencimiento. Nada de cuentas ni de correos de recuperación:
 * para un negocio de una persona, eso sería construir un sistema de
 * usuarios entero para tener un usuario.
 *
 * Lo que sí se hace bien, porque acá los atajos se pagan:
 *
 * · La clave se compara en tiempo constante. Comparar dos textos con
 *   `===` corta en el primer carácter distinto, y esa diferencia de
 *   tiempo alcanza para adivinarla de a un carácter.
 * · La sesión es un número al azar guardado del lado del servidor,
 *   no la clave viajando de ida y vuelta. Si alguien roba la galleta,
 *   se le vence; y se puede cortar borrando una clave del almacén.
 * · La galleta va `HttpOnly` —ningún guion la puede leer, así que un
 *   XSS no se la lleva—, `Secure` y `SameSite=Strict`, que impide que
 *   otro sitio dispare acciones con tu sesión.
 * · Los intentos se limitan. Sin eso, una clave de ocho caracteres se
 *   prueba entera con paciencia y un guion.
 */

import crypto from 'node:crypto';

const HORAS = 8;

function variable(nombre: string): string {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const proceso = typeof process !== 'undefined' ? (process.env ?? {}) : {};
  return proceso[nombre] ?? meta[nombre] ?? '';
}

const URL_BASE = () => variable('KV_REST_API_URL') || variable('UPSTASH_REDIS_REST_URL');
const TOKEN = () => variable('KV_REST_API_TOKEN') || variable('UPSTASH_REDIS_REST_TOKEN');

async function mandar(comando: (string | number)[]): Promise<unknown> {
  const r = await fetch(URL_BASE(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando),
  });
  if (!r.ok) throw new Error(`El almacén contestó ${r.status}`);
  const cuerpo = (await r.json()) as { result?: unknown };
  return cuerpo.result;
}

export function hayClaveConfigurada(): boolean {
  return variable('ADMIN_CLAVE').length >= 12;
}

/** Comparación en tiempo constante, insensible a la longitud. */
function igual(a: string, b: string): boolean {
  /* Se comparan los resúmenes y no los textos: así la comparación
     siempre opera sobre 32 bytes y el largo de la clave no se filtra
     por el tiempo que tarda. */
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * ¿Se puede intentar entrar desde esta dirección?
 *
 * Diez intentos cada quince minutos. No molesta a nadie que sepa su
 * clave y hace inviable probarlas todas.
 */
export async function permiteIntentar(huella: string): Promise<boolean> {
  const clave = `intentos:${huella}`;
  const n = Number(await mandar(['INCR', clave]));
  if (n === 1) await mandar(['EXPIRE', clave, 15 * 60]);
  return n <= 10;
}

export async function crearSesion(): Promise<{ token: string; segundos: number }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const segundos = HORAS * 60 * 60;
  await mandar(['SET', `sesion:${token}`, '1', 'EX', segundos]);
  return { token, segundos };
}

export async function sesionValida(token: string | undefined): Promise<boolean> {
  if (!token || token.length < 20) return false;
  return (await mandar(['GET', `sesion:${token}`])) === '1';
}

export async function cerrarSesion(token: string | undefined): Promise<void> {
  if (token) await mandar(['DEL', `sesion:${token}`]);
}

export function claveCorrecta(intento: string): boolean {
  const real = variable('ADMIN_CLAVE');
  if (!real || !intento) return false;
  return igual(intento, real);
}

/* ---- La galleta ---- */
export const NOMBRE_GALLETA = 'acentta_sesion';

export function galletaDeSesion(token: string, segundos: number): string {
  return `${NOMBRE_GALLETA}=${token}; Path=/; Max-Age=${segundos}; HttpOnly; Secure; SameSite=Strict`;
}

export function galletaBorrada(): string {
  return `${NOMBRE_GALLETA}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

/** Lee la galleta de la petición sin depender del ayudante del marco. */
export function tokenDe(request: Request): string | undefined {
  const bruto = request.headers.get('cookie') ?? '';
  for (const parte of bruto.split(';')) {
    const [n, ...resto] = parte.trim().split('=');
    if (n === NOMBRE_GALLETA) return resto.join('=');
  }
  return undefined;
}

/** Con qué se identifica a quien intenta entrar, para limitarlo. */
export function huellaDe(request: Request): string {
  return (request.headers.get('x-forwarded-for') ?? 'desconocida').split(',')[0]!.trim();
}
