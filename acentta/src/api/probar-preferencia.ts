/**
 * GET /api/probar-preferencia
 * ---------------------------------------------------------------
 * Sirve para una sola pregunta, y es la que ahora mismo no se puede
 * contestar mirando la pantalla: **cuando Mercado Pago deja el botón
 * de pagar apagado y no dice nada, ¿el problema es la preferencia que
 * armamos nosotros o la cuenta con la que se está pagando?**
 *
 * Crea una preferencia con lo mínimo —un producto de cien pesos— sin
 * vencimiento, sin retorno automático, sin aviso de pago y sin envío,
 * y devuelve el enlace.
 *
 *   · Si con ese enlace SÍ se puede pagar → el problema es alguno de
 *     los campos que le agregamos a la preferencia de verdad, y se
 *     prueba de a uno hasta encontrarlo.
 *   · Si tampoco se puede pagar → el problema no está en el código.
 *     Es la cuenta de prueba, o la relación entre comprador y
 *     vendedor.
 *
 * Sólo responde en modo de prueba. En producción esto sería una
 * dirección pública que fabrica cobros reales de cien pesos.
 *
 * Es andamio: se borra cuando el circuito esté verificado.
 */

import type { APIRoute } from 'astro';
import { crearPreferenciaMinima, hayCredenciales, modoDeclarado } from '@lib/mercadopago';

export const prerender = false;

export const GET: APIRoute = async () => {
  const cabeceras = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (!hayCredenciales()) {
    return new Response(JSON.stringify({ error: 'Sin credenciales de Mercado Pago.' }), { status: 503, headers: cabeceras });
  }
  if (modoDeclarado() !== 'prueba') {
    return new Response(JSON.stringify({
      error: 'Sólo disponible en modo de prueba. En producción esto crearía cobros reales.',
    }), { status: 403, headers: cabeceras });
  }

  try {
    const respuesta = await crearPreferenciaMinima();
    return new Response(JSON.stringify({
      ...respuesta,
      comoSeUsa: 'Abrí init_point en la misma ventana de incógnito donde estás con el comprador de prueba. '
        + 'Si ahí el botón de pagar se habilita, el problema está en algún campo de la preferencia grande. '
        + 'Si sigue apagado, el problema no es del código.',
    }, null, 2), { headers: cabeceras });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'falló la creación',
    }, null, 2), { status: 502, headers: cabeceras });
  }
};
