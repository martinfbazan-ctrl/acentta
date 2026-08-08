/**
 * acentta · catálogo
 * ---------------------------------------------------------------
 * Datos mock, tipados contra el contrato de `types/catalogo.ts`.
 * Si mañana llegan de un CMS o de un proveedor de dropshipping,
 * se reemplaza este archivo y nada más.
 *
 * Catálogo definitivo: 36 productos en dos rubros.
 *   · Decoración (24): iluminación, textil, alfombras y muebles chicos.
 *   · Deco inteligente (12): proyectores, limpieza, aromatización,
 *     seguridad y conectividad.
 *
 * Precios calibrados en pesos argentinos para que el ticket promedio
 * quede alrededor de $ 40.000 y el umbral de envío gratis de $ 50.000
 * caiga un 25 % por encima — que es donde más empuja.
 *
 * ---------------------------------------------------------------
 * LOS SIETE CASOS BORDE
 * ---------------------------------------------------------------
 * No son productos de relleno: cada uno existe para romper algo
 * distinto de la interfaz antes de que lo rompa un cliente. Están
 * marcados en el archivo con el comentario CASO BORDE.
 *
 *   1. Nombre de más de 90 caracteres ...... p35 (96 car.)
 *      Nombre largo en decoración .......... p03 (83 car.)
 *   2. Producto agotado .................... p14
 *      Producto con una sola unidad ........ p26
 *   3. Producto sin ninguna opinión ........ p07 y p31
 *   4. Descuento del 60 % .................. p20
 *      Producto sin descuento .............. p04, p10, p15, p17…
 *   5. Precio de seis cifras ............... p19 y p28
 *   6. Producto con una sola foto .......... p29
 *   7. Producto con seis variantes ......... p30
 *
 * Un catálogo de demostración con productos todos parecidos no
 * demuestra nada: la grilla siempre queda linda cuando los nombres
 * miden lo mismo y todos los precios tienen cinco dígitos.
 */

import type { Producto } from '@tipos/catalogo';

export const productos: Producto[] = [
  /* ============================================================
     ILUMINACIÓN
     ============================================================ */
  {
    id: 'p01',
    slug: 'lampara-de-pie-arco',
    nombre: 'Lámpara de pie Arco',
    rubro: 'decoracion',
    categoria: 'iluminacion',
    precio: 89900,
    precioAnterior: 129900,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Negro mate', muestra: '#1C1C1C', stock: 12, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Latón', muestra: '#B08D57', stock: 7, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Blanco', muestra: '#F2F2F0', stock: 4, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1673939859210-23d8444237ff', alt: 'Lámpara de pie de arco junto a un sillón en un living luminoso', ancho: 800, alto: 1000 },
      { src: 'photo-1675767528117-963ce219b52a', alt: 'La misma lámpara vista desde el otro extremo del living', ancho: 800, alto: 1000 },
      { src: 'photo-1688918511009-0b3992e6b020', alt: 'Detalle de la pantalla de la lámpara encendida al atardecer', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Un arco de 2,10 m que lleva la luz al centro del ambiente sin ocupar el centro del ambiente. Base de mármol para que no se mueva y pantalla orientable.',
    especificaciones: [
      { clave: 'Altura', valor: '210 cm' },
      { clave: 'Alcance del arco', valor: '160 cm' },
      { clave: 'Base', valor: 'Mármol Carrara' },
      { clave: 'Portalámparas', valor: 'E27, hasta 15 W LED' },
      { clave: 'Cable', valor: '2,5 m con interruptor de pie' },
    ],
    dimensiones: { alto: 210, ancho: 160, profundidad: 35 },
    peso: 14.2,
    plazoEnvio: { min: 5, max: 9 },
    rating: 4.7,
    cantidadOpiniones: 128,
    opiniones: [],
    badges: ['mas_vendido', 'oferta'],
    unidadesVendidas: 312,
    crossSell: ['p13', 'p09', 'p06'],
  },
  {
    id: 'p02',
    slug: 'lampara-de-mesa-cupula-ceramica',
    nombre: 'Lámpara de mesa Cúpula Cerámica',
    rubro: 'decoracion',
    categoria: 'iluminacion',
    precio: 34500,
    precioAnterior: 46000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Arena', muestra: '#D9CBB8', stock: 18, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Terracota', muestra: '#B5654A', stock: 9, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Verde salvia', muestra: '#8A9A82', stock: 6, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1685302874389-ed7790984a2e', alt: 'Lámpara de mesa de cerámica sobre una mesa blanca junto a una planta', ancho: 800, alto: 1000 },
      { src: 'photo-1513694203232-719a280e022f', alt: 'La lámpara encendida sobre una cómoda de madera', ancho: 800, alto: 1000 },
      { src: 'photo-1743578666060-49a1747d61df', alt: 'Rincón con la lámpara y objetos de decoración vintage', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Cerámica esmaltada a mano, así que no hay dos iguales. Luz cálida y difusa, pensada para mesa de luz o para un rincón de lectura.',
    especificaciones: [
      { clave: 'Altura', valor: '38 cm' },
      { clave: 'Diámetro de pantalla', valor: '26 cm' },
      { clave: 'Material', valor: 'Cerámica esmaltada + lino' },
      { clave: 'Portalámparas', valor: 'E27, hasta 12 W LED' },
    ],
    dimensiones: { alto: 38, ancho: 26, profundidad: 26 },
    peso: 2.6,
    plazoEnvio: { min: 4, max: 8 },
    rating: 4.5,
    cantidadOpiniones: 64,
    opiniones: [],
    badges: ['oferta'],
    crossSell: ['p07', 'p12', 'p05'],
  },
  {
    id: 'p03',
    slug: 'colgante-domo-laton-cable-textil',
    /* CASO BORDE · nombre de 83 caracteres, para verificar que la grilla
       no se rompa ni empuje el precio fuera de línea. El caso extremo
       de más de 90 está en p35, ya en el segundo rubro. */
    nombre: 'Lámpara colgante Domo de latón cepillado con cable textil regulable de hasta 180 cm',
    rubro: 'decoracion',
    categoria: 'iluminacion',
    precio: 62400,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Latón cepillado', muestra: '#B08D57', stock: 11, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Negro grafito', muestra: '#2B2B2B', stock: 8, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1638189311070-d4e5dcc86902', alt: 'Lámpara colgante de latón sobre una mesa auxiliar', ancho: 800, alto: 1000 },
      { src: 'photo-1718049720099-a035f05e539a', alt: 'El colgante iluminando un living con sillón blanco', ancho: 800, alto: 1000 },
      { src: 'photo-1560448204-603b3fc33ddc', alt: 'Vista general del ambiente con el colgante encendido', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Domo de latón cepillado de 30 cm con cable textil regulable. Va bien solo sobre una mesa o en fila de tres sobre una isla.',
    especificaciones: [
      { clave: 'Diámetro', valor: '30 cm' },
      { clave: 'Largo de cable', valor: 'Regulable hasta 180 cm' },
      { clave: 'Material', valor: 'Latón cepillado' },
      { clave: 'Portalámparas', valor: 'E27, hasta 15 W LED' },
    ],
    dimensiones: { alto: 22, ancho: 30, profundidad: 30 },
    peso: 1.9,
    plazoEnvio: { min: 6, max: 11 },
    rating: 4.8,
    cantidadOpiniones: 23,
    opiniones: [],
    badges: ['nuevo'],
    crossSell: ['p12', 'p01', 'p10'],
  },
  {
    id: 'p04',
    slug: 'lampara-de-pie-tripode-roble',
    nombre: 'Lámpara de pie Trípode Roble',
    rubro: 'decoracion',
    categoria: 'iluminacion',
    precio: 78900,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Roble natural', muestra: '#C4A484', stock: 9, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Nogal', muestra: '#6B4A2F', stock: 5, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1675767528183-628d7e46ae59', alt: 'Lámpara de pie con trípode de madera junto a un sillón', ancho: 800, alto: 1000 },
      { src: 'photo-1646107543597-e95b90ba4081', alt: 'La lámpara en un living con sillón y butaca', ancho: 800, alto: 1000 },
      { src: 'photo-1693578616322-c8abe6c7393d', alt: 'Vista lateral del trípode de madera maciza', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Trípode de roble macizo con pantalla de lino crudo. Sube 155 cm y ocupa poco piso: entra en el hueco entre el sillón y la pared.',
    especificaciones: [
      { clave: 'Altura', valor: '155 cm' },
      { clave: 'Diámetro de pantalla', valor: '45 cm' },
      { clave: 'Material', valor: 'Roble macizo + lino' },
      { clave: 'Portalámparas', valor: 'E27, hasta 15 W LED' },
    ],
    dimensiones: { alto: 155, ancho: 45, profundidad: 45 },
    peso: 6.4,
    plazoEnvio: { min: 5, max: 10 },
    rating: 4.4,
    cantidadOpiniones: 89,
    opiniones: [],
    badges: [],
    crossSell: ['p09', 'p13', 'p02'],
  },
  {
    id: 'p05',
    slug: 'velador-papel-japones',
    nombre: 'Velador Papel Japonés',
    rubro: 'decoracion',
    categoria: 'iluminacion',
    precio: 21900,
    precioAnterior: 28900,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'medida', nombre: '25 cm', stock: 22, imagen: 0 },
      { id: 'v2', tipo: 'medida', nombre: '35 cm', stock: 14, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1714926618653-39de3cf5b691', alt: 'Velador de papel japonés apoyado sobre piso de madera', ancho: 800, alto: 1000 },
      { src: 'photo-1685302874389-ed7790984a2e', alt: 'El velador encendido sobre una mesa auxiliar', ancho: 800, alto: 1000 },
      { src: 'photo-1743578666060-49a1747d61df', alt: 'Rincón cálido con el velador prendido', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Papel de arroz sobre estructura de bambú. Da una luz suave y pareja, sin sombras duras. Se pliega para guardar.',
    especificaciones: [
      { clave: 'Altura', valor: '25 o 35 cm según medida' },
      { clave: 'Material', valor: 'Papel de arroz + bambú' },
      { clave: 'Portalámparas', valor: 'E14, hasta 7 W LED' },
    ],
    dimensiones: { alto: 35, ancho: 25, profundidad: 25 },
    peso: 0.7,
    plazoEnvio: { min: 4, max: 8 },
    rating: 4.2,
    cantidadOpiniones: 12,
    opiniones: [],
    badges: ['oferta'],
    crossSell: ['p02', 'p08', 'p11'],
  },

  /* ============================================================
     TEXTIL
     ============================================================ */
  {
    id: 'p06',
    slug: 'juego-almohadones-lino-arena',
    nombre: 'Juego de almohadones Lino Arena',
    rubro: 'decoracion',
    categoria: 'textil',
    precio: 28400,
    precioAnterior: 41900,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Arena', muestra: '#D9CBB8', stock: 24, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Piedra', muestra: '#A8A29A', stock: 16, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Terracota', muestra: '#B5654A', stock: 11, imagen: 2 },
      { id: 'v4', tipo: 'color', nombre: 'Verde salvia', muestra: '#8A9A82', stock: 8, imagen: 0 },
      { id: 'v5', tipo: 'color', nombre: 'Azul niebla', muestra: '#8FA3B0', stock: 6, imagen: 1 },
      { id: 'v6', tipo: 'color', nombre: 'Carbón', muestra: '#3A3A3A', stock: 4, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1698936061086-2bf99c7b9fc5', alt: 'Sillón gris con cuatro almohadones de lino combinados', ancho: 800, alto: 1000 },
      { src: 'photo-1606885118474-c8baf907e998', alt: 'Detalle de la textura del lino de los almohadones', ancho: 800, alto: 1000 },
      { src: 'photo-1534889156217-d643df14f14a', alt: 'Los almohadones sobre un sillón verde azulado', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Cuatro fundas de lino lavado de 45 × 45 cm con cierre invisible. Se lavan en lavarropas y quedan mejor arrugadas que planchadas.',
    especificaciones: [
      { clave: 'Medida', valor: '45 × 45 cm cada uno' },
      { clave: 'Unidades', valor: '4 fundas' },
      { clave: 'Material', valor: '100 % lino lavado' },
      { clave: 'Relleno', valor: 'No incluido' },
      { clave: 'Lavado', valor: 'Lavarropas, agua fría' },
    ],
    dimensiones: { alto: 45, ancho: 45, profundidad: 8 },
    peso: 1.1,
    plazoEnvio: { min: 4, max: 7 },
    rating: 4.6,
    cantidadOpiniones: 210,
    opiniones: [],
    badges: ['mas_vendido', 'oferta'],
    unidadesVendidas: 486,
    crossSell: ['p07', 'p09', 'p13'],
  },
  {
    id: 'p07',
    slug: 'manta-tejida-sierra',
    nombre: 'Manta tejida Sierra',
    rubro: 'decoracion',
    categoria: 'textil',
    precio: 32900,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Crudo', muestra: '#E8E2D8', stock: 15, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Gris piedra', muestra: '#9A9A96', stock: 10, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1616395442106-1b927fee41cd', alt: 'Manta tejida con patrón geométrico en tonos tierra', ancho: 800, alto: 1000 },
      { src: 'photo-1608724553456-89e963624dbb', alt: 'Detalle del tejido de la manta', ancho: 800, alto: 1000 },
      { src: 'photo-1698936061086-2bf99c7b9fc5', alt: 'La manta doblada sobre el respaldo de un sillón', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Tejida en telar con lana y algodón. Mide 130 × 170 cm: alcanza para taparse en el sillón sin que sobre por los costados.',
    especificaciones: [
      { clave: 'Medida', valor: '130 × 170 cm' },
      { clave: 'Material', valor: '60 % lana, 40 % algodón' },
      { clave: 'Terminación', valor: 'Flecos tejidos a mano' },
      { clave: 'Lavado', valor: 'Lavado en seco' },
    ],
    dimensiones: { alto: 170, ancho: 130, profundidad: 4 },
    peso: 1.8,
    plazoEnvio: { min: 5, max: 9 },
    /* CASO BORDE · producto sin ninguna opinión todavía.
       No se inventa un rating: se dice que no hay. */
    cantidadOpiniones: 0,
    opiniones: [],
    badges: ['nuevo'],
    crossSell: ['p06', 'p13', 'p02'],
  },
  {
    id: 'p08',
    slug: 'camino-de-mesa-telar-natural',
    nombre: 'Camino de mesa Telar Natural',
    rubro: 'decoracion',
    categoria: 'textil',
    precio: 15800,
    precioAnterior: 22500,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'medida', nombre: '40 × 140 cm', stock: 19, imagen: 0 },
      { id: 'v2', tipo: 'medida', nombre: '40 × 180 cm', stock: 12, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1608724553456-89e963624dbb', alt: 'Camino de mesa tejido en telar con motivos geométricos', ancho: 800, alto: 1000 },
      { src: 'photo-1606885118474-c8baf907e998', alt: 'Detalle de la trama del camino de mesa', ancho: 800, alto: 1000 },
      { src: 'photo-1616046229478-9901c5536a45', alt: 'El camino puesto sobre una mesa de madera con sillas', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Algodón crudo tejido en telar manual. Suma textura a la mesa sin taparla, que es justo lo que una mesa de madera necesita.',
    especificaciones: [
      { clave: 'Medida', valor: '40 × 140 cm o 40 × 180 cm' },
      { clave: 'Material', valor: '100 % algodón' },
      { clave: 'Lavado', valor: 'Lavarropas, ciclo delicado' },
    ],
    dimensiones: { alto: 180, ancho: 40, profundidad: 1 },
    peso: 0.5,
    plazoEnvio: { min: 4, max: 7 },
    rating: 4.3,
    cantidadOpiniones: 37,
    opiniones: [],
    badges: ['oferta'],
    crossSell: ['p12', 'p06', 'p05'],
  },

  /* ============================================================
     ALFOMBRAS
     ============================================================ */
  {
    id: 'p09',
    slug: 'alfombra-bereber-trenzada-160x230',
    nombre: 'Alfombra Bereber Trenzada 160 × 230',
    rubro: 'decoracion',
    categoria: 'alfombras',
    precio: 74500,
    precioAnterior: 98000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'medida', nombre: '160 × 230 cm', stock: 8, imagen: 0 },
      { id: 'v2', tipo: 'medida', nombre: '200 × 290 cm', stock: 4, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1600166898405-da9535204843', alt: 'Alfombra bereber de lana cruda con flecos', ancho: 800, alto: 1000 },
      { src: 'photo-1594040226829-7f251ab46d80', alt: 'La alfombra en un ambiente, vista desde arriba', ancho: 800, alto: 1000 },
      { src: 'photo-1695632953654-78815eee7296', alt: 'Detalle del trenzado y los flecos de la alfombra', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Lana cruda trenzada a mano con flecos en los dos extremos. Pelo alto de 2 cm: abriga el piso de verdad, no sólo a la vista.',
    especificaciones: [
      { clave: 'Medida', valor: '160 × 230 cm o 200 × 290 cm' },
      { clave: 'Material', valor: '100 % lana' },
      { clave: 'Altura de pelo', valor: '20 mm' },
      { clave: 'Base', valor: 'Algodón antideslizante' },
      { clave: 'Limpieza', valor: 'Aspirado suave, limpieza en seco' },
    ],
    dimensiones: { alto: 230, ancho: 160, profundidad: 2 },
    peso: 9.8,
    plazoEnvio: { min: 7, max: 13 },
    rating: 4.7,
    cantidadOpiniones: 96,
    opiniones: [],
    badges: ['oferta'],
    unidadesVendidas: 154,
    crossSell: ['p01', 'p13', 'p06'],
  },
  {
    id: 'p10',
    slug: 'alfombra-kilim-ocre-120x170',
    nombre: 'Alfombra Kilim Ocre 120 × 170',
    rubro: 'decoracion',
    categoria: 'alfombras',
    precio: 52300,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'medida', nombre: '120 × 170 cm', stock: 13, imagen: 0 },
      { id: 'v2', tipo: 'medida', nombre: '160 × 230 cm', stock: 6, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1572123979839-3749e9973aba', alt: 'Alfombra kilim con motivos geométricos en tonos ocre', ancho: 800, alto: 1000 },
      { src: 'photo-1671576563965-23993d69eb17', alt: 'Detalle del dibujo del kilim', ancho: 800, alto: 1000 },
      { src: 'photo-1621700052663-f1170e9b26ec', alt: 'La alfombra kilim vista completa sobre piso claro', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Tejido plano, sin pelo. Liviana, se dobla y se lleva, y es la única que sobrevive a un comedor con sillas que se arrastran.',
    especificaciones: [
      { clave: 'Medida', valor: '120 × 170 cm o 160 × 230 cm' },
      { clave: 'Material', valor: 'Lana y algodón' },
      { clave: 'Tipo de tejido', valor: 'Plano, reversible' },
      { clave: 'Limpieza', valor: 'Aspirado, lavable en seco' },
    ],
    dimensiones: { alto: 170, ancho: 120, profundidad: 0.5 },
    peso: 4.2,
    plazoEnvio: { min: 6, max: 11 },
    rating: 4.5,
    cantidadOpiniones: 54,
    opiniones: [],
    badges: [],
    crossSell: ['p12', 'p03', 'p07'],
  },
  {
    id: 'p11',
    slug: 'alfombra-yute-redonda-150',
    nombre: 'Alfombra Yute Redonda 150 cm',
    rubro: 'decoracion',
    categoria: 'alfombras',
    precio: 41200,
    precioAnterior: 58900,
    moneda: 'ARS',
    /* CASO BORDE · stock real bajo. El badge de "últimas unidades" no
       está escrito a mano: se calcula de esta suma. Si el stock sube,
       el badge desaparece solo. */
    variantes: [
      { id: 'v1', tipo: 'medida', nombre: '150 cm', stock: 2, imagen: 0 },
      { id: 'v2', tipo: 'medida', nombre: '180 cm', stock: 1, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1603913996638-c01100417b4a', alt: 'Alfombra redonda de yute con una planta encima', ancho: 800, alto: 1000 },
      { src: 'photo-1714926618653-39de3cf5b691', alt: 'La alfombra de yute sobre piso de madera', ancho: 800, alto: 1000 },
      { src: 'photo-1600166898405-da9535204843', alt: 'Detalle del trenzado del yute', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Yute natural trenzado en espiral. Áspera al tacto y resistente: va bien en entrada, cocina o debajo de una mesa redonda.',
    especificaciones: [
      { clave: 'Diámetro', valor: '150 cm o 180 cm' },
      { clave: 'Material', valor: '100 % yute natural' },
      { clave: 'Altura de pelo', valor: '8 mm' },
      { clave: 'Limpieza', valor: 'Aspirado, paño húmedo' },
    ],
    dimensiones: { alto: 150, ancho: 150, profundidad: 0.8 },
    peso: 7.1,
    plazoEnvio: { min: 6, max: 12 },
    rating: 4.4,
    cantidadOpiniones: 71,
    opiniones: [],
    badges: ['oferta'],
    crossSell: ['p14', 'p05', 'p08'],
  },

  /* ============================================================
     MUEBLES CHICOS
     ============================================================ */
  {
    id: 'p12',
    slug: 'mesa-auxiliar-roble-macizo',
    nombre: 'Mesa auxiliar Roble Macizo',
    rubro: 'decoracion',
    categoria: 'muebles-chicos',
    precio: 62400,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'material', nombre: 'Roble natural', stock: 14, imagen: 0 },
      { id: 'v2', tipo: 'material', nombre: 'Roble ahumado', stock: 7, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1607809714110-e34f71c7b2ed', alt: 'Mesa auxiliar redonda de roble con dos sillas', ancho: 800, alto: 1000 },
      { src: 'photo-1616046229478-9901c5536a45', alt: 'La mesa de roble vista en un comedor', ancho: 800, alto: 1000 },
      { src: 'photo-1693578616322-c8abe6c7393d', alt: 'La mesa auxiliar junto a un sillón', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Roble macizo con aceite natural, sin barniz plástico. Tapa de 50 cm: entra al lado del sillón y sostiene una taza, un libro y una lámpara.',
    especificaciones: [
      { clave: 'Diámetro de tapa', valor: '50 cm' },
      { clave: 'Altura', valor: '52 cm' },
      { clave: 'Material', valor: 'Roble macizo aceitado' },
      { clave: 'Armado', valor: 'Tres tornillos, sin herramientas especiales' },
    ],
    dimensiones: { alto: 52, ancho: 50, profundidad: 50 },
    peso: 8.3,
    plazoEnvio: { min: 7, max: 12 },
    rating: 4.8,
    cantidadOpiniones: 143,
    opiniones: [],
    badges: ['mas_vendido'],
    unidadesVendidas: 267,
    crossSell: ['p02', 'p03', 'p10'],
  },
  {
    id: 'p13',
    slug: 'puff-tejido-nube',
    nombre: 'Puff tejido Nube',
    rubro: 'decoracion',
    categoria: 'muebles-chicos',
    precio: 38900,
    precioAnterior: 51900,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Crudo', muestra: '#E8E2D8', stock: 16, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Gris piedra', muestra: '#9A9A96', stock: 9, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Mostaza', muestra: '#D0A03C', stock: 5, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1606425288528-4cebbfc69de7', alt: 'Puff tejido junto a una butaca blanca', ancho: 800, alto: 1000 },
      { src: 'photo-1566386429501-fe1523f35f40', alt: 'El puff usado como apoyapiés frente a un sillón', ancho: 800, alto: 1000 },
      { src: 'photo-1646107543597-e95b90ba4081', alt: 'El puff en el living, visto de lejos', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Trenzado grueso de algodón sobre relleno firme. Sirve de apoyapiés, de asiento extra y de mesita si le apoyas una bandeja arriba.',
    especificaciones: [
      { clave: 'Diámetro', valor: '45 cm' },
      { clave: 'Altura', valor: '38 cm' },
      { clave: 'Material', valor: 'Algodón trenzado' },
      { clave: 'Relleno', valor: 'Espuma de alta densidad' },
      { clave: 'Soporta', valor: 'Hasta 110 kg' },
    ],
    dimensiones: { alto: 38, ancho: 45, profundidad: 45 },
    peso: 3.9,
    plazoEnvio: { min: 5, max: 9 },
    rating: 4.6,
    cantidadOpiniones: 88,
    opiniones: [],
    badges: ['oferta'],
    crossSell: ['p09', 'p06', 'p04'],
  },
  {
    id: 'p14',
    slug: 'banqueta-nordica-fresno',
    nombre: 'Banqueta Nórdica Fresno',
    rubro: 'decoracion',
    categoria: 'muebles-chicos',
    precio: 29700,
    moneda: 'ARS',
    /* CASO BORDE · producto agotado. Sigue visible y sigue siendo
       indexable: esconderlo pierde el tráfico que ya lo busca. */
    variantes: [
      { id: 'v1', tipo: 'material', nombre: 'Fresno natural', stock: 0, imagen: 0 },
      { id: 'v2', tipo: 'material', nombre: 'Fresno negro', stock: 0, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1586023492125-27b2c045efd7', alt: 'Banqueta de madera de fresno con asiento tapizado', ancho: 800, alto: 1000 },
      { src: 'photo-1566386429501-fe1523f35f40', alt: 'La banqueta junto a una butaca', ancho: 800, alto: 1000 },
      { src: 'photo-1607809714110-e34f71c7b2ed', alt: 'La banqueta usada como asiento en una mesa', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Patas de fresno macizo y asiento tapizado en tela texturada. Apilable de a tres, para cuando llega gente de más.',
    especificaciones: [
      { clave: 'Altura de asiento', valor: '45 cm' },
      { clave: 'Material', valor: 'Fresno macizo + tela' },
      { clave: 'Apilable', valor: 'Hasta 3 unidades' },
      { clave: 'Soporta', valor: 'Hasta 120 kg' },
    ],
    dimensiones: { alto: 45, ancho: 38, profundidad: 38 },
    peso: 4.6,
    plazoEnvio: { min: 6, max: 11 },
    rating: 4.1,
    cantidadOpiniones: 45,
    opiniones: [],
    badges: [],
    crossSell: ['p12', 'p13', 'p11'],
  },

  /* ============================================================
     ILUMINACIÓN · completa el rubro
     ============================================================ */
  {
    id: 'p15',
    slug: 'aplique-de-pared-media-luna',
    nombre: 'Aplique de pared Media Luna',
    rubro: 'decoracion',
    categoria: 'iluminacion',
    precio: 41800,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco yeso', muestra: '#F2EFE9', stock: 14, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Negro grafito', muestra: '#2B2B2B', stock: 9, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Latón', muestra: '#B08D57', stock: 5, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1718049720099-a035f05e539a', alt: 'Aplique de pared encendido junto a un sillón blanco', ancho: 800, alto: 1000 },
      { src: 'photo-1560448204-603b3fc33ddc', alt: 'El aplique visto en el conjunto del ambiente', ancho: 800, alto: 1000 },
      { src: 'photo-1638189311070-d4e5dcc86902', alt: 'Detalle del cuerpo metálico del aplique', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Luz indirecta contra la pared, sin lámpara que ocupe la mesa de luz. Se instala con dos tarugos y se orienta a mano.',
    especificaciones: [
      { clave: 'Ancho', valor: '24 cm' },
      { clave: 'Saliente de pared', valor: '11 cm' },
      { clave: 'Material', valor: 'Metal con pintura mate' },
      { clave: 'Portalámparas', valor: 'E14, hasta 8 W LED' },
      { clave: 'Instalación', valor: 'A caja de pared o a tomacorriente' },
    ],
    dimensiones: { alto: 14, ancho: 24, profundidad: 11 },
    peso: 1.1,
    plazoEnvio: { min: 5, max: 9 },
    rating: 4.4,
    cantidadOpiniones: 37,
    opiniones: [],
    badges: [],
    crossSell: ['p02', 'p05', 'p12'],
  },

  /* ============================================================
     TEXTIL · completa el rubro
     ============================================================ */
  {
    id: 'p16',
    slug: 'juego-de-sabanas-percal-300-hilos',
    nombre: 'Juego de sábanas Percal 300 hilos',
    rubro: 'decoracion',
    categoria: 'textil',
    precio: 58400,
    precioAnterior: 79900,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'medida', nombre: 'Una plaza y media', stock: 12, imagen: 0 },
      { id: 'v2', tipo: 'medida', nombre: 'Dos plazas', stock: 16, imagen: 0 },
      { id: 'v3', tipo: 'medida', nombre: 'Queen', stock: 8, imagen: 1 },
      { id: 'v4', tipo: 'medida', nombre: 'King', stock: 3, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1534889156217-d643df14f14a', alt: 'Cama tendida con juego de sábanas de algodón en tono neutro', ancho: 800, alto: 1000 },
      { src: 'photo-1606885118474-c8baf907e998', alt: 'Detalle de la textura del percal', ancho: 800, alto: 1000 },
      { src: 'photo-1616395442106-1b927fee41cd', alt: 'La cama tendida vista desde los pies', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Percal de 300 hilos: fresco en verano y sin ese brillo plástico del satén barato. Incluye sábana ajustable, encimera y dos fundas.',
    especificaciones: [
      { clave: 'Composición', valor: '100 % algodón peinado' },
      { clave: 'Densidad', valor: '300 hilos' },
      { clave: 'Incluye', valor: 'Ajustable, encimera y 2 fundas' },
      { clave: 'Alto de colchón', valor: 'Hasta 35 cm' },
      { clave: 'Lavado', valor: 'Máquina, agua fría' },
    ],
    dimensiones: { alto: 8, ancho: 40, profundidad: 30 },
    peso: 2.1,
    plazoEnvio: { min: 4, max: 8 },
    rating: 4.6,
    cantidadOpiniones: 214,
    opiniones: [],
    badges: ['mas_vendido', 'oferta'],
    unidadesVendidas: 486,
    crossSell: ['p07', 'p06', 'p17'],
  },
  {
    id: 'p17',
    slug: 'manta-de-lana-liviana-pampa',
    nombre: 'Manta de lana liviana Pampa',
    rubro: 'decoracion',
    categoria: 'textil',
    precio: 46200,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Crudo', muestra: '#E8E0D2', stock: 10, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Gris piedra', muestra: '#9A968E', stock: 7, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Verde salvia', muestra: '#8A9A82', stock: 4, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1616395442106-1b927fee41cd', alt: 'Manta de lana liviana desplegada sobre una cama', ancho: 800, alto: 1000 },
      { src: 'photo-1608724553456-89e963624dbb', alt: 'Detalle del tejido de la manta', ancho: 800, alto: 1000 },
      { src: 'photo-1534889156217-d643df14f14a', alt: 'La manta doblada a los pies de la cama', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Lana merino lavada, de las que abrigan sin pesar. Sirve de sobrecama en verano y de segunda capa en invierno.',
    especificaciones: [
      { clave: 'Medida', valor: '180 × 220 cm' },
      { clave: 'Composición', valor: '70 % lana merino, 30 % algodón' },
      { clave: 'Gramaje', valor: '480 g/m²' },
      { clave: 'Lavado', valor: 'En seco o a mano, agua fría' },
    ],
    dimensiones: { alto: 10, ancho: 45, profundidad: 32 },
    peso: 1.8,
    plazoEnvio: { min: 5, max: 10 },
    rating: 4.7,
    cantidadOpiniones: 88,
    opiniones: [],
    badges: [],
    crossSell: ['p06', 'p16', 'p13'],
  },
  {
    id: 'p18',
    slug: 'individuales-de-lino-juego-de-cuatro',
    nombre: 'Individuales de lino, juego de cuatro',
    rubro: 'decoracion',
    categoria: 'textil',
    precio: 24900,
    precioAnterior: 33200,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Arena', muestra: '#D9CBB8', stock: 22, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Terracota', muestra: '#B5654A', stock: 11, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Gris piedra', muestra: '#9A968E', stock: 15, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1616046229478-9901c5536a45', alt: 'Mesa de madera puesta con individuales de lino y platos', ancho: 800, alto: 1000 },
      { src: 'photo-1606885118474-c8baf907e998', alt: 'Detalle de la trama del lino', ancho: 800, alto: 1000 },
      { src: 'photo-1608724553456-89e963624dbb', alt: 'Los individuales apilados sobre la mesa', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Lino lavado con dobladillo a mano. Se arruga, y esa es la idea: es la única tela que mejora con el uso.',
    especificaciones: [
      { clave: 'Medida', valor: '33 × 48 cm cada uno' },
      { clave: 'Cantidad', valor: '4 unidades' },
      { clave: 'Composición', valor: '100 % lino lavado' },
      { clave: 'Lavado', valor: 'Máquina, agua fría' },
    ],
    dimensiones: { alto: 4, ancho: 34, profundidad: 25 },
    peso: 0.6,
    plazoEnvio: { min: 4, max: 8 },
    rating: 4.3,
    cantidadOpiniones: 52,
    opiniones: [],
    badges: ['oferta'],
    crossSell: ['p08', 'p12', 'p02'],
  },

  /* ============================================================
     ALFOMBRAS · completa el rubro
     ============================================================ */
  {
    id: 'p19',
    slug: 'alfombra-de-lana-trama-nieve-200x290',
    nombre: 'Alfombra de lana Trama Nieve 200 × 290',
    rubro: 'decoracion',
    categoria: 'alfombras',
    /* CASO BORDE · precio de seis cifras. Es el que verifica de
       verdad la alineación tabular: si los números no son de ancho
       fijo, este producto desalinea toda la columna de precios de
       la grilla. Además supera solo el umbral de envío gratis, así
       que la barra de progreso aparece completa desde el primer
       artículo — un estado que hay que ver antes de publicar. */
    precio: 214900,
    precioAnterior: 268000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Nieve', muestra: '#EFEAE1', stock: 4, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Avena', muestra: '#D6C7AE', stock: 3, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1594040226829-7f251ab46d80', alt: 'Alfombra de lana clara vista desde arriba en un living', ancho: 800, alto: 1000 },
      { src: 'photo-1621700052663-f1170e9b26ec', alt: 'La alfombra completa sobre piso claro', ancho: 800, alto: 1000 },
      { src: 'photo-1695632953654-78815eee7296', alt: 'Detalle del pelo de lana de la alfombra', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Lana virgen anudada a mano, 2 cm de pelo. Es la pieza que define un living entero: conviene medir el ambiente antes, no después.',
    especificaciones: [
      { clave: 'Medida', valor: '200 × 290 cm' },
      { clave: 'Material', valor: '100 % lana virgen' },
      { clave: 'Altura de pelo', valor: '20 mm' },
      { clave: 'Base', valor: 'Algodón tejido' },
      { clave: 'Limpieza', valor: 'Aspirado semanal, lavado profesional' },
    ],
    dimensiones: { alto: 22, ancho: 60, profundidad: 60 },
    peso: 21.4,
    plazoEnvio: { min: 8, max: 15 },
    rating: 4.9,
    cantidadOpiniones: 31,
    opiniones: [],
    badges: ['oferta'],
    crossSell: ['p01', 'p13', 'p12'],
  },
  {
    id: 'p20',
    slug: 'alfombra-lavable-damero-140x200',
    nombre: 'Alfombra lavable Damero 140 × 200',
    rubro: 'decoracion',
    categoria: 'alfombras',
    /* CASO BORDE · 60 % de descuento. Es el porcentaje más alto del
       catálogo y el que pone a prueba el badge: con tres dígitos más
       el signo, la pastilla tiene que seguir entrando en la esquina
       de la tarjeta sin tapar la foto. */
    precio: 35600,
    precioAnterior: 89000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco y negro', muestra: '#3A3A3A', stock: 18, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Arena y crudo', muestra: '#D9CBB8', stock: 12, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1621700052663-f1170e9b26ec', alt: 'Alfombra con dibujo geométrico sobre piso claro', ancho: 800, alto: 1000 },
      { src: 'photo-1603913996638-c01100417b4a', alt: 'La alfombra con una planta apoyada encima', ancho: 800, alto: 1000 },
      { src: 'photo-1671576563965-23993d69eb17', alt: 'Detalle del dibujo a damero', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Entra en el lavarropas y sale seca en pocas horas. Pensada para cocina, entrada o cuarto de chicos, donde una alfombra de lana dura un mes.',
    especificaciones: [
      { clave: 'Medida', valor: '140 × 200 cm' },
      { clave: 'Material', valor: 'Poliéster reciclado' },
      { clave: 'Altura', valor: '5 mm' },
      { clave: 'Base', valor: 'Antideslizante' },
      { clave: 'Lavado', valor: 'Lavarropas, ciclo delicado 30 °C' },
    ],
    dimensiones: { alto: 12, ancho: 45, profundidad: 45 },
    peso: 4.2,
    plazoEnvio: { min: 5, max: 9 },
    rating: 4.2,
    cantidadOpiniones: 176,
    opiniones: [],
    badges: ['oferta'],
    unidadesVendidas: 341,
    crossSell: ['p11', 'p18', 'p14'],
  },
  {
    id: 'p21',
    slug: 'alfombra-pasillo-kilim-80x300',
    nombre: 'Alfombra de pasillo Kilim 80 × 300',
    rubro: 'decoracion',
    categoria: 'alfombras',
    precio: 67300,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Ocre', muestra: '#C08A2E', stock: 6, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Índigo', muestra: '#3B4E6B', stock: 5, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Terracota', muestra: '#B5654A', stock: 2, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1671576563965-23993d69eb17', alt: 'Alfombra de pasillo con motivos kilim', ancho: 800, alto: 1000 },
      { src: 'photo-1572123979839-3749e9973aba', alt: 'Detalle de los motivos geométricos del kilim', ancho: 800, alto: 1000 },
      { src: 'photo-1594040226829-7f251ab46d80', alt: 'La alfombra extendida en un ambiente', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Tres metros de largo para pasillos, cocinas angostas o el pie de una cama grande. Tejido plano, así que las puertas siguen abriendo.',
    especificaciones: [
      { clave: 'Medida', valor: '80 × 300 cm' },
      { clave: 'Material', valor: 'Lana y algodón' },
      { clave: 'Altura', valor: '6 mm' },
      { clave: 'Tejido', valor: 'Plano, reversible' },
      { clave: 'Limpieza', valor: 'Aspirado y lavado en seco' },
    ],
    dimensiones: { alto: 14, ancho: 50, profundidad: 32 },
    peso: 6.8,
    plazoEnvio: { min: 6, max: 12 },
    rating: 4.5,
    cantidadOpiniones: 41,
    opiniones: [],
    badges: ['nuevo'],
    crossSell: ['p10', 'p09', 'p12'],
  },

  /* ============================================================
     MUEBLES CHICOS · completa el rubro
     ============================================================ */
  {
    id: 'p22',
    slug: 'mesas-ratonas-nido-juego-de-dos',
    nombre: 'Mesas ratonas nido, juego de dos',
    rubro: 'decoracion',
    categoria: 'muebles-chicos',
    precio: 94500,
    precioAnterior: 118000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'material', nombre: 'Roble natural', stock: 7, imagen: 0 },
      { id: 'v2', tipo: 'material', nombre: 'Nogal oscuro', stock: 4, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1607809714110-e34f71c7b2ed', alt: 'Dos mesas ratonas de madera, una debajo de la otra', ancho: 800, alto: 1000 },
      { src: 'photo-1693578616322-c8abe6c7393d', alt: 'Las mesas separadas junto a un sillón', ancho: 800, alto: 1000 },
      { src: 'photo-1616046229478-9901c5536a45', alt: 'Detalle de la unión de la pata con la tapa', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Una entra debajo de la otra cuando no se usan, y salen las dos cuando hay visitas. Resuelve el living chico sin dejar de ser un mueble lindo.',
    especificaciones: [
      { clave: 'Mesa grande', valor: '55 × 55 × 45 cm' },
      { clave: 'Mesa chica', valor: '42 × 42 × 38 cm' },
      { clave: 'Material', valor: 'Madera maciza con laca al agua' },
      { clave: 'Armado', valor: 'Cuatro tornillos, llave incluida' },
    ],
    dimensiones: { alto: 45, ancho: 55, profundidad: 55 },
    peso: 12.3,
    plazoEnvio: { min: 7, max: 13 },
    rating: 4.6,
    cantidadOpiniones: 63,
    opiniones: [],
    badges: ['oferta'],
    unidadesVendidas: 158,
    crossSell: ['p13', 'p19', 'p01'],
  },
  {
    id: 'p23',
    slug: 'puff-de-yute-trenzado',
    nombre: 'Puff de yute trenzado',
    rubro: 'decoracion',
    categoria: 'muebles-chicos',
    precio: 38900,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Yute natural', muestra: '#C9A87C', stock: 13, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Yute teñido negro', muestra: '#3A3A3A', stock: 6, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1606425288528-4cebbfc69de7', alt: 'Puff de fibra trenzada junto a una butaca blanca', ancho: 800, alto: 1000 },
      { src: 'photo-1603913996638-c01100417b4a', alt: 'El puff con una planta al lado', ancho: 800, alto: 1000 },
      { src: 'photo-1566386429501-fe1523f35f40', alt: 'El puff usado como apoyapiés', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Sirve de asiento extra, de apoyapiés o de mesita si le apoyas una bandeja encima. Pesa poco: se mueve con una mano.',
    especificaciones: [
      { clave: 'Diámetro', valor: '45 cm' },
      { clave: 'Altura', valor: '38 cm' },
      { clave: 'Material', valor: 'Yute trenzado sobre estructura de MDF' },
      { clave: 'Soporta', valor: 'Hasta 100 kg' },
    ],
    dimensiones: { alto: 38, ancho: 45, profundidad: 45 },
    peso: 3.9,
    plazoEnvio: { min: 6, max: 11 },
    rating: 4.4,
    cantidadOpiniones: 97,
    opiniones: [],
    badges: [],
    crossSell: ['p13', 'p11', 'p22'],
  },
  {
    id: 'p24',
    slug: 'banqueta-alta-de-barra-roble',
    nombre: 'Banqueta alta de barra Roble',
    rubro: 'decoracion',
    categoria: 'muebles-chicos',
    precio: 52700,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'material', nombre: 'Roble natural', stock: 9, imagen: 0 },
      { id: 'v2', tipo: 'material', nombre: 'Roble ahumado', stock: 5, imagen: 1 },
      { id: 'v3', tipo: 'material', nombre: 'Roble laqueado blanco', stock: 3, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1586023492125-27b2c045efd7', alt: 'Banqueta alta de madera con respaldo bajo', ancho: 800, alto: 1000 },
      { src: 'photo-1607809714110-e34f71c7b2ed', alt: 'La banqueta junto a una mesa alta', ancho: 800, alto: 1000 },
      { src: 'photo-1646107543597-e95b90ba4081', alt: 'Detalle del asiento y el apoyapiés', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Asiento a 65 cm, la altura de barra estándar de una isla de cocina. Con apoyapiés de metal, que es lo que decide si se puede estar sentado media hora.',
    especificaciones: [
      { clave: 'Altura de asiento', valor: '65 cm' },
      { clave: 'Altura total', valor: '92 cm' },
      { clave: 'Material', valor: 'Roble macizo y acero' },
      { clave: 'Soporta', valor: 'Hasta 130 kg' },
      { clave: 'Armado', valor: 'Sin herramientas' },
    ],
    dimensiones: { alto: 92, ancho: 42, profundidad: 45 },
    peso: 6.1,
    plazoEnvio: { min: 7, max: 13 },
    rating: 4.5,
    cantidadOpiniones: 74,
    opiniones: [],
    badges: [],
    crossSell: ['p14', 'p22', 'p18'],
  },

  /* ============================================================
     RUBRO 2 · DECO INTELIGENTE
     ------------------------------------------------------------
     Doce productos que existen para demostrar una sola cosa: que
     el sistema no estaba atado a la decoración. Ninguna plantilla
     cambia, ningún componente se duplica. La ficha, la grilla, los
     filtros y el carrito son exactamente los mismos; lo único que
     cambia son los datos.

     Se eligió electrónica para el hogar y no un rubro cualquiera
     porque comparte comprador con la decoración —quien acaba de
     comprar una lámpara de pie es candidato a un velador con
     proyector— y eso permite que el cross-sell cruce los dos
     rubros en vez de quedar encerrado en cada uno.

     Las fotos vienen de data/fotos-deco-inteligente.ts, donde cada
     URL está anotada con la descripción original de su autor.
     ============================================================ */

  /* ---------- PROYECTORES Y VELADORES ---------- */
  {
    id: 'p25',
    slug: 'proyector-de-cielo-estrellado-aurora',
    nombre: 'Proyector de cielo estrellado Aurora',
    rubro: 'deco-inteligente',
    categoria: 'proyectores',
    precio: 64900,
    precioAnterior: 92000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 15, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Negro', muestra: '#2B2B2B', stock: 9, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1755414718613-3d45827fb9eb', alt: 'Proyector encendido dibujando luces de colores en el techo', ancho: 800, alto: 1000 },
      { src: 'photo-1757223167463-9daae3787a4d', alt: 'Detalle del cielo de puntos proyectado sobre una pared oscura', ancho: 800, alto: 1000 },
      { src: 'photo-1784126689159-72024d2c26e0', alt: 'Reflejos de luz proyectados en una habitación a oscuras', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Proyecta una nebulosa y un campo de estrellas sobre el techo. Se controla desde el teléfono y se apaga solo a la hora que se le indique.',
    especificaciones: [
      { clave: 'Cobertura', valor: 'Hasta 25 m² de techo' },
      { clave: 'Colores', valor: '16 millones, regulables' },
      { clave: 'Control', valor: 'Aplicación, control remoto y voz' },
      { clave: 'Temporizador', valor: '30, 60 y 90 minutos' },
      { clave: 'Alimentación', valor: 'USB-C, fuente incluida' },
      { clave: 'Consumo', valor: '9 W' },
    ],
    dimensiones: { alto: 16, ancho: 12, profundidad: 12 },
    peso: 0.7,
    plazoEnvio: { min: 7, max: 14 },
    rating: 4.6,
    cantidadOpiniones: 143,
    opiniones: [],
    badges: ['oferta', 'mas_vendido'],
    unidadesVendidas: 267,
    crossSell: ['p05', 'p26', 'p30'],
  },
  {
    id: 'p26',
    slug: 'velador-proyector-luna',
    nombre: 'Velador proyector Luna',
    rubro: 'deco-inteligente',
    categoria: 'proyectores',
    precio: 37500,
    moneda: 'ARS',
    /* CASO BORDE · última unidad. El stock total es exactamente 1:
       es el único punto del catálogo donde el aviso de escasez es
       literalmente cierto. Y esa es la regla: el badge se calcula
       del stock, nunca se carga a mano (ver esUltimasUnidades). */
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco luna', muestra: '#F2EFE9', stock: 1, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Gris cráter', muestra: '#9A968E', stock: 0, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1481728236344-b5c828da9edf', alt: 'Velador encendido en un cuarto a media luz', ancho: 800, alto: 1000 },
      { src: 'photo-1541545705343-80ecdec063ff', alt: 'El cuarto iluminado apenas por el velador', ancho: 800, alto: 1000 },
      { src: 'photo-1538587049046-4af04d161055', alt: 'Detalle de la esfera de luz encendida', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Una esfera de luz cálida con relieve de cráteres, que además proyecta un halo suave en la pared. Regulable en tres intensidades por toque.',
    especificaciones: [
      { clave: 'Diámetro', valor: '15 cm' },
      { clave: 'Intensidades', valor: '3, por toque' },
      { clave: 'Batería', valor: '1800 mAh, hasta 8 horas' },
      { clave: 'Carga', valor: 'USB-C, 2 horas' },
      { clave: 'Temperatura de luz', valor: '2700 K, cálida' },
    ],
    dimensiones: { alto: 18, ancho: 15, profundidad: 15 },
    peso: 0.5,
    plazoEnvio: { min: 6, max: 12 },
    rating: 4.8,
    cantidadOpiniones: 96,
    opiniones: [],
    badges: [],
    crossSell: ['p25', 'p05', 'p02'],
  },
  {
    id: 'p27',
    slug: 'proyector-de-galaxia-con-bocina',
    nombre: 'Proyector de galaxia con bocina',
    rubro: 'deco-inteligente',
    categoria: 'proyectores',
    precio: 81200,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Negro', muestra: '#2B2B2B', stock: 11, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 7, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1602554771321-8ec4ea08f4c5', alt: 'Proyector con dibujo de estrellas apoyado sobre una superficie clara', ancho: 800, alto: 1000 },
      { src: 'photo-1615743893538-c502749d04a0', alt: 'Luces de colores reflejadas sobre una pared', ancho: 800, alto: 1000 },
      { src: 'photo-1757223167463-9daae3787a4d', alt: 'Puntos de luz proyectados sobre fondo oscuro', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Suma bocina Bluetooth al proyector, y las luces siguen el ritmo de lo que se esté escuchando. Pensado para el cuarto de un adolescente más que para el living.',
    especificaciones: [
      { clave: 'Bocina', valor: 'Bluetooth 5.3, 5 W' },
      { clave: 'Modos de luz', valor: '12, con sincronía de audio' },
      { clave: 'Cobertura', valor: 'Hasta 30 m² de techo' },
      { clave: 'Control', valor: 'Aplicación y control remoto' },
      { clave: 'Alimentación', valor: 'USB-C, fuente incluida' },
    ],
    dimensiones: { alto: 19, ancho: 14, profundidad: 14 },
    peso: 0.9,
    plazoEnvio: { min: 8, max: 15 },
    rating: 4.3,
    cantidadOpiniones: 58,
    opiniones: [],
    badges: ['nuevo'],
    crossSell: ['p25', 'p26', 'p30'],
  },

  /* ---------- ROBOTS DE LIMPIEZA ---------- */
  {
    id: 'p28',
    slug: 'robot-aspirador-con-vaciado-automatico',
    nombre: 'Robot aspirador con vaciado automático',
    rubro: 'deco-inteligente',
    categoria: 'limpieza',
    /* Segundo precio de seis cifras del catálogo, y el más caro de
       todos. Sirve para ver el resumen de pedido con un solo
       artículo caro en vez de muchos baratos: las cuotas cambian de
       largo y el bloque de precio tiene que aguantarlo. */
    precio: 249900,
    precioAnterior: 329000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Negro', muestra: '#2B2B2B', stock: 6, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 4, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1653990480360-31a12ce9723e', alt: 'Robot aspirador negro sobre piso de madera', ancho: 800, alto: 1000 },
      { src: 'photo-1762500824321-de3c2f316156', alt: 'Robot aspirador blanco sobre una superficie metálica', ancho: 800, alto: 1000 },
      { src: 'photo-1647940990395-967898eb0d65', alt: 'El robot trabajando junto a un sillón', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Aspira, pasa el trapo y vuelve solo a la base, que le vacía el depósito. Con eso se pasa de vaciarlo todos los días a hacerlo una vez cada dos meses.',
    especificaciones: [
      { clave: 'Succión', valor: '6000 Pa' },
      { clave: 'Base', valor: 'Vaciado automático, bolsa de 2,5 L' },
      { clave: 'Autonomía', valor: 'Hasta 180 minutos' },
      { clave: 'Navegación', valor: 'Láser, con mapa de la casa' },
      { clave: 'Altura', valor: '9,8 cm, pasa bajo la mayoría de los muebles' },
      { clave: 'Control', valor: 'Aplicación, voz y botón' },
    ],
    dimensiones: { alto: 10, ancho: 35, profundidad: 35 },
    peso: 8.4,
    plazoEnvio: { min: 9, max: 16 },
    rating: 4.7,
    cantidadOpiniones: 208,
    opiniones: [],
    badges: ['oferta', 'mas_vendido'],
    unidadesVendidas: 189,
    crossSell: ['p29', 'p20', 'p36'],
  },
  {
    id: 'p29',
    slug: 'robot-limpiavidrios-magnetico',
    nombre: 'Robot limpiavidrios magnético',
    rubro: 'deco-inteligente',
    categoria: 'limpieza',
    precio: 118400,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Gris grafito', muestra: '#57534E', stock: 8 },
    ],
    /* CASO BORDE · una sola foto. Es el que verifica el repliegue de
       la galería: con una imagen, la fila de miniaturas no se
       muestra en lugar de mostrar una miniatura sola, que es peor
       que no mostrar nada porque parece un error de carga.
       Que exista un producto así no es un descuido: en dropshipping
       hay proveedores que mandan una foto y nada más. */
    imagenes: [
      { src: 'photo-1603618090561-412154b4bd1b', alt: 'Robot limpiavidrios circular adherido a un vidrio', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Se pega al vidrio por succión y recorre la ventana solo. Trae cable de seguridad para los pisos altos, que es lo primero que hay que atar.',
    especificaciones: [
      { clave: 'Succión', valor: '2800 Pa, con respaldo de batería' },
      { clave: 'Vidrios', valor: 'De 3 a 27 mm de espesor' },
      { clave: 'Seguridad', valor: 'Cable de acero de 4,5 m' },
      { clave: 'Autonomía de emergencia', valor: '25 minutos sin corriente' },
      { clave: 'Paños', valor: '4 de microfibra incluidos' },
    ],
    dimensiones: { alto: 9, ancho: 24, profundidad: 24 },
    peso: 1.4,
    plazoEnvio: { min: 9, max: 16 },
    rating: 4.1,
    cantidadOpiniones: 34,
    opiniones: [],
    badges: [],
    crossSell: ['p28', 'p32', 'p36'],
  },

  /* ---------- AROMATIZACIÓN ---------- */
  {
    id: 'p30',
    slug: 'difusor-ultrasonico-de-aroma',
    nombre: 'Difusor ultrasónico de aroma',
    rubro: 'deco-inteligente',
    categoria: 'aromatizacion',
    precio: 29800,
    precioAnterior: 39900,
    moneda: 'ARS',
    /* CASO BORDE · seis variantes de color. Es el que pone a prueba
       el selector: con seis muestras, la fila tiene que envolver sin
       empujar el botón de compra fuera de la primera pantalla, y
       cada muestra tiene que seguir teniendo 44 px de área táctil.
       Además hay una agotada entre medio, para ver el estado
       tachado conviviendo con los disponibles. */
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 20, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Arena', muestra: '#D9CBB8', stock: 14, imagen: 1 },
      { id: 'v3', tipo: 'color', nombre: 'Terracota', muestra: '#B5654A', stock: 9, imagen: 2 },
      { id: 'v4', tipo: 'color', nombre: 'Verde salvia', muestra: '#8A9A82', stock: 6, imagen: 0 },
      { id: 'v5', tipo: 'color', nombre: 'Gris piedra', muestra: '#9A968E', stock: 0, imagen: 1 },
      { id: 'v6', tipo: 'color', nombre: 'Negro mate', muestra: '#2B2B2B', stock: 11, imagen: 2 },
    ],
    imagenes: [
      { src: 'photo-1732229035217-e7e42f61af4b', alt: 'Difusor de aroma sobre una mesada junto a una planta', ancho: 800, alto: 1000 },
      { src: 'photo-1672925216623-f32a54d732e0', alt: 'El difusor apoyado sobre una superficie clara', ancho: 800, alto: 1000 },
      { src: 'photo-1634681896994-0027a701b1d7', alt: 'Detalle del vapor saliendo del difusor', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Nebuliza agua con aceite esencial sin calentarla, así que el aroma no se quema. Con luz cálida regulable, para que también sirva de velador.',
    especificaciones: [
      { clave: 'Capacidad', valor: '300 ml' },
      { clave: 'Autonomía', valor: 'Hasta 10 horas en modo intermitente' },
      { clave: 'Apagado automático', valor: 'Al quedarse sin agua' },
      { clave: 'Luz', valor: '7 colores, regulable' },
      { clave: 'Ruido', valor: 'Menos de 30 dB' },
      { clave: 'Cobertura', valor: 'Hasta 20 m²' },
    ],
    dimensiones: { alto: 17, ancho: 14, profundidad: 14 },
    peso: 0.6,
    plazoEnvio: { min: 7, max: 13 },
    rating: 4.5,
    cantidadOpiniones: 312,
    opiniones: [],
    badges: ['oferta', 'mas_vendido'],
    unidadesVendidas: 524,
    crossSell: ['p31', 'p26', 'p07'],
  },
  {
    id: 'p31',
    slug: 'aromatizador-automatico-programable',
    nombre: 'Aromatizador automático programable',
    rubro: 'deco-inteligente',
    categoria: 'aromatizacion',
    precio: 44600,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 12, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Negro', muestra: '#2B2B2B', stock: 8, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1732229033839-c76b4071c449', alt: 'Aromatizador cilíndrico apoyado sobre una mesa', ancho: 800, alto: 1000 },
      { src: 'photo-1630404387821-f4958041b9ac', alt: 'El aromatizador junto a un frasco de aceite esencial', ancho: 800, alto: 1000 },
      { src: 'photo-1632322831476-f8c68bef7dba', alt: 'Frascos de aroma sobre una superficie blanca', ancho: 800, alto: 1000 },
    ],
    /* CASO BORDE · producto sin ninguna opinión todavía. No lleva
       rating: mostrar cinco estrellas vacías se lee como "malo",
       cuando lo que pasa es que es nuevo. El bloque de opiniones
       cambia por una invitación a ser el primero en escribir. */
    descripcion:
      'Programa hasta seis disparos por día y elige los horarios. Sirve para que el ambiente esté listo antes de llegar, no media hora después.',
    especificaciones: [
      { clave: 'Programación', valor: 'Hasta 6 horarios por día' },
      { clave: 'Carga', valor: 'Cartucho de 250 ml' },
      { clave: 'Rendimiento', valor: 'Hasta 3000 disparos por carga' },
      { clave: 'Alimentación', valor: '2 pilas AA, incluidas' },
      { clave: 'Montaje', valor: 'De pared o de apoyo' },
    ],
    dimensiones: { alto: 22, ancho: 10, profundidad: 8 },
    peso: 0.4,
    plazoEnvio: { min: 8, max: 14 },
    cantidadOpiniones: 0,
    opiniones: [],
    badges: ['nuevo'],
    crossSell: ['p30', 'p25', 'p16'],
  },

  /* ---------- SEGURIDAD ---------- */
  {
    id: 'p32',
    slug: 'camara-de-seguridad-interior-2k',
    nombre: 'Cámara de seguridad interior 2K',
    rubro: 'deco-inteligente',
    categoria: 'seguridad',
    precio: 56300,
    precioAnterior: 74000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 17, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Negro', muestra: '#2B2B2B', stock: 10, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1589935447067-5531094415d1', alt: 'Cámara de interior blanca apoyada sobre su base', ancho: 800, alto: 1000 },
      { src: 'photo-1585206031650-9e9a7c87dcfe', alt: 'La cámara conectada con su cable de alimentación', ancho: 800, alto: 1000 },
      { src: 'photo-1520697830682-bbb6e85e2b0b', alt: 'Detalle del lente de la cámara', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Gira 360°, distingue personas de mascotas y guarda en tarjeta local, sin abono mensual obligatorio. Con obturador físico para tapar el lente cuando hay gente en casa.',
    especificaciones: [
      { clave: 'Resolución', valor: '2K, 2560 × 1440' },
      { clave: 'Giro', valor: '360° horizontal, 110° vertical' },
      { clave: 'Visión nocturna', valor: 'Infrarroja, hasta 10 m' },
      { clave: 'Almacenamiento', valor: 'MicroSD hasta 256 GB o nube' },
      { clave: 'Privacidad', valor: 'Obturador físico del lente' },
      { clave: 'Conexión', valor: 'Wi-Fi 2,4 y 5 GHz' },
    ],
    dimensiones: { alto: 12, ancho: 8, profundidad: 8 },
    peso: 0.3,
    plazoEnvio: { min: 8, max: 15 },
    rating: 4.4,
    cantidadOpiniones: 167,
    opiniones: [],
    badges: ['oferta'],
    unidadesVendidas: 231,
    crossSell: ['p33', 'p34', 'p36'],
  },
  {
    id: 'p33',
    slug: 'camara-exterior-con-panel-solar',
    nombre: 'Cámara exterior con panel solar',
    rubro: 'deco-inteligente',
    categoria: 'seguridad',
    precio: 97800,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 9, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Gris grafito', muestra: '#57534E', stock: 4, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1549109926-58f039549485', alt: 'Cámara de exterior montada en una pared', ancho: 800, alto: 1000 },
      { src: 'photo-1528312635006-8ea0bc49ec63', alt: 'La cámara instalada sobre un poste', ancho: 800, alto: 1000 },
      { src: 'photo-1510849911856-cdc9335e5597', alt: 'La cámara vista de día contra el cielo', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Sin cables: el panel solar la mantiene cargada todo el año. Resiste lluvia y sol directo, y avisa al teléfono solo cuando detecta una persona, no cuando pasa un auto.',
    especificaciones: [
      { clave: 'Resolución', valor: '2K, 2560 × 1440' },
      { clave: 'Alimentación', valor: 'Panel solar + batería de 9600 mAh' },
      { clave: 'Resistencia', valor: 'IP66, lluvia y polvo' },
      { clave: 'Detección', valor: 'Personas y vehículos, por inteligencia local' },
      { clave: 'Visión nocturna', valor: 'A color, con foco LED' },
      { clave: 'Temperatura de trabajo', valor: 'De −20 °C a 50 °C' },
    ],
    dimensiones: { alto: 14, ancho: 21, profundidad: 12 },
    peso: 1.2,
    plazoEnvio: { min: 9, max: 16 },
    rating: 4.6,
    cantidadOpiniones: 89,
    opiniones: [],
    badges: [],
    crossSell: ['p32', 'p34', 'p35'],
  },
  {
    id: 'p34',
    slug: 'kit-de-dos-camaras-y-sensor-de-puerta',
    nombre: 'Kit de dos cámaras y sensor de puerta',
    rubro: 'deco-inteligente',
    categoria: 'seguridad',
    precio: 142500,
    precioAnterior: 189000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'material', nombre: 'Kit de interior', stock: 5, imagen: 0 },
      { id: 'v2', tipo: 'material', nombre: 'Kit mixto, interior y exterior', stock: 3, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1563920443079-783e5c786b83', alt: 'Dos cámaras de seguridad montadas juntas', ancho: 800, alto: 1000 },
      { src: 'photo-1496368077930-c1e31b4e5b44', alt: 'Par de cámaras instaladas en una pared exterior', ancho: 800, alto: 1000 },
      { src: 'photo-1557597774-9d273605dfa9', alt: 'Varias cámaras de seguridad de distintos modelos', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Dos cámaras y un sensor magnético de apertura, todo en la misma aplicación. Es el punto donde deja de ser un aparato suelto y pasa a ser un sistema.',
    especificaciones: [
      { clave: 'Incluye', valor: '2 cámaras 2K + 1 sensor de puerta' },
      { clave: 'Almacenamiento', valor: 'Base con 32 GB, ampliable' },
      { clave: 'Alcance del sensor', valor: 'Hasta 30 m de la base' },
      { clave: 'Batería del sensor', valor: 'Hasta 2 años' },
      { clave: 'Aplicación', valor: 'Única, para todos los dispositivos' },
    ],
    dimensiones: { alto: 18, ancho: 32, profundidad: 22 },
    peso: 2.3,
    plazoEnvio: { min: 9, max: 17 },
    rating: 4.5,
    cantidadOpiniones: 62,
    opiniones: [],
    badges: ['oferta'],
    crossSell: ['p32', 'p33', 'p36'],
  },

  /* ---------- CONECTIVIDAD ---------- */
  {
    id: 'p35',
    /* CASO BORDE · nombre largo, esta vez en el segundo rubro. El de
       decoración ya probaba la grilla; este prueba lo que pasa
       cuando un nombre largo convive con un precio corto y un badge
       de estado, que es la combinación que más rompe la alineación
       de la fila. */
    slug: 'extensor-wifi-doble-banda-con-puerto-ethernet',
    nombre: 'Extensor de wi-fi de doble banda con puerto Ethernet y repetición automática de la red del hogar',
    rubro: 'deco-inteligente',
    categoria: 'conectividad',
    precio: 33900,
    precioAnterior: 45000,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 24, imagen: 0 },
    ],
    imagenes: [
      { src: 'photo-1606904825846-647eb07f5be2', alt: 'Extensor de wi-fi blanco apoyado sobre una mesa clara', ancho: 800, alto: 1000 },
      { src: 'photo-1554098415-cae1af5e4f1a', alt: 'El extensor encendido con sus luces de estado', ancho: 800, alto: 1000 },
      { src: 'photo-1745847768408-b7b83796cae6', alt: 'Detalle de las antenas y el puerto de red', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Se enchufa en el punto donde la señal empieza a caer y repite la red con el mismo nombre y la misma contraseña. Sin configuración: se aprieta un botón en el módem y otro acá.',
    especificaciones: [
      { clave: 'Velocidad', valor: 'Hasta 1200 Mbps combinados' },
      { clave: 'Bandas', valor: '2,4 y 5 GHz simultáneas' },
      { clave: 'Puerto', valor: '1 Ethernet gigabit' },
      { clave: 'Cobertura agregada', valor: 'Hasta 90 m²' },
      { clave: 'Configuración', valor: 'Botón WPS o aplicación' },
    ],
    dimensiones: { alto: 12, ancho: 7, profundidad: 5 },
    peso: 0.2,
    plazoEnvio: { min: 7, max: 13 },
    rating: 4.2,
    cantidadOpiniones: 128,
    opiniones: [],
    badges: ['oferta'],
    unidadesVendidas: 197,
    crossSell: ['p36', 'p32', 'p28'],
  },
  {
    id: 'p36',
    slug: 'sistema-de-wifi-en-malla-dos-nodos',
    nombre: 'Sistema de wi-fi en malla, dos nodos',
    rubro: 'deco-inteligente',
    categoria: 'conectividad',
    precio: 128700,
    moneda: 'ARS',
    variantes: [
      { id: 'v1', tipo: 'color', nombre: 'Blanco', muestra: '#F2EFE9', stock: 7, imagen: 0 },
      { id: 'v2', tipo: 'color', nombre: 'Negro', muestra: '#2B2B2B', stock: 2, imagen: 1 },
    ],
    imagenes: [
      { src: 'photo-1681383064412-171e5bee5f6e', alt: 'Dos nodos de wi-fi en malla sobre una mesa', ancho: 800, alto: 1000 },
      { src: 'photo-1750712263185-edde9f359e33', alt: 'Un nodo apoyado sobre una mesa de madera', ancho: 800, alto: 1000 },
      { src: 'photo-1750711158632-5273ec9b9b86', alt: 'El nodo junto a un conmutador de red', ancho: 800, alto: 1000 },
    ],
    descripcion:
      'Dos nodos que arman una sola red y se pasan el teléfono entre ellos sin que la llamada se corte. Es lo que corresponde cuando la casa tiene dos pisos o paredes gruesas.',
    especificaciones: [
      { clave: 'Velocidad', valor: 'Hasta 3000 Mbps combinados' },
      { clave: 'Cobertura', valor: 'Hasta 260 m² con los dos nodos' },
      { clave: 'Dispositivos', valor: 'Hasta 100 conectados' },
      { clave: 'Puertos por nodo', valor: '2 Ethernet gigabit' },
      { clave: 'Ampliable', valor: 'Hasta 6 nodos en la misma red' },
      { clave: 'Control parental', valor: 'Por dispositivo y por horario' },
    ],
    dimensiones: { alto: 16, ancho: 26, profundidad: 14 },
    peso: 1.1,
    plazoEnvio: { min: 8, max: 15 },
    rating: 4.7,
    cantidadOpiniones: 74,
    opiniones: [],
    badges: [],
    crossSell: ['p35', 'p28', 'p32'],
  },
];
