/**
 * acentta · dónde viven los pedidos
 * ---------------------------------------------------------------
 * Un pedido tiene que existir ANTES de que la persona pague. Si se
 * creara al recibir el aviso de Mercado Pago, un aviso perdido sería
 * una venta cobrada sin registro, y no habría con qué reclamarle a
 * nadie. Se crea pendiente, y el aviso lo confirma o lo descarta.
 *
 * ALMACÉN
 *
 * Redis a través de su API REST, con `fetch` y nada más. No se suma
 * un cliente de base de datos: son dos operaciones —guardar y leer
 * por clave— y una dependencia menos en una función que maneja plata
 * es una superficie menos que auditar.
 *
 * Las variables de entorno las inyecta sola la integración de Vercel
 * al conectar el almacén. Se aceptan los dos nombres que se usan
 * según cómo se haya conectado; no vale la pena que esto falle por
 * un prefijo.
 *
 * SIN ALMACÉN CONFIGURADO
 *
 * `hayAlmacen()` devuelve false y quien llama decide. En desarrollo
 * eso permite probar el resto del circuito; en producción, la
 * función de cobro se niega a crear un pago —cobrar sin registrar el
 * pedido es exactamente lo que no puede pasar—.
 */

import type { Cotizacion, MetodoEnvio, MetodoPago } from '@lib/cotizacion';

export type EstadoPedido =
  | 'pendiente'    // creado, todavía no se pagó
  | 'aprobado'     // Mercado Pago confirmó el cobro
  | 'rechazado'    // el pago se rechazó
  | 'devuelto'     // se devolvió el dinero
  | 'cancelado';

export interface Comprador {
  email: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
}

export interface Entrega {
  metodo: MetodoEnvio;
  cp: string;
  provincia: string;
  ciudad: string;
  calle: string;
  numero: string;
  piso?: string;
  entre?: string;
  referencias?: string;
}

export interface Pedido {
  numero: string;
  creado: string;
  actualizado: string;
  estado: EstadoPedido;
  cotizacion: Cotizacion;
  metodoPago: MetodoPago;
  comprador: Comprador;
  entrega: Entrega;
  /** Identificador del pago en Mercado Pago, cuando ya hubo uno. */
  pagoId?: string;
  /** Lo que Mercado Pago dice del pago, tal cual, para poder auditar. */
  detallePago?: string;
  /** Se carga a mano cuando el proveedor despacha. Es lo único que
   *  gana un contracargo. */
  seguimiento?: string;
}

/**
 * Las credenciales se leen CUANDO SE USAN, no al cargar el módulo.
 *
 * Leerlas arriba de todo parece más prolijo y tiene un problema: el
 * módulo se evalúa una sola vez, y si eso llega a pasar en un momento
 * en que el entorno todavía no está poblado, las constantes quedan
 * vacías para siempre y no hay forma de recuperarse sin reiniciar.
 * Leerlas adentro cuesta nada y no depende del orden de carga.
 *
 * Se miran las dos fuentes porque no siempre están las dos: `process.env`
 * es lo normal en una función de servidor, e `import.meta.env` es lo que
 * expone el compilador. Y se aceptan los dos juegos de nombres, según
 * cómo se haya conectado el almacén:
 *
 *     KV_REST_API_URL / KV_REST_API_TOKEN            ← integración de Vercel
 *     UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  ← conexión directa
 *
 * Ojo con las otras que aparecen al conectar: `REDIS_URL` y `KV_URL`
 * son cadenas de conexión para un cliente de Redis, no direcciones
 * REST, y no sirven acá. `KV_REST_API_READ_ONLY_TOKEN` tampoco: los
 * pedidos se escriben.
 */
function variable(...nombres: string[]): string {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const proceso = typeof process !== 'undefined' ? (process.env ?? {}) : {};
  for (const n of nombres) {
    const v = proceso[n] ?? meta[n];
    if (v) return v;
  }
  return '';
}

const urlBase = () => variable('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
const tokenDeAcceso = () => variable('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');

export function hayAlmacen(): boolean {
  return Boolean(urlBase() && tokenDeAcceso());
}

/** Una orden de Redis por su API REST. */
async function mandar(comando: (string | number)[]): Promise<unknown> {
  const r = await fetch(urlBase(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDeAcceso()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando),
  });
  if (!r.ok) throw new Error(`El almacén contestó ${r.status}`);
  const cuerpo = (await r.json()) as { result?: unknown; error?: string };
  if (cuerpo.error) throw new Error(`El almacén rechazó la orden: ${cuerpo.error}`);
  return cuerpo.result;
}

/**
 * Número de pedido.
 *
 * Lleva azar además de la fecha, y no es capricho. Un número
 * puramente secuencial o derivado del reloj se adivina, y quien
 * adivina un número puede consultar el pedido de otro en la página de
 * seguimiento. Con seis caracteres al azar eso deja de ser posible
 * sin dejar de ser un número corto para dictar por teléfono.
 */
export function nuevoNumero(): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin I, L, O, 0, 1
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const azar = [...bytes].map((b) => alfabeto[b % alfabeto.length]).join('');
  const dia = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `AC-${dia}-${azar}`;
}

const clave = (numero: string) => `pedido:${numero}`;

export async function guardarPedido(pedido: Pedido): Promise<void> {
  /* Noventa días de vida. Suficiente para el plazo de reclamos y para
     defender un contracargo; pasado eso, un pedido viejo en un
     almacén de clave y valor es dato personal guardado sin motivo. */
  await mandar(['SET', clave(pedido.numero), JSON.stringify(pedido), 'EX', 60 * 60 * 24 * 90]);
}

export async function leerPedido(numero: string): Promise<Pedido | null> {
  const bruto = await mandar(['GET', clave(numero)]);
  if (typeof bruto !== 'string') return null;
  try { return JSON.parse(bruto) as Pedido; } catch { return null; }
}

export async function actualizarPedido(
  numero: string,
  cambios: Partial<Pedido>,
): Promise<Pedido | null> {
  const actual = await leerPedido(numero);
  if (!actual) return null;
  const nuevo: Pedido = { ...actual, ...cambios, actualizado: new Date().toISOString() };
  await guardarPedido(nuevo);
  return nuevo;
}

/**
 * ¿Este aviso ya se procesó?
 *
 * Mercado Pago reintenta el aviso si no le contestamos rápido: a los
 * 0, 15 y 30 minutos, a las 6, 48 y 96 horas, y tres veces más. Sin
 * esta marca, un pedido se procesa ocho veces: ocho correos al
 * comprador y el stock descontado ocho veces.
 *
 * `SET ... NX` es atómico: o la marca se crea, o ya estaba. Dos avisos
 * que lleguen exactamente a la vez no pueden pasar los dos, que es
 * justo el caso que un `if (existe)` seguido de un `set` deja pasar.
 */
export async function marcarProcesado(pagoId: string): Promise<boolean> {
  const r = await mandar(['SET', `pago:${pagoId}`, '1', 'NX', 'EX', 60 * 60 * 24 * 30]);
  return r === 'OK' || (typeof r === 'object' && r !== null && 'result' in r);
}

/** Deshace la marca. Se usa cuando el procesamiento falla después de
 *  marcarlo: es preferible arriesgar un aviso repetido —que el resto
 *  del código sabe manejar— a perder un pago aprobado para siempre. */
export async function desmarcarProcesado(pagoId: string): Promise<void> {
  try { await mandar(['DEL', `pago:${pagoId}`]); } catch { /* mejor esfuerzo */ }
}
