/**
 * acentta · OCA e-Pak
 * ---------------------------------------------------------------
 * Implementa el contrato de `logistica.ts`.
 *
 * POR QUÉ OCA Y NO EL ANTERIOR
 *
 * Envíopack quedó afuera por una restricción que no está en ninguna
 * documentación: su formulario sólo acepta CABA y Buenos Aires como
 * provincia de origen. acentta despacha desde Córdoba.
 *
 * En OCA el código postal de origen es un parámetro de la cotización.
 * Le pasás 5000 y cotiza. No hay lista que te limite.
 *
 * ─────────────────────────────────────────────────────────────────
 * TRES COSAS DE SU DISEÑO QUE CONDICIONAN ESTE ARCHIVO
 *
 * 1 · ES SOAP, PERO NO HACE FALTA HABLAR SOAP. Sus métodos aceptan
 *     GET y POST con parámetros sueltos, y contestan XML. Se usa eso:
 *     un sobre SOAP a mano para consultar una tarifa es ceremonia sin
 *     ganancia.
 *
 * 2 · EL VOLUMEN VA EN METROS CÚBICOS. Nuestras cajas están en
 *     centímetros, como las quiere todo el resto del sitio.
 *     Confundirlos no da error: da una cotización mil veces más
 *     barata, que se descubre al despachar y la paga el vendedor.
 *     La conversión está en un solo lugar y tiene prueba propia.
 *
 * 3 · LA OPERATIVA DECIDE LA LOGÍSTICA. No es un detalle técnico: es
 *     el modelo de trabajo. «Sucursal a Puerta» significa que llevás
 *     el paquete a una sucursal y OCA entrega en el domicilio del
 *     comprador — la decisión tomada, para no esperar la colecta que
 *     pasa una o dos veces por semana.
 * ─────────────────────────────────────────────────────────────────
 */

import { variable } from '@lib/entorno';
import type { TarifaExterna } from '@lib/cotizacion';
import type {
  Despacho, DatosDeDespacho, Logistica, PedidoDeTarifa, MetodoDeEntrega,
} from '@lib/logistica';

/* ------------------------------------------------------------------ *
 * Entornos
 * ------------------------------------------------------------------ */

const QA = 'https://integraciones.ocadev.com.ar/epak_tracking_test/Oep_TrackEPak.asmx';
const PRODUCCION = 'https://webservice.oca.com.ar/ePak_tracking/Oep_TrackEPak.asmx';

/**
 * En qué entorno estamos. De fábrica, el de prueba.
 *
 * Mismo criterio que con el cobro: si alguien olvida declararlo, lo
 * que falla es un envío de mentira y no uno de verdad. Un envío real
 * creado por accidente es una orden de retiro que alguien tiene que
 * ir a cancelar.
 */
export function modoDeclarado(): 'prueba' | 'produccion' {
  return variable('OCA_MODO').toLowerCase().startsWith('produc') ? 'produccion' : 'prueba';
}

const base = () => (modoDeclarado() === 'produccion' ? PRODUCCION : QA);

/**
 * ¿Se puede crear un envío de verdad?
 *
 * Consultar una tarifa y dar de alta un envío son operaciones de
 * riesgo opuesto: la primera es una pregunta y la segunda genera una
 * orden de retiro que alguien tiene que ir a cancelar si estuvo mal.
 * Con un solo interruptor había que aceptar las dos juntas.
 *
 * Y hace falta que estén separadas, porque **el entorno de prueba de
 * OCA no conoce las operativas de tu cuenta**: sólo las de su cuenta
 * de demostración. Para cotizar con tarifas reales hay que ir a
 * producción sí o sí, y eso no puede implicar que un despacho se
 * dispare por accidente.
 *
 * Así que despachar pide su propio permiso, escrito a mano y aparte.
 */
export function despachoRealPermitido(): boolean {
  return variable('OCA_DESPACHO_REAL').trim().toLowerCase() === 'si';
}

/* ------------------------------------------------------------------ *
 * Credenciales y datos de cuenta
 * ------------------------------------------------------------------ */

const usuario = () => variable('OCA_USUARIO').trim();
const clave = () => variable('OCA_CLAVE').trim();
const cuit = () => variable('OCA_CUIT').trim();
const cuenta = () => variable('OCA_CUENTA').trim();

/**
 * La operativa contratada, según cómo reciba el comprador.
 *
 * **Una operativa es un producto, no un parámetro.** Cada
 * combinación de origen y destino es una distinta, con su tarifario
 * propio. OCA le genera a cada cuenta las ocho de una vez y entrega
 * la lista junta, en números consecutivos:
 *
 *     Puerta a Puerta            nos colectan, entregan a domicilio
 *     Puerta a Sucursal          nos colectan, retira el comprador
 *     Sucursal a Puerta          llevamos, entregan a domicilio  ← la nuestra
 *     Sucursal a Sucursal        llevamos, retira el comprador
 *     Log. Inv. ×4               devoluciones
 *
 * Que sean consecutivos es la trampa. Los ocho números se parecen
 * entre sí, ninguno dice qué es, y **la respuesta de OCA a una
 * cotización tampoco lo dice**: contesta un precio, sin nombrar el
 * servicio. Poner el de al lado no da error, da una tarifa distinta
 * que parece igual de razonable.
 *
 * Ya pasó: se cargó el de Sucursal a Sucursal en esta variable y
 * todas las tarifas bajaron entre un 25 % y un 30 %. Leído solo,
 * parecía que OCA había abaratado. Era el sitio cobrándole tarifa de
 * retiro en sucursal a quien pedía entrega en su casa.
 *
 * Los números no se escriben acá: viven en variables de entorno, uno
 * por modalidad. Mientras `OCA_OPERATIVA_SUCURSAL` esté vacía,
 * `cotizar()` no ofrece el retiro en sucursal — es preferible que la
 * opción no aparezca a que aparezca cobrando lo que no es.
 *
 * Las de prueba que OCA publica en su documentación: puerta a puerta
 * 64665, puerta a sucursal 62342, sucursal a puerta 94584, sucursal
 * a sucursal 78254. Ésas sí van escritas porque son públicas y de su
 * cuenta de demostración, no de la nuestra.
 */
const operativa = () => variable('OCA_OPERATIVA').trim() || '94584';
const operativaSucursal = () => variable('OCA_OPERATIVA_SUCURSAL').trim();

/** ¿Se puede cotizar sucursal a sucursal, o falta contratarla? */
export function haySucursalASucursal(): boolean {
  return operativaSucursal().length > 0;
}

/** El centro de costo, que sale de `GetCentroCostoPorOperativa`. */
const centroDeCosto = () => variable('OCA_CENTRO_COSTO').trim() || '0';

/**
 * Desde dónde sale la mercadería. Córdoba capital.
 *
 * Está en variables y no clavado porque es lo primero que cambia
 * cuando cambia el depósito, y porque tenerlo acá deja explícito el
 * dato que Envíopack no aceptaba.
 */
export function origen(): { cp: string; provincia: string; localidad: string } {
  return {
    cp: variable('OCA_CP_ORIGEN').trim() || '5000',
    provincia: variable('OCA_PROVINCIA_ORIGEN').trim() || 'CORDOBA',
    localidad: variable('OCA_LOCALIDAD_ORIGEN').trim() || 'CORDOBA',
  };
}

export function hayCredenciales(): boolean {
  /* Para cotizar alcanza con el CUIT; para despachar hacen falta
     usuario y clave. Se informa lo mínimo para cotizar, que es lo que
     usa el checkout: un sitio que no puede despachar todavía sí puede
     y debe mostrar precios reales. */
  return Boolean(cuit());
}

export function puedeDespachar(): boolean {
  return Boolean(usuario() && clave() && cuenta());
}

/* ------------------------------------------------------------------ *
 * Unidades
 * ------------------------------------------------------------------ */

/**
 * De la lista de cajas en centímetros al volumen total en metros
 * cúbicos, que es lo que pide OCA.
 *
 * Un paquete de 27 × 16 × 11 cm son 4752 cm³, o sea 0,004752 m³.
 * Mandar 4752 donde esperan 0,004752 no da error: da una cotización
 * de un envío mil veces más grande. Al revés —mandar centímetros
 * creyendo que son metros— da una cotización ridículamente barata que
 * se cobra al comprador y se descubre al despachar.
 *
 * Por eso vive acá sola, se exporta, y tiene prueba propia.
 */
export function volumenEnMetrosCubicos(paquetes: string): number {
  const cajas = String(paquetes).split(',').map((c) => c.trim()).filter(Boolean);
  if (cajas.length === 0) {
    throw new Error('No se puede cotizar un envío sin ningún paquete.');
  }

  let total = 0;
  for (const caja of cajas) {
    const [alto, ancho, largo] = caja.split('x').map(Number);
    if (![alto, ancho, largo].every((n) => Number.isFinite(n) && n! > 0)) {
      throw new Error(`Medida de paquete inválida: «${caja}».`);
    }
    /* Centímetros cúbicos a metros cúbicos: se divide por un millón,
       no por cien. Un centímetro es la centésima parte de un metro,
       y el cubo de cien es un millón. */
    total += (alto! * ancho! * largo!) / 1_000_000;
  }
  /* Seis decimales: una caja chica da valores del orden de 0,004 y
     redondear a dos la convertiría en cero. */
  return Math.round(total * 1e6) / 1e6;
}

/* ------------------------------------------------------------------ *
 * Llamadas
 * ------------------------------------------------------------------ */

/**
 * Una llamada a e-Pak. Se usa POST con formulario y no un sobre SOAP:
 * sus métodos aceptan las dos formas y ésta se lee.
 *
 * `tiempoLimite` existe porque esto corre dentro del checkout. Si OCA
 * tarda, la respuesta correcta no es esperar: es cotizar con la tabla
 * propia y seguir vendiendo.
 */
async function llamar(
  metodo: string,
  parametros: Record<string, string>,
  tiempoLimite = 8000,
): Promise<string> {
  const cuerpo = new URLSearchParams(parametros);
  const r = await fetch(`${base()}/${metodo}`, {
    method: 'POST',
    signal: AbortSignal.timeout(tiempoLimite),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo.toString(),
  });

  const texto = await r.text();
  if (!r.ok) {
    /* Se tacha la clave por si volviera en el eco del error: esto
       termina en un registro. */
    const limpio = clave() ? texto.split(clave()).join('«oculta»') : texto;
    throw new Error(`OCA ${metodo} respondió ${r.status}: ${limpio.slice(0, 300)}`);
  }
  return texto;
}

/* ------------------------------------------------------------------ *
 * Leer el XML sin sumar una dependencia
 * ------------------------------------------------------------------ */

/**
 * OCA devuelve un DataSet de .NET: filas repetidas con etiquetas
 * simples, sin atributos ni espacios de nombres en los datos. Para
 * eso no hace falta un analizador completo, y sumar uno significaría
 * confiar en código que nadie de acá leyó para procesar algo que
 * decide cuánto se le cobra a una persona.
 *
 * Si algún día la respuesta se complica, esto se reemplaza por una
 * librería de verdad. Hoy sería ceremonia.
 */
function filas(xml: string, ...etiquetas: string[]): Record<string, string>[] {
  /* [ERROR CORREGIDO] Esto recibía UNA etiqueta y todos los llamados
     pasaban `Table`, porque así se llama en la respuesta de tarifas.
     La de sucursales usa `Centro` dentro de `CentrosDeImposicion`, y
     el resultado fue cero sucursales en Córdoba capital —donde OCA
     tiene varias—.

     Otra vez el mismo patrón: no dio error, dio una lista vacía. Una
     lista vacía es una respuesta legítima de la API y por eso engaña.
     Lo encontró el diagnóstico preguntando qué etiquetas llegaron de
     verdad, no una lectura del código.

     Ahora se prueban varias y gana la primera que traiga filas. */
  for (const etiqueta of etiquetas) {
    const encontradas = filasDe(xml, etiqueta);
    if (encontradas.length > 0) return encontradas;
  }
  return [];
}

function filasDe(xml: string, etiqueta: string): Record<string, string>[] {
  /* [ERROR CORREGIDO] Esto recorría el bloque COMPLETO, incluida su
     propia etiqueta de apertura y cierre. La primera coincidencia del
     lector de campos era entonces `<Table>…</Table>` entero: se
     guardaba todo el contenido bajo la clave «table» y no quedaba
     nada más que leer. El precio siempre salía indefinido.

     No daba error: daba «sin cotización», que es una respuesta
     legítima de la API y por eso engañaba. Se lo llevó puesto la
     prueba de los formatos de número, que es exactamente para lo que
     está. Ahora se recorre sólo el contenido interno. */
  const bloques = [...xml.matchAll(
    new RegExp(`<${etiqueta}[^>]*>([\\s\\S]*?)</${etiqueta}>`, 'gi'),
  )];
  return bloques.map((bloque) => {
    const campos: Record<string, string> = {};
    for (const m of (bloque[1] ?? '').matchAll(/<([A-Za-z_][\w.-]*)>([\s\S]*?)<\/\1>/g)) {
      campos[m[1]!.toLowerCase()] = m[2]!.trim();
    }
    return campos;
  });
}

/**
 * Un número escrito como lo escribe un servicio argentino.
 *
 * Puede venir `1234.56` o `1234,56`. Tomar la coma por separador de
 * miles convierte $ 1.234,56 en $ 123456, y ese número se le cobra a
 * alguien.
 */
function aNumero(v: string | undefined): number {
  if (!v) return NaN;
  const limpio = v.trim().replace(/\s/g, '');
  /* Si hay coma y punto, el último que aparece es el decimal. */
  const coma = limpio.lastIndexOf(',');
  const punto = limpio.lastIndexOf('.');
  if (coma > punto) return Number(limpio.replace(/\./g, '').replace(',', '.'));
  return Number(limpio.replace(/,/g, ''));
}

/* ------------------------------------------------------------------ *
 * Cotizar
 * ------------------------------------------------------------------ */

/**
 * Cuál operativa corresponde, y `null` si esa modalidad no está
 * contratada.
 *
 * Devolver `null` en vez de caer a la de domicilio es deliberado. Si
 * cayera, el comprador que elige «retiro en sucursal» vería el precio
 * de la entrega a domicilio con el rótulo de sucursal: un número
 * correcto en la pantalla equivocada, que es la clase de error que no
 * se descubre nunca desde adentro.
 */
function operativaPara(entrega: MetodoDeEntrega | undefined): string | null {
  if (entrega === 'sucursal') return operativaSucursal() || null;
  return operativa();
}

export async function cotizar(pedido: PedidoDeTarifa): Promise<TarifaExterna | null> {
  if (!cuit()) return null;

  const op = operativaPara(pedido.entrega);
  if (!op) return null;

  const xml = await llamar('Tarifar_Envio_Corporativo', {
    Cuit: cuit(),
    Operativa: op,
    PesoTotal: pedido.peso.toFixed(2),
    VolumenTotal: volumenEnMetrosCubicos(pedido.paquetes).toFixed(6),
    CodigoPostalOrigen: origen().cp,
    CodigoPostalDestino: String(pedido.cp).trim(),
    CantidadPaquetes: String(pedido.paquetes.split(',').length),
    /* El valor declarado sólo se cobra en operativas con seguro. Se
       manda el real cuando lo hay: declarar de menos abarata el
       seguro y deja el envío mal cubierto. */
    ValorDeclarado: String(Math.round(pedido.valorDeclarado ?? 0)),
  });

  const resultado = filas(xml, 'Table')[0] ?? filas(xml, 'Tarifar')[0];
  if (!resultado) return null;

  const costo = aNumero(resultado.total ?? resultado.precio);
  if (!Number.isFinite(costo) || costo <= 0) return null;

  const dias = aNumero(resultado.plazoentrega);

  return {
    costo,
    /* Los días vienen del correo y ya contemplan la modalidad: en
       sucursal a sucursal suele ser uno menos porque no hay reparto
       final. Por eso nadie más le resta un día: estaría contándolo
       dos veces. */
    diasExtra: Number.isFinite(dias) && dias > 0 ? Math.ceil(dias) : 3,
    correo: 'OCA',
    correoId: 'oca',
    servicio: resultado.idtiposervicio ?? op,
  };
}

/* ------------------------------------------------------------------ *
 * Sucursales
 * ------------------------------------------------------------------ */

/**
 * La respuesta cruda de un método, para diagnosticar.
 *
 * Existe porque adivinar nombres de campos de un DataSet ajeno sale
 * mal: cuando `sucursalesPorCP` devolvió cero sucursales en Córdoba
 * capital —donde OCA tiene varias— la explicación más probable no era
 * que no hubiera, sino que los campos se llamaran distinto de lo que
 * yo supuse. Un mapeo equivocado devuelve una lista vacía, que es una
 * respuesta legítima, y por eso engaña.
 *
 * Devuelve los NOMBRES de los campos y una muestra corta, no la
 * respuesta entera: alcanza para corregir el mapeo sin volcar un
 * documento completo en una terminal.
 */
export async function camposDeLaRespuesta(
  metodo: string,
  parametros: Record<string, string>,
): Promise<{ etiquetas: string[]; campos: string[]; muestra: string; fila: string }> {
  const xml = await llamar(metodo, parametros);

  const etiquetas = [...new Set(
    [...xml.matchAll(/<([A-Za-z_][\w.-]*)[\s>]/g)].map((m) => m[1]!),
  )];

  /* [ERROR CORREGIDO] Esto buscaba `<Table>` porque es como se llama
     en la respuesta de tarifas. En la de sucursales el elemento es
     `<Centro>`, así que el diagnóstico contestó «campos: (ninguno)»
     justo cuando lo habían llamado para averiguar los campos.

     Un diagnóstico que hereda la suposición que está diagnosticando
     no sirve. Ahora la fila se descubre: es la etiqueta que más veces
     se repite y que tiene hijos. */
  const repeticiones = new Map<string, number>();
  for (const m of xml.matchAll(/<([A-Za-z_][\w.-]*)>\s*<[A-Za-z_]/g)) {
    repeticiones.set(m[1]!, (repeticiones.get(m[1]!) ?? 0) + 1);
  }
  const fila = [...repeticiones.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const primeraFila = fila
    ? xml.match(new RegExp(`<${fila}>([\\s\\S]*?)</${fila}>`, 'i'))
    : null;
  const campos = primeraFila
    ? [...new Set([...(primeraFila[1] ?? '').matchAll(/<([A-Za-z_][\w.-]*)>/g)].map((m) => m[1]!))]
    : [];

  return { etiquetas, campos, muestra: xml.slice(0, 400), fila: fila ?? '(no se detectó)' };
}

/**
 * Los centros de costo habilitados para una operativa.
 *
 * Es el dato más incómodo de conseguir de toda la integración: no
 * está en el panel a la vista, sale de una consulta, y sin él no se
 * puede dar de alta un envío. Por eso se pide desde acá en lugar de
 * mandar a buscarlo.
 *
 * Ojo: este método vive en OTRO servicio. En producción es
 * `oep_tracking/Oep_Track.asmx` y no `ePak_tracking/Oep_TrackEPak.asmx`
 * como el resto; en el entorno de prueba ni siquiera termina en
 * `.asmx`. Usar la dirección del resto de los métodos devuelve un 404
 * que se lee como «no hay centros de costo».
 */
export async function centrosDeCosto(): Promise<{ id: string; nombre: string }[]> {
  /* [ERROR CORREGIDO] Acá había una sola dirección, copiada de su
     documentación, y en el entorno de prueba devolvía un 404 con una
     página de error de IIS. La documentación de este método está
     incompleta: vive en otro servicio que el resto —`Oep_Track` y no
     `Oep_TrackEPak`— y la dirección de prueba que publican ni
     siquiera termina en `.asmx`.
   *
     Con una sola dirección, un 404 se lee como «no tenés centros de
     costo», que es un diagnóstico equivocado sobre la cuenta a partir
     de un error de documentación. Se prueban las variantes razonables
     y gana la primera que conteste algo. */
  const candidatas = modoDeclarado() === 'produccion'
    ? [
      'https://webservice.oca.com.ar/oep_tracking/Oep_Track.asmx/GetCentroCostoPorOperativa',
      'https://webservice.oca.com.ar/ePak_tracking/Oep_TrackEPak.asmx/GetCentroCostoPorOperativa',
    ]
    : [
      'https://integraciones.ocadev.com.ar/epak_tracking_test/Oep_TrackEPak.asmx/GetCentroCostoPorOperativa',
      'https://integraciones.ocadev.com.ar/oep_tracking_test/Oep_Track.asmx/GetCentroCostoPorOperativa',
      'https://integraciones.ocadev.com.ar/epak_tracking_test/GetCentroCostoPorOperativa',
    ];

  const cuerpo = new URLSearchParams({ CUIT: cuit(), Operativa: operativa() }).toString();
  const errores: string[] = [];

  for (const url of candidatas) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: cuerpo,
      });
      const xml = await r.text();

      if (!r.ok) { errores.push(`${r.status} en ${url.split('/').slice(3).join('/')}`); continue; }
      /* Una página HTML no es una respuesta: es un error disfrazado. */
      if (/^\s*<(!DOCTYPE|html)/i.test(xml)) { errores.push(`HTML en ${url.split('/').slice(3).join('/')}`); continue; }

      const centros = filas(xml, 'Table', 'CentroCosto', 'Centro')
        .map((f) => ({
          id: f.idcentrocosto ?? f.centrocosto ?? f.nrocentrocosto ?? f.numerocentrocosto ?? '',
          nombre: f.descripcion ?? f.nombre ?? f.centrocostodescripcion ?? '',
        }))
        .filter((c) => c.id);

      if (centros.length) return centros;
      errores.push(`sin filas en ${url.split('/').slice(3).join('/')}`);
    } catch (e) {
      errores.push(`${e instanceof Error ? e.message : e} en ${url.split('/').slice(3).join('/')}`);
    }
  }

  throw new Error(`Ninguna dirección devolvió centros de costo. Se probaron: ${errores.join(' · ')}`);
}

export interface Sucursal {
  id: string;
  nombre: string;
  calle: string;
  numero: string;
  localidad: string;
  cp: string;
  /** Sólo las que admiten paquetes sirven como punto de despacho. */
  admitePaquetes: boolean;
  entregaPaquetes: boolean;
}

/**
 * Las sucursales que atienden un código postal.
 *
 * Sirve para dos cosas distintas y conviene no mezclarlas: para saber
 * **dónde dejás vos el paquete** (necesita admisión) y para ofrecerle
 * al comprador **dónde retirarlo** (necesita entrega). Una sucursal
 * puede tener una capacidad y no la otra.
 */
export async function sucursalesPorCP(cp: string): Promise<Sucursal[]> {
  const xml = await llamar('GetCentrosImposicionConServiciosByCP', {
    CodigoPostal: String(cp).trim(),
  });

  const vistas = new Map<string, Sucursal>();
  for (const f of filas(xml, 'Centro', 'Table')) {
    const id = f.idcentroimposicion ?? f.idcentro ?? '';
    if (!id) continue;

    /* Los servicios pueden venir en un campo llamado «Servicio», en
       uno llamado «Servicios», o como banderas sueltas del estilo
       «AdmitePaquetes». En vez de apostar a un nombre —que es
       exactamente el error que dejó esta lista vacía— se revisan
       todas las claves y todos los valores buscando las dos palabras
       que importan. */
    const texto = Object.entries(f)
      .map(([clave, valor]) => `${clave} ${valor}`)
      .join(' ')
      .toLowerCase();

    const previa = vistas.get(id);
    vistas.set(id, {
      id,
      nombre: f.sucursal ?? f.nombre ?? '',
      calle: (f.calle ?? '').trim(),
      numero: (f.numero ?? '').trim(),
      localidad: (f.localidad ?? '').trim(),
      cp: f.codigopostal ?? String(cp),
      admitePaquetes: (previa?.admitePaquetes ?? false) || /admis/.test(texto),
      entregaPaquetes: (previa?.entregaPaquetes ?? false) || /entrega/.test(texto),
    });
  }
  return [...vistas.values()];
}

/* ------------------------------------------------------------------ *
 * Despachar
 * ------------------------------------------------------------------ */

/** Escapa lo que va adentro de un atributo XML. */
function xmlSeguro(v: string | undefined, largo: number): string {
  return String(v ?? '')
    .slice(0, largo)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** `AAAAMMDD`, que es como OCA quiere la fecha de admisión. */
function fechaOCA(d = new Date()): string {
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${dd(d.getMonth() + 1)}${dd(d.getDate())}`;
}

export async function despachar(datos: DatosDeDespacho): Promise<Despacho> {
  if (!puedeDespachar()) {
    throw new Error('Faltan OCA_USUARIO, OCA_CLAVE y OCA_CUENTA para dar de alta un envío.');
  }

  /* El seguro. En producción esto crea una orden de retiro real: OCA
     queda esperando un paquete, y cancelarla es un trámite. Cotizar
     ahí es inofensivo y hace falta —el entorno de prueba no conoce
     las operativas propias—, así que el permiso para despachar se
     pide aparte y a mano. */
  if (modoDeclarado() === 'produccion' && !despachoRealPermitido()) {
    throw new Error(
      'Estás en producción y OCA_DESPACHO_REAL no dice «si». No se dio de alta el envío '
      + 'a propósito: sería una orden de retiro real. Cotizar sigue funcionando.',
    );
  }

  const o = origen();
  const paquetes = datos.cajas.map((c) =>
    `<paquete alto="${c.alto}" ancho="${c.ancho}" largo="${c.largo}" `
    + `peso="${c.peso.toFixed(2)}" valor="0" cant="1" />`).join('\n');

  /* El remito es nuestro número de pedido. Es el hilo que une el
     envío con el registro, igual que la referencia en el cobro. */
  const xml = `<?xml version="1.0" encoding="iso-8859-1" standalone="yes"?>
<ROWS>
  <cabecera ver="2.0" nrocuenta="${xmlSeguro(cuenta(), 10)}" origen="API" />
  <origenes>
    <origen calle="${xmlSeguro(variable('OCA_CALLE_ORIGEN'), 30)}"
            nro="${xmlSeguro(variable('OCA_NUMERO_ORIGEN'), 5)}"
            piso="" depto=""
            cp="${xmlSeguro(o.cp, 4)}"
            localidad="${xmlSeguro(o.localidad, 30)}"
            provincia="${xmlSeguro(o.provincia, 30)}"
            contacto="${xmlSeguro(variable('OCA_CONTACTO'), 30)}"
            email="${xmlSeguro(variable('OCA_EMAIL'), 100)}"
            solicitante="acentta" observaciones=""
            centrocosto="${xmlSeguro(centroDeCosto(), 10)}"
            idfranjahoraria="1"
            idcentroimposicionorigen="${xmlSeguro(variable('OCA_SUCURSAL_ORIGEN') || '0', 3)}"
            fecha="${fechaOCA()}">
      <envios>
        <envio idoperativa="${xmlSeguro(operativa(), 6)}" nroremito="${xmlSeguro(datos.numeroPedido, 30)}">
          <destinatario apellido="${xmlSeguro(datos.apellido, 30)}"
                        nombre="${xmlSeguro(datos.nombre, 30)}"
                        calle="${xmlSeguro(datos.entrega.calle, 30)}"
                        nro="${xmlSeguro(datos.entrega.numero, 5)}"
                        piso="${xmlSeguro(datos.entrega.piso, 6)}" depto=""
                        localidad="${xmlSeguro(datos.entrega.ciudad, 30)}"
                        provincia="${xmlSeguro(datos.entrega.provincia, 30)}"
                        cp="${xmlSeguro(datos.entrega.cp, 4)}"
                        telefono="${xmlSeguro(datos.telefono, 30)}"
                        email="${xmlSeguro(datos.email, 100)}"
                        idci="0"
                        celular="${xmlSeguro(datos.telefono, 15)}"
                        observaciones="${xmlSeguro(datos.entrega.referencias, 100)}" />
          <paquetes>
${paquetes}
          </paquetes>
        </envio>
      </envios>
    </origen>
  </origenes>
</ROWS>`;

  const respuesta = await llamar('IngresoORMultiplesRetiros_v2', {
    usr: usuario(),
    psw: clave(),
    XML_Datos: xml,
    /* Confirmado. Un envío sin confirmar queda en el carrito de e-Pak
       esperando que alguien entre a confirmarlo a mano, y toda la
       razón de esto es no tener tareas pendientes en dos lugares. */
    ConfirmarRetiro: 'true',
  }, 20000);

  const fila = filas(respuesta, 'Table')[0] ?? {};
  const orden = fila.idordenretiro ?? fila.ordenretiro ?? '';
  if (!orden) {
    throw new Error(`OCA no devolvió el número de orden. Respondió: ${respuesta.slice(0, 300)}`);
  }

  return {
    orden,
    /* El número de envío aparece con la orden; si no viene, se
       consulta después. Que falte no es una falla. */
    seguimiento: fila.numeroenvio ?? fila.nroenvio ?? null,
    estado: 'confirmado',
  };
}

/**
 * La etiqueta en PDF, que es la que se pega en la caja.
 *
 * Devuelve la dirección y no el archivo: OCA lo entrega en base64 y
 * moverlo por nuestra función para volver a servirlo sería mover un
 * PDF por gusto.
 */
export async function urlDeEtiqueta(orden: string): Promise<string> {
  const p = new URLSearchParams({ idOrdenRetiro: orden, logisticaInversa: 'false' });
  return `${base()}/GetPdfDeEtiquetasPorOrdenOrNumeroEnvioParaEtiquetadora?${p.toString()}`;
}

/* ------------------------------------------------------------------ *
 * El adaptador
 * ------------------------------------------------------------------ */

export const oca: Logistica = {
  nombre: 'oca',
  hayCredenciales,
  origen,
  cotizar,
  despachar,
  urlDeEtiqueta,
};
