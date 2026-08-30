/**
 * acentta · la tabla de zonas de envío
 * ---------------------------------------------------------------
 * Esta prueba existe por un error que estuvo dando precios
 * equivocados a media Argentina sin que nada lo notara.
 *
 * La zona «Provincia de Buenos Aires» declaraba el rango 1901-8199.
 * La búsqueda devuelve la primera zona que coincide y Buenos Aires
 * está antes en la lista, así que ese rango se comía enteras a
 * «Centro y Cuyo» y a «Norte»: Córdoba, Rosario, Mendoza, Tucumán y
 * Salta se cobraban $ 7.300 en lugar de $ 8.100 o $ 9.400, y se les
 * prometían dos días hábiles extra en lugar de tres o cuatro.
 *
 * Por qué nadie lo vio: la calculadora contestaba rápido y devolvía
 * una zona plausible. No hay excepción, no hay pantalla en rojo, no
 * hay nada en la consola. Un error de datos silencioso sólo se
 * encuentra si alguien pregunta lo correcto.
 *
 * Las tres preguntas que hace esta prueba:
 *
 *   1. ¿Algún código postal cae en dos zonas? Si pasa, el resultado
 *      depende del orden de la lista, y ese orden es accidental.
 *   2. ¿Queda algún hueco dentro del territorio cubierto?
 *   3. ¿Códigos postales reales conocidos dan la zona que
 *      corresponde? No rangos inventados: capitales de provincia y
 *      ciudades grandes, que es lo que alguien va a escribir.
 *
 * Las dos primeras valen para cualquier tabla futura: si mañana se
 * agrega una zona y pisa a otra, esto lo dice antes de publicar.
 *
 *     node pruebas/envio.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FUENTE = path.join(AQUI, '..', 'src', 'lib', 'envio.ts');

/* Se compila el archivo real, no una copia. Una prueba que valida
   una copia de la tabla no valida nada: valida la copia. */
const compilado = await build({
  entryPoints: [FUENTE],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const tmp = path.join(AQUI, '.envio.compilado.mjs');
fs.writeFileSync(tmp, compilado.outputFiles[0].text);
const { ZONAS, calcularEnvio, normalizarCP } = await import(`file://${tmp}`);
fs.unlinkSync(tmp);

const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); };

/* ============================================================
   1 · Ningún código postal puede caer en dos zonas
   ============================================================ */
const solapados = [];
for (let cp = 1000; cp <= 9999; cp++) {
  const cuantas = ZONAS.filter((z) => z.rangos.some(([a, b]) => cp >= a && cp <= b));
  if (cuantas.length > 1) solapados.push({ cp, zonas: cuantas.map((z) => z.nombre) });
}
if (solapados.length) {
  const p = solapados[0];
  ok(false, `${solapados.length} códigos postales caen en más de una zona; el primero es ${p.cp} (${p.zonas.join(' y ')}). Cuál gana depende del orden de la lista.`);
}

/* Y, por las dudas, que ninguna zona se pise a sí misma: un rango
   duplicado no cambia el resultado pero esconde la intención. */
for (const z of ZONAS) {
  for (let i = 0; i < z.rangos.length; i++) {
    for (let j = i + 1; j < z.rangos.length; j++) {
      const [a1, b1] = z.rangos[i], [a2, b2] = z.rangos[j];
      ok(b1 < a2 || b2 < a1, `${z.nombre} declara dos rangos que se pisan: ${a1}-${b1} y ${a2}-${b2}`);
    }
  }
}

/* ============================================================
   2 · Sin huecos dentro del territorio cubierto
   ============================================================ */
const cubiertos = [];
for (let cp = 1000; cp <= 9999; cp++) {
  if (ZONAS.some((z) => z.rangos.some(([a, b]) => cp >= a && cp <= b))) cubiertos.push(cp);
}
const desde = cubiertos[0], hasta = cubiertos[cubiertos.length - 1];
const huecos = [];
for (let cp = desde; cp <= hasta; cp++) {
  if (!ZONAS.some((z) => z.rangos.some(([a, b]) => cp >= a && cp <= b))) {
    const ultimo = huecos[huecos.length - 1];
    if (ultimo && ultimo[1] === cp - 1) ultimo[1] = cp;
    else huecos.push([cp, cp]);
  }
}
for (const [a, b] of huecos) {
  ok(false, `hueco sin cobertura entre ${a} y ${b}, en medio de una zona que sí se cubre`);
}

/* ============================================================
   3 · Códigos postales reales
   ------------------------------------------------------------
   Uno por zona como mínimo, y con especial atención a los bordes:
   1900 y 1901, 5999 y 6000. Un error de un dígito en un límite es
   exactamente el que nadie prueba a mano.
   ============================================================ */
const REALES = [
  [1425, 'CABA', 'Palermo'],
  [1000, 'CABA', 'primer código de la zona'],
  [1499, 'CABA', 'último código de la zona'],
  [1602, 'Gran Buenos Aires', 'Florida, Vicente López'],
  [1900, 'Gran Buenos Aires', 'La Plata · último de la zona'],
  [1950, 'Provincia de Buenos Aires', 'Berisso'],
  [7000, 'Provincia de Buenos Aires', 'Tandil'],
  [8000, 'Provincia de Buenos Aires', 'Bahía Blanca'],
  [2000, 'Centro y Cuyo', 'Rosario'],
  [5000, 'Centro y Cuyo', 'Córdoba capital'],
  [5500, 'Centro y Cuyo', 'Mendoza'],
  [3100, 'Norte', 'Paraná'],
  [4000, 'Norte', 'San Miguel de Tucumán'],
  [4400, 'Norte', 'Salta'],
  [8300, 'Patagonia', 'Neuquén'],
  [9410, 'Patagonia', 'Ushuaia'],
];

for (const [cp, esperada, ciudad] of REALES) {
  const r = calcularEnvio(String(cp), 1);
  ok(r.ok, `${cp} (${ciudad}) quedó sin cobertura`);
  if (r.ok) ok(r.zona === esperada, `${cp} (${ciudad}) devuelve «${r.zona}» y corresponde «${esperada}»`);
}

/* Las zonas declaradas tienen que usarse todas. Una zona que ningún
   código postal alcanza es la firma de este error. */
const alcanzadas = new Set(REALES.map(([cp]) => calcularEnvio(String(cp), 1).zona));
for (const z of ZONAS) {
  ok(alcanzadas.has(z.nombre), `la zona «${z.nombre}» está declarada y ningún código postal real la alcanza`);
}

/* El precio tiene que subir con la distancia. Si una zona más lejos
   sale más barata, alguien se equivocó al copiar un número. */
const orden = ['CABA', 'Gran Buenos Aires', 'Provincia de Buenos Aires', 'Centro y Cuyo', 'Norte', 'Patagonia'];
const porNombre = Object.fromEntries(ZONAS.map((z) => [z.nombre, z]));
for (let i = 1; i < orden.length; i++) {
  const a = porNombre[orden[i - 1]], b = porNombre[orden[i]];
  if (!a || !b) continue;
  ok(b.base > a.base, `${b.nombre} cuesta ${b.base} y ${a.nombre}, que está más cerca, cuesta ${a.base}`);
  ok(b.diasExtra >= a.diasExtra, `${b.nombre} promete llegar antes que ${a.nombre}, que está más cerca`);
}

/* ============================================================
   4 · Formato del código postal
   ============================================================ */
ok(normalizarCP('C1425DKE') === 1425, 'no acepta el formato nuevo con letras (C1425DKE)');
ok(normalizarCP('  5000 ') === 5000, 'no tolera espacios alrededor');
ok(normalizarCP('c1425dke') === 1425, 'no acepta el formato nuevo en minúsculas');
ok(normalizarCP('142') === null, 'acepta un código postal de tres dígitos');
ok(normalizarCP('') === null, 'acepta un código postal vacío');
ok(!calcularEnvio('0500', 1).ok, 'da cobertura a un código postal que no existe');

/* El peso encarece, pero sólo por encima del umbral. */
const liviano = calcularEnvio('5000', 2), pesado = calcularEnvio('5000', 12);
ok(liviano.costo === porNombre['Centro y Cuyo'].base, 'un paquete liviano no debería pagar extra por peso');
ok(pesado.costo > liviano.costo, 'un paquete de 12 kg cuesta lo mismo que uno de 2');

/* ============================================================
   Transparencia fiscal · el precio sin impuestos
   ------------------------------------------------------------
   En Argentina los precios se publican CON IVA adentro, así que el
   neto se obtiene dividiendo, no restando.

       $ 135.000 / 1,21 = $ 111.570   ✔
       $ 135.000 − 21 % = $ 106.650   �’

   Los dos son números plausibles y sólo uno es correcto. El segundo
   es el error clásico de este cálculo, y si se publica queda escrito
   en la ficha con aire de dato verificado.

   Los dos casos de prueba salen de la tienda oficial de Stanley, que
   publica las dos cifras: sirven de verificación externa y no de una
   cuenta hecha por nosotros para comprobar nuestra propia cuenta.
   ============================================================ */
{
  /* Mismo mecanismo que arriba: se compila el archivo real. `formato.ts`
     no depende de nada del proyecto, así que alcanza con esto. */
  const compiladoFormato = await build({
    entryPoints: [path.join(AQUI, '..', 'src', 'lib', 'formato.ts')],
    bundle: true, format: 'esm', write: false, platform: 'neutral',
  });
  const tmpFormato = path.join(AQUI, '.formato.compilado.mjs');
  fs.writeFileSync(tmpFormato, compiladoFormato.outputFiles[0].text);
  const { precioSinImpuestos, IVA_GENERAL } = await import(`file://${tmpFormato}?${Date.now()}`);
  fs.unlinkSync(tmpFormato);

  ok(precioSinImpuestos(135000) === 111570,
    `$135.000 sin IVA son $111.570 (dato de Stanley) y dio ${precioSinImpuestos(135000)}`);
  ok(precioSinImpuestos(182000) === 150413,
    `$182.000 sin IVA son $150.413 (dato de Stanley) y dio ${precioSinImpuestos(182000)}`);

  /* El error de restar en vez de dividir. */
  ok(precioSinImpuestos(135000) !== 106650,
    '¡GRAVE! se está restando el 21 % en vez de sacar el IVA contenido');

  /* Y la comprobación de ida y vuelta, que es la que de verdad
     define «sin impuestos»: reponerle el IVA tiene que devolver el
     precio publicado. */
  for (const p of [135000, 182000, 42000, 124000, 999]) {
    const neto = precioSinImpuestos(p);
    ok(Math.abs(neto * (1 + IVA_GENERAL) - p) <= 1,
      `reponerle el IVA a ${p} no devuelve el precio: da ${Math.round(neto * 1.21)}`);
  }

  /* La alícuota reducida no puede informar la general. */
  ok(precioSinImpuestos(110500, 0.105) === 100000,
    `al 10,5 % el neto de 110.500 es 100.000 y dio ${precioSinImpuestos(110500, 0.105)}`);
  ok(precioSinImpuestos(135000, 0) === 135000, 'un producto exento no tiene IVA que sacar');

  /* Nada raro tiene que producir un número raro publicado. */
  ok(precioSinImpuestos(0) === 0, 'precio cero tendría que dar cero');
  ok(precioSinImpuestos(NaN) === 0, 'un precio inválido no puede producir NaN en la página');
  ok(Number.isFinite(precioSinImpuestos(135000, NaN)),
    'una alícuota inválida no puede producir NaN en la página');
}

/* ============================================================ */
console.log('\n=== ENVÍO · tabla de zonas ===');
console.log(`  ${ZONAS.length} zonas · ${cubiertos.length} códigos postales cubiertos · ${REALES.length} ciudades verificadas`);
for (const z of ZONAS) {
  const rangos = z.rangos.map(([a, b]) => `${a}-${b}`).join(', ');
  console.log(`  ${z.nombre.padEnd(26)} ${rangos.padEnd(30)} $ ${z.base}  +${z.diasExtra} días`);
}

if (fallos.length) {
  console.log(`\n  ${fallos.length} problema(s):`);
  for (const f of fallos) console.log(`   · ${f}`);
  process.exit(1);
}
console.log('\n✓ la tabla de zonas es coherente y da las zonas reales\n');
