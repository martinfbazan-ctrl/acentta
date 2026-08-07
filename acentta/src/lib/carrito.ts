/**
 * acentta · carrito
 * ---------------------------------------------------------------
 * Estado en memoria, persistido en el navegador. El carrito
 * sobrevive a cerrar la pestaña: quien armó un pedido de seis
 * productos y volvió al día siguiente no debería tener que armarlo
 * de nuevo, y ese olvido es una de las fugas más caras y más
 * fáciles de evitar de un e-commerce.
 *
 * No hay servidor ni cuentas de usuario: fuera de alcance por brief.
 */

import { UMBRAL_ENVIO_GRATIS } from '@tipos/catalogo';
import { calcularEnvio } from '@lib/envio';

export interface ItemCarrito {
  id: string;
  slug: string;
  nombre: string;
  precio: number;
  imagen: string;
  variante: string;
  cantidad: number;
  /** Tope real de la variante elegida. */
  stockMax: number;
  peso: number;
}

const CLAVE = 'acentta:carrito:v1';
const CLAVE_CP = 'acentta:cp:v1';

/* En file:// algunos navegadores bloquean el almacenamiento. En vez
   de romper, el carrito sigue funcionando en memoria por esa sesión. */
let memoria: ItemCarrito[] = [];
let hayAlmacenamiento = true;

function leerCrudo(): ItemCarrito[] {
  if (!hayAlmacenamiento) return memoria;
  try {
    const bruto = localStorage.getItem(CLAVE);
    return bruto ? (JSON.parse(bruto) as ItemCarrito[]) : [];
  } catch {
    hayAlmacenamiento = false;
    return memoria;
  }
}

function escribir(items: ItemCarrito[]) {
  memoria = items;
  if (hayAlmacenamiento) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(items));
    } catch {
      hayAlmacenamiento = false;
    }
  }
  avisar();
}

/* ============================================================
   Suscripción
   Cualquier parte de la página puede escuchar los cambios sin que
   el carrito tenga que conocerlas.
   ============================================================ */
type Oyente = (items: ItemCarrito[]) => void;
const oyentes = new Set<Oyente>();

export function suscribir(cb: Oyente): () => void {
  oyentes.add(cb);
  cb(leer());
  return () => oyentes.delete(cb);
}

function avisar() {
  const items = leer();
  for (const cb of oyentes) cb(items);
  document.dispatchEvent(new CustomEvent('carrito:cambio', { detail: items }));
}

/* ============================================================
   Operaciones
   ============================================================ */

export function leer(): ItemCarrito[] {
  return leerCrudo();
}

/** La clave de línea incluye la variante: dos colores del mismo
 *  producto son dos líneas, no una con cantidad 2. */
function clave(item: Pick<ItemCarrito, 'id' | 'variante'>) {
  return `${item.id}::${item.variante}`;
}

export function agregar(nuevo: Omit<ItemCarrito, 'cantidad'>, cantidad = 1): ItemCarrito[] {
  const items = leer();
  const existente = items.find((i) => clave(i) === clave(nuevo));

  if (existente) {
    existente.cantidad = Math.min(existente.stockMax, existente.cantidad + cantidad);
  } else {
    items.push({ ...nuevo, cantidad: Math.min(nuevo.stockMax, cantidad) });
  }

  escribir(items);
  return items;
}

export function cambiarCantidad(id: string, variante: string, cantidad: number) {
  const items = leer();
  const item = items.find((i) => clave(i) === `${id}::${variante}`);
  if (!item) return;
  item.cantidad = Math.max(1, Math.min(item.stockMax, cantidad));
  escribir(items);
}

/**
 * Quitar devuelve lo que quitó y en qué posición estaba, para que
 * deshacer pueda reponerlo exactamente donde estaba. Un "deshacer"
 * que manda el producto al final de la lista se siente roto.
 */
export function quitar(id: string, variante: string): { item: ItemCarrito; posicion: number } | null {
  const items = leer();
  const posicion = items.findIndex((i) => clave(i) === `${id}::${variante}`);
  if (posicion === -1) return null;
  const [item] = items.splice(posicion, 1);
  escribir(items);
  return { item: item!, posicion };
}

export function reponer(item: ItemCarrito, posicion: number) {
  const items = leer();
  items.splice(posicion, 0, item);
  escribir(items);
}

export function vaciar() {
  escribir([]);
}

/* ============================================================
   Totales
   ============================================================ */

export function cantidadTotal(items = leer()): number {
  return items.reduce((s, i) => s + i.cantidad, 0);
}

export function subtotal(items = leer()): number {
  return items.reduce((s, i) => s + i.precio * i.cantidad, 0);
}

export function pesoTotal(items = leer()): number {
  return items.reduce((s, i) => s + i.peso * i.cantidad, 0);
}

/* El código postal se guarda apenas la persona lo escribe, en la
   ficha o en el carrito. Pedirlo dos veces es pedirlo mal. */
export function guardarCP(cp: string) {
  try { localStorage.setItem(CLAVE_CP, cp); } catch { /* sin almacenamiento */ }
}

export function leerCP(): string {
  try { return localStorage.getItem(CLAVE_CP) ?? ''; } catch { return ''; }
}

export interface Resumen {
  subtotal: number;
  envio: number;
  /** true cuando el envío todavía no se puede calcular por falta de CP. */
  envioEstimado: boolean;
  envioGratis: boolean;
  total: number;
  faltaParaGratis: number;
  zona?: string;
  diasExtra: number;
}

/**
 * Resumen del pedido.
 * El envío entra en el total desde el carrito, no desde el último
 * paso del checkout: cero costos sorpresa es la regla, y el momento
 * en que aparece un costo nuevo es el momento en que se abandona.
 */
export function resumen(cp = leerCP(), items = leer()): Resumen {
  const sub = subtotal(items);
  const gratis = sub >= UMBRAL_ENVIO_GRATIS;

  if (gratis) {
    return {
      subtotal: sub, envio: 0, envioEstimado: false, envioGratis: true,
      total: sub, faltaParaGratis: 0, diasExtra: 0,
    };
  }

  const calculo = cp ? calcularEnvio(cp, pesoTotal(items)) : null;

  if (calculo?.ok) {
    return {
      subtotal: sub,
      envio: calculo.costo!,
      envioEstimado: false,
      envioGratis: false,
      total: sub + calculo.costo!,
      faltaParaGratis: UMBRAL_ENVIO_GRATIS - sub,
      zona: calculo.zona,
      diasExtra: calculo.diasExtra!,
    };
  }

  /* Sin código postal se muestra el piso de la tabla, marcado como
     estimado. Es preferible a mostrar cero y sorprender después. */
  const piso = 4200;
  return {
    subtotal: sub,
    envio: piso,
    envioEstimado: true,
    envioGratis: false,
    total: sub + piso,
    faltaParaGratis: UMBRAL_ENVIO_GRATIS - sub,
    diasExtra: 0,
  };
}
