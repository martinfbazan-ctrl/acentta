/**
 * acentta · imágenes
 * ---------------------------------------------------------------
 * Todo el armado de URLs de foto vive acá. El resto del sitio pide
 * `foto(algo, ancho)` y no sabe de dónde sale.
 *
 * Hay dos orígenes conviviendo, y es a propósito:
 *
 *   PROPIA      Una foto subida desde el panel. Llega como una ruta
 *               que empieza con «/», por ejemplo
 *               `/imagenes/productos/lampara-arco.jpg`. Se sirve desde
 *               el mismo dominio que el sitio, que es lo que hace que
 *               cargue rápido.
 *
 *   PROVISORIA  Una de las fotos de banco del prototipo. Llega como un
 *               identificador de Unsplash, por ejemplo
 *               `photo-1673939859210-23d8444237ff`. Vive en otro
 *               dominio: antes de pedir el primer byte hay que
 *               resolver un DNS y negociar un TLS, y eso es lo que
 *               mantiene el LCP por encima de la meta.
 *
 * Que convivan permite migrar de a un producto por vez en lugar de
 * tener que reemplazar las 105 fotos de golpe. Cuando no quede ninguna
 * provisoria, se borra la mitad de este archivo y el `preconnect` del
 * layout, y el resto del sitio sigue sin enterarse.
 */

const BANCO = 'https://images.unsplash.com/';

/** Anchos que se ofrecen al navegador para que elija según pantalla. */
const ANCHOS = [400, 600, 800, 1200, 1600];

/** Una ruta que arranca con «/» es un archivo propio del sitio. */
const esPropia = (fuente: string) => fuente.startsWith('/');

export function foto(fuente: string, ancho = 800): string {
  if (esPropia(fuente)) {
    /* Un archivo propio se sirve tal cual: no hay servicio de recorte
       detrás. El tamaño lo define la foto que se subió, así que el
       panel pide 800 × 1000 o más. */
    return fuente;
  }
  return `${BANCO}${fuente}?auto=format&fit=crop&w=${ancho}&q=72`;
}

/**
 * srcset completo. Sin esto, un teléfono de 390 px descarga la misma
 * imagen que un monitor de 27 pulgadas — y lo paga en segundos de carga.
 *
 * Con una foto propia no hay varios tamaños que ofrecer, así que se
 * devuelve vacío: el navegador usa `src` y no intenta elegir entre
 * opciones que no existen. Es la respuesta honesta, y además evita el
 * error clásico de declarar anchos que no se sirven.
 */
export function srcset(fuente: string): string | undefined {
  if (esPropia(fuente)) return undefined;
  return ANCHOS.map((a) => `${foto(fuente, a)} ${a}w`).join(', ');
}

/**
 * Tamaños declarados para la grilla de productos.
 * Coinciden con los cortes de `.grilla-productos`: 2 columnas en móvil,
 * 3 desde 640 px, 4 desde 1024 px.
 */
export const TAMANOS_GRILLA =
  '(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw';

export const TAMANOS_HERO =
  '(min-width: 1024px) 780px, 100vw';

/* ─────────────────────────────────────────────────────────────
   Recorte en el servidor
   ─────────────────────────────────────────────────────────────
   `foto()` pide un ancho y nada más, así que el banco devuelve el alto
   original. Para una ficha de producto eso está bien: la foto se ve
   entera. Para el hero no: es una franja apaisada con `object-fit:
   cover`, y una foto vertical de 2:3 llega con el triple de alto del
   que se ve. Esos píxeles se descargan, se decodifican y se tiran.

   Medido sobre el hero de la home: 1920 × 2880 descargados para pintar
   1905 × 565. El 81% no se ve nunca.

   Pidiendo `h` junto con `w`, el recorte lo hace el banco antes de
   mandar el archivo.                                                  */

/** Proporción del hero en teléfono. El hueco mide 412 × 510: 0,81. */
export const HERO_MOVIL = 4 / 5;

/** Proporción del hero en escritorio. El hueco es más apaisado todavía,
 *  así que pedir 12:5 deja margen para que `cover` recorte arriba y
 *  abajo sin quedarse corto de ancho. */
export const HERO_ESCRITORIO = 12 / 5;

/** El ancho a partir del cual el hero deja de ser vertical. */
export const CORTE_HERO = 900;

/** Como `foto()`, pero recortada a una proporción. */
export function fotoProporcion(fuente: string, ancho: number, proporcion: number): string {
  if (esPropia(fuente)) return fuente;
  const alto = Math.round(ancho / proporcion);
  return `${BANCO}${fuente}?auto=format&fit=crop&w=${ancho}&h=${alto}&q=72`;
}

/** `srcset` con todos los anchos, recortados a una proporción. */
export function srcsetProporcion(fuente: string, proporcion: number): string | undefined {
  if (esPropia(fuente)) return undefined;
  return ANCHOS.map((a) => `${fotoProporcion(fuente, a, proporcion)} ${a}w`).join(', ');
}
