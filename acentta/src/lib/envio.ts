/**
 * acentta · cálculo de envío
 * ---------------------------------------------------------------
 * Tabla de zonas simplificada de Argentina, por rango de código
 * postal. En un proyecto real esto lo devuelve la API del correo;
 * acá la lógica vive aislada para que reemplazarla sea cambiar una
 * función y nada más.
 *
 * Por qué existe esta calculadora en la ficha y no recién en el
 * checkout: el costo de envío sorpresa es la principal causa de
 * abandono de carrito. Mostrarlo antes cuesta algunas visitas que
 * se van; ocultarlo cuesta carritos armados que se abandonan en el
 * último paso, que es mucho más caro.
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
}

export const ZONAS: Zona[] = [
  {
    nombre: 'CABA',
    rangos: [[1000, 1499]],
    base: 4200,
    porKiloExtra: 380,
    diasExtra: 0,
  },
  {
    nombre: 'Gran Buenos Aires',
    rangos: [[1600, 1900], [1650, 1900]],
    base: 5400,
    porKiloExtra: 420,
    diasExtra: 1,
  },
  {
    nombre: 'Provincia de Buenos Aires',
    rangos: [[1500, 1599], [1901, 8199]],
    base: 7300,
    porKiloExtra: 520,
    diasExtra: 2,
  },
  {
    nombre: 'Centro y Cuyo',
    rangos: [[2000, 2999], [5000, 5999]],
    base: 8100,
    porKiloExtra: 560,
    diasExtra: 3,
  },
  {
    nombre: 'Norte',
    rangos: [[3000, 4999]],
    base: 9400,
    porKiloExtra: 640,
    diasExtra: 4,
  },
  {
    nombre: 'Patagonia',
    rangos: [[8300, 9999]],
    base: 11800,
    porKiloExtra: 780,
    diasExtra: 6,
  },
];

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
      error: 'El código postal lleva cuatro números. Si tenés el formato nuevo, escribilo completo (por ejemplo C1425DKE).',
    };
  }

  const zona = ZONAS.find((z) => z.rangos.some(([a, b]) => cp >= a && cp <= b));

  if (!zona) {
    return {
      ok: false,
      error: `Todavía no llegamos al código postal ${cp}. Escribinos y vemos si podemos coordinar una entrega.`,
    };
  }

  const kilosExtra = Math.max(0, Math.ceil(pesoKg - 5));
  const costo = zona.base + kilosExtra * zona.porKiloExtra;

  return { ok: true, zona: zona.nombre, costo, diasExtra: zona.diasExtra };
}
