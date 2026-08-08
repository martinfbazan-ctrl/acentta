/**
 * acentta · catálogo
 * ---------------------------------------------------------------
 * Los productos ya no viven escritos acá: viven en
 * `src/contenido/productos/`, un archivo YAML por producto, editables
 * desde el panel en `/keystatic`. Este archivo los lee y los traduce
 * al contrato de `types/catalogo.ts`.
 *
 * Esa frontera es la que el brief pedía desde el arranque, y ésta es
 * la prueba de que servía: cambiar de «datos escritos a mano» a «datos
 * cargados por un panel» fue reescribir este archivo. Ninguna página,
 * ningún componente y ninguna función de `lib/catalogo.ts` cambió.
 *
 * POR QUÉ CON `import.meta.glob` Y NO CON `fs`
 * Las dos formas funcionan en el momento de compilar, pero glob deja
 * los archivos dentro del grafo de módulos: al guardar un producto en
 * el panel, el sitio en desarrollo se actualiza solo. Con `fs` habría
 * que reiniciar el servidor para ver cada cambio.
 *
 * LOS SIETE CASOS BORDE SIGUEN EN PIE
 * Se migraron tal cual, y son los mismos productos de siempre:
 *
 *   1. Nombre de más de 90 caracteres ...... extensor de wi-fi
 *   2. Agotado .............................. banqueta nórdica
 *      Una sola unidad ...................... velador proyector Luna
 *   3. Sin ninguna opinión .................. manta Sierra, aromatizador
 *   4. Descuento del 60 % ................... alfombra lavable Damero
 *   5. Precio de seis cifras ................ alfombra de lana, robot
 *   6. Una sola foto ........................ robot limpiavidrios
 *   7. Seis variantes ....................... difusor ultrasónico
 */

import { parse } from 'yaml';
import type { Producto, Variante, Imagen, Especificacion } from '@tipos/catalogo';

/** Lo que devuelve el panel. Deliberadamente laxo: la validación viene después. */
interface ProductoCrudo {
  nombre: string;
  id: string;
  rubro: string;
  categoria: string;
  precio: number;
  precioAnterior?: number | null;
  variantes?: Array<{
    tipo?: string;
    nombre?: string;
    muestra?: string | null;
    stock?: number;
    imagen?: number | null;
  }>;
  imagenes?: Array<{
    archivo?: string | null;
    idRemoto?: string | null;
    alt?: string;
    ancho?: number;
    alto?: number;
  }>;
  descripcion?: string;
  especificaciones?: Especificacion[];
  dimensiones?: { alto?: number; ancho?: number; profundidad?: number };
  peso?: number;
  plazoEnvio?: { min?: number; max?: number };
  rating?: number | null;
  cantidadOpiniones?: number;
  unidadesVendidas?: number | null;
  badges?: string[];
  crossSell?: string[];
}

/* El nombre del archivo es la dirección del producto en el sitio.
   Que la URL salga del nombre del archivo y no de un campo evita el
   error más caro de un catálogo: dos productos con la misma URL. */
const archivos = import.meta.glob<string>('../contenido/productos/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function slugDe(ruta: string): string {
  return ruta.split('/').pop()!.replace(/\.yaml$/, '');
}

/**
 * La foto puede venir de dos lados.
 * `archivo` es una subida propia, que se sirve desde el mismo dominio.
 * `idRemoto` es una de las provisorias de banco que quedaron del
 * prototipo. Se prefiere la propia: es la que hace rápido al sitio, y
 * así el catálogo se puede migrar de a un producto por vez en lugar de
 * todo de golpe.
 */
function fuenteDeImagen(i: { archivo?: string | null; idRemoto?: string | null }): string {
  return (i.archivo || i.idRemoto || '').trim();
}

function traducir(ruta: string, crudo: ProductoCrudo): Producto {
  const slug = slugDe(ruta);

  const variantes: Variante[] = (crudo.variantes ?? []).map((v, n) => ({
    id: `v${n + 1}`,
    tipo: (v.tipo ?? 'color') as Variante['tipo'],
    nombre: v.nombre ?? '',
    ...(v.muestra ? { muestra: v.muestra } : {}),
    stock: v.stock ?? 0,
    ...(v.imagen === null || v.imagen === undefined ? {} : { imagen: v.imagen }),
  }));

  const imagenes: Imagen[] = (crudo.imagenes ?? [])
    .map((i) => ({
      src: fuenteDeImagen(i),
      alt: i.alt ?? '',
      ancho: i.ancho ?? 800,
      alto: i.alto ?? 1000,
    }))
    /* Una fila de imagen sin ninguna fuente es una fila que alguien
       agregó y no completó. Se descarta acá y no rompe la página; si
       no queda ninguna, la validación del catálogo lo detiene. */
    .filter((i) => i.src !== '');

  return {
    id: crudo.id ?? slug,
    slug,
    nombre: crudo.nombre,
    rubro: crudo.rubro as Producto['rubro'],
    categoria: crudo.categoria as Producto['categoria'],
    precio: crudo.precio,
    ...(crudo.precioAnterior ? { precioAnterior: crudo.precioAnterior } : {}),
    moneda: 'ARS',
    variantes,
    imagenes,
    descripcion: crudo.descripcion ?? '',
    especificaciones: crudo.especificaciones ?? [],
    dimensiones: {
      alto: crudo.dimensiones?.alto ?? 0,
      ancho: crudo.dimensiones?.ancho ?? 0,
      profundidad: crudo.dimensiones?.profundidad ?? 0,
    },
    peso: crudo.peso ?? 0,
    plazoEnvio: { min: crudo.plazoEnvio?.min ?? 5, max: crudo.plazoEnvio?.max ?? 10 },
    ...(crudo.rating ? { rating: crudo.rating } : {}),
    cantidadOpiniones: crudo.cantidadOpiniones ?? 0,
    opiniones: [],
    badges: (crudo.badges ?? []) as Producto['badges'],
    ...(crudo.unidadesVendidas ? { unidadesVendidas: crudo.unidadesVendidas } : {}),
    crossSell: crudo.crossSell ?? [],
  };
}

/* El orden es el del identificador, no el del nombre del archivo.
   Importa: la home toma la primera foto de cada categoría para el
   bento, y el ranking desempata por orden cuando dos productos tienen
   las mismas ventas. Un orden alfabético cambiaría la portada del
   sitio cada vez que alguien renombra un producto. */
export const productos: Producto[] = Object.entries(archivos)
  .map(([ruta, texto]) => traducir(ruta, parse(texto) as ProductoCrudo))
  .sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }));
