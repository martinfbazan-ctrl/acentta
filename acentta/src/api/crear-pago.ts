/**
 * POST /api/crear-pago
 * ---------------------------------------------------------------
 * Recibe QUÉ se compra. Nunca cuánto sale.
 *
 * El cuerpo que llega del navegador es, entero:
 *
 *     {
 *       items: [{ id, cantidad, variante }],
 *       metodoEnvio, metodoPago,
 *       comprador: { email, nombre, apellido, dni, telefono },
 *       entrega:   { cp, provincia, ciudad, calle, numero, ... }
 *     }
 *
 * No hay un solo precio en esa lista, y es a propósito: si hubiera
 * uno, habría que decidir si creerle, y la respuesta correcta a esa
 * pregunta siempre es que no.
 *
 * El orden de las operaciones tampoco es casual:
 *
 *   1. cotizar        — si algo no cierra, se corta acá y no se creó nada
 *   2. guardar pedido — pendiente, ANTES de que exista el cobro
 *   3. crear pago     — recién ahora
 *
 * Guardar antes de cobrar es lo que hace que un aviso perdido sea un
 * problema recuperable en vez de un cobro sin registro.
 */

import type { APIRoute } from 'astro';
import { ErrorDeCotizacion, type LineaPedida, type MetodoEnvio, type MetodoPago } from '@lib/cotizacion';
import { cotizarConCorreo } from '@lib/tarifa';
import { elegirPasarela } from '@lib/pasarela';
import { guardarPedido, hayAlmacen, nuevoNumero, type Comprador, type Entrega, type Pedido } from '@lib/pedidos';

export const prerender = false;

const json = (datos: unknown, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Recorta y limita: nada de lo que escribe una persona entra sin tope. */
const texto = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

export const POST: APIRoute = async ({ request, url }) => {
  /* Cuál cobra lo decide una variable de entorno. Esta ruta no sabe
     ni le importa: le pide un cobro a lo que haya y devuelve el
     enlace que le den. */
  const pasarela = elegirPasarela();

  /* Dos negativas antes de mirar el cuerpo. Cobrar sin poder
     registrar el pedido es exactamente lo que no puede pasar, así que
     es preferible un error claro a una venta sin respaldo. */
  if (!pasarela.hayCredenciales()) {
    return json({ error: 'El cobro todavía no está configurado en este sitio.' }, 503);
  }
  if (!hayAlmacen()) {
    return json({ error: 'El registro de pedidos no está disponible. No se puede cobrar sin registrar.' }, 503);
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'El pedido llegó mal formado.' }, 400);
  }

  const comprador: Comprador = {
    email: texto((cuerpo.comprador as Record<string, unknown>)?.email, 120).toLowerCase(),
    nombre: texto((cuerpo.comprador as Record<string, unknown>)?.nombre, 60),
    apellido: texto((cuerpo.comprador as Record<string, unknown>)?.apellido, 60),
    dni: texto((cuerpo.comprador as Record<string, unknown>)?.dni, 12),
    telefono: texto((cuerpo.comprador as Record<string, unknown>)?.telefono, 30),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(comprador.email)) {
    return json({ error: 'Hace falta un correo válido para mandarte el pedido.' }, 400);
  }
  if (!comprador.nombre || !comprador.apellido) {
    return json({ error: 'Faltan el nombre y el apellido.' }, 400);
  }

  const e = (cuerpo.entrega ?? {}) as Record<string, unknown>;
  const metodoEnvio = (texto(cuerpo.metodoEnvio, 20) || 'domicilio') as MetodoEnvio;
  const entrega: Entrega = {
    metodo: metodoEnvio === 'sucursal' ? 'sucursal' : 'domicilio',
    cp: texto(e.cp, 10),
    provincia: texto(e.provincia, 60),
    ciudad: texto(e.ciudad, 80),
    calle: texto(e.calle, 120),
    numero: texto(e.numero, 12),
    piso: texto(e.piso, 40) || undefined,
    entre: texto(e.entre, 120) || undefined,
    referencias: texto(e.referencias, 300) || undefined,
  };
  if (!entrega.cp || !entrega.calle || !entrega.numero || !entrega.ciudad) {
    return json({ error: 'Falta la dirección de entrega.' }, 400);
  }

  const metodoPago = (texto(cuerpo.metodoPago, 20) || 'tarjeta') as MetodoPago;

  /* ---- El total ----

     Le pregunta el precio del envío al correo y, si no contesta, usa
     la tabla propia. Lo que no cambia es dónde se decide el total:
     acá, en el servidor, contra el catálogo. El navegador sigue sin
     poder opinar sobre un solo peso. */
  let cotizacion;
  try {
    cotizacion = await cotizarConCorreo(
      (cuerpo.items ?? []) as LineaPedida[],
      { cp: entrega.cp, provincia: entrega.provincia, ciudad: entrega.ciudad },
      entrega.metodo,
      metodoPago === 'transferencia' ? 'transferencia' : 'tarjeta',
    );
  } catch (err) {
    if (err instanceof ErrorDeCotizacion) return json({ error: err.motivo }, 409);
    throw err;
  }

  /* ---- El pedido, antes del cobro ---- */
  const ahora = new Date().toISOString();
  const pedido: Pedido = {
    numero: nuevoNumero(),
    creado: ahora,
    actualizado: ahora,
    estado: 'pendiente',
    cotizacion,
    metodoPago: metodoPago === 'transferencia' ? 'transferencia' : 'tarjeta',
    comprador,
    entrega,
  };

  try {
    await guardarPedido(pedido);
  } catch {
    return json({ error: 'No pudimos registrar el pedido. Probá de nuevo en un momento.' }, 502);
  }

  /* ---- El cobro ---- */
  try {
    /* La dirección del sitio se toma de la petición y no de una
       variable: así el circuito funciona igual en la dirección de
       prueba de Vercel, en una vista previa y en el dominio propio,
       sin tener que acordarse de cambiar nada. */
    const urlSitio = `${url.protocol}//${url.host}`;
    const { id, enlace, real } = await pasarela.crearCobro({
      numeroPedido: pedido.numero,
      lineas: cotizacion.lineas.map((l) => ({
        id: l.id,
        nombre: l.variante ? `${l.nombre} · ${l.variante}` : l.nombre,
        cantidad: l.cantidad,
        precio: l.precio,
      })),
      envio: cotizacion.envio,
      descuento: cotizacion.descuento,
      /* El total cotizado por el servidor, explícito. Con Mobbex es
         el número que se cobra; con Mercado Pago es redundante con la
         suma de las líneas. Mandarlo siempre hace que las dos cobren
         lo mismo sin que esta ruta tenga que saber cuál está activa. */
      total: cotizacion.total,
      comprador,
      entrega,
      urlSitio,
    });

    /* El seguro. La pasarela acaba de decir si este cobro es real, y
       la configuración del sitio dice en qué entorno creemos estar.
       Si no coinciden en la dirección peligrosa —cobro real mientras
       creíamos estar probando— no se devuelve el enlace.

       Con Mobbex esto no debería dispararse nunca, porque el campo
       `test` impide el cobro real antes de que exista. Queda igual:
       una defensa que no cuesta nada y que cubre el día que alguien
       cambie ese detalle sin acordarse de este. */
    if (!pasarela.cobroPermitido(real)) {
      await guardarPedido({ ...pedido, estado: 'cancelado', actualizado: new Date().toISOString() });
      console.error(
        `crear-pago: BLOQUEADO. ${pasarela.nombre} abrió un cobro real y el sitio declara `
        + `«${pasarela.modoDeclarado()}».`,
      );
      return json({
        error: 'El cobro está en modo de prueba pero las credenciales son de producción. '
          + 'No se abrió el pago a propósito: sería un cobro real.',
      }, 409);
    }

    return json({
      numero: pedido.numero,
      pasarela: pasarela.nombre,
      preferencia: id,
      enlace,
      modo: real ? 'produccion' : 'prueba',
      /* Se devuelve el total cotizado por el servidor para que la
         página pueda mostrarlo antes de saltar. Es informativo: el
         que se cobra es el que ya viajó dentro de la preferencia. */
      total: cotizacion.total,
    });
  } catch (err) {
    /* El pedido queda guardado como pendiente aunque el cobro no se
       haya podido crear. Un pedido pendiente sin pago es basura
       inofensiva que caduca sola; un pago sin pedido, no. */
    console.error('crear-pago:', err);
    return json({ error: 'No pudimos abrir el pago. Probá de nuevo en un momento.' }, 502);
  }
};

/* Cualquier otro método, cortado. Un GET que cree pagos sería un
   enlace que dispara cobros con sólo abrirlo. */
export const ALL: APIRoute = () =>
  new Response('Método no permitido', { status: 405, headers: { Allow: 'POST' } });
