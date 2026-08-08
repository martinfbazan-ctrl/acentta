// @ts-check
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
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
 * El panel necesita tres cosas que el sitio no quiere: React, la
 * integración de Keystatic y un adaptador de servidor —porque leer y
 * escribir archivos no se puede hacer desde una página estática—.
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
  integrations: [react(), keystatic()],
};

export default configuracionDelPanel;
