/**
 * acentta · opiniones destacadas
 * ---------------------------------------------------------------
 * Contenido de demostración, parte del catálogo mock. No son reseñas
 * reales de clientes reales: el proyecto se presenta como conceptual
 * y no inventa métricas de negocio.
 *
 * Lo que sí es real es la mecánica: el promedio y la cantidad que se
 * muestran en la home se calculan del catálogo, no están escritos a mano.
 */

export interface OpinionDestacada {
  autor: string;
  ciudad: string;
  puntaje: number;
  texto: string;
  producto: string;
  productoSlug: string;
}

export const opinionesDestacadas: OpinionDestacada[] = [
  {
    autor: 'Carolina M.',
    ciudad: 'Rosario, Santa Fe',
    puntaje: 5,
    texto:
      'Llegó tres días antes de la fecha que decía. La base de mármol pesa lo que tiene que pesar, no se mueve ni con el gato encima.',
    producto: 'Lámpara de pie Arco',
    productoSlug: 'lampara-de-pie-arco',
  },
  {
    autor: 'Diego F.',
    ciudad: 'Córdoba Capital',
    puntaje: 4,
    texto:
      'El lino es lino de verdad, se nota al tacto. Le pongo cuatro y no cinco porque el tono arena es un poco más claro que en la foto.',
    producto: 'Juego de almohadones Lino Arena',
    productoSlug: 'juego-almohadones-lino-arena',
  },
  {
    autor: 'Valentina R.',
    ciudad: 'La Plata, Buenos Aires',
    puntaje: 5,
    texto:
      'Pedí que me avisen si bajaba y me avisaron. Compré con 24 % de descuento y el envío salió gratis por poco. Todo claro desde el principio.',
    producto: 'Alfombra Bereber Trenzada',
    productoSlug: 'alfombra-bereber-trenzada-160x230',
  },
];
