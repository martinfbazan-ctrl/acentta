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

/** La lista ordenada de pedidos, para poder verlos sin adivinar. */
const INDICE = 'pedidos:por-fecha';

export async function guardarPedido(pedido: Pedido): Promise<void> {
  /* Noventa días de vida. Suficiente para el plazo de reclamos y para
     defender un contracargo; pasado eso, un pedido viejo en un
     almacén de clave y valor es dato personal guardado sin motivo. */
  await mandar(['SET', clave(pedido.numero), JSON.stringify(pedido), 'EX', 60 * 60 * 24 * 90]);

  /* Y el número entra al índice, ordenado por fecha de creación.
     Sin esto, la única forma de encontrar un pedido sería conocer su
     número de memoria: no habría pantalla de pedidos posible.

     El puntaje es la fecha de CREACIÓN y no la de modificación, a
     propósito: cargar un número de seguimiento no tiene por qué
     mandar el pedido al principio de la lista. */
  await mandar(['ZADD', INDICE, Date.parse(pedido.creado) || Date.now(), pedido.numero]);
}

/**
 * Los últimos pedidos, del más nuevo al más viejo.
 *
 * Dos viajes al almacén: uno por la lista de números y otro por los
 * pedidos. Se podría hacer en uno con un guion del lado del almacén,
 * y no vale la pena: son cincuenta claves.
 */
export async function listarPedidos(limite = 50): Promise<Pedido[]> {
  let numeros = await mandar(['ZRANGE', INDICE, '+inf', '-inf', 'BYSCORE', 'REV', 'LIMIT', 0, limite]);

  /* Índice vacío pero pedidos guardados: se reconstruye y se
     reintenta, una sola vez.

     Pasa por una razón concreta y previsible: el índice se agregó
     después que el almacén, así que todo lo guardado antes quedó sin
     indexar. Existía, se podía consultar por número, y no aparecía en
     ninguna lista. Pedirle a alguien que vuelva a comprar para
     recuperar sus propios pedidos no es una respuesta.

     También cubre el caso general de que el índice y los datos se
     desincronicen por lo que sea. Sale barato: sólo se hace cuando la
     lista viene vacía. */
  if (!Array.isArray(numeros) || numeros.length === 0) {
    const reconstruidos = await reconstruirIndice();
    if (reconstruidos === 0) return [];
    numeros = await mandar(['ZRANGE', INDICE, '+inf', '-inf', 'BYSCORE', 'REV', 'LIMIT', 0, limite]);
  }

  if (!Array.isArray(numeros) || numeros.length === 0) return [];

  const crudos = await mandar(['MGET', ...numeros.map((n) => clave(String(n)))]);
  if (!Array.isArray(crudos)) return [];

  return crudos
    .map((c) => {
      if (typeof c !== 'string') return null;
      try { return JSON.parse(c) as Pedido; } catch { return null; }
    })
    /* Un pedido puede haber caducado y seguir en el índice. Se
       descarta en silencio: el índice se limpia solo la próxima vez
       que se escriba, y un hueco no justifica romper la pantalla. */
    .filter((p): p is Pedido => p !== null);
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
 * Rearma el índice recorriendo las claves de pedido.
 *
 * Recorre con `SCAN` y no con `KEYS`: el segundo bloquea el almacén
 * mientras recorre todo, y aunque acá sean cien claves, es la clase
 * de atajo que funciona hasta el día que deja de funcionar.
 *
 * Devuelve cuántos pedidos encontró.
 */
export async function reconstruirIndice(): Promise<number> {
  let cursor = '0';
  let encontrados = 0;
  /* Tope de vueltas: si algo devuelve un cursor que nunca cierra, es
     preferible una lista incompleta a una función que gira sola
     hasta que Vercel la corta. */
  for (let vuelta = 0; vuelta < 50; vuelta++) {
    const paso = await mandar(['SCAN', cursor, 'MATCH', 'pedido:*', 'COUNT', 200]);
    if (!Array.isArray(paso) || paso.length < 2) break;

    cursor = String(paso[0]);
    const claves = Array.isArray(paso[1]) ? paso[1].map(String) : [];

    if (claves.length > 0) {
      const crudos = await mandar(['MGET', ...claves]);
      if (Array.isArray(crudos)) {
        for (const c of crudos) {
          if (typeof c !== 'string') continue;
          try {
            const p = JSON.parse(c) as Pedido;
            if (!p?.numero) continue;
            await mandar(['ZADD', INDICE, Date.parse(p.creado) || Date.now(), p.numero]);
            encontrados++;
          } catch { /* una clave ilegible no puede frenar el resto */ }
        }
      }
    }

    if (cursor === '0') break;
  }
  return encontrados;
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
