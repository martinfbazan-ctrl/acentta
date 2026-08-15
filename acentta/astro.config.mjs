// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Configuración del SITIO. El panel de administración no está acá.
 * ---------------------------------------------------------------
 * Salida 100 % estática: el build produce archivos .html y nada más.
 * Mismo techo de velocidad que escribirlos a mano, sin mantenerlos a
 * mano, y sin un proceso de servidor que pueda caerse.
 *
 * El panel de carga de productos vive en `astro.admin.config.mjs` y se
 * levanta aparte con `npm run admin`. La separación no es un detalle
 * de organización, es una decisión con tres consecuencias:
 *
 *   · El sitio publicado no lleva React ni el código del panel. Quien
 *     entra a comprar descarga exactamente lo mismo que antes.
 *   · El build sigue siendo un directorio de HTML plano, así que el
 *     generador de vista previa y las cuatro auditorías funcionan sin
 *     cambios.
 *   · El panel no queda expuesto en internet. Se usa en la máquina de
 *     quien carga los productos, y lo que publica son archivos.
 */
export default defineConfig({
  site: 'https://acentta.vercel.app',
  output: 'static',

  /* Astro comprime el HTML por defecto y, al hacerlo, elimina el
     salto de línea que separa un texto de un <a> que viene en la
     línea siguiente. El resultado: "desde la páginade seguimiento".
     No es un problema de redacción sino del compresor, y aparece en
     cualquier párrafo con un enlace partido en dos líneas.
     Se apaga: la diferencia de peso es de unos pocos kilobytes que
     gzip recupera igual, y la alternativa sería escribir todos los
     párrafos en una sola línea. */
  compressHTML: false,

  build: {
    // Cada página en su propio archivo .html (mejor para hosting estático)
    format: 'directory',
    inlineStylesheets: 'auto',
  },

  // Imágenes remotas permitidas mientras el catálogo usa fotos provisorias.
  // Cuando todas las fotos sean propias, se borran estos dominios.
  image: {
    domains: ['images.unsplash.com', 'images.pexels.com'],
    remotePatterns: [{ protocol: 'https' }],
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  /* Ningún guion queda incrustado dentro del HTML.
     ---------------------------------------------------------------
     Por defecto Astro mete los guiones chicos dentro de la página
     para ahorrar una petición. Suena bien y acá estorba: la política
     de seguridad de contenido que sirve Vercel dice `script-src
     'self'`, o sea «sólo se ejecuta código que venga de un archivo
     propio». Un guion incrustado no viene de ningún archivo, así que
     el navegador lo bloquea — y con él se caían el carrusel de la
     home y la validación de dos formularios.

     La alternativa habitual es agregar 'unsafe-inline' a la política,
     que es exactamente lo que la política existe para impedir; o
     firmar cada guion con su hash, que hay que rehacer en cada
     compilación. Poner el umbral en cero es más barato que las dos:
     todo sale a archivo aparte.

     Lo que cuesta: tres pedidos más, en tres páginas. Sobre HTTP/2
     eso no se nota, y a cambio esos archivos quedan cacheados un año
     y se reusan entre páginas. Verificado: después del cambio no
     queda ni un solo <script> ejecutable dentro del HTML. */
  vite: { build: { assetsInlineLimit: 0 } },

  integrations: [
    /* Mapa del sitio para los buscadores.
       ---------------------------------------------------------------
       El filtro no es opcional: sin él entran al mapa las seis páginas
       que llevan `noindex`, y eso es contradecirse por escrito —el
       sitemap dice «indexá esto» y el HTML dice «no lo indexes». El
       buscador resuelve la contradicción ignorando el mapa entero.

       Las direcciones se comparan completas porque eso es lo que
       recibe el filtro. Se usa igualdad exacta y no `includes`: con
       `includes('/carrito')` cualquier producto que algún día se
       llamara «carrito-de-servicio» desaparecería del mapa sin que
       nadie se entere. */
    sitemap({
      filter: (pagina) => {
        const sinIndexar = ['/carrito/', '/checkout/', '/confirmacion/', '/botones/', '/sistema/', '/etapas/', '/pedidos/'];
        const ruta = new URL(pagina).pathname;
        return !sinIndexar.includes(ruta);
      },
    }),
  ],
});
