/**
 * POST /api/aviso-de-pago
 * ---------------------------------------------------------------
 * El webhook. Es la parte del circuito donde un descuido cuesta
 * plata, así que vale la pena el detalle.
 *
 * Cuatro reglas, y ninguna es opcional:
 *
 * 1 · SE COMPRUEBA QUIÉN MANDA EL AVISO.
 *     Llega por internet a una dirección pública. Sin comprobar,
 *     cualquiera que la descubra manda «pago aprobado».
 *
 *     Cada pasarela lo demuestra a su manera y esta ruta no se entera
 *     de cuál: Mercado Pago firma con un HMAC que se recalcula;
 *     Mobbex **no firma nada**, así que lo que se compara es un token
 *     secreto que viaja en la propia dirección. Son defensas de
 *     fuerza muy distinta, y por eso existe la regla 2.
 *
 * 2 · NO SE LE CREE AL AVISO. NUNCA.
 *     Del cuerpo sale una sola cosa: de qué pago hay que preguntar.
 *     El estado y el monto se consultan después, directo a la API de
 *     la pasarela, con nuestras credenciales.
 *
 *     Con Mercado Pago esto era rigor. Con Mobbex es lo único que
 *     hay: como no hay firma, un aviso inventado es indistinguible de
 *     uno real salvo por el token. Lo que hace que igual no sirva de
 *     nada es que ningún dato del mensaje llega a escribirse — lo
 *     peor que consigue es que volvamos a consultar un pago que ya
 *     existe y escribamos el mismo estado que ya tenía.
 *
 * 3 · SE PROCESA UNA SOLA VEZ, PERO LOS CAMBIOS SÍ SE PROCESAN.
 *     Las pasarelas reintentan hasta recibir un 200. Sin marca de
 *     procesado, un pedido se confirma ocho veces. La marca incluye
 *     el estado que el aviso dice traer, así que un reintento del
 *     mismo aviso se descarta y un cambio real —de aprobado a
 *     devuelto— sí entra.
 *
 * 4 · SE CONTESTA 200 CASI SIEMPRE.
 *     Contestar error hace que reintenten. Está bien cuando el
 *     problema es nuestro y transitorio —el almacén no responde— y
 *     está mal cuando el aviso es de algo que no nos incumbe: un pago
 *     que no es de este sitio reintentaría durante días. Lo que no se
 *     puede procesar y no se va a poder procesar nunca, se acepta y
 *     se descarta.
 */

import type { APIRoute } from 'astro';
import { elegirPasarela, type Aviso } from '@lib/pasarela';
import { desmarcarProcesado, hayAlmacen, leerPedido, marcarProcesado } from '@lib/pedidos';
import { aplicarPago } from '@lib/conciliacion';

export const prerender = false;

/** Aceptado y cerrado: no reintentar. */
const listo = (nota: string) =>
  new Response(nota, { status: 200, headers: { 'Cache-Control': 'no-store' } });

/** Nuestro problema y puede pasar solo: que reintenten. */
const reintentar = (nota: string) => new Response(nota, { status: 500 });

export const POST: APIRoute = async ({ request, url }) => {
  const pasarela = elegirPasarela();

  if (!pasarela.hayCredenciales() || !hayAlmacen()) {
    /* Sin configuración no hay nada que hacer, pero tampoco tiene
       sentido que reintenten durante días. */
    return listo('sin configurar');
  }

  /* [PENDIENTE VISIBLE] Sin forma de comprobar el remitente, esta
     dirección acepta cualquier cosa. Se rechaza todo y se deja el
     registro gritando, porque el modo silencioso de este error es el
     peor de todos: el circuito parece funcionar —los pedidos se
     aprueban solos por la consulta a mano— y nadie se entera de que
     la puerta quedó abierta hasta que alguien la empuja. */
  if (!pasarela.hayAvisoVerificable()) {
    console.error(
      `aviso-de-pago: NO HAY CÓMO VERIFICAR EL REMITENTE (${pasarela.nombre}). `
      + 'Falta el secreto del webhook, o es demasiado corto. '
      + 'Se rechazan todos los avisos hasta que se configure.',
    );
    return new Response('Sin secreto configurado', { status: 503 });
  }

  let cuerpo: Record<string, unknown> = {};
  try { cuerpo = (await request.json()) as Record<string, unknown>; } catch { /* puede venir vacío */ }

  const aviso: Aviso = { url, headers: request.headers, cuerpo };

  if (!pasarela.avisoLegitimo(aviso)) {
    /* 401 y no 200: que la pasarela sepa que lo rechazamos, y que
       quien lo haya falsificado no reciba una confirmación. */
    return new Response('Aviso no verificado', { status: 401 });
  }

  const clave = pasarela.claveDeAviso(aviso);
  if (!clave) return listo('el aviso no dice de qué pago habla');

  /* La marca se toma antes de trabajar. Si dos avisos llegan a la
     vez, uno solo pasa: `SET NX` es atómico. */
  let tomado = false;
  try {
    tomado = await marcarProcesado(clave);
  } catch {
    return reintentar('el almacén no contestó');
  }
  if (!tomado) return listo('ya se había procesado');

  try {
    /* Acá se pregunta. Lo que devuelve esto es la verdad; lo que
       traía el aviso era apenas una pista. */
    const pago = await pasarela.pagoDelAviso(aviso);
    if (!pago) return listo('no es un aviso de pago que nos incumba');

    /* La referencia externa es nuestro número de pedido: es lo único
       que une el pago con el registro. Sin él no hay nada que
       actualizar, y no lo va a haber en un reintento. */
    if (!pago.referenciaExterna) return listo('el pago no trae número de pedido');

    const pedido = await leerPedido(pago.referenciaExterna);
    if (!pedido) return listo(`no existe el pedido ${pago.referenciaExterna}`);

    /* La comprobación de monto y la escritura viven en un solo lugar,
       compartidas con la consulta a mano de la pantalla de pedidos.
       Dos copias de esta lógica terminarían divergiendo, y la que
       divergiera sería la que menos se usa: justamente la que nadie
       mira. */
    const r = await aplicarPago(pedido, pago);
    if (r.revisar) {
      console.error(`aviso-de-pago: ${pedido.numero} queda para revisar — ${r.nota}`);
      return listo('monto distinto, queda para revisar');
    }

    /* Acá va el correo al comprador cuando el estado sea aprobado.
       Todavía no está: mandar correo pide un proveedor y una clave
       más, y el circuito de cobro tiene que estar verificado antes de
       sumarle piezas. Mientras tanto el pedido queda registrado y se
       consulta por número. */

    return listo(`pedido ${pedido.numero} → ${r.estado}`);
  } catch (err) {
    /* Falló después de tomar la marca. Se devuelve la marca para que
       el reintento pueda trabajar: es preferible arriesgar un aviso
       repetido —que este mismo código sabe manejar— a perder para
       siempre la confirmación de un pago cobrado. */
    await desmarcarProcesado(clave);
    console.error('aviso-de-pago:', err);
    return reintentar('error al procesar');
  }
};

/* Las dos pasarelas verifican la dirección con un GET alguna vez. Que
   conteste algo, sin hacer nada. */
export const GET: APIRoute = () => listo('acentta · receptor de avisos de pago');
