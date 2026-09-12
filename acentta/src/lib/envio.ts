/**
 * acentta · cálculo de envío
 * ---------------------------------------------------------------
 * Tabla de zonas de Argentina por rango de código postal. Dejó de
 * ser la verdad el día que entró OCA: ahora la tarifa real la pide
 * `tarifa.ts` al operador y esta tabla es la RED DE SEGURIDAD para
 * cuando el operador no contesta. Sigue decidiendo, eso sí, a dónde
 * vendemos: un código postal fuera de estas zonas no se vende
 * aunque OCA diga que llega.
 *
 * Por qué existe esta calculadora en la ficha y no recién en el
 * checkout: el costo de envío sorpresa es la principal causa de
 * abandono de carrito. Mostrarlo antes cuesta algunas visitas que
 * se van; ocultarlo cuesta carritos armados que se abandonan en el
 * último paso, que es mucho más caro.
 *
 * ---------------------------------------------------------------
 * [ERROR CORREGIDO] LA TABLA ESTABA ARMADA PARA OTRO ORIGEN
 *
 * Hasta acá la zona más barata era CABA ($ 4.200) y la más cara la
 * Patagonia. Ese es el mapa de precios de alguien que despacha
 * desde Buenos Aires. acentta despacha desde Córdoba capital, así
 * que la zona más barata es Córdoba y CABA está lejos.
 *
 * No era un error de números sino de FORMA, y por eso no se veía:
 * la tabla contestaba rápido, con zonas plausibles y precios de
 * aspecto razonable. Sólo aparece al comparar contra lo que cobra
 * el correo de verdad. Medido el 12/9/2026 con OCA, saliendo de
 * CP 5000, con un paquete de 27x16x11 cm y 0,6 kg:
 *
 *     Destino            OCA cobra    la tabla cobraba
 *     Córdoba capital    $  7.851     $  8.100
 *     CABA               $ 10.488     $  4.200   ← $ 6.288 de menos
 *     Rosario            $ 10.488     $  8.100
 *     Bariloche          $ 12.336     $ 11.800
 *
 * En tres de los cuatro destinos medidos la diferencia la ponía el
 * vendedor. No llegó a costar plata porque el envío gratis se
 * comía todo el catálogo, que es un error tapando al otro.
 *
 * CÓMO ESTÁN PUESTOS LOS PRECIOS DE ABAJO
 *
 * Sobre el costo real de OCA, más un 12 %. El margen no es codicia:
 * esta tabla se usa justo cuando OCA no contesta, o sea cuando no
 * hay forma de saber si la tarifa cambió desde la última medición.
 * Entre cobrar unos pesos de más y regalar $ 6.288 en cada envío,
 * el error barato es el primero.
 *
 * Cada zona dice si su precio está MEDIDO o INTERPOLADO. Para
 * medir las que faltan: `npm run logistica:vivo` con
 * `OCA_MODO = "produccion"`, que sólo consulta precios y no da de
 * alta ningún envío.
 */

export interface Zona {
  nombre: string;
  /** Rangos de código postal que cubre. */
  rangos: [number, number][];
  /** Costo base en pesos. */
  base: number;
  /** Adicional por kilo por encima de 5 kg. */
  porKiloExtra: number;
  /** Días hábiles adicionales sobre el plazo del producto. */
  diasExtra: number;
  /**
   * Lo que cobró OCA de verdad, cuando se lo midió.
   *
   * No se usa para calcular nada: existe para que una prueba pueda
   * verificar que `base` nunca queda por debajo del costo real, y
   * para que dentro de seis meses se sepa cuál de estos números es
   * un dato y cuál una estimación.
   */
  medido?: { costo: number; destino: string; fecha: string };
}

/**
 * De la más cerca a la más lejos, saliendo de Córdoba capital.
 *
 * El orden de la lista no decide nada —los rangos no se pisan y hay
 * una prueba que lo verifica— pero leerla ordenada es lo que hace
 * evidente si algún día un precio queda al revés.
 */
export const ZONAS: Zona[] = [
  {
    nombre: 'Córdoba capital y alrededores',
    /* Capital, Villa Carlos Paz, Alta Gracia, Río Ceballos, Jesús
       María: el Gran Córdoba entra en los primeros doscientos. */
    rangos: [[5000, 5199]],
    base: 8800,
    porKiloExtra: 620,
    diasExtra: 1,
    medido: { costo: 7851, destino: 'CP 5000 · Córdoba', fecha: '2026-09-12' },
  },
  {
    nombre: 'Provincia de Córdoba',
    /* Río Cuarto (5800), Villa María (5900), Cruz del Eje (5280).
       INTERPOLADA: está entre el precio de la capital y el nacional
       porque geográficamente lo está, no porque se haya medido.
       San Francisco y Morteros quedan afuera a propósito: ese bloque
       de códigos comparte numeración con Santa Fe y prefiero que un
       par de pueblos cordobeses paguen tarifa nacional a que medio
       Santa Fe pague tarifa provincial. */
    rangos: [[5200, 5299], [5800, 5999]],
    base: 9900,
    porKiloExtra: 700,
    diasExtra: 2,
  },
  {
    nombre: 'Centro, Cuyo y Litoral',
    /* CABA, Buenos Aires, Santa Fe, Entre Ríos, La Pampa, La Rioja,
       San Juan, Mendoza y San Luis.

       Van juntas porque OCA las cobra igual: CABA y Rosario dieron
       exactamente el mismo importe, lo que muestra que su tarifario
       trabaja con zonas anchas y no con distancia. Separarlas sería
       inventar una precisión que el correo no tiene. */
    rangos: [[1000, 2999], [5300, 5799], [6000, 8299]],
    base: 11800,
    porKiloExtra: 820,
    diasExtra: 3,
    medido: { costo: 10488, destino: 'CP 1425 · CABA y CP 2000 · Rosario', fecha: '2026-09-12' },
  },
  {
    nombre: 'Norte',
    /* Santa Fe norte, Chaco, Formosa, Corrientes, Misiones, Santiago
       del Estero, Tucumán, Catamarca, Salta y Jujuy.
       INTERPOLADA: por encima del nacional y por debajo de la
       Patagonia. Medir Salta (4400) confirmaría o corregiría. */
    rangos: [[3000, 4999]],
    base: 12600,
    porKiloExtra: 880,
    diasExtra: 4,
  },
  {
    nombre: 'Patagonia',
    rangos: [[8300, 9999]],
    base: 13900,
    porKiloExtra: 970,
    diasExtra: 5,
    medido: { costo: 12336, destino: 'CP 8400 · Bariloche', fecha: '2026-09-12' },
  },
];

/** Cuánto se le suma al costo medido de OCA para armar `base`. */
export const MARGEN_SOBRE_TARIFA_REAL = 0.12;

export interface ResultadoEnvio {
  ok: boolean;
  zona?: string;
  costo?: number;
  diasExtra?: number;
  /** Mensaje de error en lenguaje claro, si algo falló. */
  error?: string;
}

/**
 * El código postal argentino tiene 4 dígitos. El formato nuevo
 * (CPA) agrega una letra adelante y cuatro atrás — se acepta y se
 * extraen los 4 números, en vez de rechazarlo por no ser lo esperado.
 */
export function normalizarCP(entrada: string): number | null {
  const limpio = entrada.trim().toUpperCase();
  const cpa = limpio.match(/^[A-Z](\d{4})[A-Z]{3}$/);
  if (cpa) return Number(cpa[1]);
  const simple = limpio.match(/^(\d{4})$/);
  if (simple) return Number(simple[1]);
  return null;
}

export function calcularEnvio(entrada: string, pesoKg: number): ResultadoEnvio {
  const cp = normalizarCP(entrada);

  if (cp === null) {
    return {
      ok: false,
      error: 'El código postal lleva cuatro números. Si tienes el formato nuevo, escríbelo completo (por ejemplo C1425DKE).',
    };
  }

  const zona = ZONAS.find((z) => z.rangos.some(([a, b]) => cp >= a && cp <= b));

  if (!zona) {
    return {
      ok: false,
      error: `Todavía no llegamos al código postal ${cp}. Escríbenos y vemos si podemos coordinar una entrega.`,
    };
  }

  const kilosExtra = Math.max(0, Math.ceil(pesoKg - 5));
  const costo = zona.base + kilosExtra * zona.porKiloExtra;

  return { ok: true, zona: zona.nombre, costo, diasExtra: zona.diasExtra };
}
