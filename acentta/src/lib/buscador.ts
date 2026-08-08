/**
 * acentta · buscador
 * ---------------------------------------------------------------
 * Por qué el índice viaja al navegador y no hay servidor de búsqueda.
 *
 * El sitio es estático: no hay backend al que preguntarle. La opción
 * sería un servicio externo, pero con 36 productos eso es traer una
 * dependencia, una clave y una latencia de red para resolver algo
 * que entra en tres kilobytes. El índice completo pesa menos que el
 * ícono del carrito, así que se manda entero y se busca en memoria.
 * Resultado: las sugerencias aparecen mientras se escribe, sin una
 * sola petición y sin estado de carga que diseñar.
 *
 * Cuando el catálogo pase de unos pocos cientos de productos esto
 * deja de cerrar y hay que mover la búsqueda a un servicio. El límite
 * está en el peso del índice, no en la velocidad: buscar sobre un
 * arreglo de mil elementos sigue siendo instantáneo.
 *
 * SINÓNIMOS
 * ---------------------------------------------------------------
 * La gente no busca por el nombre del catálogo. Busca "aspiradora"
 * cuando el producto se llama "robot aspirador", "velador" cuando
 * dice "lámpara de mesa", y "wifi" cuando dice "conectividad". Sin
 * una tabla de sinónimos, el buscador contesta "no encontramos nada"
 * a alguien que quería comprar — que es la peor respuesta posible.
 */

import type { Producto } from '@tipos/catalogo';

/** Quita tildes y pasa a minúsculas: "Lámpara" y "lampara" son lo mismo. */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s×x-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Términos extra por categoría. Van al índice, no a la vista:
 * ensanchan lo que encuentra la búsqueda sin ensuciar el catálogo.
 */
const SINONIMOS: Record<string, string> = {
  iluminacion: 'luz luces lampara lamparas velador veladores aplique colgante pie mesa foco',
  textil: 'tela telas almohadon almohadones cojin cojines manta mantas sabanas cama sillon mantel individuales lino',
  alfombras: 'alfombra tapete carpeta piso kilim yute lana pasillo',
  'muebles-chicos': 'mueble muebles mesa mesita ratona auxiliar banqueta taburete puff silla',
  proyectores: 'proyector velador luz estrellas galaxia cielo noche nocturna infantil',
  limpieza: 'robot aspiradora aspirador limpiar limpieza barrer trapear vidrios ventanas',
  aromatizacion: 'aroma aromas perfume difusor humidificador esencia esencias fragancia olor',
  seguridad: 'camara camaras vigilancia alarma sensor seguridad monitoreo cctv',
  conectividad: 'wifi wi-fi internet router repetidor extensor señal red malla mesh',
};

/** Términos por rubro, para que "inteligente" o "smart" encuentren algo. */
const SINONIMOS_RUBRO: Record<string, string> = {
  decoracion: 'decoracion deco hogar casa ambiente living dormitorio comedor',
  'deco-inteligente': 'deco inteligente smart tecnologia electronica domotica automatico enchufe',
};

/** Lo mínimo que el navegador necesita para mostrar un resultado. */
export interface EntradaIndice {
  slug: string;
  nombre: string;
  categoria: string;
  /** Nombre visible de la categoría, para el resultado. */
  rotulo: string;
  precio: number;
  imagen: string;
  agotado: boolean;
  /**
   * Texto propio del producto —nombre, variantes y valores de las
   * especificaciones— ya normalizado. Es lo único que define una
   * coincidencia directa, y lo único que se manda por producto.
   */
  n: string;
  /** Miniatura ya resuelta, para la sugerencia. */
  foto?: string;
}

/**
 * Lo que viaja al navegador.
 *
 * Los sinónimos van aparte y no dentro de cada producto: son nueve
 * cadenas compartidas por 36 productos. Repetirlas en cada entrada
 * hacía que el índice pesara 50 KB en todas las páginas del sitio,
 * la mayor parte de ellos la misma lista de palabras copiada una y
 * otra vez.
 */
export interface Indice {
  entradas: EntradaIndice[];
  sinonimos: Record<string, string>;
}

/**
 * "wi-fi" y "wifi" tienen que encontrarse entre sí. Se indexa el texto
 * con guiones y también sin ellos, y la consulta se prueba de las dos
 * formas. Es más barato que mantener una lista de excepciones.
 */
function sinGuiones(s: string): string {
  return s.replace(/-/g, '');
}

export function construirIndice(
  productos: Producto[],
  rotuloDe: (c: string) => string
): Indice {
  const entradas = productos.map((p) => {
    const variantes = p.variantes.map((v) => v.nombre).join(' ');
    /* De las especificaciones se indexa el valor, no la clave.
       "Material", "Altura" y "Peso" se repiten en los 36 productos y
       nadie los busca; "roble macizo" y "IP66" sí. */
    const specs = p.especificaciones.map((e) => e.valor).join(' ');

    return {
      slug: p.slug,
      nombre: p.nombre,
      categoria: p.categoria,
      rotulo: rotuloDe(p.categoria),
      precio: p.precio,
      imagen: p.imagenes[0]!.src,
      agotado: p.variantes.reduce((s, v) => s + v.stock, 0) === 0,
      /* El nombre de la categoría cuenta como coincidencia directa:
         buscar "iluminación" o "seguridad" tiene que traer la
         categoría entera. Los sinónimos, en cambio, quedan en el
         segundo nivel — son aproximaciones, no el nombre real. */
      n: normalizar([p.nombre, rotuloDe(p.categoria), variantes, specs].join(' ')),
    };
  });

  /* Sólo las categorías y los rubros que el catálogo usa de verdad. */
  const sinonimos: Record<string, string> = {};
  for (const p of productos) {
    if (!sinonimos[p.categoria]) {
      sinonimos[p.categoria] = normalizar(
        [rotuloDe(p.categoria), SINONIMOS[p.categoria] ?? '', SINONIMOS_RUBRO[p.rubro] ?? ''].join(' ')
      );
    }
  }

  return { entradas, sinonimos };
}

/**
 * Puntaje de un producto contra una consulta. Cero significa que no
 * corresponde mostrarlo.
 *
 * Dos reglas, y las dos importan.
 *
 * 1. TODAS las palabras de la consulta tienen que aparecer. Con "o"
 *    en vez de "y", "lámpara de pie" devolvería medio catálogo porque
 *    "de" está en todos lados. Es la diferencia entre un buscador y
 *    una lista.
 *
 * 2. Coincidencia directa antes que coincidencia por categoría. Los
 *    sinónimos están cargados por categoría, así que sin esta segunda
 *    regla buscar "puff" devolvía las seis piezas de muebles chicos
 *    —incluidas dos mesas— porque "puff" es sinónimo de la categoría
 *    entera. Ahora la categoría sólo entra en juego cuando ninguna
 *    palabra coincide con el producto en sí: es lo que hace que
 *    "aspiradora" siga encontrando el robot, sin que "puff" traiga
 *    mesas de arrastre.
 */
export function puntuar(e: EntradaIndice, consulta: string, sinonimos = ''): number {
  const q = normalizar(consulta);
  if (!q) return 0;

  const palabras = q.split(' ').filter((w) => w.length > 1 || /\d/.test(w));
  if (palabras.length === 0) return 0;

  /* El texto sin guiones se arma acá y no se manda por la red: son 36
     cadenas cortas, calcularlas cuesta menos que transmitirlas. */
  const propio = `${e.n} ${sinGuiones(e.n)}`;
  const directa = palabras.every((w) => propio.includes(w));
  if (!directa) {
    const amplio = `${propio} ${sinonimos} ${sinGuiones(sinonimos)}`;
    if (!palabras.every((w) => amplio.includes(w))) return 0;
  }

  /* El nombre también se prueba sin guiones. Sin esto, buscar "wifi"
     ponía primera la cámara —que lo tiene en la especificación de
     conexión— por delante del extensor de wi-fi, que lo lleva en el
     nombre: los dos coincidían, pero el bonus por nombre no se
     activaba porque el nombre dice "wi-fi" y la consulta "wifi". */
  const nombre = normalizar(e.nombre);
  const nombreLlano = sinGuiones(nombre);

  /* La distancia entre los dos niveles es enorme a propósito: ningún
     acierto de categoría puede trepar por encima de una coincidencia
     directa por muchos puntos de detalle que sume. */
  let puntos = directa ? 10_000 : 1;

  if (nombre === q || nombreLlano === q) puntos += 1000;
  else if (nombre.startsWith(q) || nombreLlano.startsWith(q)) puntos += 500;
  else if (nombre.includes(q) || nombreLlano.includes(q)) puntos += 300;

  for (const w of palabras) {
    if (nombre.startsWith(w) || nombreLlano.startsWith(w)) puntos += 60;
    else if (new RegExp(`\\b${w}`).test(nombre) || new RegExp(`\\b${w}`).test(nombreLlano)) puntos += 40;
    else if (nombre.includes(w) || nombreLlano.includes(w)) puntos += 20;
  }

  /* Lo agotado sigue apareciendo —esconderlo hace pensar que no se
     vende— pero nunca arriba de algo que se puede comprar hoy. */
  if (e.agotado) puntos -= 250;

  return puntos;
}

export function buscar(indice: Indice, consulta: string, limite = 60): EntradaIndice[] {
  const puntuados = indice.entradas
    .map((e) => ({ e, p: puntuar(e, consulta, indice.sinonimos[e.categoria] ?? '') }))
    .filter((x) => x.p > 0);

  /* Si hay coincidencias directas, las de categoría no se muestran.
     Aparecen sólo cuando no hay nada mejor, que es cuando de verdad
     ayudan en vez de ensuciar. */
  const directas = puntuados.filter((x) => x.p >= 10_000);
  const finales = directas.length > 0 ? directas : puntuados;

  return finales
    .sort((a, b) => b.p - a.p || a.e.nombre.localeCompare(b.e.nombre, 'es'))
    .slice(0, limite)
    .map((x) => x.e);
}

/**
 * Enlace a una ficha que funciona en el sitio publicado y también en
 * la copia local que se abre con doble clic. En la vista previa las
 * rutas son relativas y `window.__raiz` dice desde dónde colgar.
 */
export function enlaceProducto(slug: string): string {
  const raiz = (globalThis as { __raiz?: string }).__raiz;
  return raiz ? `${raiz}producto/${slug}/index.html` : `/producto/${slug}`;
}
