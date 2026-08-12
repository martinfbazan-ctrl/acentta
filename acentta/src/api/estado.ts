/**
 * GET /api/estado
 * ---------------------------------------------------------------
 * Qué ve la función de cobro desde adentro.
 *
 * Existe porque diagnosticar «no disponible» desde afuera es
 * adivinar. Puede ser que la variable no esté, que esté con otro
 * nombre, que esté en un entorno distinto del que se está mirando, o
 * que el despliegue sea anterior a haberla cargado. Los cuatro casos
 * se ven igual desde el navegador y se distinguen en una línea desde
 * acá.
 *
 * QUÉ DEVUELVE Y QUÉ NO
 *
 * Nombres y booleanos. **Ningún valor, nunca**, ni recortado: media
 * credencial sigue siendo una pista de la otra media. Del token de
 * Mercado Pago se informa solamente si empieza con `TEST-`, que es
 * lo único que hace falta saber para no cobrarle de verdad a alguien
 * por accidente.
 *
 * Un nombre de variable no es un secreto, pero tampoco es información
 * que valga la pena regalar, así que sólo se listan las que empiezan
 * con los prefijos que a este sitio le importan.
 *
 * Cuando el circuito esté andando, esta ruta se puede borrar: son
 * tres líneas en `astro.produccion.config.mjs` y este archivo.
 */

import type { APIRoute } from 'astro';
import { hayAlmacen } from '@lib/pedidos';
import { consultarCuenta, hayCredenciales, modoDeclarado, variable } from '@lib/mercadopago';

export const prerender = false;

const PREFIJOS = ['KV_', 'UPSTASH_', 'REDIS_', 'MP_'];

export const GET: APIRoute = async () => {
  const proceso = typeof process !== 'undefined' ? (process.env ?? {}) : {};
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

  const visibles = (fuente: Record<string, string | undefined>) =>
    Object.keys(fuente)
      .filter((k) => PREFIJOS.some((p) => k.startsWith(p)))
      .filter((k) => Boolean(fuente[k]))
      .sort();

  const almacenListo = hayAlmacen();
  const pagoListo = hayCredenciales();
  const cuenta = pagoListo
    ? await consultarCuenta()
    : { ok: false, esCuentaDePrueba: false };

  return new Response(JSON.stringify({
    almacen: {
      listo: almacenListo,
      KV_REST_API_URL: Boolean(variable('KV_REST_API_URL')),
      KV_REST_API_TOKEN: Boolean(variable('KV_REST_API_TOKEN')),
      UPSTASH_REDIS_REST_URL: Boolean(variable('UPSTASH_REDIS_REST_URL')),
      UPSTASH_REDIS_REST_TOKEN: Boolean(variable('UPSTASH_REDIS_REST_TOKEN')),
    },
    mercadoPago: {
      listo: pagoListo,
      MP_ACCESS_TOKEN: pagoListo,
      MP_WEBHOOK_SECRET: Boolean(variable('MP_WEBHOOK_SECRET')),
      /* Lo que declara la configuración del sitio. */
      modoDeclarado: modoDeclarado(),
      /* Lo que dice Mercado Pago sobre el dueño del token. Las
         credenciales de prueba pertenecen a una cuenta cuyo alias
         empieza con TEST.
         [CORREGIDO] Antes esto se deducía del prefijo del token, que
         era `TEST-`. Mercado Pago unificó el formato y hoy los dos
         entornos usan `APP_USR-`, así que ese chequeo daba siempre
         «producción» y avisaba de un peligro que no existía. */
      cuenta,
      aviso: !cuenta.ok
        ? 'No se pudo consultar la cuenta: revisar que el token sea válido.'
        : cuenta.esCuentaDePrueba && modoDeclarado() === 'produccion'
          ? 'Credenciales de prueba con el sitio declarado en producción. No cobra nada; corregir MP_MODO.'
          : !cuenta.esCuentaDePrueba && modoDeclarado() !== 'produccion'
            ? 'CUIDADO: las credenciales parecen de producción y el sitio dice estar en prueba. El cobro va a quedar bloqueado a propósito.'
            : null,
    },
    /* Las dos fuentes por separado: si una variable aparece en una y
       no en la otra, el problema es de cómo se compiló y no de que
       falte cargarla. */
    nombresVisibles: {
      enProcess: visibles(proceso),
      enImportMeta: visibles(meta),
    },
    listoParaCobrar: almacenListo && pagoListo && Boolean(variable('MP_WEBHOOK_SECRET')),
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
