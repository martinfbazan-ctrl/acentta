/**
 * acentta · opiniones por producto
 * ---------------------------------------------------------------
 * Contenido de demostración. Vive separado del catálogo porque en un
 * proyecto real las opiniones vienen de otra fuente y con otro ritmo
 * de actualización que la ficha del producto.
 *
 * Regla de honestidad: hay opiniones de 3 y de 4 estrellas, con
 * críticas concretas. Un listado donde todo es 5 estrellas se lee
 * como comprado, y el comprador atento lo detecta.
 */

import type { Opinion } from '@tipos/catalogo';

export const opinionesPorProducto: Record<string, Opinion[]> = {
  'lampara-de-pie-arco': [
    {
      id: 'o1',
      autor: 'Carolina M.',
      puntaje: 5,
      fecha: '2026-07-18',
      texto:
        'Llegó tres días antes de la fecha que decía. La base de mármol pesa lo que tiene que pesar: no se mueve ni con el gato encima. El arco llega justo al centro del sillón.',
      compraVerificada: true,
      foto: {
        src: 'photo-1675767528117-963ce219b52a',
        alt: 'Foto de una compradora: la lámpara de arco junto a su sillón',
        ancho: 600,
        alto: 450,
      },
    },
    {
      id: 'o2',
      autor: 'Nicolás P.',
      puntaje: 4,
      fecha: '2026-07-02',
      texto:
        'Muy buena, pero el armado del arco cuesta más de lo que dice el instructivo. Somos dos y nos llevó media hora. Una vez armada, impecable.',
      compraVerificada: true,
    },
    {
      id: 'o3',
      autor: 'Sofía L.',
      puntaje: 5,
      fecha: '2026-06-21',
      texto:
        'La compré en negro mate y queda mejor de lo que esperaba. El interruptor de pie es más cómodo que buscar el cable a oscuras.',
      compraVerificada: true,
    },
    {
      id: 'o4',
      autor: 'Martín A.',
      puntaje: 3,
      fecha: '2026-06-05',
      texto:
        'La lámpara está bien pero la caja llegó golpeada en una punta. El producto no tenía nada, igual avisé. Me respondieron el mismo día.',
      compraVerificada: true,
    },
  ],

  'juego-almohadones-lino-arena': [
    {
      id: 'o1',
      autor: 'Diego F.',
      puntaje: 4,
      fecha: '2026-07-22',
      texto:
        'El lino es lino de verdad, se nota al tacto. Le pongo cuatro y no cinco porque el tono arena es un poco más claro que en la foto.',
      compraVerificada: true,
    },
    {
      id: 'o2',
      autor: 'Julieta R.',
      puntaje: 5,
      fecha: '2026-07-10',
      texto:
        'Los lavé dos veces y quedaron igual. Arrugados quedan mejor que planchados, tal como dice la descripción. Compré terracota y arena y combinan bien.',
      compraVerificada: true,
      foto: {
        src: 'photo-1698936061086-2bf99c7b9fc5',
        alt: 'Foto de una compradora: los almohadones sobre su sillón gris',
        ancho: 600,
        alto: 450,
      },
    },
    {
      id: 'o3',
      autor: 'Federico S.',
      puntaje: 4,
      fecha: '2026-06-28',
      texto:
        'Son fundas, no vienen con relleno — está aclarado pero conviene leerlo. Buena costura y el cierre no se ve.',
      compraVerificada: true,
    },
  ],

  'alfombra-bereber-trenzada-160x230': [
    {
      id: 'o1',
      autor: 'Valentina R.',
      puntaje: 5,
      fecha: '2026-07-25',
      texto:
        'Pedí que me avisen si bajaba y me avisaron. Compré con 24 % de descuento y el envío salió gratis por poco. Todo claro desde el principio.',
      compraVerificada: true,
    },
    {
      id: 'o2',
      autor: 'Gastón M.',
      puntaje: 4,
      fecha: '2026-07-04',
      texto:
        'Abriga de verdad, el pelo es alto. Los primeros días suelta un poco de pelusa, después para. Tardó nueve días hábiles, dentro de lo prometido.',
      compraVerificada: true,
    },
  ],

  'mesa-auxiliar-roble-macizo': [
    {
      id: 'o1',
      autor: 'Lucía D.',
      puntaje: 5,
      fecha: '2026-07-19',
      texto:
        'Roble macizo de verdad, pesa. Se arma con tres tornillos en cinco minutos. El aceite natural se siente al tacto, no es un barniz plástico.',
      compraVerificada: true,
    },
    {
      id: 'o2',
      autor: 'Ramiro C.',
      puntaje: 5,
      fecha: '2026-06-30',
      texto:
        'La uso al lado del sillón y entra justo. Sostiene una taza, un libro y la lámpara sin tambalear.',
      compraVerificada: true,
    },
  ],

  'puff-tejido-nube': [
    {
      id: 'o1',
      autor: 'Ana T.',
      puntaje: 5,
      fecha: '2026-07-15',
      texto:
        'Firme, no se hunde. Lo uso de apoyapiés y a veces de asiento cuando viene gente. El trenzado es grueso y prolijo.',
      compraVerificada: true,
    },
    {
      id: 'o2',
      autor: 'Pablo E.',
      puntaje: 4,
      fecha: '2026-06-18',
      texto:
        'Muy lindo. El mostaza es más apagado que en la foto, a mí me gustó igual pero lo aclaro.',
      compraVerificada: true,
    },
  ],
};

export function opinionesDe(slug: string): Opinion[] {
  return opinionesPorProducto[slug] ?? [];
}
