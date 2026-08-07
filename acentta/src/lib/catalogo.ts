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

/** Cross-sell resuelto: de IDs a productos, salteando los agotados. */
export function complementos(p: Producto, limite = 3): Producto[] {
  return p.crossSell
    .map(porId)
    .filter((x): x is Producto => x !== undefined && !estaAgotado(x))
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
  iluminacion: { nombre: 'Iluminación', descripcion: 'De pie, de mesa y colgantes' },
  textil: { nombre: 'Textil', descripcion: 'Mesa, sillón y cama' },
  alfombras: { nombre: 'Alfombras', descripcion: 'Lana, kilim y yute' },
  'muebles-chicos': { nombre: 'Muebles chicos', descripcion: 'Mesitas, banquetas y puffs' },
};

export function categoriasDeDecoracion(): ResumenCategoria[] {
  const claves: Categoria[] = ['iluminacion', 'textil', 'alfombras', 'muebles-chicos'];
  return claves.map((clave) => {
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
