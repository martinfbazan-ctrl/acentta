// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://acentta.vercel.app',

  // Salida 100% estática: el build produce archivos .html.
  // Mismo techo de velocidad que escribirlos a mano, sin mantenerlos a mano.
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
  // Cuando lleguen las fotos propias, se borran estos dominios.
  image: {
    domains: ['images.unsplash.com', 'images.pexels.com'],
    remotePatterns: [{ protocol: 'https' }],
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
