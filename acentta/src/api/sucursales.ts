/**
 * GET /api/sucursales?cp=5000
 * ---------------------------------------------------------------
 * Las sucursales de OCA donde el comprador puede retirar su pedido.
 *
 * POR QUÉ HACE FALTA UN ENDPOINT PARA ESTO
 *
 * El checkout es una página estática: se construye una vez y se
 * sirve igual a todos. La lista de sucursales depende del código
 * postal que la persona escribe en el momento, y sale de la API de
 * OCA, que pide credenciales. Ninguna de las dos cosas puede vivir
 * en el navegador — la primera porque no se sabe al construir, la
 * segunda porque una credencial en el navegador es una credencial
 * pública.
 *
 * QUÉ FILTRA, Y POR QUÉ IMPORTA LA DIFERENCIA
 *
 * `sucursalesPorCP` devuelve dos capacidades distintas y es fácil
 * confundirlas:
 *
 *   · `admitePaquetes`  → ahí PODEMOS DEJAR nosotros el paquete
 *   · `entregaPaquetes` → ahí PUEDE RETIRAR el comprador
 *
 * Esta ruta es para el comprador, así que filtra por la segunda.
 * Ofrecerle una sucursal que sólo admite despachos lo manda a un
 * mostrador donde le van a decir que su paquete no está — y el que
 * queda mal es el vendedor, no OCA.
 *
 * LO QUE NO DEVUELVE
 *
 * Nada de la cuenta: ni operativa, ni CUIT, ni centro de costo. Sólo
 * lo que hace falta para reconocer una sucursal en un mapa mental:
 * nombre, calle, altura y localidad.
 */

import type { APIRoute } from 'astro';
import { sucursalesPorCP, hayCredenciales, motivoDeLaUltimaFalta } from '@lib/oca';
import { normalizarCP } from '@lib/envio';
import { nombreDeLogistica } from '@lib/logistica';

export const prerender = false;

/** Cuántas se ofrecen. Más de una docena deja de ser una elección. */
const MAXIMO = 12;

export const GET: APIRoute = async ({ url }) => {
  /* Se puede cachear: la lista de sucursales de un código postal no
     cambia de un minuto al otro, y sin esto cada tecla del checkout
     sería una llamada a OCA. Una hora en el navegador y un día en el
     borde son de sobra, y el `stale-while-revalidate` hace que una
     lista vieja se muestre al instante mientras se refresca sola. */
  const cabeceras = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  };
  const error = (mensaje: string, status: number) =>
    new Response(JSON.stringify({ error: mensaje, sucursales: [] }), {
      status,
      headers: { ...cabeceras, 'Cache-Control': 'no-store' },
    });

  if (nombreDeLogistica() !== 'oca' || !hayCredenciales()) {
    return error('El retiro en sucursal no está disponible ahora.', 503);
  }

  /* El código postal se normaliza con la MISMA función que valida el
     envío: acepta los cuatro dígitos y también el formato nuevo con
     letras. Dos validaciones distintas para el mismo dato terminan
     divergiendo, y el síntoma sería que el envío cotiza pero las
     sucursales no aparecen. */
  const cp = normalizarCP(url.searchParams.get('cp') ?? '');
  if (cp === null) {
    return error('El código postal lleva cuatro números.', 400);
  }

  try {
    const todas = await sucursalesPorCP(String(cp));
    const paraRetirar = todas.filter((s) => s.entregaPaquetes);

    return new Response(JSON.stringify({
      cp: String(cp),
      sucursales: paraRetirar.slice(0, MAXIMO).map((s) => ({
        id: s.id,
        nombre: s.nombre,
        direccion: [s.calle, s.numero].filter(Boolean).join(' '),
        localidad: s.localidad,
      })),
      /* Que se sepa si la lista quedó recortada: sin esto, alguien
         que no ve su sucursal no distingue «OCA no tiene una cerca»
         de «hay más y no te las mostramos». */
      hayMas: paraRetirar.length > MAXIMO,
    }), { headers: cabeceras });
  } catch (e) {
    /* Un problema del correo no puede parecer un problema del
       comprador. Se registra con el motivo que OCA haya dado y se
       contesta algo que se pueda leer. */
    console.error('sucursales: OCA no contestó —', motivoDeLaUltimaFalta() ?? e);
    return error('No pudimos traer las sucursales. Probá de nuevo en un momento.', 502);
  }
};
