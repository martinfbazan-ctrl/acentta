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
import { variable } from '@lib/entorno';
import { hayAlmacen } from '@lib/pedidos';
import { elegirPasarela, nombreDePasarela } from '@lib/pasarela';
import { consultarCuenta } from '@lib/mercadopago';

export const prerender = false;

const PREFIJOS = ['KV_', 'UPSTASH_', 'REDIS_', 'MP_', 'MOBBEX_', 'PASARELA'];

export const GET: APIRoute = async () => {
  const proceso = typeof process !== 'undefined' ? (process.env ?? {}) : {};
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

  const visibles = (fuente: Record<string, string | undefined>) =>
    Object.keys(fuente)
      .filter((k) => PREFIJOS.some((p) => k.startsWith(p)))
      .filter((k) => Boolean(fuente[k]))
      .sort();

  const almacenListo = hayAlmacen();
  const pasarela = elegirPasarela();
  const pagoListo = pasarela.hayCredenciales();
  const avisoVerificable = pasarela.hayAvisoVerificable();

  /* Sólo tiene sentido preguntarle a Mercado Pago por su cuenta
     cuando Mercado Pago es la pasarela activa. Con Mobbex encendido,
     esa consulta usaría credenciales que probablemente ya no estén y
     devolvería un error que parecería un problema. */
  const cuenta = pasarela.nombre === 'mercadopago' && pagoListo
    ? await consultarCuenta()
    : null;

  return new Response(JSON.stringify({
    almacen: {
      listo: almacenListo,
      KV_REST_API_URL: Boolean(variable('KV_REST_API_URL')),
      KV_REST_API_TOKEN: Boolean(variable('KV_REST_API_TOKEN')),
      UPSTASH_REDIS_REST_URL: Boolean(variable('UPSTASH_REDIS_REST_URL')),
      UPSTASH_REDIS_REST_TOKEN: Boolean(variable('UPSTASH_REDIS_REST_TOKEN')),
    },
    pasarela: {
      /* Cuál está cobrando. Si esto dice algo distinto de lo que
         esperabas, el resto del informe habla de la otra. */
      activa: nombreDePasarela(),
      listo: pagoListo,
      /* Lo que declara la configuración del sitio. */
      modoDeclarado: pasarela.modoDeclarado(),
      /* Si esto es falso, la ruta de avisos rechaza todo: no hay con
         qué comprobar quién los manda. */
      avisoVerificable,
    },
    mobbex: {
      MOBBEX_API_KEY: Boolean(variable('MOBBEX_API_KEY')),
      MOBBEX_ACCESS_TOKEN: Boolean(variable('MOBBEX_ACCESS_TOKEN')),
      /* Se informa el largo y no el valor: es lo único que hace falta
         para saber si va a pasar el mínimo de 24. */
      MOBBEX_WEBHOOK_TOKEN_largo: variable('MOBBEX_WEBHOOK_TOKEN').length,
      MOBBEX_MODO: variable('MOBBEX_MODO') || '(sin declarar · se asume prueba)',
    },
    mercadoPago: {
      /* Apagado salvo que PASARELA diga lo contrario. */
      activo: pasarela.nombre === 'mercadopago',
      MP_ACCESS_TOKEN: Boolean(variable('MP_ACCESS_TOKEN')),
      MP_WEBHOOK_SECRET: Boolean(variable('MP_WEBHOOK_SECRET')),
      MP_MODO: variable('MP_MODO') || '(sin declarar · se asume prueba)',
      /* Lo que dice Mercado Pago sobre el dueño del token. Las
         credenciales de prueba pertenecen a una cuenta cuyo alias
         empieza con TEST.
         [CORREGIDO] Antes esto se deducía del prefijo del token, que
         era `TEST-`. Mercado Pago unificó el formato y hoy los dos
         entornos usan `APP_USR-`, así que ese chequeo daba siempre
         «producción» y avisaba de un peligro que no existía. */
      cuenta,
    },
    /* Las dos fuentes por separado: si una variable aparece en una y
       no en la otra, el problema es de cómo se compiló y no de que
       falte cargarla. */
    nombresVisibles: {
      enProcess: visibles(proceso),
      enImportMeta: visibles(meta),
    },
    listoParaCobrar: almacenListo && pagoListo && avisoVerificable,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
