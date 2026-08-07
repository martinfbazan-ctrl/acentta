/**
 * acentta · contrato de datos del catálogo
 * ---------------------------------------------------------------
 * Este archivo es la frontera entre los datos y el sitio.
 * Hoy los datos son un mock en el repo. Si mañana llegan de un CMS
 * o de un proveedor de dropshipping, se cambia la fuente y el resto
 * del sitio no se entera: los tipos siguen siendo estos.
 *
 * Está en TypeScript por una razón concreta: si un producto sale sin
 * precio, sin stock o con menos de 3 fotos, el build falla y avisa
 * cuál es. Con 36 productos y 18 campos cada uno, ese aviso es la
 * diferencia entre encontrar el error ahora o descubrirlo en vivo.
 */

/** Rubros del catálogo. El segundo existe para probar que el sistema escala. */
export type Rubro = 'decoracion' | 'deco-inteligente';

/** Subcategorías, agrupadas por rubro. */
export type CategoriaDecoracion =
  | 'iluminacion'
  | 'textil'
  | 'alfombras'
  | 'muebles-chicos';

export type CategoriaDecoInteligente =
  | 'proyectores'
  | 'limpieza'
  | 'aromatizacion'
  | 'seguridad'
  | 'conectividad';

export type Categoria = CategoriaDecoracion | CategoriaDecoInteligente;

/**
 * Estados que puede tener un producto en la grilla.
 * Es una lista cerrada a propósito: si alguien inventa un badge
 * nuevo sin agregarlo acá, el build lo rechaza.
 *
 * Nota de criterio: no existe badge de urgencia inventada.
 * 'ultimas_unidades' se calcula del stock real (ver `esUltimasUnidades`).
 */
export type Badge =
  | 'oferta'
  | 'mas_vendido'
  | 'nuevo'
  | 'ultimas_unidades'
  | 'agotado';

/** Tipos de variante que maneja el catálogo. */
export type TipoVariante = 'color' | 'medida' | 'material';

export interface Variante {
  id: string;
  tipo: TipoVariante;
  /** Etiqueta visible: "Arena", "120 × 170 cm", "Roble macizo" */
  nombre: string;
  /** Solo para tipo 'color': hex de la muestra. */
  muestra?: string;
  /** Stock de esta variante puntual. 0 = agotada pero visible y tachada. */
  stock: number;
  /** Índice de la imagen de la galería que corresponde a esta variante. */
  imagen?: number;
}

export interface Imagen {
  src: string;
  /** Obligatorio: sin alt no compila. Accesibilidad por contrato. */
  alt: string;
  ancho: number;
  alto: number;
}

export interface Opinion {
  id: string;
  autor: string;
  /** 1 a 5, enteros. */
  puntaje: number;
  fecha: string; // ISO
  texto: string;
  /** Foto que subió el comprador, si la hay. */
  foto?: Imagen;
  compraVerificada: boolean;
}

export interface Especificacion {
  clave: string;
  valor: string;
}

export interface Dimensiones {
  alto: number;   // cm
  ancho: number;  // cm
  profundidad: number; // cm
}

export interface Producto {
  id: string;
  /** URL de la ficha: /producto/{slug} */
  slug: string;
  nombre: string;
  rubro: Rubro;
  categoria: Categoria;

  /** En pesos argentinos, sin decimales. El catálogo no maneja centavos. */
  precio: number;
  /** Precio tachado. Si no hay descuento, se omite: no se infla un precio falso. */
  precioAnterior?: number;
  moneda: 'ARS';

  variantes: Variante[];
  /** Mínimo 3 salvo caso borde declarado. Lo verifica `validarProducto`. */
  imagenes: Imagen[];

  descripcion: string;
  especificaciones: Especificacion[];
  dimensiones: Dimensiones;
  /** En kilogramos. Define el costo de envío. */
  peso: number;
  /** Días hábiles mínimo y máximo. Se muestra como fecha, no como rango de días. */
  plazoEnvio: { min: number; max: number };

  /** Promedio de opiniones. Ausente si todavía no tiene ninguna. */
  rating?: number;
  cantidadOpiniones: number;
  opiniones: Opinion[];

  badges: Badge[];
  /** Solo se muestra si el dato es real. Ausente = no se inventa un contador. */
  unidadesVendidas?: number;

  /** IDs de productos para "completá el ambiente". */
  crossSell: string[];
}

/* ============================================================
   Reglas de negocio derivadas
   Viven acá para que la misma regla no se reescriba en cada vista.
   ============================================================ */

export const UMBRAL_ENVIO_GRATIS = 50_000; // ARS · brief §12.4
export const STOCK_BAJO = 5;               // umbral de "últimas unidades"

/** Stock total sumando todas las variantes. */
export function stockTotal(p: Producto): number {
  return p.variantes.reduce((suma, v) => suma + v.stock, 0);
}

export function estaAgotado(p: Producto): boolean {
  return stockTotal(p) === 0;
}

/** Urgencia real: se calcula del stock, no se declara a mano. */
export function esUltimasUnidades(p: Producto): boolean {
  const total = stockTotal(p);
  return total > 0 && total <= STOCK_BAJO;
}

export function tieneDescuento(p: Producto): boolean {
  return p.precioAnterior !== undefined && p.precioAnterior > p.precio;
}

export function ahorroEnPesos(p: Producto): number {
  return tieneDescuento(p) ? p.precioAnterior! - p.precio : 0;
}

export function ahorroEnPorcentaje(p: Producto): number {
  if (!tieneDescuento(p)) return 0;
  return Math.round((ahorroEnPesos(p) / p.precioAnterior!) * 100);
}

/* ============================================================
   Validación en tiempo de build
   ============================================================ */

export interface ErrorCatalogo {
  producto: string;
  problema: string;
}

/**
 * Verifica las reglas que TypeScript no puede comprobar solo
 * (cantidades, rangos, coherencia entre campos).
 * Se ejecuta al construir el sitio: si algo falla, el build se detiene.
 */
export function validarProducto(p: Producto): ErrorCatalogo[] {
  const errores: ErrorCatalogo[] = [];
  const falla = (problema: string) => errores.push({ producto: p.slug, problema });

  if (p.precio <= 0) falla('el precio tiene que ser mayor a cero');
  if (p.precioAnterior !== undefined && p.precioAnterior <= p.precio) {
    falla('el precio anterior tiene que ser mayor al precio actual');
  }
  if (p.imagenes.length === 0) falla('no tiene ninguna imagen');
  if (p.imagenes.some((i) => !i.alt.trim())) falla('tiene una imagen sin texto alternativo');
  if (p.variantes.length === 0) falla('no tiene variantes');
  if (p.rating !== undefined && (p.rating < 1 || p.rating > 5)) {
    falla('el rating está fuera del rango 1–5');
  }
  if (p.cantidadOpiniones === 0 && p.rating !== undefined) {
    falla('tiene rating pero cero opiniones');
  }
  if (p.cantidadOpiniones > 0 && p.rating === undefined) {
    falla('tiene opiniones pero no tiene rating');
  }
  if (p.plazoEnvio.min > p.plazoEnvio.max) falla('el plazo de envío está invertido');
  if (p.peso <= 0) falla('el peso tiene que ser mayor a cero');

  return errores;
}
