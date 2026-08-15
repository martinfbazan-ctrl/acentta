/**
 * GET /api/pedido?numero=AC-260810-K7M2QX
 * ---------------------------------------------------------------
 * Lo que la página de confirmación y la de seguimiento necesitan
 * saber, y nada más.
 *
 * QUÉ NO DEVUELVE, Y POR QUÉ
 *
 * El número de pedido viaja en la dirección: queda en el historial
 * del navegador, en el registro del servidor y en cualquier captura
 * de pantalla que alguien mande por chat. Tratarlo como una
 * contraseña sería un error, así que la respuesta se arma como si
 * fuera pública.
 *
 * Van el estado, el total, los productos y la fecha estimada. No van
 * el DNI, el teléfono, la dirección completa ni el correo. Con eso
 * alcanza para que la persona confirme que su compra entró y siga el
 * envío; lo otro sólo serviría para que un número adivinado valga la
 * pena.
 *
 * El número igual lleva seis caracteres al azar además de la fecha,
 * justamente para que no se pueda recorrer de a uno.
 */

import type { APIRoute } from 'astro';
import { hayAlmacen, leerPedido } from '@lib/pedidos';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const cabeceras = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (!hayAlmacen()) {
    return new Response(JSON.stringify({ error: 'no disponible' }), { status: 503, headers: cabeceras });
  }

  const numero = (url.searchParams.get('numero') ?? '').trim().toUpperCase();
  if (!/^AC-\d{6}-[A-Z0-9]{6}$/.test(numero)) {
    return new Response(JSON.stringify({ error: 'Ese número de pedido no tiene el formato correcto.' }), {
      status: 400, headers: cabeceras,
    });
  }

  const pedido = await leerPedido(numero);
  /* Misma respuesta para «no existe» y para «formato válido pero
     inventado»: no hay que confirmarle a nadie qué números existen. */
  if (!pedido) {
    return new Response(JSON.stringify({ error: 'No encontramos ese pedido.' }), {
      status: 404, headers: cabeceras,
    });
  }

  /* Con el correo correcto se muestra un poco más: la dirección de
     entrega y el número de seguimiento completo. Son dos datos que
     sólo tiene quien compró, así que un número adivinado no alcanza.
     Sin correo, o con uno que no coincide, se devuelve la vista
     reducida de siempre — que es la que usa la confirmación, donde
     la persona acaba de pagar y no tiene por qué volver a escribir
     su correo. */
  const correo = (url.searchParams.get('email') ?? '').trim().toLowerCase();
  const verificado = Boolean(correo) && correo === pedido.comprador.email.toLowerCase();

  return new Response(JSON.stringify({
    numero: pedido.numero,
    estado: pedido.estado,
    verificado,
    ...(verificado ? {
      entrega: {
        metodo: pedido.entrega.metodo,
        calle: pedido.entrega.calle,
        numero: pedido.entrega.numero,
        piso: pedido.entrega.piso ?? null,
        ciudad: pedido.entrega.ciudad,
        provincia: pedido.entrega.provincia,
        cp: pedido.entrega.cp,
      },
    } : {}),
    creado: pedido.creado,
    total: pedido.cotizacion.total,
    subtotal: pedido.cotizacion.subtotal,
    envio: pedido.cotizacion.envio,
    envioGratis: pedido.cotizacion.envioGratis,
    descuento: pedido.cotizacion.descuento,
    diasExtra: pedido.cotizacion.diasExtra,
    metodoPago: pedido.metodoPago,
    metodoEnvio: pedido.entrega.metodo,
    /* De la dirección, sólo lo que sirve para reconocerla: ciudad y
       provincia. La calle y la altura no hacen falta acá. */
    ciudad: pedido.entrega.ciudad,
    provincia: pedido.entrega.provincia,
    seguimiento: pedido.seguimiento ?? null,
    items: pedido.cotizacion.lineas.map((l) => ({
      nombre: l.nombre, variante: l.variante, cantidad: l.cantidad,
      precio: l.precio, imagen: l.imagen, slug: l.slug,
    })),
  }), { headers: cabeceras });
};
