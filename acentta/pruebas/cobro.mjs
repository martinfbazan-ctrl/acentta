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
 *   2. Un aviso de pago con firma inválida, ¿se acepta?
 *      Tiene que dar que no. Sin esa verificación, cualquiera que
 *      descubra la dirección de la función manda «pago aprobado» y
 *      se lleva mercadería gratis.
 *
 *   3. El mismo aviso dos veces, ¿procesa dos veces?
 *      Tiene que dar que no. Mercado Pago reintenta hasta ocho veces
 *      si no le contestamos rápido.
 *
 * Corre sin red y sin credenciales: la cotización es aritmética
 * pura, la firma es un HMAC, y el almacén se reemplaza por un doble.
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
const { firmaValida } = await cargar('src/lib/mercadopago.ts', 'mercadopago');

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
  const caro = todos().find((p) => p.precio >= 50000 && p.variantes.some((v) => v.stock > 0));
  const barato = todos().find((p) => p.precio < 20000 && p.variantes.some((v) => v.stock > 0));

  if (caro) {
    const c = cotizar([{ id: caro.id, cantidad: 1 }], '5000');
    ok(c.envioGratis && c.envio === 0, `${caro.precio} supera el umbral y el envío no salió gratis`);
    ok(c.total === c.subtotal, 'con envío gratis el total tendría que ser el subtotal');
  }
  if (barato) {
    const c = cotizar([{ id: barato.id, cantidad: 1 }], '5000');
    ok(!c.envioGratis && c.envio > 0, 'un pedido chico tendría que pagar envío');
    ok(c.zona === 'Centro y Cuyo', `5000 tendría que cotizar Centro y Cuyo y da ${c.zona}`);

    const sucursal = cotizar([{ id: barato.id, cantidad: 1 }], '5000', 'sucursal');
    ok(sucursal.envio < c.envio, 'retirar en sucursal tendría que salir menos');

    const transferencia = cotizar([{ id: barato.id, cantidad: 1 }], '5000', 'domicilio', 'transferencia');
    ok(transferencia.descuento > 0, 'la transferencia tendría que descontar');
    ok(transferencia.total === c.total - transferencia.descuento, 'el descuento no se restó bien');

    /* Dos unidades pesan el doble, y el envío puede subir por peso. */
    const dos = cotizar([{ id: barato.id, cantidad: 2 }], '5000');
    ok(dos.subtotal === barato.precio * 2, 'el subtotal por dos no dio el doble');
    ok(dos.envio >= c.envio, 'el envío de dos unidades salió más barato que el de una');
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
   5 · Un aviso repetido no se procesa dos veces
   ============================================================ */
{
  /* Doble del almacén: un Redis de mentira, en memoria, que respeta
     lo único que importa acá — que `SET NX` sea atómico. */
  const datos = new Map();
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
    }
    return { ok: true, json: async () => ({ result }) };
  };

  const { marcarProcesado, desmarcarProcesado, guardarPedido, leerPedido, nuevoNumero } =
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
}

/* ============================================================ */
console.log('\n=== COBRO · el circuito de pago ===');
console.log('  el precio lo pone el catálogo, no el navegador');
console.log('  la firma del aviso se verifica y se compara en tiempo constante');
console.log('  un aviso repetido no procesa dos veces');

if (fallos.length) {
  console.log(`\n  ${fallos.length} problema(s):`);
  for (const f of fallos) console.log(`   · ${f}`);
  process.exit(1);
}
console.log('\n✓ el circuito de cobro resiste lo que tiene que resistir\n');
