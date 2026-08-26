/**
 * acentta · el contrato que cumple cualquier pasarela de pago
 * ---------------------------------------------------------------
 * Este archivo no cobra nada. Define qué tiene que saber hacer algo
 * para poder cobrar acá, y elige cuál de las implementaciones se usa.
 *
 * POR QUÉ EXISTE
 *
 * El sitio arrancó cobrando con Mercado Pago. Cuando hubo que cambiar
 * a Mobbex por costo de comisiones, la pregunta interesante no era
 * «¿se puede?» sino «¿cuánto del sitio hay que tocar?». La respuesta
 * fue: el archivo de la pasarela y el cableado de dos rutas. La
 * cotización, el almacén de pedidos, la conciliación, el checkout, la
 * confirmación y la pantalla de despacho no se enteraron.
 *
 * Eso no fue suerte. Fue haber puesto el total del lado del servidor
 * desde el principio, y no dejar que ningún precio viaje desde el
 * navegador. Una pasarela, vista desde acá, hace tres cosas: abre un
 * cobro, avisa cuando algo cambió, y contesta la verdad si se le
 * pregunta. Todo lo demás es dialecto.
 *
 * LO QUE NORMALIZA CADA ADAPTADOR
 *
 * Los estados. Mercado Pago dice `approved`; Mobbex dice `200`. Si esa
 * diferencia llegara a la conciliación, la conciliación tendría que
 * conocer las dos pasarelas y volveríamos al principio. Así que cada
 * adaptador traduce a los cinco estados de acá, y guarda el original
 * en `crudo` para que la pantalla de despacho pueda mostrar el detalle
 * real cuando hay que entender qué pasó.
 *
 * La regla de traducción, para las dos: **ante la duda, pendiente.**
 * Un pedido pendiente de más se revisa a mano y se resuelve. Un pedido
 * aprobado de más se despacha y se pierde la mercadería.
 */

import { variable } from '@lib/entorno';
import { mobbex } from '@lib/mobbex';
import { mercadoPago } from '@lib/mercadopago';

/* ------------------------------------------------------------------ *
 * Los cinco estados que entiende el resto del sitio
 * ------------------------------------------------------------------ */

export type EstadoPago = 'aprobado' | 'pendiente' | 'rechazado' | 'cancelado' | 'devuelto';

export interface PagoConsultado {
  /** Identificador del pago en la pasarela. */
  id: string;
  /** Ya traducido a nuestro vocabulario. */
  estado: EstadoPago;
  /** Lo que dijo la pasarela, tal cual, para poder investigar después. */
  crudo: string;
  /** Texto legible del motivo, cuando lo hay. */
  detalle: string;
  /** Lo que efectivamente se cobró. Se compara contra lo cotizado. */
  monto: number;
  /** Nuestro número de pedido. Es el hilo que une el pago al registro. */
  referenciaExterna: string;
}

/* ------------------------------------------------------------------ *
 * Lo que se le pide a una pasarela para abrir un cobro
 * ------------------------------------------------------------------ */

export interface LineaDeCobro {
  id: string;
  nombre: string;
  cantidad: number;
  precio: number;
}

export interface DatosDeCobro {
  numeroPedido: string;
  lineas: LineaDeCobro[];
  envio: number;
  descuento: number;
  /**
   * El total cotizado por el servidor.
   *
   * Va explícito y no se deduce de las líneas porque las dos pasarelas
   * no coinciden en quién manda: Mercado Pago suma los ítems más el
   * envío, Mobbex cobra este número y trata los ítems como decoración
   * del comprobante. Mandar el total calculado acá hace que las dos
   * cobren exactamente lo mismo, que es lo único que importa.
   */
  total: number;
  comprador: {
    email: string;
    nombre: string;
    apellido: string;
    dni: string;
    telefono: string;
  };
  entrega?: {
    cp: string;
    provincia: string;
    ciudad: string;
    calle: string;
    numero: string;
    piso?: string;
  };
  /** La dirección real de este sitio, tomada de la petición. */
  urlSitio: string;
}

export interface CobroCreado {
  /** Identificador del cobro en la pasarela. */
  id: string;
  /** A dónde hay que mandar a la persona. */
  enlace: string;
  /**
   * ¿Esto cobra plata de verdad?
   *
   * Lo dice la pasarela en su respuesta, no una suposición nuestra.
   * Es la única forma de detectar que se subieron credenciales de
   * producción a un sitio que se cree de prueba.
   */
  real: boolean;
}

/* ------------------------------------------------------------------ *
 * El aviso que llega de la pasarela
 * ------------------------------------------------------------------ */

export interface Aviso {
  url: URL;
  headers: Headers;
  cuerpo: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * El contrato
 * ------------------------------------------------------------------ */

export interface Pasarela {
  readonly nombre: 'mobbex' | 'mercadopago';

  /** ¿Están cargadas las credenciales? */
  hayCredenciales(): boolean;

  /** ¿Se puede verificar de quién viene un aviso? */
  hayAvisoVerificable(): boolean;

  /** En qué entorno DECIMOS que estamos. */
  modoDeclarado(): 'prueba' | 'produccion';

  /**
   * ¿Se puede seguir con este cobro?
   *
   * El caso que importa es uno solo: la pasarela dice que el cobro es
   * real y nosotros creíamos estar probando. Ahí hay plata de alguien
   * en juego y una entrega comprometida, así que no se sigue.
   *
   * El caso inverso —credenciales de prueba con el sitio declarado en
   * producción— no cobra nada y no lastima a nadie.
   */
  cobroPermitido(real: boolean, declarado?: 'prueba' | 'produccion'): boolean;

  /** Abre el cobro y devuelve a dónde mandar a la persona. */
  crearCobro(datos: DatosDeCobro): Promise<CobroCreado>;

  /**
   * Pregunta por el pago de un pedido usando NUESTRO número.
   *
   * Es la red de seguridad de todo el circuito. Los avisos son
   * mensajes que llegan por la red, y los mensajes que llegan por la
   * red se pierden: un despliegue en ese momento, un corte, una
   * función que tardó de más. Un pedido que quedó pendiente por un
   * aviso perdido es un pago cobrado que nadie va a despachar.
   */
  buscarPagoPorPedido(numeroPedido: string): Promise<PagoConsultado | null>;

  /**
   * ¿Este aviso lo mandó realmente la pasarela?
   *
   * Cada una lo demuestra a su manera —firma criptográfica una, token
   * compartido la otra— y por eso la pregunta vive acá y no en la
   * ruta. La ruta sólo necesita saber sí o no.
   */
  avisoLegitimo(aviso: Aviso): boolean;

  /**
   * La clave con la que se decide si este aviso ya se procesó.
   *
   * No es sólo el identificador del pago: incluye el estado que el
   * aviso dice traer. Un reintento del mismo aviso repite la clave y
   * se descarta; un cambio real de estado —de aprobado a devuelto—
   * trae otra clave y sí se procesa. Con la clave sin el estado, una
   * devolución quedaba invisible para siempre.
   *
   * Que el estado salga del cuerpo del aviso, que no es confiable, no
   * es un problema: sólo decide si vale la pena preguntar. Lo que se
   * escribe en el pedido sale siempre de la consulta a la API.
   */
  claveDeAviso(aviso: Aviso): string | null;

  /**
   * El pago del que habla este aviso, preguntado a la fuente.
   *
   * Nunca se le cree al cuerpo del aviso. El aviso dice de qué hay que
   * preguntar; la respuesta viene de la API, autenticada con nuestras
   * credenciales.
   */
  pagoDelAviso(aviso: Aviso): Promise<PagoConsultado | null>;
}

/* ------------------------------------------------------------------ *
 * Cuál se usa
 * ------------------------------------------------------------------ */

/**
 * Mobbex de fábrica.
 *
 * Mercado Pago sigue entero en el repositorio y se enciende poniendo
 * `PASARELA=mercadopago`. No se borró a propósito: fue la primera
 * integración del sitio, funciona, y tenerlo al lado es lo que
 * permite volver en una variable de entorno si el arancel cambia.
 *
 * El valor de fábrica está escrito y no deducido: si alguien olvida
 * declarar la variable, el sitio cobra con la pasarela que decidimos,
 * no con la que quedó primera en un objeto.
 */
export function nombreDePasarela(): 'mobbex' | 'mercadopago' {
  return variable('PASARELA').toLowerCase() === 'mercadopago' ? 'mercadopago' : 'mobbex';
}

/**
 * La pasarela activa.
 *
 * Se resuelve al llamarla y no al importar el módulo, por lo mismo
 * que las variables de entorno se leen al usarse: durante la
 * construcción del sitio todavía no están cargadas.
 */
export function elegirPasarela(): Pasarela {
  return nombreDePasarela() === 'mercadopago' ? mercadoPago : mobbex;
}
