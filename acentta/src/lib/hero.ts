import { porSlug } from './catalogo';

/**
 * La imagen de la primera lámina del carrusel.
 *
 * Vive acá y no dentro de `HeroCarrusel.astro` porque el layout necesita
 * conocerla para precargarla: es el LCP de la home, y el navegador la
 * descubre recién cuando parsea el `<img>`, ya con el CSS resuelto.
 *
 * Un solo lugar la define. Si mañana el hero arranca con otra campaña, se
 * cambia acá y el `preload` la sigue solo — no hay forma de que el layout
 * precargue una imagen y el carrusel muestre otra.
 *
 * Es un objeto con `src` y `alt`. El carrusel usa los dos; para el `preload`
 * del layout alcanza con `IMAGEN_HERO.src`.
 */
export const IMAGEN_HERO = porSlug('lampara-de-pie-arco')!.imagenes[1]!;
