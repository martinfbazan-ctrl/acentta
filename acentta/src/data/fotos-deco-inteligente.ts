/**
 * acentta · banco de fotos del rubro Deco inteligente
 * ---------------------------------------------------------------
 * Por qué existe este archivo aparte.
 *
 * Las fotos de decoración se eligieron a ojo, una por una, y viven
 * dentro de cada producto. Para el segundo rubro eso no alcanzaba:
 * una lámpara se reconoce en cualquier foto de living, pero un
 * extensor de wi-fi o un difusor no. Si el texto alternativo dice
 * "difusor de aroma" y la foto muestra una vela, el sitio miente en
 * el único lugar donde no puede permitírselo: la capa que lee quien
 * no ve las imágenes.
 *
 * Así que estas URLs no se inventaron. Cada `id` se tomó de la
 * ficha real de Unsplash y el `alt` original del autor está
 * anotado al lado, en inglés, para poder auditarlo después. El alt
 * que ve el usuario se escribe en español dentro del producto, pero
 * describe lo que esta foto muestra de verdad.
 *
 * Licencia: Unsplash License — uso comercial permitido, sin
 * atribución obligatoria. Se excluyó deliberadamente todo lo que
 * viniera de plus.unsplash.com (Unsplash+), que es de pago.
 *
 * Cuando lleguen las fotos propias del proveedor, se borra este
 * archivo entero y se reemplazan los `src` de los productos.
 */

export interface FotoBanco {
  id: string;
  /** Descripción original del autor, tal como figura en Unsplash. */
  alt: string;
}

/* ============================================================
   ROBOTS DE LIMPIEZA
   ============================================================ */
export const ROBOTS: FotoBanco[] = [
  { id: 'photo-1558317374-067fb5f30001', alt: 'white and black device' },
  { id: 'photo-1653990480360-31a12ce9723e', alt: 'a black robot vacuum on a wooden floor' },
  { id: 'photo-1647940990395-967898eb0d65', alt: 'a robotic vacuum is on the floor next to a couch' },
  { id: 'photo-1603618090561-412154b4bd1b', alt: 'black and white round device' },
  { id: 'photo-1558317374-24793bc9f2fb', alt: 'white robot vacuum cleaner on area rug' },
  { id: 'photo-1603618090554-f7a5079ffb54', alt: 'grayscale photo of round frame on wooden floor' },
  { id: 'photo-1757478558372-43c94b3268bb', alt: 'a black robot vacuum cleaner on a light gray floor' },
  { id: 'photo-1762500824321-de3c2f316156', alt: 'a white robotic vacuum cleaner on a metallic surface' },
  { id: 'photo-1762859731349-c9ff2808b672', alt: 'robot vacuum cleans floor while family relaxes' },
  { id: 'photo-1762501748150-7fd88647fc2c', alt: 'robot vacuum cleaning spilled water and debris on floor' },
  { id: 'photo-1762500824496-9094f37873c4', alt: 'girl and dog watch robot vacuum cleaner' },
  { id: 'photo-1762500825366-ba34b0c5352e', alt: 'robot vacuum cleans floor while family relaxes' },
];

/* ============================================================
   PROYECTORES Y VELADORES
   ============================================================ */
export const PROYECTORES: FotoBanco[] = [
  { id: 'photo-1755414718613-3d45827fb9eb', alt: 'a yellow star lantern with colorful lights projected on ceiling' },
  { id: 'photo-1757223167463-9daae3787a4d', alt: 'abstract pattern of white dots on black background' },
  { id: 'photo-1481728236344-b5c828da9edf', alt: "baby's black wooden crib with LED crib mobile" },
  { id: 'photo-1541545705343-80ecdec063ff', alt: "baby's white wooden crib lowlight photography" },
  { id: 'photo-1784126689159-72024d2c26e0', alt: 'a disco ball reflecting light patterns in a dark room' },
  { id: 'photo-1538587049046-4af04d161055', alt: 'person about to eat blue LED light ball' },
  { id: 'photo-1602554771321-8ec4ea08f4c5', alt: 'blue and white star print box' },
  { id: 'photo-1615743893538-c502749d04a0', alt: 'silver baubles on red wall' },
];

/* ============================================================
   AROMATIZACIÓN
   ============================================================ */
export const AROMATIZACION: FotoBanco[] = [
  { id: 'photo-1732229035217-e7e42f61af4b', alt: 'a humidifier sitting on top of a counter next to a potted plant' },
  { id: 'photo-1672925216623-f32a54d732e0', alt: 'an electronic device with two birds on top of it' },
  { id: 'photo-1732229033839-c76b4071c449', alt: 'a bluetooth speaker sitting on top of a table' },
  { id: 'photo-1634681896994-0027a701b1d7', alt: 'a white cup with steam rising out of it' },
  { id: 'photo-1632322831476-f8c68bef7dba', alt: 'two bottles with reeds in them on a white surface' },
  { id: 'photo-1636737249734-f180af754ab8', alt: 'a vase with a flower and two bottles of essential oils on a table' },
  { id: 'photo-1605671507162-43e526ef6f97', alt: 'blue and white ceramic container on brown wooden table' },
  { id: 'photo-1630404387821-f4958041b9ac', alt: 'black glass bottle on brown wooden table' },
  { id: 'photo-1625479968533-de325eb299a4', alt: 'white flower on brown wooden table' },
  { id: 'photo-1635749886064-8debe661b70e', alt: 'a vase of flowers on a table' },
];

/* ============================================================
   SEGURIDAD
   ============================================================ */
export const SEGURIDAD: FotoBanco[] = [
  { id: 'photo-1549109926-58f039549485', alt: 'white surveillance camera hanging on wall' },
  { id: 'photo-1589935447067-5531094415d1', alt: 'white and black camera on tripod' },
  { id: 'photo-1585206031650-9e9a7c87dcfe', alt: 'white and black corded device' },
  { id: 'photo-1528312635006-8ea0bc49ec63', alt: 'white security camera on post' },
  { id: 'photo-1510849911856-cdc9335e5597', alt: 'white security camera at daytime' },
  { id: 'photo-1563920443079-783e5c786b83', alt: 'two grey CCTV cameras' },
  { id: 'photo-1496368077930-c1e31b4e5b44', alt: 'two bullet surveillance cameras attached on wall' },
  { id: 'photo-1557597774-9d273605dfa9', alt: 'assorted-color security cameras' },
  { id: 'photo-1618482914248-29272d021005', alt: 'black and gray camera stand' },
  { id: 'photo-1520697830682-bbb6e85e2b0b', alt: 'selective focus photography of lens' },
];

/* ============================================================
   CONECTIVIDAD
   ============================================================ */
export const CONECTIVIDAD: FotoBanco[] = [
  { id: 'photo-1606904825846-647eb07f5be2', alt: 'white router on white table' },
  { id: 'photo-1516044734145-07ca8eef8731', alt: 'white and black modem router with four lights' },
  { id: 'photo-1681383064412-171e5bee5f6e', alt: 'a couple of routers sitting on top of a table' },
  { id: 'photo-1554098415-cae1af5e4f1a', alt: 'white modem outer is turned on' },
  { id: 'photo-1606420187127-dae7c868fa7a', alt: 'white router on black table' },
  { id: 'photo-1745847768408-b7b83796cae6', alt: 'a close-up of a wireless router' },
  { id: 'photo-1750711158632-5273ec9b9b86', alt: 'a wi-fi router and a network switch sit side-by-side' },
  { id: 'photo-1750712263185-edde9f359e33', alt: 'a wireless router sits on a wooden table' },
  { id: 'photo-1554098415-4052459dc340', alt: 'black corded electronic device' },
  { id: 'photo-1733810763720-4c83af0668ea', alt: 'a group of sticks sticking out of a white square' },
  { id: 'photo-1546124404-9e7e3cac2ec1', alt: 'white and gray cable' },
  { id: 'photo-1722488359737-7a9b8a8436c7', alt: 'a group of electronic devices sitting on top of a table' },
];
