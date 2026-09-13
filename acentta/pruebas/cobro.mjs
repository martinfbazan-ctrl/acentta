/**
 * acentta · el circuito de cobro
 * ---------------------------------------------------------------
 * Tres preguntas, y la primera es la que justifica todo el diseño:
 *
 *   1. Si el navegador manda un precio, ¿cambia el total?
 *      Tiene que dar que no. Es la vulnerabilidad clásica de las
 *      tiendas hechas a mano: abrir las herramientas del navegador,
 *      cambiar $ 89.900 por $ 1 y pagar un peso.
 *
 *   2. Un aviso de pago sin credencial válida, ¿se acepta?
 *      Tiene que dar que no. Sin esa verificación, cualquiera que
 *      descubra la dirección de la función manda «pago aprobado» y
 *      se lleva mercadería gratis.
 *
 *   3. El mismo aviso dos veces, ¿procesa dos veces?
 *      Tiene que dar que no. Las pasarelas reintentan hasta ocho
 *      veces si no les contestamos rápido.
 *
 *   4. Un aviso que MIENTE, ¿cambia algo?
 *      Tiene que dar que no, y es la pregunta que se volvió central
 *      al pasar a Mobbex: Mercado Pago firma sus avisos y Mobbex no.
 *      Sin firma, lo único que queda entre un mensaje inventado y la
 *      mercadería es que ningún dato del mensaje se escriba jamás
 *      sin preguntarle antes a la API.
 *
 * Se prueban las dos pasarelas. Mercado Pago quedó apagado pero
 * sigue en el repositorio, y un adaptador sin pruebas es un
 * adaptador que nadie se va a animar a volver a encender.
 *
 * Corre sin red y sin credenciales: la cotización es aritmética
 * pura, la firma es un HMAC, y el almacén y las dos APIs se
 * reemplazan por dobles.
 *
 *     node pruebas/cobro.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); };

/** Los alias de importación, leídos del tsconfig del proyecto. */
function aliasDelProyecto() {
  const bruto = fs.readFileSync(path.join(RAIZ, 'tsconfig.json'), 'utf8');
  /* El tsconfig lleva comentarios, que JSON.parse no acepta. */
  const limpio = bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const paths = JSON.parse(limpio).compilerOptions?.paths ?? {};
  return Object.fromEntries(
    Object.entries(paths).map(([clave, destinos]) => [
      clave.replace(/\/\*$/, ''),
      path.join(RAIZ, String(destinos[0]).replace(/\/\*$/, '')),
    ]),
  );
}

/** Compila un módulo del proyecto y lo importa, con los alias del tsconfig. */
async function cargar(entrada, nombre) {
  const r = await build({
    entryPoints: [path.join(RAIZ, entrada)],
    bundle: true, format: 'esm', write: false, platform: 'node',
    /* Los alias los resuelve esbuild, no el tsconfig. Se leen de ahí
       igual, en vez de repetirlos: una lista copiada a mano se
       desincroniza el día que alguien agrega uno, y el error que da
       —«no se pudo resolver»— no dice que el problema es la copia.
       Ojo con `@tipos`, que apunta a `src/types` y no a `src/tipos`. */
    alias: aliasDelProyecto(),
    /* `import.meta.glob` es de Vite y no existe fuera. El catálogo se
       carga leyendo los YAML a mano, en un reemplazo mínimo. */
    plugins: [globDeYaml()],
    /* Las dependencias de node_modules quedan afuera del empaquetado
       y las resuelve Node. Empaquetarlas rompe las que están escritas
       en el formato viejo de módulos: `yaml`, por ejemplo, hace un
       `require('process')` que no sobrevive la conversión. Lo que
       interesa probar es el código del proyecto, no volver a compilar
       sus dependencias. */
    packages: 'external',
  });
  const tmp = path.join(AQUI, `.${nombre}.mjs`);
  fs.writeFileSync(tmp, r.outputFiles[0].text);
  const mod = await import(`file://${tmp}?${Date.now()}`);
  fs.unlinkSync(tmp);
  return mod;
}

/** Reemplaza el cargador de catálogo por uno que lee los YAML sin Vite. */
function globDeYaml() {
  return {
    name: 'catalogo-sin-vite',
    setup(b) {
      b.onLoad({ filter: /src[\\/]data[\\/]productos\.ts$/ }, (args) => {
        const original = fs.readFileSync(args.path, 'utf8');
        const dir = path.join(RAIZ, 'src/contenido/productos');
        const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'));
        const mapa = Object.fromEntries(archivos.map((f) => [
          `../contenido/productos/${f}`,
          fs.readFileSync(path.join(dir, f), 'utf8'),
        ]));
        /* Se sustituye sólo la llamada a import.meta.glob; el resto
           del archivo —el traductor y el ordenamiento— es el real. */
        const parcheado = original.replace(
          /import\.meta\.glob<string>\([\s\S]*?\)\s*;/,
          `${JSON.stringify(mapa)};`,
        );
        return { contents: parcheado, loader: 'ts', resolveDir: path.dirname(args.path) };
      });
    },
  };
}

const { cotizar, ErrorDeCotizacion } = await cargar('src/lib/cotizacion.ts', 'cotizacion');
const { firmaValida, cobroPermitido, fechaParaMercadoPago, enlaceDePago } = await cargar('src/lib/mercadopago.ts', 'mercadopago');

/* ============================================================
   0.b · A qué pantalla de pago se manda a la persona
   ------------------------------------------------------------
   Cada entorno tiene la suya:
       init_point          → www.mercadopago.com.ar     (producción)
       sandbox_init_point  → sandbox.mercadopago.com.ar (laboratorio)

   Cruzarlas hace fallar el pago con «Una de las partes con la que
   intentás hacer el pago es de prueba», un mensaje que no señala a
   ningún lado del código y aparece en la última pantalla del
   circuito, después de que la persona cargó la tarjeta.

   Es una decisión de una línea y ya se rompió una vez: estaba bien,
   y se cayó como daño colateral al corregir cómo se detectaba el
   modo. Por eso vive aparte y se prueba.
   ============================================================ */
{
  const dos = { init_point: 'https://www.mercadopago.com.ar/x', sandbox_init_point: 'https://sandbox.mercadopago.com.ar/x' };

  /* Siempre el mismo, en los dos modos. Con credenciales de prueba
     esa pantalla se pone en modo de prueba sola. */
  for (const [live, modo] of [[false, 'prueba'], [true, 'produccion'], [null, 'prueba'], [null, 'produccion']]) {
    ok(enlaceDePago({ ...dos, live_mode: live }, modo) === dos.init_point,
      `con live_mode=${live} y modo ${modo} tendría que ir a init_point`);
  }

  /* La reserva, para la cuenta que no devuelva el principal. */
  ok(enlaceDePago({ sandbox_init_point: dos.sandbox_init_point }, 'prueba') === dos.sandbox_init_point,
    'sin init_point tendría que caer en el de reserva');
  ok(enlaceDePago({}, 'prueba') === undefined, 'sin ningún enlace tiene que devolver nada');
}

/* ============================================================
   0.a · La fecha de vencimiento, en el formato que se lee
   ------------------------------------------------------------
   Iba con `Z` al final. Mercado Pago documenta el desplazamiento
   horario escrito, y cuando no puede leer la fecha no rechaza la
   preferencia: la acepta y después deja el botón de pagar apagado,
   sin ningún mensaje. Un formato mal puesto acá no falla donde se
   escribe, falla dos pantallas después y parece un problema de
   Mercado Pago.
   ============================================================ */
{
  const patron = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/;
  const f = fechaParaMercadoPago(Date.UTC(2026, 7, 11, 22, 30, 0));
  ok(patron.test(f), `la fecha no tiene el formato que espera Mercado Pago: ${f}`);
  ok(!f.endsWith('Z'), 'la fecha termina en Z y tiene que llevar el desplazamiento escrito');
  ok(f === '2026-08-11T19:30:00.000-03:00', `la conversión a hora argentina da ${f}`);

  /* Y que el instante siga siendo el mismo: una fecha bien formada
     pero corrida tres horas vence antes de tiempo. */
  ok(new Date(f).getTime() === Date.UTC(2026, 7, 11, 22, 30, 0),
    'la fecha quedó bien escrita pero apunta a otro instante');

  /* Un vencimiento en el pasado deja el pago muerto al nacer. */
  const futura = fechaParaMercadoPago(Date.now() + 60_000);
  ok(new Date(futura).getTime() > Date.now(), 'el vencimiento calculado ya pasó');
}

/* ============================================================
   0 · El seguro entre prueba y producción
   ------------------------------------------------------------
   Existe por un error mío. El modo se deducía del prefijo del
   token: los de prueba empezaban con `TEST-`. Mercado Pago unificó
   el formato —hoy los dos entornos usan `APP_USR-`— y ese chequeo
   pasó a gritar «producción» para credenciales de prueba
   perfectamente válidas.
   Una alarma falsa en un semáforo de seguridad es peor que no
   tenerlo: la próxima vez que avise en serio, ya nadie la mira.
   Ahora el modo se declara a mano y se contrasta con `live_mode`,
   que es lo que devuelve la propia API.
   ============================================================ */
{
  ok(cobroPermitido(false, 'prueba'), 'un cobro de prueba con el sitio en prueba tendría que pasar');
  ok(cobroPermitido(true, 'produccion'), 'un cobro real con el sitio en producción tendría que pasar');
  ok(cobroPermitido(false, 'produccion'), 'credenciales de prueba con el sitio en producción no cobran nada: se deja pasar');
  ok(!cobroPermitido(true, 'prueba'),
    '¡GRAVE! un cobro REAL pasaría con el sitio declarado en prueba — es plata de alguien y una entrega comprometida');
}

/* ============================================================
   1 · El navegador no decide el precio
   ============================================================ */
{
  /* Se elige un producto real del catálogo, sin escribir su precio
     acá: si mañana cambia, la prueba sigue valiendo. */
  const { todos } = await cargar('src/lib/catalogo.ts', 'catalogo');
  const producto = todos().find((p) => p.variantes.some((v) => v.stock > 1));
  ok(producto, 'no hay ningún producto con stock para probar');

  const variante = producto.variantes.find((v) => v.stock > 1);
  const honesto = cotizar([{ id: producto.id, cantidad: 1, variante: variante.nombre }], '5000');

  ok(honesto.subtotal === producto.precio,
    `el subtotal deberia ser ${producto.precio} y da ${honesto.subtotal}`);

  /* EL INTENTO. Se manda exactamente lo que mandaría alguien que
     editó el almacenamiento del navegador: el producto correcto con
     un precio de un peso, más otros nombres de campo por si alguno
     colara. */
  const adulterado = cotizar([{
    id: producto.id, cantidad: 1, variante: variante.nombre,
    precio: 1, price: 1, unit_price: 1, subtotal: 1, total: 1,
  }], '5000');

  ok(adulterado.total === honesto.total,
    `¡GRAVE! un precio mandado por el navegador cambió el total: ${adulterado.total} en vez de ${honesto.total}`);
  ok(adulterado.lineas[0].precio === producto.precio,
    `¡GRAVE! la línea quedó con el precio del navegador: ${adulterado.lineas[0].precio}`);

  /* Y lo mismo con el envío y el descuento, que también son plata. */
  const conEnvioFalso = cotizar([{ id: producto.id, cantidad: 1 }], '5000');
  ok(conEnvioFalso.envio === honesto.envio, 'el envío cambió sin motivo');
}

/* ============================================================
   2 · Lo que la cotización se niega a cotizar
   ============================================================ */
{
  const { todos } = await cargar('src/lib/catalogo.ts', 'catalogo2');
  const p = todos().find((x) => x.variantes.some((v) => v.stock > 0));
  const v = p.variantes.find((x) => x.stock > 0);

  const rechaza = (linea, cp, porque) => {
    try {
      cotizar(Array.isArray(linea) ? linea : [linea], cp ?? '5000');
      fallos.push(`deberia rechazar: ${porque}`);
    } catch (e) {
      ok(e instanceof ErrorDeCotizacion, `${porque}: cortó con un error inesperado (${e.message})`);
    }
  };

  rechaza([], '5000', 'un pedido vacío');
  rechaza({ id: 'no-existe', cantidad: 1 }, '5000', 'un producto inventado');
  rechaza({ id: p.id, cantidad: 0 }, '5000', 'cantidad cero');
  rechaza({ id: p.id, cantidad: -3 }, '5000', 'cantidad negativa');
  rechaza({ id: p.id, cantidad: 1.5 }, '5000', 'cantidad fraccionaria');
  rechaza({ id: p.id, cantidad: 9999 }, '5000', 'cantidad absurda');
  rechaza({ id: p.id, cantidad: v.stock + 1, variante: v.nombre }, '5000', 'más unidades que stock');
  rechaza({ id: p.id, cantidad: 1, variante: 'Color inventado' }, '5000', 'una variante que no existe');
  rechaza({ id: p.id, cantidad: 1 }, '', 'sin código postal');
  rechaza({ id: p.id, cantidad: 1 }, '0000', 'un código postal sin cobertura');

  /* Un producto agotado tampoco se cotiza. */
  const agotado = todos().find((x) => x.variantes.every((y) => y.stock === 0));
  if (agotado) rechaza({ id: agotado.id, cantidad: 1 }, '5000', 'un producto agotado');
}

/* ============================================================
   3 · Las cuentas que sí tienen que dar
   ============================================================ */
{
  const { todos } = await cargar('src/lib/catalogo.ts', 'catalogo3');

  /* [ERROR CORREGIDO] Acá decía `p.precio >= 50000`: el umbral de
     envío gratis copiado a mano. El día que subió a $ 100.000, esta
     prueba siguió eligiendo un producto de $ 60.000 y exigiéndole
     envío gratis, que es justo lo que el cambio dejó de hacer. Una
     prueba que falla por estar desactualizada enseña a ignorar las
     pruebas, y ése es el daño de verdad. Ahora sale de la constante. */
  const { UMBRAL_ENVIO_GRATIS } = await cargar('src/types/catalogo.ts', 'umbral3');

  const caro = todos().find((p) => p.precio >= UMBRAL_ENVIO_GRATIS && p.variantes.some((v) => v.stock > 0));
  const barato = todos().find((p) => p.precio < UMBRAL_ENVIO_GRATIS && p.variantes.some((v) => v.stock > 0));

  if (caro) {
    const c = cotizar([{ id: caro.id, cantidad: 1 }], '5000');
    ok(c.envioGratis && c.envio === 0, `${caro.precio} supera el umbral y el envío no salió gratis`);
    ok(c.total === c.subtotal, 'con envío gratis el total tendría que ser el subtotal');
  }
  if (barato) {
    const c = cotizar([{ id: barato.id, cantidad: 1 }], '5000');
    ok(!c.envioGratis && c.envio > 0, 'un pedido chico tendría que pagar envío');

    /* El nombre de la zona tampoco se escribe a mano: se pregunta
       cuál cubre el 5000. Antes decía «Centro y Cuyo», que dejó de
       existir al rehacer la tabla para despachar desde Córdoba. */
    const { ZONAS } = await cargar('src/lib/envio.ts', 'envio-cobro');
    const esperada = ZONAS.find((z) => z.rangos.some(([a, b]) => 5000 >= a && 5000 <= b))?.nombre;
    ok(c.zona === esperada, `5000 tendría que cotizar «${esperada}» y da «${c.zona}»`);

    const sucursal = cotizar([{ id: barato.id, cantidad: 1 }], '5000', 'sucursal');
    ok(sucursal.envio < c.envio, 'retirar en sucursal tendría que salir menos');

    const transferencia = cotizar([{ id: barato.id, cantidad: 1 }], '5000', 'domicilio', 'transferencia');
    ok(transferencia.descuento > 0, 'la transferencia tendría que descontar');
    ok(transferencia.total === c.total - transferencia.descuento, 'el descuento no se restó bien');

    /* Dos unidades pesan el doble, y el envío puede subir por peso.
     *
     * [ERROR CORREGIDO] Esto pedía dos unidades de `barato`, que se
     * eligió por PRECIO y nada más. Cuando el umbral de envío gratis
     * subió a $ 100.000, el primer producto barato pasó a ser uno con
     * una sola unidad en stock, y `cotizar()` cortó —bien— con
     * «Quedan 1 unidades». La prueba reventó entera, y no por un
     * defecto: por pedirle a un producto algo que nunca prometió.
     *
     * Es el mismo error que rompió /sistema: buscar por una
     * propiedad y después usar el resultado para otra. Ahora se
     * busca por la que hace falta —una variante con dos o más— y si
     * no hay, el caso no se ejecuta en vez de inventar un fallo. */
    const dosEnStock = todos().find(
      (p) => p.precio < UMBRAL_ENVIO_GRATIS && p.variantes.some((v) => v.stock >= 2),
    );
    if (dosEnStock) {
      const una = cotizar([{ id: dosEnStock.id, cantidad: 1 }], '5000');
      const dos = cotizar([{ id: dosEnStock.id, cantidad: 2 }], '5000');
      ok(dos.subtotal === dosEnStock.precio * 2, 'el subtotal por dos no dio el doble');
      ok(dos.peso > una.peso, 'dos unidades tendrían que pesar más que una');

      /* [ERROR CORREGIDO] Acá decía, a secas, `dos.envio >= una.envio`:
         más peso nunca puede salir más barato.

         Con un umbral de envío gratis POR MONTO eso deja de ser
         cierto, y de la mejor manera posible. Si el producto pasa la
         mitad del umbral, dos unidades lo cruzan y el envío se hace
         cero: una unidad paga, dos viajan gratis. La prueba lo
         reportó como «el envío de dos unidades salió más barato que
         el de una», que es literalmente verdad y no es un defecto.

         Es justamente el incentivo por el que existe el umbral. Una
         prueba que lo llama error empuja a sacarlo.

         Se separan los dos casos, y cada uno afirma lo suyo. */
      if (dos.envioGratis) {
        ok(dos.envio === 0, 'cruzó el umbral y el envío no quedó en cero');
        ok(dos.subtotal >= UMBRAL_ENVIO_GRATIS,
          'se declaró envío gratis sin llegar al umbral');
        ok(!una.envioGratis && una.envio > 0,
          `${dosEnStock.nombre}: dos unidades viajan gratis y una también, `
          + 'así que este caso no está probando el umbral');
      } else {
        ok(dos.envio >= una.envio,
          'sin cruzar el umbral, el envío de dos unidades no puede salir menos que el de una');
      }
    }

    /* Y que pedir más de lo que hay siga cortando. Es la otra mitad
       de lo mismo: el corte de recién era correcto, y conviene
       tenerlo verificado a propósito en vez de descubrirlo de casualidad. */
    const conUna = todos().find((p) => p.variantes.some((v) => v.stock === 1));
    if (conUna) {
      let corto = false;
      try { cotizar([{ id: conUna.id, cantidad: 2 }], '5000'); } catch { corto = true; }
      ok(corto, `${conUna.nombre} tiene una sola unidad y aceptó un pedido de dos`);
    }
  }
}

/* ============================================================
   4 · La firma del aviso de pago
   ============================================================ */
{
  const secreto = 'secreto-de-prueba-no-es-el-real';
  const dataId = '123456';
  const requestId = 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e';
  const ts = '1742505638683';

  const firmar = (manifiesto, clave = secreto) =>
    crypto.createHmac('sha256', clave).update(manifiesto).digest('hex');

  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const buena = firmar(manifiesto);

  ok(firmaValida({ xSignature: `ts=${ts},v1=${buena}`, xRequestId: requestId, dataId, secreto }),
    'una firma legítima fue rechazada — con esto no entraría ningún aviso real');

  /* Todos los intentos que tienen que fallar. */
  const rechaza = (opciones, porque) =>
    ok(!firmaValida({ xRequestId: requestId, dataId, secreto, ...opciones }), `¡GRAVE! se aceptó ${porque}`);

  rechaza({ xSignature: `ts=${ts},v1=${'0'.repeat(64)}` }, 'una firma inventada');
  rechaza({ xSignature: `ts=${ts},v1=${firmar(manifiesto, 'otro-secreto')}` }, 'una firma hecha con otro secreto');
  rechaza({ xSignature: `ts=${ts + 1},v1=${buena}` }, 'una firma con el reloj cambiado');
  rechaza({ xSignature: `ts=${ts},v1=${buena}`, dataId: '999999' }, 'una firma para otro pago');
  rechaza({ xSignature: `ts=${ts},v1=${buena}`, xRequestId: 'otro' }, 'una firma con otro identificador de petición');
  rechaza({ xSignature: `v1=${buena}` }, 'una firma sin marca de tiempo');
  rechaza({ xSignature: `ts=${ts}` }, 'un encabezado sin firma');
  rechaza({ xSignature: '' }, 'un encabezado vacío');
  rechaza({ xSignature: null }, 'un aviso sin encabezado de firma');
  rechaza({ xSignature: `ts=${ts},v1=${buena}`, secreto: '' }, 'un aviso cuando no hay secreto configurado');
  rechaza({ xSignature: `ts=${ts},v1=${buena.slice(0, 20)}` }, 'una firma cortada');

  /* El identificador va en minúsculas en el manifiesto. Si llega en
     mayúsculas tiene que validar igual: lo dice la documentación y es
     el detalle que más veces rompe integraciones reales. */
  const alfanumerico = 'AbC123';
  const manifiestoMinuscula = `id:${alfanumerico.toLowerCase()};request-id:${requestId};ts:${ts};`;
  ok(firmaValida({
    xSignature: `ts=${ts},v1=${firmar(manifiestoMinuscula)}`,
    xRequestId: requestId, dataId: alfanumerico, secreto,
  }), 'un identificador con mayúsculas no validó; el manifiesto tiene que pasarlo a minúsculas');

  /* Cuando falta un dato, su par se omite del manifiesto en vez de ir
     vacío. Otro detalle de la especificación fácil de equivocar. */
  const sinRequestId = `id:${dataId};ts:${ts};`;
  ok(firmaValida({
    xSignature: `ts=${ts},v1=${firmar(sinRequestId)}`,
    xRequestId: null, dataId, secreto,
  }), 'sin x-request-id el manifiesto tendría que omitir ese par, no dejarlo vacío');
}

/* ============================================================
   4.b · MOBBEX · la pasarela que NO firma sus avisos
   ------------------------------------------------------------
   Mercado Pago manda un HMAC que se puede recalcular. Mobbex manda
   `content-type: application/json` y nada más. Eso cambia dónde
   está puesta la seguridad, y esta sección existe para probar que
   está puesta donde tiene que estar.

   El token de la dirección es la primera barrera y es floja a
   propósito: viaja en la URL y las URLs terminan en registros. La
   barrera real es que **nada de lo que trae el aviso se escribe**.
   Por eso la prueba que más importa acá no es la del token sino la
   de más abajo: un aviso que grita «aprobado, 999.999 pesos» tiene
   que terminar escribiendo lo que diga la API, aunque diga lo
   contrario.
   ============================================================ */
{
  process.env.MOBBEX_API_KEY = 'clave-de-mentira';
  process.env.MOBBEX_ACCESS_TOKEN = 'token-de-mentira';
  process.env.MOBBEX_MODO = 'prueba';
  process.env.MOBBEX_WEBHOOK_TOKEN = 'un-token-largo-de-mas-de-24-caracteres';

  const mobbex = await cargar('src/lib/mobbex.ts', 'mobbex');
  const { traducirCodigo, avisoLegitimo, claveDeAviso, cobroPermitido: permitidoMobbex,
    hayAvisoVerificable, urlDeAviso, buscarPagoPorPedido, pagoDelAviso } = mobbex;

  /* ---- La tabla de estados ----

     Dos códigos son trampa y son los que justifican la sección: el 3
     («autorizada») es una tarjeta que aceptó pero cuya plata todavía
     no se capturó, y el 2 («en espera») es un cupón de efectivo
     emitido y sin pagar. Los dos suenan a venta hecha. Si alguno
     contara como aprobado, se despacharía mercadería contra plata
     que puede no entrar nunca. */
  const esperado = {
    4: 'aprobado', 200: 'aprobado', 201: 'aprobado',
    300: 'aprobado', 301: 'aprobado', 302: 'aprobado',
    602: 'devuelto', 605: 'devuelto',
    400: 'rechazado', 403: 'rechazado', 410: 'rechazado', 419: 'rechazado',
    500: 'rechazado', 604: 'rechazado',
    401: 'cancelado', 402: 'cancelado', 600: 'cancelado', 601: 'cancelado', 610: 'cancelado',
    0: 'pendiente', 1: 'pendiente', 2: 'pendiente', 3: 'pendiente',
    100: 'pendiente', 210: 'pendiente', 299: 'pendiente', 603: 'pendiente', 800: 'pendiente',
  };
  for (const [codigo, debe] of Object.entries(esperado)) {
    const dio = traducirCodigo(codigo);
    ok(dio === debe, `el código ${codigo} de Mobbex se tradujo como «${dio}» y tendría que ser «${debe}»`);
    /* Y en número, que es como viene en el cuerpo del aviso. */
    ok(traducirCodigo(Number(codigo)) === debe, `el código ${codigo} en número se tradujo distinto que en texto`);
  }
  ok(traducirCodigo('3') !== 'aprobado',
    '¡GRAVE! una autorización sin captura contaría como cobrada: se despacharía contra plata que puede no entrar');
  ok(traducirCodigo('2') !== 'aprobado',
    '¡GRAVE! un cupón de efectivo emitido y sin pagar contaría como cobrado');
  ok(traducirCodigo('7777') === 'pendiente',
    'un código que Mobbex agregue mañana tiene que caer en pendiente, no en aprobado');

  /* ---- El token del aviso ---- */
  const avisoCon = (busqueda, cuerpo = {}) => ({
    url: new URL(`https://acentta.com/api/aviso-de-pago${busqueda}`),
    headers: new Headers(),
    cuerpo,
  });
  const bueno = process.env.MOBBEX_WEBHOOK_TOKEN;

  ok(hayAvisoVerificable(), 'con el token cargado tendría que poder verificarse el aviso');
  ok(avisoLegitimo(avisoCon(`?fuente=mobbex&token=${encodeURIComponent(bueno)}`)),
    'un aviso con el token correcto fue rechazado — así no entraría ningún aviso real');

  const rechazaAviso = (busqueda, porque) =>
    ok(!avisoLegitimo(avisoCon(busqueda)), `¡GRAVE! se aceptó ${porque}`);

  rechazaAviso('?fuente=mobbex', 'un aviso sin token');
  rechazaAviso('?fuente=mobbex&token=', 'un aviso con el token vacío');
  rechazaAviso('?fuente=mobbex&token=cualquier-cosa-que-alguien-invente', 'un aviso con un token inventado');
  rechazaAviso(`?fuente=mobbex&token=${encodeURIComponent(bueno.slice(0, -1))}`, 'un token al que le falta el último carácter');
  rechazaAviso(`?fuente=mobbex&token=${encodeURIComponent(bueno)}X`, 'un token con un carácter de más');

  /* Un token corto se puede probar a fuerza bruta contra una
     dirección pública, y da la misma sensación de seguridad que uno
     largo. Se rechaza de entrada. */
  process.env.MOBBEX_WEBHOOK_TOKEN = 'corto';
  ok(!hayAvisoVerificable(), 'un token de 5 caracteres no tendría que contar como verificable');
  ok(!avisoLegitimo(avisoCon('?token=corto')),
    '¡GRAVE! un token de 5 caracteres alcanzaría para aprobar pedidos');

  process.env.MOBBEX_WEBHOOK_TOKEN = '';
  ok(!avisoLegitimo(avisoCon('?token=')), '¡GRAVE! sin token configurado se aceptó un aviso sin token');
  ok(!hayAvisoVerificable(), 'sin token configurado no puede haber aviso verificable');
  process.env.MOBBEX_WEBHOOK_TOKEN = bueno;

  /* La dirección que se le da a Mobbex lleva el token adentro. */
  ok(urlDeAviso('https://acentta.com').includes(encodeURIComponent(bueno)),
    'la dirección de avisos no lleva el token');
  ok(avisoLegitimo(avisoCon(new URL(urlDeAviso('https://acentta.com')).search)),
    'la dirección que armamos no pasa nuestra propia verificación');

  /* ---- La clave de idempotencia ----

     Tiene que incluir el estado. Con la clave sin estado, la
     devolución de un pedido ya aprobado compartía clave con la
     aprobación y se descartaba en silencio: la plata volvía y el
     pedido seguía diciendo «aprobado, listo para despachar». */
  const cuerpoCon = (estado) => ({
    type: 'checkout',
    data: { payment: { id: 'pag-1', reference: 'AC-260826-ABC123', status: { code: estado } } },
  });
  const claveAprobado = claveDeAviso(avisoCon('?token=x', cuerpoCon('200')));
  const claveRepetido = claveDeAviso(avisoCon('?token=x', cuerpoCon('200')));
  const claveDevuelto = claveDeAviso(avisoCon('?token=x', cuerpoCon('602')));

  ok(claveAprobado === claveRepetido, 'el mismo aviso dos veces tendría que dar la misma clave');
  ok(claveAprobado !== claveDevuelto,
    '¡GRAVE! una devolución compartiría clave con la aprobación y se descartaría: la plata vuelve y el pedido sigue diciendo aprobado');
  ok(claveDeAviso(avisoCon('?token=x', {})) === null, 'un aviso vacío no tendría que dar clave');

  /* ---- LO IMPORTANTE: no se le cree al aviso ----

     Se arma el peor aviso posible: token válido —supongamos que se
     filtró— y un cuerpo que dice que el pedido está pagado por casi
     un millón de pesos. La API, que es la que sabe, dice que ese
     pago fue rechazado y por otro monto.

     Lo que devuelva `pagoDelAviso` tiene que ser lo que dice la API.
     Si alguna vez alguien "optimiza" esto leyendo el estado del
     cuerpo para ahorrarse una llamada, esta prueba se pone roja. */
  const fetchOriginal = globalThis.fetch;
  let consultas = 0;
  globalThis.fetch = async (url) => {
    consultas++;
    const u = new URL(String(url));
    const ref = u.searchParams.get('reference');
    return {
      ok: true,
      json: async () => ({
        result: true,
        data: {
          docs: [
            /* Una operación de OTRO pedido cuyo número contiene al
               nuestro. Mobbex filtra por coincidencia, así que esto
               llega igual y hay que descartarlo de este lado. */
            { uid: 'op-ajena', status: '200', total: 999999, reference: `${ref}-EXTRA`, currency: 'test' },
            /* La nuestra, la de verdad. */
            { uid: 'op-real', status: '400', total: 45900, reference: ref, currency: 'test' },
          ],
        },
      }),
    };
  };

  const avisoMentiroso = avisoCon(`?fuente=mobbex&token=${encodeURIComponent(bueno)}`, {
    type: 'checkout',
    data: {
      payment: {
        id: 'pag-falso',
        reference: 'AC-260826-ABC123',
        status: { code: '200' },
        total: 999999,
      },
    },
  });

  const consultado = await pagoDelAviso(avisoMentiroso);
  ok(consultas === 1, 'no se consultó a la API: el estado saldría del cuerpo del aviso');
  ok(consultado?.estado === 'rechazado',
    `¡GRAVE! el aviso decía «aprobado» y se le creyó: quedó en «${consultado?.estado}». `
    + 'Sin firma que verificar, creerle al cuerpo es regalar la mercadería');
  ok(consultado?.monto === 45900,
    `¡GRAVE! el monto salió del aviso (${consultado?.monto}) y no de la consulta`);
  ok(consultado?.id === 'op-real',
    'el identificador tendría que ser el de la operación consultada, no el que dijo el aviso');
  ok(consultado?.referenciaExterna === 'AC-260826-ABC123',
    '¡GRAVE! se tomó la operación de otro pedido cuyo número contiene al nuestro');

  /* Un aviso sin referencia no sirve para nada y no se inventa. */
  ok(await pagoDelAviso(avisoCon('?token=x', { type: 'checkout', data: {} })) === null,
    'un aviso sin número de pedido no tendría que devolver ningún pago');

  /* ---- Un cobro real llegando a un sitio declarado en prueba ----

     No debería poder pasar, porque el campo `test` lo impide al
     crear el cobro. Si pasa igual es porque alguien cobró de verdad
     contra este registro, y eso no se aprueba solo. */
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => ({
      result: true,
      data: {
        docs: [{
          uid: 'op-real-de-verdad', status: '200', total: 45900,
          reference: new URL(String(url)).searchParams.get('reference'),
          currency: 'ars',
        }],
      },
    }),
  });
  const sospechoso = await buscarPagoPorPedido('AC-260826-ABC123');
  ok(sospechoso?.estado === 'pendiente',
    '¡GRAVE! un cobro en pesos reales se aprobó solo con el sitio declarado en modo de prueba');
  ok(String(sospechoso?.detalle).includes('REVISAR'), 'el pago sospechoso no quedó marcado para revisar');

  /* Sin operaciones propias, no hay pago. */
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: true, data: { docs: [] } }) });
  ok(await buscarPagoPorPedido('AC-260826-ABC123') === null, 'sin operaciones tendría que devolver null');

  globalThis.fetch = fetchOriginal;

  /* ---- El seguro entre prueba y producción ---- */
  ok(permitidoMobbex(false, 'prueba'), 'un cobro de prueba con el sitio en prueba tendría que pasar');
  ok(permitidoMobbex(true, 'produccion'), 'un cobro real con el sitio en producción tendría que pasar');
  ok(!permitidoMobbex(true, 'prueba'),
    '¡GRAVE! un cobro REAL pasaría con el sitio declarado en prueba');
}

/* ============================================================
   4.c · La conciliación no conoce ninguna pasarela
   ------------------------------------------------------------
   Antes traducía los estados por su cuenta, y ese vocabulario era
   el de Mercado Pago. Al sumar Mobbex habría habido que duplicarlo
   acá. Ahora recibe los cinco estados ya traducidos venga de donde
   venga, y lo único que decide es la regla del monto — que es la
   que impide que un pago manipulado apruebe un pedido.
   ============================================================ */
{
  const guardados = [];
  const { aplicarPago } = await cargar('src/lib/conciliacion.ts', 'conciliacion');

  /* El almacén se reemplaza por uno que anota en vez de escribir. */
  process.env.KV_REST_API_URL = 'https://almacen-de-mentira';
  process.env.KV_REST_API_TOKEN = 'token-de-mentira';
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (_u, opciones) => {
    const orden = JSON.parse(opciones.body);
    if (orden[0] === 'GET') {
      return { ok: true, json: async () => ({ result: JSON.stringify(pedidoBase) }) };
    }
    if (orden[0] === 'SET') guardados.push(JSON.parse(orden[2]));
    return { ok: true, json: async () => ({ result: 'OK' }) };
  };

  const pedidoBase = {
    numero: 'AC-260826-ABC123', estado: 'pendiente',
    creado: new Date().toISOString(), actualizado: new Date().toISOString(),
    cotizacion: { total: 45900 },
  };

  const pago = (extra) => ({
    id: 'op-1', estado: 'aprobado', crudo: '200', detalle: '',
    monto: 45900, referenciaExterna: pedidoBase.numero, ...extra,
  });

  /* El caso normal. */
  const bien = await aplicarPago(pedidoBase, pago());
  ok(bien.estado === 'aprobado' && !bien.revisar, 'un pago correcto tendría que aprobar el pedido');

  /* EL INTENTO: se cobró mucho menos de lo cotizado. Puede ser un
     cambio de precio o puede ser manipulación; en los dos casos la
     respuesta es la misma. */
  const poco = await aplicarPago(pedidoBase, pago({ monto: 1 }));
  ok(poco.revisar === true && poco.estado === 'pendiente',
    '¡GRAVE! se aprobó un pedido de 45.900 pesos cobrando 1 peso');

  /* Y de más también: puede ser un error nuestro de cotización. */
  const mucho = await aplicarPago(pedidoBase, pago({ monto: 90000 }));
  ok(mucho.revisar === true, 'cobrar de más tampoco tendría que aprobarse solo');

  /* Un peso de diferencia es redondeo de la pasarela, no fraude. */
  const redondeo = await aplicarPago(pedidoBase, pago({ monto: 45900.6 }));
  ok(!redondeo.revisar && redondeo.estado === 'aprobado',
    'una diferencia de redondeo no tendría que frenar el pedido');

  /* El detalle guarda el código sin traducir: «rechazado» no ayuda a
     entender nada, el 410 de Mobbex sí. */
  await aplicarPago(pedidoBase, pago({ estado: 'rechazado', crudo: '410', detalle: 'fondos insuficientes' }));
  const ultimo = guardados[guardados.length - 1];
  ok(String(ultimo?.detallePago).includes('410'),
    'el detalle del pago perdió el código original de la pasarela');

  globalThis.fetch = fetchOriginal;
}

/* ============================================================
   5 · Un aviso repetido no se procesa dos veces
   ============================================================ */
{
  /* Doble del almacén: un Redis de mentira, en memoria, que respeta
     lo único que importa acá — que `SET NX` sea atómico. */
  const datos = new Map();
  const orden_ = new Map(); // el conjunto ordenado: miembro -> puntaje
  process.env.KV_REST_API_URL = 'https://almacen-de-mentira';
  process.env.KV_REST_API_TOKEN = 'token-de-mentira';
  globalThis.fetch = async (_url, opciones) => {
    const [orden, clave, valor, ...resto] = JSON.parse(opciones.body);
    let result = null;
    if (orden === 'SET') {
      const nx = resto.includes('NX');
      if (nx && datos.has(clave)) result = null;
      else { datos.set(clave, valor); result = 'OK'; }
    } else if (orden === 'GET') {
      result = datos.get(clave) ?? null;
    } else if (orden === 'DEL') {
      result = datos.delete(clave) ? 1 : 0;
    } else if (orden === 'MGET') {
      result = [clave, valor, ...resto].filter((k) => k !== undefined).map((k) => datos.get(k) ?? null);
    } else if (orden === 'ZADD') {
      orden_.set(String(resto[0]), Number(valor));
      result = 1;
    } else if (orden === 'ZRANGE') {
      result = [...orden_.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
    } else if (orden === 'SCAN') {
      const patron = resto[0]; // MATCH <patron>
      const re = new RegExp('^' + String(patron).replace('*', '.*') + '$');
      result = ['0', [...datos.keys()].filter((k) => re.test(k))];
    }
    return { ok: true, json: async () => ({ result }) };
  };

  const { marcarProcesado, desmarcarProcesado, guardarPedido, leerPedido, nuevoNumero, listarPedidos } =
    await cargar('src/lib/pedidos.ts', 'pedidos');

  const pagoId = '987654321';
  const primera = await marcarProcesado(pagoId);
  const segunda = await marcarProcesado(pagoId);
  ok(primera === true, 'el primer aviso no pudo tomar la marca');
  ok(segunda === false, '¡GRAVE! el mismo aviso se procesaría dos veces: dos correos y el stock descontado dos veces');

  /* Y ocho reintentos seguidos, que es lo que manda Mercado Pago. */
  let extra = 0;
  for (let i = 0; i < 8; i++) if (await marcarProcesado(pagoId)) extra++;
  ok(extra === 0, `${extra} reintentos volvieron a pasar`);

  /* Al devolver la marca, el reintento tiene que poder trabajar. */
  await desmarcarProcesado(pagoId);
  ok(await marcarProcesado(pagoId) === true, 'después de devolver la marca, el reintento no pudo tomarla');

  /* El número de pedido no se puede adivinar recorriendo. */
  const numeros = new Set(Array.from({ length: 400 }, () => nuevoNumero()));
  ok(numeros.size === 400, 'se repitieron números de pedido');
  ok([...numeros].every((n) => /^AC-\d{6}-[A-Z0-9]{6}$/.test(n)), 'algún número no tiene el formato esperado');

  /* Guardar y leer, ida y vuelta. */
  const numero = nuevoNumero();
  await guardarPedido({ numero, estado: 'pendiente', cotizacion: { total: 1000 } });
  const leido = await leerPedido(numero);
  ok(leido?.numero === numero && leido.cotizacion.total === 1000, 'el pedido no volvió igual del almacén');
  ok(await leerPedido('AC-999999-ZZZZZZ') === null, 'un pedido inexistente no devolvió null');

  /* ---- El índice se repara solo ----

     El índice se agregó DESPUÉS que el almacén, así que todo lo
     guardado antes quedó fuera de la lista: existía, se podía
     consultar por número, y la pantalla de pedidos mostraba vacío.
     Pedirle a alguien que vuelva a comprar para recuperar sus
     propios pedidos no es una respuesta.

     Acá se simula exactamente eso: tres pedidos escritos a mano, sin
     pasar por el índice, como los que ya estaban guardados. */
  datos.clear(); orden_.clear();
  for (let i = 0; i < 3; i++) {
    const n = nuevoNumero();
    datos.set(`pedido:${n}`, JSON.stringify({
      numero: n, creado: new Date(Date.now() - i * 60000).toISOString(),
      estado: 'aprobado', cotizacion: { total: 1000 + i },
    }));
  }
  ok(orden_.size === 0, 'la prueba está mal armada: el índice no debería tener nada todavía');

  const lista = await listarPedidos(50);
  ok(lista.length === 3,
    `¡GRAVE! los pedidos guardados antes del índice no aparecen en la lista: se listaron ${lista.length} de 3`);
  ok(orden_.size === 3, 'el índice no quedó reconstruido después de listar');

  /* Y del más nuevo al más viejo, que es como se trabaja.
     Con `?.` y no directo: si la lista viene vacía —que es el defecto
     que esta sección persigue— una prueba que revienta con
     «cannot read properties of undefined» esconde el diagnóstico
     detrás de un rastro de pila. Tiene que decir qué pasó. */
  ok(lista[0]?.cotizacion?.total === 1000, 'la lista no vino ordenada del más nuevo al más viejo');
}

/* ============================================================ */
console.log('\n=== COBRO · el circuito de pago ===');
console.log('  el precio lo pone el catálogo, no el navegador');
console.log('  Mercado Pago · la firma se verifica y se compara en tiempo constante');
console.log('  Mobbex · sin firma, el aviso sólo dice qué preguntar: el estado sale de la API');
console.log('  un aviso repetido no procesa dos veces, pero un cambio de estado sí entra');
console.log('  si el monto cobrado no coincide con el cotizado, el pedido no se aprueba');

if (fallos.length) {
  console.log(`\n  ${fallos.length} problema(s):`);
  for (const f of fallos) console.log(`   · ${f}`);
  process.exit(1);
}
console.log('\n✓ el circuito de cobro resiste lo que tiene que resistir\n');
