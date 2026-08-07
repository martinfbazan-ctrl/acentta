/**
 * acentta · catálogo
 * ---------------------------------------------------------------
 * Datos mock, tipados contra el contrato de `types/catalogo.ts`.
 * Si mañana llegan de un CMS o de un proveedor de dropshipping,
 * se reemplaza este archivo y nada más.
 *
 * Etapa 2: 14 productos de decoración, suficientes para que la home
 * y la tarjeta se puedan mostrar funcionando. El catálogo completo
 * (36 productos, dos rubros) llega en la etapa 6.
 *
 * Precios calibrados en pesos argentinos para que el ticket promedio
 * quede alrededor de $ 40.000 y el umbral de envío gratis de $ 50.000
 * caiga un 25 % por encima — que es donde más empuja.
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
    /* CASO BORDE · nombre de 92 caracteres, para verificar que la grilla
       no se rompa ni empuje el precio fuera de línea. */
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
      'Trenzado grueso de algodón sobre relleno firme. Sirve de apoyapiés, de asiento extra y de mesita si le apoyás una bandeja arriba.',
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
];
