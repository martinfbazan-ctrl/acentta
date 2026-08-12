// @ts-check
import vercel from '@astrojs/vercel';

import base from './astro.config.mjs';

/**
 * Configuración de lo que se PUBLICA en Vercel.
 * ---------------------------------------------------------------
 * Es la de siempre más tres rutas de servidor: las dos del cobro y
 * la de consulta de un pedido. El resto del sitio sigue siendo HTML
 * plano, generado al compilar, sin nada corriendo detrás.
 *
 * POR QUÉ UN ARCHIVO APARTE
 *
 * Mismo motivo que con el panel de carga. Un adaptador cambia la
 * forma de la salida: `dist/` deja de ser un directorio de HTML y
 * pasa a ser el formato interno de Vercel. Eso se llevaría puestos
 * el generador de vista previa y las siete auditorías, que leen
 * `dist/` archivo por archivo.
 *
 * Con dos configuraciones cada una hace una sola cosa:
 *
 *     npm run build     el sitio estático, para auditar
 *     npm run vercel    lo que se publica, con las tres funciones
 *
 * Vercel usa esta gracias a `buildCommand` en vercel.json. Las
 * páginas salen igual de estáticas que en la otra; lo único que se
 * agrega son tres funciones.
 *
 * POR QUÉ LAS RUTAS SE REGISTRAN A MANO
 *
 * Los archivos viven en `src/api/` y no en `src/pages/api/`. Todo lo
 * que está en `src/pages` se vuelve una ruta del sitio, y estas tres
 * necesitan un servidor: en la compilación estática —la que auditamos—
 * Astro cortaría con un error pidiendo un adaptador. Registrándolas
 * acá existen sólo cuando hay adaptador para sostenerlas.
 *
 * Es el mismo patrón que ya se usa para el panel, y por el mismo
 * motivo: que la compilación estática siga siendo estática de verdad.
 *
 * @type {import('astro').AstroIntegration}
 */
const rutasDeCobro = {
  name: 'acentta:cobro',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({ pattern: '/api/crear-pago', entrypoint: './src/api/crear-pago.ts', prerender: false });
      injectRoute({ pattern: '/api/aviso-de-pago', entrypoint: './src/api/aviso-de-pago.ts', prerender: false });
      injectRoute({ pattern: '/api/pedido', entrypoint: './src/api/pedido.ts', prerender: false });
      /* Diagnóstico. Dice qué variables ve la función, sin valores.
         Se puede borrar cuando el circuito esté verificado. */
      injectRoute({ pattern: '/api/estado', entrypoint: './src/api/estado.ts', prerender: false });
    },
  },
};

/* Objeto anotado en lugar de `defineConfig`, igual que en la
   configuración del panel: la mayor parte viene heredada de otro
   archivo y la inferencia de tipos se rompe al combinarlas. La
   anotación da el mismo chequeo sin pelearse con el genérico.

   @type {import('astro').AstroUserConfig} */
const configuracionDeProduccion = {
  ...base,
  output: 'static',
  adapter: vercel(),
  /* Sale a otro directorio a propósito. Con adaptador, `dist/` deja
     de ser HTML plano y pasa a partirse en `client/` y `server/`; si
     las dos compilaciones escribieran en el mismo lugar, correr ésta
     y después `npm run auditar` auditaría una salida que no existe,
     con un error confuso. Cada una a lo suyo. */
  outDir: './dist-vercel',
  integrations: [...(base.integrations ?? []), rutasDeCobro],
};

export default configuracionDeProduccion;
