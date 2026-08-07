/**
 * acentta · imágenes
 * ---------------------------------------------------------------
 * Las fotos del catálogo son provisorias, de bancos gratuitos.
 * Todo el armado de URLs vive acá: cuando lleguen las fotos propias,
 * se cambia este archivo y el resto del sitio no se entera.
 */

const BASE = 'https://images.unsplash.com/';

/** Anchos que se ofrecen al navegador para que elija según pantalla. */
const ANCHOS = [400, 600, 800, 1200, 1600];

export function foto(id: string, ancho = 800): string {
  return `${BASE}${id}?auto=format&fit=crop&w=${ancho}&q=72`;
}

/**
 * srcset completo. Sin esto, un teléfono de 390 px descarga la misma
 * imagen que un monitor de 27 pulgadas — y lo paga en segundos de carga.
 */
export function srcset(id: string): string {
  return ANCHOS.map((a) => `${foto(id, a)} ${a}w`).join(', ');
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
