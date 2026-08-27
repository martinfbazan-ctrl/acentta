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
    /*
      De las credenciales se informa la FORMA, nunca el valor.

      Existe por un 401 de Mobbex —«el API Key es obligatorio»— con
      las dos variables cargadas. Que estén cargadas y que sirvan son
      dos cosas distintas, y desde afuera se ven igual: un booleano en
      `true` no distingue una credencial correcta de una pegada al
      revés, con un espacio de más o cortada al copiar.

      El largo y la forma alcanzan para separar esos casos y no
      revelan nada: saber que un texto tiene 40 caracteres no ayuda a
      adivinar cuáles son.
    */
    mobbex: (() => {
      const clave = variable('MOBBEX_API_KEY');
      const token = variable('MOBBEX_ACCESS_TOKEN');
      const esUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
      const sobra = (v: string) => v !== v.trim();

      return {
        MOBBEX_API_KEY: Boolean(clave),
        /* La clave de aplicación son 40 caracteres alfanuméricos, sin guiones. */
        MOBBEX_API_KEY_largo: clave.length,
        /* El token de la entidad es un UUID: 36 caracteres con guiones. */
        MOBBEX_ACCESS_TOKEN: Boolean(token),
        MOBBEX_ACCESS_TOKEN_largo: token.length,
        MOBBEX_WEBHOOK_TOKEN_largo: variable('MOBBEX_WEBHOOK_TOKEN').length,
        MOBBEX_MODO: variable('MOBBEX_MODO') || '(sin declarar · se asume prueba)',

        /* El error más probable y el más difícil de ver mirando el
           panel: los dos valores en el casillero del otro. */
        parecenIntercambiadas: esUuid(clave) && !esUuid(token),
        /* El segundo más probable: un espacio o un salto de línea que
           viajó con el copiar y pegar. */
        sobranEspacios: sobra(clave) || sobra(token),

        aviso:
          !clave || !token
            ? 'Falta cargar alguna de las dos credenciales de Mobbex.'
            : esUuid(clave) && !esUuid(token)
              ? 'Parecen estar cambiadas de lugar: la API Key tiene forma de token de entidad. '
                + 'La API Key son 40 caracteres sin guiones; el Access Token es un UUID de 36.'
              : sobra(clave) || sobra(token)
                ? 'Alguna credencial tiene un espacio o un salto de línea al principio o al final. '
                  + 'Volvé a pegarla sin el sobrante.'
                : clave.length !== 40 || !esUuid(token)
                  ? `La forma no es la esperada: la API Key tiene ${clave.length} caracteres `
                    + `(se esperan 40) y el Access Token ${token.length} (se esperan 36, con guiones).`
                  : null,
      };
    })(),
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
