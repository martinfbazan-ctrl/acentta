// @ts-check
import { defineConfig } from 'astro/config';

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
});
