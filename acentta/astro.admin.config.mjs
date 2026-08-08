// @ts-check
import react from '@astrojs/react';
import node from '@astrojs/node';

import base from './astro.config.mjs';

/**
 * Configuración del PANEL de carga de productos.
 * ---------------------------------------------------------------
 * Se usa así:
 *
 *     npm run admin
 *
 * y el panel queda en http://localhost:4321/keystatic
 *
 * POR QUÉ UN ARCHIVO APARTE Y NO UNA BANDERA
 *
 * El panel necesita tres cosas que el sitio no quiere: React, un
 * adaptador de servidor —porque leer y escribir archivos no se puede
 * hacer desde una página estática— y sus propias rutas.
 *
 * Si eso viviera en la configuración principal, el build dejaría de
 * producir un directorio de HTML plano y pasaría a producir un
 * servidor. Se llevaría puestos el generador de vista previa, las
 * cuatro auditorías y la posibilidad de publicar en cualquier hosting
 * estático. Además, el visitante que entra a comprar terminaría
 * descargando React para nada.
 *
 * Con dos configuraciones, cada una hace una sola cosa:
 *
 *     npm run dev      el sitio, sin panel
 *     npm run admin    el panel, para cargar productos
 *     npm run build    el sitio publicable, estático puro
 *
 * Lo que el panel produce son archivos YAML en src/contenido/. El
 * sitio los lee al compilar. Nunca corren los dos a la vez en
 * producción, y el panel no queda expuesto en internet.
 */

/**
 * Las rutas del panel se registran acá, a mano.
 *
 * Keystatic trae una integración que hace esto sola, y es lo que
 * habría que usar. No se usa por un motivo concreto: sus páginas
 * internas cargan la configuración a través de un módulo virtual que
 * la integración resuelve, y esa resolución falla en Windows sin
 * emitir ningún error — el servidor arranca normal y las dos rutas
 * simplemente no existen. Diagnosticarlo cuesta, porque no hay nada
 * roto a la vista: hay un 404 donde debería estar el panel.
 *
 * Registrándolas acá, apuntando a archivos propios que importan la
 * configuración por ruta relativa, no queda nada implícito. Y si algo
 * falla, falla diciendo qué.
 *
 * Los archivos viven en `src/panel/` y no en `src/pages/` porque todo
 * lo que está en `src/pages` se vuelve una página del sitio. Estas dos
 * sólo son rutas cuando se usa esta configuración.
 *
 * @type {import('astro').AstroIntegration}
 */
const rutasDelPanel = {
  name: 'acentta:panel',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({
        pattern: '/keystatic/[...params]',
        entrypoint: './src/panel/pagina.astro',
        prerender: false,
      });
      injectRoute({
        pattern: '/api/keystatic/[...params]',
        entrypoint: './src/panel/api.ts',
        prerender: false,
      });
    },
  },
};

/* Se exporta un objeto anotado en lugar de pasar por `defineConfig`.
   Esa función existe para que el editor infiera tipos a partir de lo
   que uno escribe; acá la mayor parte viene heredada de otro archivo y
   la inferencia se rompe al combinarlas. La anotación da el mismo
   chequeo sin pelearse con el genérico.

   @type {import('astro').AstroUserConfig} */
const configuracionDelPanel = {
  ...base,
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), rutasDelPanel],
};

export default configuracionDelPanel;
