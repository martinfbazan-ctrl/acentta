/**
 * acentta · capa de acceso al catálogo
 * ---------------------------------------------------------------
 * Ninguna página lee el array de productos directamente: todas pasan
 * por acá. Esa es la frontera que hace que cambiar el mock por un CMS
 * sea tocar un archivo y no todo el sitio.
 *
 * Además valida el catálogo al construir: si un producto está mal
 * cargado, el build se detiene con el nombre del producto y el problema.
 */

import { productos } from '../data/productos';
import {
  estaAgotado,
  esUltimasUnidades,
  tieneDescuento,
  ahorroEnPorcentaje,
  stockTotal,
  validarProducto,
  type Producto,
  type Badge,
  type Categoria,
  type Rubro,
} from '@tipos/catalogo';

/* ============================================================
   Validación en tiempo de build
   ============================================================ */

const errores = productos.flatMap(validarProducto);
if (errores.length > 0) {
  const detalle = errores.map((e) => `  · ${e.producto}: ${e.problema}`).join('\n');
  throw new Error(
    `El catálogo tiene ${errores.length} problema(s) y el sitio no se puede construir así:\n${detalle}`
  );
}

const slugsDuplicados = productos
  .map((p) => p.slug)
  .filter((s, i, todos) => todos.indexOf(s) !== i);
if (slugsDuplicados.length > 0) {
  throw new Error(`Hay slugs repetidos en el catálogo: ${slugsDuplicados.join(', ')}`);
}

/* ============================================================
   Consultas
   ============================================================ */

export function todos(): Producto[] {
  return productos;
}

export function porSlug(slug: string): Producto | undefined {
  return productos.find((p) => p.slug === slug);
}

export function porId(id: string): Producto | undefined {
  return productos.find((p) => p.id === id);
}

export function porRubro(rubro: Rubro): Producto[] {
  return productos.filter((p) => p.rubro === rubro);
}

export function porCategoria(categoria: Categoria): Producto[] {
  return productos.filter((p) => p.categoria === categoria);
}

/** Los que tienen descuento real, ordenados por porcentaje. */
export function enOferta(limite = 8): Producto[] {
  return productos
    .filter(tieneDescuento)
    .sort((a, b) => ahorroEnPorcentaje(b) - ahorroEnPorcentaje(a))
    .slice(0, limite);
}

/**
 * Más vendidos.
 * Se ordena por unidades vendidas reales, no por un campo "destacado"
 * cargado a mano. Si el dato no existe, el producto no entra: no se
 * inventa un ranking.
 */
export function masVendidos(limite = 4): Producto[] {
  return productos
    .filter((p) => p.unidadesVendidas !== undefined && !estaAgotado(p))
    .sort((a, b) => (b.unidadesVendidas ?? 0) - (a.unidadesVendidas ?? 0))
    .slice(0, limite);
}

export function novedades(limite = 4): Producto[] {
  return productos.filter((p) => p.badges.includes('nuevo')).slice(0, limite);
}

/**
 * Cross-sell resuelto, salteando los agotados.
 *
 * [ERROR CORREGIDO] Esto resolvía sólo por identificador —`b01`—
 * mientras el panel titulaba el campo «Dirección del producto», que
 * es el slug. Quien lo completara como decía la etiqueta cargaba un
 * dato válido que no resolvía nada: la sección «Completá el ambiente»
 * simplemente no aparecía, sin ningún error.
 *
 * Una etiqueta que pide una cosa y un código que espera otra es un
 * defecto del que nadie sospecha, porque los dos lados parecen bien
 * mirados por separado. Ahora se acepta cualquiera de los dos: el
 * identificador es cómodo para quien conoce el catálogo y la
 * dirección es la que se lee en la barra del navegador.
 */
export function complementos(p: Producto, limite = 3): Producto[] {
  return p.crossSell
    .map((referencia) => {
      const limpia = String(referencia ?? '').trim();
      if (!limpia) return undefined;
      /* Por si alguien pega la dirección completa del producto. */
      const slug = limpia.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?producto\//, '').replace(/\/$/, '');
      return porId(limpia) ?? porSlug(slug) ?? porSlug(limpia);
    })
    .filter((x): x is Producto => x !== undefined && !estaAgotado(x))
    /* Un producto no se recomienda a sí mismo. */
    .filter((x) => x.id !== p.id)
    .slice(0, limite);
}

/* ============================================================
   Badges calculados
   ============================================================
   El badge de estado no se lee del campo `badges` cuando depende del
   stock: se deriva. Así la urgencia nunca puede mentir, ni siquiera
   por un descuido al cargar un producto. */

export function badgeDeEstado(p: Producto): Badge | undefined {
  if (estaAgotado(p)) return 'agotado';
  if (esUltimasUnidades(p)) return 'ultimas_unidades';
  if (p.badges.includes('mas_vendido')) return 'mas_vendido';
  if (p.badges.includes('nuevo')) return 'nuevo';
  return undefined;
}

/* ============================================================
   Datos derivados para la home
   ============================================================ */

export interface ResumenCategoria {
  clave: Categoria;
  nombre: string;
  descripcion: string;
  cantidad: number;
  desde: number;
  imagen: { src: string; alt: string };
}

const NOMBRES_CATEGORIA: Record<string, { nombre: string; descripcion: string }> = {
  'vasos-y-botellas': { nombre: 'Vasos y botellas', descripcion: 'Térmicos, con manija y sorbete' },
  termos: { nombre: 'Termos', descripcion: 'Para el mate y para el viaje' },
  mate: { nombre: 'Mate', descripcion: 'Mates, bombillas y yerberas' },
  cafe: { nombre: 'Café', descripcion: 'Vasos de viaje y cafeteras' },
  iluminacion: { nombre: 'Iluminación', descripcion: 'De pie, de mesa y colgantes' },
  textil: { nombre: 'Textil', descripcion: 'Mesa, sillón y cama' },
  alfombras: { nombre: 'Alfombras', descripcion: 'Lana, kilim y yute' },
  'muebles-chicos': { nombre: 'Muebles chicos', descripcion: 'Mesitas, banquetas y puffs' },
  proyectores: { nombre: 'Proyectores', descripcion: 'Veladores y cielos de estrellas' },
  limpieza: { nombre: 'Limpieza', descripcion: 'Robots que trabajan solos' },
  aromatizacion: { nombre: 'Aromatización', descripcion: 'Difusores y aromatizadores' },
  seguridad: { nombre: 'Seguridad', descripcion: 'Cámaras y sensores' },
  conectividad: { nombre: 'Conectividad', descripcion: 'Extensores y wi-fi en malla' },
};

/* Las claves de cada rubro viven acá y no repartidas por las
   páginas. Cuando entre un tercer rubro se agrega una constante y
   una entrada en el mapa de nombres; ninguna plantilla cambia. */
export const CATEGORIAS_DECORACION: Categoria[] = [
  'iluminacion',
  'textil',
  'alfombras',
  'muebles-chicos',
];

export const CATEGORIAS_DECO_INTELIGENTE: Categoria[] = [
  'proyectores',
  'limpieza',
  'aromatizacion',
  'seguridad',
  'conectividad',
];

export const CATEGORIAS_BAZAR: Categoria[] = [
  'vasos-y-botellas',
  'termos',
  'mate',
  'cafe',
];

export const CATEGORIAS_TODAS: Categoria[] = [
  ...CATEGORIAS_BAZAR,
  ...CATEGORIAS_DECORACION,
  ...CATEGORIAS_DECO_INTELIGENTE,
];

/**
 * A qué rubro pertenece una categoría. Lo usan las migas de pan.
 *
 * [ERROR CORREGIDO] Esto era un ternario: «si está en decoración es
 * decoración, si no es deco inteligente». Con dos rubros funcionaba;
 * al entrar el tercero, **todo lo de bazar habría pasado a figurar
 * como deco inteligente**, y no con un error sino con una miga de pan
 * equivocada en cada ficha de producto.
 *
 * Es la clase de defecto que no rompe nada y ensucia todo. Ahora es
 * un mapa: agregar un rubro obliga a declarar a qué pertenece, y si
 * una categoría queda sin dueño lo dice.
 */
const RUBRO_DE: Record<string, Rubro> = {
  ...Object.fromEntries(CATEGORIAS_BAZAR.map((c) => [c, 'bazar' as Rubro])),
  ...Object.fromEntries(CATEGORIAS_DECORACION.map((c) => [c, 'decoracion' as Rubro])),
  ...Object.fromEntries(CATEGORIAS_DECO_INTELIGENTE.map((c) => [c, 'deco-inteligente' as Rubro])),
};

export function rubroDeCategoria(c: Categoria): Rubro {
  const r = RUBRO_DE[c];
  if (!r) throw new Error(`La categoría «${c}» no está asignada a ningún rubro.`);
  return r;
}

export const NOMBRE_RUBRO: Record<Rubro, string> = {
  bazar: 'Bazar',
  decoracion: 'Decoración',
  'deco-inteligente': 'Deco inteligente',
};

function resumir(claves: Categoria[]): ResumenCategoria[] {
  /* Una categoría sin productos no se muestra.
     Antes esto tomaba `items[0]!` directamente y una categoría vacía
     no dejaba una tarjeta vacía: tiraba la página entera. Mientras
     todas las categorías tenían productos el defecto no existía; al
     abrir bazar con una sola categoría cargada, sí. Un catálogo en
     construcción es el estado normal de un catálogo, no un caso raro. */
  return claves.filter((c) => porCategoria(c).length > 0).map((clave) => {
    const items = porCategoria(clave);
    const primera = items[0]!;
    return {
      clave,
      nombre: NOMBRES_CATEGORIA[clave]!.nombre,
      descripcion: NOMBRES_CATEGORIA[clave]!.descripcion,
      cantidad: items.length,
      desde: Math.min(...items.map((p) => p.precio)),
      imagen: { src: primera.imagenes[0]!.src, alt: primera.imagenes[0]!.alt },
    };
  });
}

export function categoriasDeBazar(): ResumenCategoria[] {
  return resumir(CATEGORIAS_BAZAR);
}

export function categoriasDeDecoracion(): ResumenCategoria[] {
  return resumir(CATEGORIAS_DECORACION);
}

export function categoriasDeDecoInteligente(): ResumenCategoria[] {
  return resumir(CATEGORIAS_DECO_INTELIGENTE);
}

export { estaAgotado, esUltimasUnidades, tieneDescuento, ahorroEnPorcentaje, stockTotal };

/* ============================================================
   Datos derivados para el listado
   ============================================================ */

export interface OpcionColor {
  nombre: string;
  muestra: string;
  /** Cuántos productos del conjunto lo ofrecen. */
  cantidad: number;
}

/** Colores realmente disponibles en un conjunto de productos. */
export function coloresDe(items: Producto[]): OpcionColor[] {
  const mapa = new Map<string, OpcionColor>();
  for (const p of items) {
    const vistos = new Set<string>();
    for (const v of p.variantes) {
      if (v.tipo !== 'color' || !v.muestra || vistos.has(v.nombre)) continue;
      vistos.add(v.nombre);
      const previo = mapa.get(v.nombre);
      if (previo) previo.cantidad++;
      else mapa.set(v.nombre, { nombre: v.nombre, muestra: v.muestra, cantidad: 1 });
    }
  }
  return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad);
}

/** Rango de precios de un conjunto, para armar el filtro. */
export function rangoDePrecios(items: Producto[]): { min: number; max: number } {
  const precios = items.map((p) => p.precio);
  return { min: Math.min(...precios), max: Math.max(...precios) };
}

/** Cuántos productos hay por categoría dentro de un conjunto. */
export function conteoPorCategoria(items: Producto[]): Map<Categoria, number> {
  const mapa = new Map<Categoria, number>();
  for (const p of items) mapa.set(p.categoria, (mapa.get(p.categoria) ?? 0) + 1);
  return mapa;
}

export const NOMBRE_CATEGORIA: Record<string, string> = {
  iluminacion: 'Iluminación',
  textil: 'Textil',
  alfombras: 'Alfombras',
  'muebles-chicos': 'Muebles chicos',
  proyectores: 'Proyectores y veladores',
  limpieza: 'Robots de limpieza',
  aromatizacion: 'Aromatización',
  seguridad: 'Seguridad',
  conectividad: 'Conectividad',
};

export const DESCRIPCION_CATEGORIA: Record<string, string> = {
  iluminacion:
    'Lámparas de pie, de mesa y colgantes. La luz define el ambiente antes que cualquier mueble.',
  textil:
    'Almohadones, mantas y caminos de mesa. Lo que se toca todos los días y cambia una habitación sin obra.',
  alfombras:
    'Lana, kilim y yute. Delimitan un ambiente mejor que una pared, y se pueden mover.',
  'muebles-chicos':
    'Mesitas de living, banquetas y puffs. Piezas que entran donde no entra un mueble grande.',
  proyectores:
    'Veladores y proyectores de luz. Cambian un ambiente entero apagando el resto de las luces.',
  limpieza:
    'Robots que aspiran, pasan el trapo y limpian vidrios. Devuelven una hora por semana.',
  aromatizacion:
    'Difusores y aromatizadores programables. El ambiente listo antes de llegar, no media hora después.',
  seguridad:
    'Cámaras y sensores para adentro y para afuera. Con almacenamiento local, sin abono obligatorio.',
  conectividad:
    'Extensores y wi-fi en malla. Para que la señal llegue al fondo de la casa igual que al living.',
};

/**
 * Atributos que el filtro del navegador lee de cada tarjeta.
 * Se generan en el servidor: el HTML llega con todos los productos,
 * así que el buscador los indexa y el filtro no necesita ir a la red.
 */
export function atributosDeFiltro(p: Producto): Record<string, string> {
  const colores = p.variantes
    .filter((v) => v.tipo === 'color' && v.stock > 0)
    .map((v) => v.nombre)
    .join('|');
  return {
    'data-precio': String(p.precio),
    'data-categoria': p.categoria,
    'data-colores': colores,
    'data-disponible': String(!estaAgotado(p)),
    'data-oferta': String(tieneDescuento(p)),
    'data-descuento': String(ahorroEnPorcentaje(p)),
    'data-rating': String(p.rating ?? 0),
    'data-vendidas': String(p.unidadesVendidas ?? 0),
    'data-nuevo': String(p.badges.includes('nuevo')),
    'data-nombre': p.nombre.toLowerCase(),
  };
}

/**
 * Datos mínimos que el carrito necesita de un producto.
 * Viajan al navegador como JSON en el botón de agregar: es la forma
 * más chica de que el carrito funcione sin pedirle nada a la red.
 */
export function datosParaCarrito(p: Producto, variante?: string) {
  const elegida = variante
    ? p.variantes.find((v) => v.nombre === variante)
    : p.variantes.find((v) => v.stock > 0) ?? p.variantes[0];
  return {
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    precio: p.precio,
    imagen: p.imagenes[0]!.src,
    variante: elegida?.nombre ?? '',
    stockMax: elegida?.stock ?? 0,
    peso: p.peso,
  };
}
