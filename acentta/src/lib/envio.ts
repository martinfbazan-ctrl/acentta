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
 * el correo de verdad. Medido con OCA, operativa 471351 —sucursal a
 * puerta—, saliendo de CP 5000, con un paquete de 27x16x11 cm y
 * 0,6 kg:
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
 * Sobre el costo real de OCA **con IVA**, más un 12 %.
 *
 * Lo del IVA no es un detalle contable. OCA cotiza en neto —tanto su
 * calculadora web como su API— y acentta factura como monotributo,
 * así que ese 21 % no se recupera como crédito fiscal: es costo
 * puro. Cobrar la tarifa pelada dejaba las cuatro zonas por debajo
 * del costo, entre $ 700 y $ 1.000 por envío.
 *
 * El margen del 12 % no es codicia: esta tabla se usa justo cuando
 * OCA no contesta, o sea cuando no hay forma de saber si la tarifa
 * cambió desde la última medición. Entre cobrar unos pesos de más y
 * regalar $ 6.288 en cada envío, el error barato es el primero.
 *
 * Las cuatro zonas están medidas. Para volver a medirlas:
 * `npm run logistica:vivo` con `OCA_MODO = "produccion"`, que sólo
 * consulta precios y no da de alta ningún envío.
 *
 * LA OPERATIVA ES PARTE DE LA MEDICIÓN
 *
 * Cada zona guarda con qué operativa se midió, y no es burocracia.
 * OCA vende ocho productos con números consecutivos —sucursal a
 * puerta, sucursal a sucursal y seis más—, y su respuesta a una
 * cotización devuelve un precio sin nombrar el servicio. Con el
 * número de al lado cargado por error, todas las tarifas bajaron un
 * 25 % y parecía que OCA había abaratado. Un precio sin su operativa
 * al lado no se puede comparar con nada.
 *
 * EL PRECIO SE AGRUPA POR TARIFARIO; EL PLAZO, POR DISTANCIA
 *
 * OCA cobra cuatro precios desde Córdoba, pero tarda más de cuatro
 * tiempos distintos. Son dos agrupaciones que no coinciden, y
 * tratarlas como una sola cuesta plata en un sentido o ventas en el
 * otro: seis zonas de precio le cobraban $ 2.112 de más a Salta;
 * fusionarlas en una le prometía a CABA 5 días cuando OCA entrega
 * en 2.
 *
 * Por eso hay dos zonas con la misma `base` y distinto `diasExtra`.
 * No es una inconsistencia: es lo que mide el correo.
 *
 * ESTA TABLA NO ES SÓLO UN RESPALDO
 *
 * La calculadora de envío de la ficha de producto la usa SIEMPRE:
 * corre en el navegador y no puede llamar a OCA. La consulta al
 * correo pasa recién en el checkout, del lado del servidor. Así que
 * estos números son los que ve todo visitante en la pantalla donde
 * decide comprar — no sólo los que ve alguien el día que OCA está
 * caído.
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
   *
   * **`operativa` no es un dato de archivo.** Una tarifa de OCA sólo
   * significa algo junto al producto que la produjo: la misma caja
   * al mismo destino sale distinto en sucursal a puerta que en
   * sucursal a sucursal, y la respuesta de OCA no dice cuál de las
   * dos contestó. Sin este campo, comparar una medición nueva contra
   * una vieja puede estar comparando dos productos distintos y
   * concluir «bajaron las tarifas» cuando lo que cambió fue el
   * servicio.
   */
  medido?: {
    costo: number;
    destino: string;
    fecha: string;
    operativa: string;
    /**
     * Cómo llama OCA a esta zona: Local, Regional, Nacional 1,
     * Nacional 2. Es la agrupación que decide el precio, y tenerla
     * escrita convierte cada zona de abajo en una afirmación
     * verificable en vez de una opinión geográfica.
     */
    ambito: string;
    /**
     * El PEOR plazo medido en la zona, en días hábiles.
     *
     * Existe porque `diasExtra` nunca puede quedar por debajo de
     * esto: prometer antes de lo que el correo tarda es la única
     * forma de romper la promesa desde el código.
     */
    dias: number;
  };
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
    /* $ 7.851 + IVA = $ 9.500, más el 12 %. */
    base: 10700,
    porKiloExtra: 750,
    diasExtra: 1,
    medido: {
      costo: 7851, destino: 'CP 5000 · Córdoba', fecha: '2026-09-13',
      operativa: '471351', ambito: 'Local', dias: 1,
    },
  },
  {
    nombre: 'Provincia de Córdoba',
    /* Río Cuarto (5800), Villa María (5900), Cruz del Eje (5280).

       San Francisco y Morteros quedan afuera a propósito: ese bloque
       de códigos comparte numeración con Santa Fe y prefiero que un
       par de pueblos cordobeses paguen tarifa nacional a que medio
       Santa Fe pague tarifa provincial. */
    rangos: [[5200, 5299], [5800, 5999]],
    /* $ 10.027 + IVA = $ 12.133, más el 12 %. */
    base: 13700,
    porKiloExtra: 960,
    /* [ERROR CORREGIDO] Decía 2, tomado de Río Cuarto. Villa María
       —más cerca de Córdoba— dio 4. La tabla prometía dos días para
       un envío que OCA entrega en cuatro, que es la única forma de
       romper una promesa desde el código: adelantarla. */
    diasExtra: 4,
    medido: {
      costo: 10027, destino: 'CP 5800 · Río Cuarto y CP 5900 · Villa María', fecha: '2026-09-13',
      operativa: '471351', ambito: 'Regional', dias: 4,
    },
  },
  /* ------------------------------------------------------------------
     Las dos que siguen cuestan LO MISMO y tardan distinto, y esa
     asimetría es el hallazgo que ordena toda la tabla.

     [ERROR CORREGIDO ·1] Antes eran «Centro, Cuyo y Litoral» a
     $ 11.800 y «Norte» a $ 12.600. La segunda salía de suponer que
     el norte, por lejos, tenía que salir más caro. No sale más caro.
     Medido desde Córdoba con la misma caja:

         CABA      $ 10.488      Salta     $ 10.488
         Rosario   $ 10.488      Tucumán   $ 10.488
         Mendoza   $ 10.488

     Cinco destinos, cinco veces el mismo número. Desde Córdoba, OCA
     no cobra por distancia. La zona «Norte» cobraba $ 2.112 de más
     por una intuición geográfica.

     [ERROR CORREGIDO ·2] Al descubrir eso las fusioné en una sola
     zona, «Resto del país», con el peor plazo de las cinco: 5 días.
     Correcto en el precio y caro en otra moneda — **a CABA le
     prometía 5 días cuando OCA entrega en 2.**

     Y no es un detalle del checkout: la calculadora de la ficha usa
     esta tabla, no OCA. La fecha que ve TODO visitante en la página
     de producto sale de acá. Le estaba agregando tres días al
     mercado más grande del país, en la pantalla donde se decide la
     compra.

     El error de fondo fue confundir dos cosas que resultaron
     distintas: **el precio se agrupa por tarifario, el plazo se
     agrupa por distancia.** Que OCA cobre lo mismo no significa que
     tarde lo mismo. Por eso hay dos zonas con la misma `base` y
     `diasExtra` distintos, y por eso la prueba ya no exige que el
     precio suba en cada escalón: exige que no baje.
     ------------------------------------------------------------------ */
  {
    nombre: 'Centro y Litoral',
    /* CABA, Buenos Aires, Santa Fe, Entre Ríos y La Pampa. */
    rangos: [[1000, 2999], [6000, 8299]],
    /* $ 10.488 + IVA = $ 12.690, más el 12 %. */
    base: 14300,
    porKiloExtra: 1000,
    /* CABA dio 2 días y Rosario 3. Se toma el peor de la zona. */
    diasExtra: 3,
    medido: {
      costo: 10488, destino: 'CP 1425 · CABA y CP 2000 · Rosario', fecha: '2026-09-13',
      operativa: '471351', ambito: 'Nacional 1', dias: 3,
    },
  },
  {
    nombre: 'Cuyo y Norte',
    /* Mendoza, San Juan, San Luis, La Rioja, y todo el norte:
       Santa Fe norte, Chaco, Formosa, Corrientes, Misiones,
       Santiago del Estero, Tucumán, Catamarca, Salta y Jujuy. */
    rangos: [[3000, 4999], [5300, 5799]],
    /* Mismo tarifario que Centro y Litoral: $ 12.690 con IVA. */
    base: 14300,
    porKiloExtra: 1000,
    /* Mendoza dio 4 días y Salta 5. Tucumán dio 2, que es menos que
       Rosario estando más lejos: los plazos que devuelve OCA tienen
       ruido y conviene no afinarlos más de lo que aguantan. */
    diasExtra: 5,
    medido: {
      costo: 10488, destino: 'CP 5500 · Mendoza, CP 4400 · Salta y CP 4000 · Tucumán', fecha: '2026-09-13',
      operativa: '471351', ambito: 'Nacional 1', dias: 5,
    },
  },
  {
    nombre: 'Patagonia',
    rangos: [[8300, 9999]],
    /* $ 12.336 + IVA = $ 14.927, más el 12 %. */
    base: 16800,
    porKiloExtra: 1180,
    /* Bariloche dio 5 días y Ushuaia 9. Mismo criterio: el peor. */
    diasExtra: 9,
    medido: {
      costo: 12336, destino: 'CP 8400 · Bariloche y CP 9410 · Ushuaia', fecha: '2026-09-13',
      operativa: '471351', ambito: 'Nacional 2', dias: 9,
    },
  },
];

/** Cuánto se le suma al costo medido de OCA para armar `base`. */
export const MARGEN_SOBRE_TARIFA_REAL = 0.12;

/**
 * Los `medido` de arriba son NETOS: no tienen el IVA adentro.
 *
 * Medido, no supuesto. La calculadora de la web de OCA aclara en
 * rojo «Los precios no incluyen IVA», pero eso solo no alcanzaba
 * para saber qué devuelve la API. Los dos números que había no eran
 * comparables —se habían consultado con paquetes distintos— así que
 * se repitió la consulta en la web con el mismo paquete que manda el
 * adaptador:
 *
 *     API   0,6 kg · 0,004752 m³ → $ 10.488
 *     Web   0,63 kg · 0,003 m³   → $ 10.080,6  «no incluyen IVA»
 *
 * Cuatro por ciento de diferencia, no veintiuno. Ese 4 % es el
 * volumen aforado —la web redondeó a 0,003 m³— y no un impuesto. Si
 * la API viniera con IVA tendría que haber dado unos $ 12.200.
 *
 * Conclusión: la API cotiza igual que la calculadora, en neto, y el
 * adaptador le suma el 21 % antes de que el número llegue a ninguna
 * pantalla. `OCA_TARIFA_INCLUYE_IVA = "si"` lo desactiva el día que
 * OCA cambie de criterio.
 *
 * Las `base` de la tabla se comparan contra el costo CON IVA, que es
 * lo que se paga de verdad. Antes de esta medición estaban las
 * cuatro por debajo del costo: entre $ 700 y $ 1.000 por envío,
 * puestos por el vendedor, sin que ninguna pantalla lo dijera.
 */
export const MEDICIONES_CON_IVA = false;

/** IVA de los servicios de transporte. No tienen alícuota reducida. */
export const IVA_ENVIO = 0.21;

/** Lo que el envío cuesta de verdad, impuesto incluido. */
export function costoRealDe(zona: Zona): number | null {
  if (!zona.medido) return null;
  return MEDICIONES_CON_IVA
    ? zona.medido.costo
    : Math.round(zona.medido.costo * (1 + IVA_ENVIO));
}

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
