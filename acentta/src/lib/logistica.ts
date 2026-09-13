/**
 * acentta · el contrato que cumple cualquier operador logístico
 * ---------------------------------------------------------------
 * El hermano de `pasarela.ts`, y por el mismo motivo.
 *
 * POR QUÉ EXISTE
 *
 * La primera integración logística fue Envíopack. Estaba escrita,
 * probada y funcionando contra su API cuando apareció el impedimento
 * que ninguna documentación menciona: **su formulario de direcciones
 * sólo acepta CABA y Buenos Aires como provincia de origen**, en los
 * dos tipos de dirección. acentta despacha desde Córdoba capital.
 *
 * No fue un error de configuración ni algo que se pudiera sortear
 * desde el código: era una restricción del producto. Se descubrió
 * recién con una cuenta abierta y credenciales en la mano.
 *
 * De ahí la lección, que ya habíamos aprendido con el cobro y acá se
 * volvió a pagar: **un proveedor externo es una decisión reversible o
 * es una trampa.** Este archivo la vuelve reversible. Envíopack pasó
 * a ser un adaptador más —no se borró, sirve el día que haya un
 * depósito en el AMBA— y OCA entró sin tocar el checkout, la
 * cotización ni la pantalla de despacho.
 *
 * LO QUE NORMALIZA CADA ADAPTADOR
 *
 * Las unidades y los vocabularios, que es donde están las trampas:
 * Envíopack pide las provincias en código ISO y el volumen por caja
 * en centímetros; OCA pide el código postal de origen y el volumen
 * total en metros cúbicos. Confundir centímetros cúbicos con metros
 * cúbicos no da error: da una cotización mil veces más barata, y esa
 * diferencia la paga el vendedor.
 */

import { variable } from '@lib/entorno';
import { oca } from '@lib/oca';
import { enviopack } from '@lib/enviopack';
import type { TarifaExterna } from '@lib/cotizacion';

/* ------------------------------------------------------------------ *
 * Lo que se le pide a un operador
 * ------------------------------------------------------------------ */

/** Dónde termina el envío: en la casa, o en una sucursal del correo. */
export type MetodoDeEntrega = 'domicilio' | 'sucursal';

export interface PedidoDeTarifa {
  /** A dónde va. */
  provincia: string;
  cp: string;
  localidad?: string;
  /** Kilos sumados del pedido. */
  peso: number;
  /** Las cajas en el formato de `paquetes.ts`: `29x11x11,29x11x11`. */
  paquetes: string;
  /** Para el seguro, cuando el operador lo pide. */
  valorDeclarado?: number;
  /**
   * Cómo lo recibe el comprador. Por omisión, en su domicilio.
   *
   * Está en el contrato y no adentro de un adaptador porque no es un
   * detalle de OCA: **para el correo son dos productos distintos con
   * dos tarifas distintas**, no un descuento sobre el mismo envío.
   * Antes el sitio lo trataba como un descuento fijo de $ 1.200
   * aplicado por nosotros, y cuando OCA empezó a contestar, ese
   * descuento dejó de aplicarse —el código lo saltea cuando hay
   * tarifa del operador— sin que nadie lo notara: elegir «retiro en
   * sucursal» costaba exactamente lo mismo que a domicilio y
   * prometía los mismos días, mientras la página de envíos seguía
   * anunciando $ 1.200 menos y un día antes.
   */
  entrega?: MetodoDeEntrega;
}

export interface DatosDeDespacho {
  numeroPedido: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  total: number;
  fechaAlta: string;
  entrega: {
    calle: string;
    numero: string;
    piso?: string;
    cp: string;
    provincia: string;
    ciudad: string;
    referencias?: string;
  };
  peso: number;
  cajas: { alto: number; ancho: number; largo: number; peso: number }[];
  correoId?: string;
  servicio?: string;
  /**
   * El identificador de la sucursal donde retira el comprador.
   *
   * Va en el contrato aunque el botón de despachar todavía no exista,
   * porque es el dato que se pierde si no se piensa ahora: el alta
   * del envío en OCA necesita el centro de imposición de destino, y
   * para entonces el pedido ya está cobrado. Recalcularlo desde el
   * código postal daría la primera sucursal de la lista, no la que la
   * persona eligió.
   *
   * `undefined` para entrega a domicilio, que es el caso normal.
   */
  sucursalDestino?: string;
}

export interface Despacho {
  /** Identificador de la orden en el operador. */
  orden: string;
  /** El número que sigue el comprador. Puede no existir al crear. */
  seguimiento: string | null;
  estado: string;
}

/* ------------------------------------------------------------------ *
 * El contrato
 * ------------------------------------------------------------------ */

export interface Logistica {
  readonly nombre: 'oca' | 'enviopack';

  /** ¿Están cargadas las credenciales? */
  hayCredenciales(): boolean;

  /**
   * Desde dónde sale la mercadería. Es el dato que volteó a Envíopack
   * y por eso está en el contrato: un operador que no pueda originar
   * desde acá no sirve, por más barato que cotice.
   */
  origen(): { cp: string; provincia: string; localidad: string };

  /**
   * Lo que paga el comprador, según cómo lo reciba.
   *
   * Se llamaba `cotizarDomicilio` cuando sólo sabía hacer eso. El
   * nombre viejo habría quedado mintiendo apenas empezó a cotizar
   * también contra sucursal, y un nombre que miente es la forma más
   * barata de que alguien —incluido yo dentro de seis meses— use la
   * función para lo que no es.
   *
   * Devuelve `null` —y no una excepción— cuando el operador contesta
   * pero no tiene tarifa. Es una respuesta válida, no una falla, y
   * quien llama cae a la tabla propia. Las fallas de verdad sí
   * lanzan.
   */
  cotizar(pedido: PedidoDeTarifa): Promise<TarifaExterna | null>;

  /**
   * Da de alta el envío. Opcional: un operador puede servir para
   * cotizar antes de estar habilitado para despachar, y esa etapa
   * intermedia es la normal, no la excepción.
   */
  despachar?(datos: DatosDeDespacho): Promise<Despacho>;

  /** La etiqueta para pegar en la caja, cuando el operador la da. */
  urlDeEtiqueta?(orden: string): Promise<string>;
}

/* ------------------------------------------------------------------ *
 * Cuál se usa
 * ------------------------------------------------------------------ */

/**
 * OCA de fábrica.
 *
 * Envíopack queda elegible con `LOGISTICA=enviopack` para el día que
 * haya un depósito en el AMBA. No se borró: está escrito, probado, y
 * lo que costó no fue el código sino descubrir el impedimento.
 */
export function nombreDeLogistica(): 'oca' | 'enviopack' {
  return variable('LOGISTICA').toLowerCase() === 'enviopack' ? 'enviopack' : 'oca';
}

/**
 * El operador activo.
 *
 * Se resuelve al llamarlo y no al importar el módulo, por lo mismo
 * que las variables de entorno se leen al usarse: durante la
 * construcción del sitio todavía no están cargadas.
 */
export function elegirLogistica(): Logistica {
  return nombreDeLogistica() === 'enviopack' ? enviopack : oca;
}
