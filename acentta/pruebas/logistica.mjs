/**
 * acentta · la integración con Envíopack
 * ---------------------------------------------------------------
 * Dos modos, y el segundo es el que contesta las preguntas que
 * todavía no sabemos responder.
 *
 *     node pruebas/logistica.mjs           sin red, con dobles
 *     node pruebas/logistica.mjs --vivo    contra la API de verdad
 *
 * EL MODO SIN RED corre siempre, en la auditoría, y verifica lo que
 * depende sólo de nuestro código: que las provincias se traduzcan al
 * código ISO que Envíopack espera, que las cajas salgan en su formato,
 * y —lo más importante— que **una caída del operador no voltee la
 * venta**: si Envíopack no contesta, se cotiza con la tabla propia y
 * el checkout sigue.
 *
 * EL MODO VIVO lo corrés vos cuando tengas credenciales. Contesta con
 * datos tres preguntas que hoy son suposiciones:
 *
 *   1. ¿Se puede operar desde Córdoba, o la cuenta está limitada a
 *      Buenos Aires como sugiere el cartel de «Mis direcciones»?
 *   2. ¿Cuánto cambia despachar desde sucursal contra esperar la
 *      colecta, y qué correos permiten cada una?
 *   3. ¿La cotización devuelve algo sin depósito configurado?
 *      La documentación dice que sin dirección por defecto no informa
 *      resultados, y eso desde afuera se lee como «no hay cobertura».
 *
 * No manda ningún paquete ni crea ningún envío: sólo consulta.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const VIVO = process.argv.includes('--vivo');

const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); };

/* Los dobles de sesión usan un token con largo realista a propósito.
   `buscarToken` descarta las cadenas de menos de veinte caracteres
   para no confundir un `{"token": "ok"}` con una sesión abierta, así
   que un doble que devuelva «tok» prueba otra cosa que la que cree
   probar: prueba el camino de falla. */
const TOKEN_DE_MENTIRA = 'token-de-prueba-con-largo-realista-0001';

/**
 * Cómo estaba el entorno antes de que esta prueba lo tocara.
 *
 * Varias secciones necesitan credenciales de mentira para forzar los
 * caminos de falla, y eso significa pisar las de verdad. Se guarda
 * acá el estado original y al final se comprueba que quedó como
 * estaba: una prueba que modifica la configuración de quien la corre
 * es una prueba que rompe lo que viene después, y el síntoma —«faltan
 * las credenciales» cuando no falta ninguna— manda a buscar el
 * problema al lugar equivocado.
 */
const ENTORNO_ORIGINAL = Object.fromEntries(
  ['ENVIOPACK_API_KEY', 'ENVIOPACK_SECRET_KEY', 'ENVIOPACK_DEPOSITO', 'ENVIOPACK_DESPACHO']
    .map((n) => [n, process.env[n]]),
);

/* ---- Cargar módulos del proyecto, igual que en las otras pruebas ---- */
function aliasDelProyecto() {
  const bruto = fs.readFileSync(path.join(RAIZ, 'tsconfig.json'), 'utf8');
  const limpio = bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const paths = JSON.parse(limpio).compilerOptions?.paths ?? {};
  return Object.fromEntries(Object.entries(paths).map(([c, d]) => [
    c.replace(/\/\*$/, ''), path.join(RAIZ, String(d[0]).replace(/\/\*$/, '')),
  ]));
}

function globDeYaml() {
  return { name: 'catalogo-sin-vite', setup(b) {
    b.onLoad({ filter: /src[\\/]data[\\/]productos\.ts$/ }, (args) => {
      const dir = path.join(RAIZ, 'src/contenido/productos');
      const mapa = Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'))
        .map((f) => [`../contenido/productos/${f}`, fs.readFileSync(path.join(dir, f), 'utf8')]));
      const src = fs.readFileSync(args.path, 'utf8')
        .replace(/import\.meta\.glob<string>\([\s\S]*?\)\s*;/, `${JSON.stringify(mapa)};`);
      return { contents: src, loader: 'ts', resolveDir: path.dirname(args.path) };
    });
  } };
}

async function cargar(entrada, nombre) {
  const r = await build({
    entryPoints: [path.join(RAIZ, entrada)],
    bundle: true, format: 'esm', write: false, platform: 'node',
    alias: aliasDelProyecto(), plugins: [globDeYaml()], packages: 'external',
  });
  const tmp = path.join(AQUI, `.${nombre}.mjs`);
  fs.writeFileSync(tmp, r.outputFiles[0].text);
  const mod = await import(`file://${tmp}?${Date.now()}`);
  fs.unlinkSync(tmp);
  return mod;
}

/* ============================================================
   1 · Las provincias, que es donde más silenciosamente se rompe
   ------------------------------------------------------------
   Envíopack quiere el código ISO sin el prefijo AR-. Mandarle el
   nombre no devuelve un error: devuelve una lista vacía, y desde
   afuera eso se lee como «el correo no llega a ese código postal».
   Un diagnóstico completamente equivocado a partir de un dato bien
   escrito.
   ============================================================ */
const EP = await cargar('src/lib/enviopack.ts', 'enviopack');
const { codigoDeProvincia, modoDeDespacho } = EP;

{
  const esperado = {
    'Córdoba': 'X', 'cordoba': 'X', 'CÓRDOBA': 'X', ' Córdoba ': 'X',
    'Buenos Aires': 'B',
    'CABA': 'C', 'caba': 'C', 'Capital Federal': 'C',
    'Ciudad Autónoma de Buenos Aires': 'C',
    'Santa Fe': 'S', 'santa fe': 'S',
    'Tucumán': 'T', 'tucuman': 'T',
    'Entre Ríos': 'E', 'Río Negro': 'R', 'Neuquén': 'Q',
    'Tierra del Fuego': 'V',
  };
  for (const [entrada, codigo] of Object.entries(esperado)) {
    const dio = codigoDeProvincia(entrada);
    ok(dio === codigo, `«${entrada}» dio «${dio}» y tendría que dar «${codigo}»`);
  }

  /* Córdoba es la nuestra: si ésta falla, no se cotiza ni un envío. */
  ok(codigoDeProvincia('Córdoba') === 'X',
    '¡GRAVE! Córdoba no se traduce: ningún envío propio se podría cotizar');

  /* Lo que NO se reconoce devuelve vacío y quien llama cotiza con la
     tabla. Nunca se adivina: una provincia equivocada devuelve la
     tarifa de otra punta del país, y esa sí se le cobra a alguien. */
  for (const basura of ['', '   ', 'Montevideo', 'XX', 'provincia', '123']) {
    ok(codigoDeProvincia(basura) === '',
      `«${basura}» tendría que devolver vacío y devolvió «${codigoDeProvincia(basura)}»`);
  }
}

/* ============================================================
   2 · De dónde sale el paquete
   ------------------------------------------------------------
   `modalidad` es a dónde llega; `despacho`, de dónde sale. Comparten
   las mismas dos letras y confundirlos no da error: da un envío
   esperando una colecta que nadie pidió, que es exactamente lo que
   se quiso evitar al elegir sucursal.
   ============================================================ */
{
  const antes = process.env.ENVIOPACK_DESPACHO;

  delete process.env.ENVIOPACK_DESPACHO;
  ok(modoDeDespacho() === 'S',
    'sin declarar, el despacho tiene que ser desde sucursal: es la decisión tomada '
    + 'y esperar la colecta agrega días');

  process.env.ENVIOPACK_DESPACHO = 'D';
  ok(modoDeDespacho() === 'D', 'declarando D tendría que quedar en colecta');

  process.env.ENVIOPACK_DESPACHO = 's';
  ok(modoDeDespacho() === 'S', 'la minúscula tendría que valer igual');

  process.env.ENVIOPACK_DESPACHO = 'cualquier cosa';
  ok(modoDeDespacho() === 'S', 'un valor inválido tiene que caer en sucursal, no en colecta');

  if (antes === undefined) delete process.env.ENVIOPACK_DESPACHO;
  else process.env.ENVIOPACK_DESPACHO = antes;
}

/* ============================================================
   2.b · Encontrar el token venga como venga
   ------------------------------------------------------------
   La documentación dice que la respuesta trae `access_token` en la
   raíz, y así estaba leído. La primera vez que Envíopack contestó de
   verdad, el token vino de otra forma y el mensaje fue «Envíopack no
   devolvió un token» — acusando a Envíopack de algo que hizo bien.

   Un 200 con sesión abierta no es una falla del servicio: es una
   forma que el lector no contemplaba. Se prueban las variantes
   razonables, y también que NO se tome el token de refresco, que
   dice «token» y no sirve para llamar: tomarlo daría un 401 en la
   llamada siguiente y mandaría a buscar el problema a las
   credenciales, que estarían bien.
   ============================================================ */
{
  const antes = { ...ENTORNO_ORIGINAL };
  process.env.ENVIOPACK_API_KEY = 'clave-de-mentira';
  process.env.ENVIOPACK_SECRET_KEY = 'secreto-de-mentira';

  const TOKEN = 'un-token-largo-de-mas-de-veinte-caracteres';
  const REFRESCO = 'un-token-de-refresco-que-no-sirve-para-llamar';

  const formas = [
    ['access_token en la raíz', { access_token: TOKEN }],
    ['accessToken en la raíz', { accessToken: TOKEN }],
    ['token en la raíz', { token: TOKEN }],
    ['envuelto en data', { data: { access_token: TOKEN } }],
    ['con el refresco al lado', { access_token: TOKEN, refresh_token: REFRESCO }],
    ['el refresco primero', { refresh_token: REFRESCO, access_token: TOKEN }],
  ];

  const fetchOriginal = globalThis.fetch;
  for (const [comoViene, respuesta] of formas) {
    EP.olvidarToken?.();
    let usado = '';
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/auth')) return { ok: true, json: async () => respuesta };
      usado = new URL(u).searchParams.get('access_token') ?? '';
      return { ok: true, text: async () => '[]' };
    };
    try {
      await EP.listarCorreos();
      ok(usado === TOKEN,
        `con el token ${comoViene} se usó «${usado.slice(0, 20)}…» en vez del de acceso`);
    } catch (e) {
      fallos.push(`con el token ${comoViene} no se pudo autenticar: ${e.message}`);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  }

  /* Y si de verdad no hay token, el mensaje tiene que decir qué
     forma tenía la respuesta, no acusar a Envíopack en abstracto. */
  EP.olvidarToken?.();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ mensaje: 'hola', codigo: 7 }) });
  try {
    await EP.listarCorreos();
    fallos.push('una respuesta sin token tendría que cortar y no cortó');
  } catch (e) {
    ok(/mensaje/.test(e.message) && /codigo/.test(e.message),
      `el error tendría que nombrar las claves de la respuesta y dijo: ${e.message}`);
    ok(!new RegExp(TOKEN).test(e.message), '¡GRAVE! el mensaje de error incluiría el token');
  } finally {
    globalThis.fetch = fetchOriginal;
    EP.olvidarToken?.();
  }

  for (const [n, v] of Object.entries(antes)) {
    if (v === undefined) delete process.env[n]; else process.env[n] = v;
  }
}

/* ============================================================
   3 · Las cajas
   ============================================================ */
const { cajaDe, comoParametro } = await cargar('src/lib/paquetes.ts', 'paquetes');
const { todos } = await cargar('src/lib/catalogo.ts', 'catalogo');

{
  const p = todos().find((x) => x.rubro === 'bazar') ?? todos()[0];
  const caja = cajaDe(p);

  ok(caja.alto > 0 && caja.ancho > 0 && caja.largo > 0, 'la caja salió con alguna medida en cero');
  ok(caja.alto >= p.dimensiones.alto, 'la caja es más baja que el producto que va adentro');
  ok(caja.ancho >= p.dimensiones.ancho, 'la caja es más angosta que el producto');

  ok(/^\d+x\d+x\d+$/.test(comoParametro([caja])), 'el formato de un paquete no es el que espera Envíopack');
  ok(comoParametro([caja, caja]).split(',').length === 2, 'dos paquetes tienen que ir separados por coma');

  /* Sin cajas, Envíopack asume una de 1×1×1 cm y cotiza cualquier
     cosa. Es preferible cortar que cotizar sobre una caja inventada. */
  let corto = false;
  try { comoParametro([]); } catch { corto = true; }
  ok(corto, '¡GRAVE! una lista de cajas vacía tendría que cortar: Envíopack asumiría 1×1×1 cm');
}

/* ============================================================
   3.b · OCA · el volumen, que es donde se pierde plata en silencio
   ------------------------------------------------------------
   OCA pide el volumen total en METROS CÚBICOS. Nuestras cajas están
   en centímetros, como las quiere el resto del sitio.

   Una caja de 27 × 16 × 11 son 4752 cm³, o sea 0,004752 m³.
   Mandar 4752 donde esperan 0,004752 cotiza un envío mil veces más
   grande y espanta al comprador con un precio absurdo. Al revés
   —mandar centímetros creyendo que son metros— cotiza ridículamente
   barato, se le cobra eso al comprador, y la diferencia aparece al
   despachar: la paga el vendedor.

   Ninguno de los dos errores da una excepción. Los dos dan un número
   que parece un número.
   ============================================================ */
const OCA = await cargar('src/lib/oca.ts', 'oca');

{
  const { volumenEnMetrosCubicos } = OCA;

  /* Un solo paquete del tamaño del Stanley. */
  ok(Math.abs(volumenEnMetrosCubicos('27x16x11') - 0.004752) < 1e-9,
    `27x16x11 cm son 0,004752 m³ y dio ${volumenEnMetrosCubicos('27x16x11')}`);

  /* Dos paquetes suman. */
  ok(Math.abs(volumenEnMetrosCubicos('27x16x11,27x16x11') - 0.009504) < 1e-9,
    'dos paquetes iguales tendrían que dar el doble de volumen');

  /* El caso redondo, para que se lea sin calculadora: un metro
     cúbico son cien centímetros de lado. */
  ok(Math.abs(volumenEnMetrosCubicos('100x100x100') - 1) < 1e-9,
    `un cubo de 100 cm de lado es 1 m³ y dio ${volumenEnMetrosCubicos('100x100x100')}`);

  /* Y el error de escala más probable: dividir por cien en vez de por
     un millón daría 47,52 en lugar de 0,004752. */
  ok(volumenEnMetrosCubicos('27x16x11') < 0.01,
    '¡GRAVE! el volumen salió en una escala equivocada: se cotizaría un envío enorme');

  /* Una caja chica no puede redondear a cero: con dos decimales,
     0,004752 se convertiría en 0 y OCA cotizaría sobre nada. */
  ok(volumenEnMetrosCubicos('10x10x10') > 0,
    '¡GRAVE! una caja chica redondeó a cero volumen');

  /* Sin cajas se corta, igual que en el otro operador. */
  let corto = false;
  try { volumenEnMetrosCubicos(''); } catch { corto = true; }
  ok(corto, 'sin paquetes tendría que cortar y no cortó');

  let cortoMal = false;
  try { volumenEnMetrosCubicos('27x16'); } catch { cortoMal = true; }
  ok(cortoMal, 'una medida incompleta tendría que cortar y no cortó');
}

/* ============================================================
   3.c · OCA · los números como los escribe un servicio argentino
   ------------------------------------------------------------
   El precio puede venir «1234.56» o «1234,56». Tomar la coma por
   separador de miles convierte $ 1.234,56 en $ 123.456, y ese número
   se le cobra a alguien.
   ============================================================ */
{
  const fetchOriginal = globalThis.fetch;
  const conPrecio = async (texto) => {
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => `<NewDataSet><Table><Tarifador>1</Tarifador>`
        + `<Precio>${texto}</Precio><Total>${texto}</Total>`
        + `<PlazoEntrega>3</PlazoEntrega></Table></NewDataSet>`,
    });
    try { return await OCA.cotizarDomicilio({ provincia: 'Córdoba', cp: '5000', peso: 0.6, paquetes: '27x16x11' }); }
    finally { globalThis.fetch = fetchOriginal; }
  };

  const antes = process.env.OCA_CUIT;
  process.env.OCA_CUIT = '30-53625919-4';

  ok((await conPrecio('9876.54'))?.costo === 9876.54, 'un precio con punto decimal se leyó mal');
  ok((await conPrecio('9876,54'))?.costo === 9876.54, 'un precio con coma decimal se leyó mal');
  ok((await conPrecio('1.234,56'))?.costo === 1234.56,
    '¡GRAVE! «1.234,56» se leyó como otra cosa: el punto es separador de miles acá');
  ok((await conPrecio('0'))?.costo === undefined, 'un precio en cero no es una tarifa válida');

  if (antes === undefined) delete process.env.OCA_CUIT; else process.env.OCA_CUIT = antes;
}

/* ============================================================
   3.d · OCA · leer la respuesta que manda de verdad
   ------------------------------------------------------------
   El XML de abajo no está inventado: es lo que devolvió el entorno
   de prueba de OCA para el código postal 5000.

   Se fija acá porque su respuesta de sucursales NO usa la misma
   etiqueta de fila que la de tarifas: las tarifas vienen en `Table`
   y las sucursales en `Centro`, dentro de `CentrosDeImposicion`. El
   lector suponía `Table` para todo y devolvió cero sucursales en
   Córdoba capital, donde OCA tiene varias.

   No dio error: dio una lista vacía, que es una respuesta legítima
   de la API. Lo encontró un diagnóstico que preguntó qué etiquetas
   llegaban, no una lectura del código.

   Y hay un detalle del formato que se prueba aparte porque es fácil
   de romper: **la misma sucursal viene repetida, una vez por
   servicio**. Contarlas sin unificar da el doble de sucursales de
   las que existen, y perder la unificación haría que una sucursal
   que sólo entrega parezca que también admite.
   ============================================================ */
{
  const RESPUESTA_REAL = `<?xml version="1.0" encoding="utf-8"?>
<CentrosDeImposicion>
  <Centro>
    <IdCentroImposicion>41</IdCentroImposicion><Sigla>COR</Sigla>
    <Sucursal>CORDOBA II</Sucursal><Calle>La Rioja </Calle><Numero>1142</Numero>
    <Torre> </Torre><Piso> </Piso><Depto> </Depto>
    <Localidad>CORDOBA</Localidad><CodigoPostal>5000</CodigoPostal>
    <Servicio>Admision de Paquetes</Servicio>
  </Centro>
  <Centro>
    <IdCentroImposicion>41</IdCentroImposicion><Sigla>COR</Sigla>
    <Sucursal>CORDOBA II</Sucursal><Calle>La Rioja </Calle><Numero>1142</Numero>
    <Localidad>CORDOBA</Localidad><CodigoPostal>5000</CodigoPostal>
    <Servicio>Entrega de Paquetes</Servicio>
  </Centro>
  <Centro>
    <IdCentroImposicion>77</IdCentroImposicion><Sigla>NCO</Sigla>
    <Sucursal>NUEVA CORDOBA</Sucursal><Calle>Independencia</Calle><Numero>500</Numero>
    <Localidad>CORDOBA</Localidad><CodigoPostal>5000</CodigoPostal>
    <Servicio>Entrega de Paquetes</Servicio>
  </Centro>
</CentrosDeImposicion>`;

  const fetchOriginal = globalThis.fetch;
  const antesCuit = process.env.OCA_CUIT;
  process.env.OCA_CUIT = '30-53625919-4';
  globalThis.fetch = async () => ({ ok: true, text: async () => RESPUESTA_REAL });

  try {
    const sucursales = await OCA.sucursalesPorCP('5000');

    ok(sucursales.length === 2,
      `¡GRAVE! se leyeron ${sucursales.length} sucursales y son 2: la fila es <Centro>, no <Table>`);

    const cordobaII = sucursales.find((s) => s.id === '41');
    const nueva = sucursales.find((s) => s.id === '77');

    ok(cordobaII?.nombre === 'CORDOBA II', 'no se leyó el nombre de la sucursal');
    ok(cordobaII?.calle === 'La Rioja', 'el nombre de calle vino con espacios y no se recortó');
    ok(cordobaII?.numero === '1142', 'no se leyó la altura');

    /* Lo que decide dónde podés dejar el paquete. */
    ok(cordobaII?.admitePaquetes === true,
      '¡GRAVE! Córdoba II admite paquetes y quedó como que no: es dónde vas a despachar');
    ok(nueva?.admitePaquetes === false,
      '¡GRAVE! Nueva Córdoba sólo entrega y quedó como que admite: ir a despachar ahí es un viaje perdido');
    ok(nueva?.entregaPaquetes === true, 'Nueva Córdoba entrega y quedó como que no');

    /* El diagnóstico tiene que descubrir la fila solo, sin heredar la
       suposición que está diagnosticando. */
    const crudo = await OCA.camposDeLaRespuesta('X', {});
    ok(crudo.fila === 'Centro',
      `el diagnóstico detectó la fila «${crudo.fila}» y es «Centro»`);
    ok(crudo.campos.includes('IdCentroImposicion') && crudo.campos.includes('Servicio'),
      'el diagnóstico no listó los campos que hacen falta para corregir un mapeo');
  } finally {
    globalThis.fetch = fetchOriginal;
    if (antesCuit === undefined) delete process.env.OCA_CUIT;
    else process.env.OCA_CUIT = antesCuit;
  }
}

/* ============================================================
   4 · LO IMPORTANTE · si el operador se cae, la venta sigue
   ------------------------------------------------------------
   Esto corre dentro del checkout. Un operador logístico caído no
   puede ser una tienda caída. Se prueban las tres formas en que un
   servicio ajeno falla —error, demora y respuesta vacía— y en las
   tres el pedido tiene que cotizarse igual, con la tabla propia.
   ============================================================ */
{
  /* [ERROR CORREGIDO] Esta sección necesita credenciales de mentira
     para forzar los caminos de falla, y al terminar las borraba con
     `delete`. El problema es que borraba también las de verdad: quien
     hubiera cargado las suyas en la terminal para después correr el
     modo vivo se las encontraba desaparecidas, y el modo vivo decía
     «faltan las credenciales» sin que faltara ninguna.

     Un diagnóstico que miente sobre su propia configuración es peor
     que no tenerlo. Ahora se guardan y se reponen, como ya se hacía
     con el modo de despacho unas líneas más arriba — la costumbre
     estaba, faltaba aplicarla acá. */
  const credencialesReales = {
    ENVIOPACK_API_KEY: process.env.ENVIOPACK_API_KEY,
    ENVIOPACK_SECRET_KEY: process.env.ENVIOPACK_SECRET_KEY,
    LOGISTICA: process.env.LOGISTICA,
  };
  const reponerCredenciales = () => {
    for (const [nombre, valor] of Object.entries(credencialesReales)) {
      if (valor === undefined) delete process.env[nombre];
      else process.env[nombre] = valor;
    }
    /* El token en memoria se pidió con las credenciales de mentira:
       si quedara, el modo vivo lo reutilizaría y fallaría al llamar. */
    EP.olvidarToken?.();
  };

  /* Esta sección prueba la RED DE SEGURIDAD, que es del contrato y no
     de un operador: sea quien sea el activo, si se cae hay que vender
     igual. Se fija Envíopack porque sus respuestas son JSON y el
     doble se lee; la garantía que se verifica vale para los dos.

     Antes esto no fijaba operador y funcionó hasta que OCA pasó a ser
     el de fábrica: entonces los dobles seguían simulando Envíopack
     mientras el código llamaba a OCA, y las tres comprobaciones
     fallaban sin que hubiera ningún defecto. Un doble que simula al
     que no está corriendo no prueba nada. */
  process.env.LOGISTICA = 'enviopack';
  process.env.ENVIOPACK_API_KEY = 'clave-de-mentira';
  process.env.ENVIOPACK_SECRET_KEY = 'secreto-de-mentira';

  const { cotizarConCorreo } = await cargar('src/lib/tarifa.ts', 'tarifa');
  const p = todos().find((x) => x.variantes.some((v) => v.stock > 0));
  const barato = todos().find((x) => x.precio < 50000 && x.variantes.some((v) => v.stock > 0));
  const linea = [{ id: (barato ?? p).id, cantidad: 1 }];
  const destino = { cp: '5000', provincia: 'Córdoba', ciudad: 'Córdoba' };

  const fetchOriginal = globalThis.fetch;

  /* Las caídas de acá abajo son provocadas, y `tarifa.ts` las anota
     en el registro —como corresponde en producción—. Acá ese registro
     llena la pantalla de rastros de pila mientras la prueba pasa, y
     una prueba que al pasar parece que reventó enseña a no mirarla.
     Se silencia sólo durante estas llamadas. */
  const conFetch = async (fn, queEs = 'la cotización') => {
    const errorOriginal = console.error;
    globalThis.fetch = fn;
    console.error = () => {};
    EP.olvidarToken?.();
    try {
      return await cotizarConCorreo(linea, destino);
    } catch (e) {
      /* Que la excepción suba hasta acá ya es el defecto: significa
         que un problema del operador logístico llegó al checkout.
         Se anota con nombre en vez de dejar que reviente la corrida
         con un rastro de pila: una prueba tiene que decir qué pasó,
         no obligar a leer el rastro para deducirlo. */
      fallos.push(`¡GRAVE! ${queEs} dejó escapar un error de Envíopack al checkout: ${e.message}`);
      return { total: 0, subtotal: 0, envio: 0, fuenteEnvio: 'ninguna' };
    } finally {
      globalThis.fetch = fetchOriginal;
      console.error = errorOriginal;
    }
  };

  /* a · Envíopack contesta una tarifa: manda la del correo. */
  const conTarifa = await conFetch(async (url) => {
    const u = String(url);
    if (u.includes('/auth')) return { ok: true, json: async () => ({ access_token: TOKEN_DE_MENTIRA }) };
    return { ok: true, text: async () => JSON.stringify([
      { valor: '9999', horas_entrega: 48, servicio: 'N', correo: { id: 'oca', nombre: 'OCA' } },
    ]) };
  });
  if (!conTarifa.envioGratis) {
    ok(conTarifa.envio === 9999, `la tarifa del correo no se usó: quedó en ${conTarifa.envio}`);
    ok(conTarifa.fuenteEnvio === 'operador', 'no quedó registrado que la tarifa vino del operador');
    ok(conTarifa.correo === 'OCA', 'no se guardó qué correo lo lleva');
  }

  /* b · Envíopack devuelve un error. */
  const conError = await conFetch(async (url) => {
    if (String(url).includes('/auth')) return { ok: true, json: async () => ({ access_token: TOKEN_DE_MENTIRA }) };
    return { ok: false, status: 500, text: async () => 'se cayó' };
  }, 'un error del operador');
  ok(conError.total > 0, '¡GRAVE! un error de Envíopack dejó la venta sin cotizar');
  ok(conError.fuenteEnvio === 'tabla', 'con Envíopack caído la tarifa tendría que salir de la tabla');

  /* c · Envíopack no contesta nunca. Es el caso peor: no falla,
         cuelga. Una venta perdida por lentitud es peor que un envío
         cotizado con la tabla. */
  const colgado = await conFetch(async (url) => {
    if (String(url).includes('/auth')) return { ok: true, json: async () => ({ access_token: TOKEN_DE_MENTIRA }) };
    throw Object.assign(new Error('se agotó el tiempo'), { name: 'TimeoutError' });
  }, 'una demora del operador');
  ok(colgado.total > 0, '¡GRAVE! una demora de Envíopack dejó la venta sin cotizar');
  ok(colgado.fuenteEnvio === 'tabla', 'con Envíopack colgado la tarifa tendría que salir de la tabla');

  /* d · Envíopack contesta bien pero sin cotizaciones. Es lo que pasa
         cuando falta el depósito, y es el caso que más engaña porque
         no hay ningún error a la vista. */
  const vacio = await conFetch(async (url) => {
    if (String(url).includes('/auth')) return { ok: true, json: async () => ({ access_token: TOKEN_DE_MENTIRA }) };
    return { ok: true, text: async () => '[]' };
  }, 'una respuesta vacía');
  ok(vacio.total > 0, '¡GRAVE! una lista vacía dejó la venta sin cotizar');
  ok(vacio.fuenteEnvio === 'tabla', 'sin cotizaciones la tarifa tendría que salir de la tabla');

  /* e · Sin credenciales no se sale a la red siquiera. */
  delete process.env.ENVIOPACK_API_KEY;
  delete process.env.ENVIOPACK_SECRET_KEY;
  let llamadas = 0;
  const sinCredenciales = await conFetch(async () => { llamadas++; return { ok: true, text: async () => '[]' }; });
  ok(llamadas === 0, 'sin credenciales no habría que llamar a Envíopack y se llamó');
  ok(sinCredenciales.fuenteEnvio === 'tabla', 'sin credenciales la tarifa tiene que salir de la tabla');

  /* f · Y el navegador sigue sin poder decidir el precio, tenga o no
         tarifa del correo. */
  process.env.ENVIOPACK_API_KEY = 'clave-de-mentira';
  process.env.ENVIOPACK_SECRET_KEY = 'secreto-de-mentira';
  const adulterado = await conFetch(async (url) => {
    if (String(url).includes('/auth')) return { ok: true, json: async () => ({ access_token: TOKEN_DE_MENTIRA }) };
    return { ok: true, text: async () => JSON.stringify([{ valor: '9999', horas_entrega: 48 }]) };
  });
  const intento = await (async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/auth')) return { ok: true, json: async () => ({ access_token: TOKEN_DE_MENTIRA }) };
      return { ok: true, text: async () => JSON.stringify([{ valor: '1', horas_entrega: 48 }]) };
    };
    EP.olvidarToken?.();
    try {
      return await cotizarConCorreo(
        [{ ...linea[0], precio: 1, envio: 0, total: 1 }], destino,
      );
    } finally { globalThis.fetch = fetchOriginal; }
  })();
  ok(intento.subtotal === adulterado.subtotal,
    '¡GRAVE! un precio mandado por el navegador cambió el subtotal');

  /* Se devuelven las credenciales que había antes de esta sección.
     El modo vivo corre después y las necesita. */
  reponerCredenciales();
}

/* ============================================================
   5 · MODO VIVO · preguntarle a Envíopack de verdad
   ============================================================ */
if (VIVO) {
  console.log('\n=== CONSULTA REAL AL OPERADOR ACTIVO ===\n');

  const operador = process.env.LOGISTICA?.toLowerCase() === 'enviopack' ? 'enviopack' : 'oca';
  console.log(`  Operador: ${operador}`);

  const p = todos().find((x) => x.rubro === 'bazar') ?? todos()[0];
  const caja = comoParametro([cajaDe(p)]);
  const peso = p.peso;

  if (operador === 'oca') {
    /* OCA publica credenciales de prueba en su documentación, igual
       que Mobbex. Si no hay propias cargadas se usan ésas: sirve para
       ver el circuito entero sin depender de que nadie conteste. */
    const propias = Boolean(process.env.OCA_CUIT);
    if (!propias) {
      process.env.OCA_CUIT = '30-53625919-4';
      process.env.OCA_OPERATIVA = process.env.OCA_OPERATIVA || '94584';
      console.log('  Credenciales: las públicas de prueba de OCA (cuenta 111757/001)');
    } else {
      console.log('  Credenciales: las tuyas');
    }
    console.log(`  Origen declarado: CP ${OCA.origen().cp} · ${OCA.origen().provincia}`);
    console.log(`  Operativa: ${process.env.OCA_OPERATIVA || '94584'} (sucursal a puerta)`);
    console.log(`  Producto: ${p.nombre}`);
    console.log(`  Paquete ${caja} cm · ${peso} kg · ${OCA.volumenEnMetrosCubicos(caja)} m³\n`);

    const destinos = [
      ['Córdoba capital', 'Córdoba', '5000'],
      ['CABA', 'CABA', '1425'],
      ['Rosario', 'Santa Fe', '2000'],
      ['Bariloche', 'Río Negro', '8400'],
    ];

    let algunaCotizo = false;
    for (const [nombre, provincia, cp] of destinos) {
      try {
        const t = await OCA.cotizarDomicilio({
          provincia, cp, peso, paquetes: caja, valorDeclarado: p.precio,
        });
        if (t) {
          algunaCotizo = true;
          console.log(`  ${nombre.padEnd(16)} $${String(Math.round(t.costo)).padStart(8)}  ${t.diasExtra} días hábiles`);
        } else {
          console.log(`  ${nombre.padEnd(16)} sin cotización`);
        }
      } catch (e) {
        console.log(`  ${nombre.padEnd(16)} ✗ ${e.message.slice(0, 160)}`);
      }
    }

    console.log('\n  ─────────────── CONCLUSIÓN ───────────────');
    if (algunaCotizo) {
      console.log('  OCA cotiza desde Córdoba. El código postal de origen es un parámetro:');
      console.log('  no hay lista de provincias que limite el punto de partida, que es');
      console.log('  exactamente lo que dejó afuera a Envíopack.');
      console.log('');
      if (!propias) {
        /* Advertencia que vale más que los números: el entorno de
           prueba de OCA responde con el tarifario de su cuenta de
           demostración. Sirve para comprobar que el circuito anda y
           que el origen se acepta; no sirve para decidir precios.
           Tomar estos importes por reales y fijar el umbral de envío
           gratis con ellos sería un error caro y difícil de notar. */
        console.log('');
        console.log('  ⚠ Estos importes NO son tarifas reales: salen del tarifario de la cuenta');
        console.log('    de demostración en el entorno de prueba. Sirven para verificar que el');
        console.log('    circuito funciona y que el origen se acepta, no para fijar precios.');
        console.log('    Que falten destinos —CABA, Rosario— también es del entorno de prueba:');
        console.log('    su tarifario de laboratorio no cubre todo el país.');
      } else {
        console.log('');
        console.log('  Compará estos importes con la tabla propia (npm run auditar:envio).');
        console.log('  Si OCA sale más caro que lo que cobrás hoy, la diferencia la ponés vos');
        console.log('  en cada venta: ahí conviene revisar el umbral de envío gratis.');
      }
      console.log('');
      console.log('  Siguiente paso: pedirle a OCA tu operativa, tu número de cuenta y un');
      console.log('  usuario de e-Pak. Con eso se pasa de cotizar a despachar, y recién ahí');
      console.log('  los números son los tuyos.');
    } else {
      console.log('  Ninguna cotización. Con las credenciales públicas eso suele significar');
      console.log('  que el entorno de prueba de OCA está caído; con las tuyas, que la');
      console.log('  operativa declarada no corresponde a tu cuenta.');
    }

    /* Se busca una sucursal de admisión en Córdoba: es a dónde vas a
       llevar el paquete, y sin una cerca la decisión de despachar
       desde sucursal deja de tener sentido. */
    try {
      const sucursales = await OCA.sucursalesPorCP(OCA.origen().cp);
      const admiten = sucursales.filter((s) => s.admitePaquetes);
      console.log(`\n  Sucursales OCA en CP ${OCA.origen().cp}: ${sucursales.length}`
        + ` (${admiten.length} admiten paquetes)`);
      for (const s of admiten.slice(0, 5)) {
        console.log(`     ${s.id.padEnd(5)} ${s.nombre} · ${s.calle} ${s.numero}`);
      }
      if (admiten.length === 0 && sucursales.length > 0) {
        console.log('     Ninguna admite paquetes: habría que despachar desde otro CP.');
      }

      /* Cero sucursales en una capital de provincia no es un dato:
         es un síntoma. OCA tiene varias en Córdoba, así que lo más
         probable es que los nombres de los campos no sean los que
         supuse al escribir el mapeo. Un mapeo equivocado devuelve
         lista vacía, que es una respuesta legítima y por eso engaña.

         En vez de dejarlo como «no hay», se pregunta qué campos vino
         de verdad. Con eso se corrige el mapeo en una línea. */
      if (sucursales.length === 0) {
        console.log('\n     ⚠ Cero sucursales en una capital de provincia es raro.');
        console.log('       Probablemente el mapeo de campos esté mal. Lo que llegó:');
        const crudo = await OCA.camposDeLaRespuesta(
          'GetCentrosImposicionConServiciosByCP', { CodigoPostal: OCA.origen().cp },
        );
        console.log(`       fila:      <${crudo.fila}>`);
        console.log(`       campos:    ${crudo.campos.join(', ') || '(ninguno)'}`);
        if (crudo.campos.length === 0) {
          console.log(`       muestra:   ${crudo.muestra.replace(/\s+/g, ' ').slice(0, 240)}`);
        }
      }
    } catch (e) {
      console.log(`\n  Sucursales: ✗ ${e.message.slice(0, 160)}`);
    }

    if (!propias) delete process.env.OCA_CUIT;
  } else {
    console.log('\n  El modo vivo de Envíopack quedó documentado en el historial del proyecto:');
    console.log('  su formulario sólo acepta CABA y Buenos Aires como provincia de origen,');
    console.log('  así que no se puede operar desde Córdoba. Se dejó el adaptador escrito');
    console.log('  para el día que haya un depósito en el AMBA.');
  }
}

/* ============================================================ */
console.log('\n=== LOGÍSTICA · OCA y Envíopack, intercambiables ===');
console.log('  OCA · el volumen va en metros cúbicos, no en centímetros');
console.log('  OCA · «1.234,56» son mil doscientos treinta y cuatro pesos, no ciento veintitrés mil');
console.log('  Envíopack · las provincias se traducen al código ISO que espera su API');
console.log('  el despacho sale de sucursal salvo que se declare colecta');
console.log('  las cajas nunca se mandan vacías: 1×1×1 cotizaría cualquier cosa');
console.log('  si el operador falla, tarda o no devuelve nada, la venta sigue con la tabla');
if (!VIVO) console.log('\n  (para consultar la API de verdad: npm run logistica:vivo)');

if (fallos.length) {
  console.log(`\n  ${fallos.length} problema(s):`);
  for (const f of fallos) console.log(`   · ${f}`);
  process.exit(1);
}
console.log('\n✓ la logística resiste que el operador no esté\n');
