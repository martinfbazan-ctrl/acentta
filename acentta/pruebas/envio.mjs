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
 * SEGUNDO ERROR, ENCONTRADO MUCHO DESPUÉS
 *
 * La tabla corregida seguía estando mal, y de una forma que ninguna
 * de las preguntas de abajo podía detectar: estaba armada para
 * despachar desde Buenos Aires. CABA era la zona más barata y la
 * Patagonia la más cara. acentta despacha desde Córdoba.
 *
 * Era coherente consigo misma, cubría el país entero, no se pisaba,
 * daba zonas plausibles y pasaba las tres preguntas limpio. Lo único
 * que la desmintió fue preguntarle el precio a OCA: cobraba $ 4.200
 * a CABA donde el correo cobra $ 10.488.
 *
 * La lección quedó escrita en la sección 3 bis. Una prueba sólo
 * puede encontrar los errores que no comparte con el código: mientras
 * las dos suponían un origen en Buenos Aires, la comparación era
 * entre dos copias de la misma suposición. Hizo falta traer un dato
 * de afuera —la tarifa real— para que apareciera.
 *
 * Las preguntas que hace esta prueba:
 *
 *   1. ¿Algún código postal cae en dos zonas? Si pasa, el resultado
 *      depende del orden de la lista, y ese orden es accidental.
 *   2. ¿Queda algún hueco dentro del territorio cubierto?
 *   3. ¿Códigos postales reales conocidos dan la zona que
 *      corresponde? No rangos inventados: capitales de provincia y
 *      ciudades grandes, que es lo que alguien va a escribir.
 *   4. ¿El precio sube con la distancia AL ORIGEN, que es Córdoba?
 *   5. ¿Alguna zona cobra menos de lo que el correo cobra de verdad?
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
const {
  ZONAS, calcularEnvio, normalizarCP,
  MARGEN_SOBRE_TARIFA_REAL, MEDICIONES_CON_IVA, IVA_ENVIO, costoRealDe,
} = await import(`file://${tmp}`);

fs.unlinkSync(tmp);

const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); };

/* Mientras esto valga `null`, la publicación se corta. Fue así unas
   horas y sirvió: una advertencia se lee dos veces y después se
   ignora, y lo que estaba en juego era el 21 % de cada envío. */
ok(MEDICIONES_CON_IVA !== null,
  'MEDICIONES_CON_IVA está en null: falta confirmar si la tarifa que devuelve OCA '
  + 'incluye IVA. Se cierra con una medición: npm run logistica:vivo imprime el peso '
  + 'y el volumen exactos para pegar en la calculadora de OCA.');

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
const CORDOBA = 'Córdoba capital y alrededores';
const PROVINCIA = 'Provincia de Córdoba';
const CENTRO = 'Centro y Litoral';
const NORTE = 'Cuyo y Norte';

const REALES = [
  [5000, CORDOBA, 'Córdoba capital · primer código de la zona'],
  [5152, CORDOBA, 'Villa Carlos Paz'],
  [5199, CORDOBA, 'último código de la zona'],
  [5800, PROVINCIA, 'Río Cuarto'],
  [5900, PROVINCIA, 'Villa María'],
  [5280, PROVINCIA, 'Cruz del Eje'],
  [1425, CENTRO, 'Palermo, CABA'],
  [1000, CENTRO, 'primer código del país'],
  [1602, CENTRO, 'Florida, Vicente López'],
  [1900, CENTRO, 'La Plata'],
  [2000, CENTRO, 'Rosario'],
  [7000, CENTRO, 'Tandil'],
  [8000, CENTRO, 'Bahía Blanca'],
  [8299, CENTRO, 'último antes de la Patagonia'],
  [5500, NORTE, 'Mendoza'],
  [5400, NORTE, 'San Juan'],
  [5300, NORTE, 'La Rioja'],
  [3100, NORTE, 'Paraná'],
  [4000, NORTE, 'San Miguel de Tucumán'],
  [4400, NORTE, 'Salta'],
  [4600, NORTE, 'San Salvador de Jujuy · lo más al norte del país'],
  [8300, 'Patagonia', 'Neuquén'],
  [9410, 'Patagonia', 'Ushuaia'],
];

/* Salta y CABA caen en zonas distintas y tienen que costar IGUAL.
   Es la comprobación que fija el hallazgo: desde Córdoba, OCA no
   cobra por distancia, y la única razón de que sean dos zonas es el
   plazo. Si alguien vuelve a separar los precios «porque el norte
   está más lejos», esto lo dice con nombre. */
{
  const caba = calcularEnvio('1425', 1), salta = calcularEnvio('4400', 1);
  ok(caba.ok && salta.ok && caba.costo === salta.costo,
    `CABA sale ${caba.costo} y Salta ${salta.costo}: desde Córdoba OCA cobra lo mismo a las dos ($ 10.488 medido)`);
  ok(salta.diasExtra > caba.diasExtra,
    'Salta tendría que prometer más días que CABA: cuestan igual pero no tardan igual');
}

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

/* El precio tiene que subir con la distancia AL ORIGEN, y el origen
   es Córdoba capital. Este arreglo es la única declaración de ese
   hecho en toda la prueba: el día que la tienda se mude, acá se ve
   qué hay que reordenar.

   Esta lista es también la que atrapa el error que motivó la
   reescritura de la tabla. Antes decía, en este orden, CABA · Gran
   Buenos Aires · Provincia de Buenos Aires · Centro y Cuyo · Norte ·
   Patagonia, y la tabla lo cumplía perfecto — porque las dos estaban
   equivocadas de la misma manera. Una prueba escrita desde la misma
   suposición que el código no puede encontrar nada. */
const orden = [CORDOBA, PROVINCIA, CENTRO, NORTE, 'Patagonia'];
const porNombre = Object.fromEntries(ZONAS.map((z) => [z.nombre, z]));

ok(orden.length === ZONAS.length,
  `la tabla tiene ${ZONAS.length} zonas y el orden por distancia nombra ${orden.length}; alguna quedó sin verificar`);
for (const n of orden) ok(porNombre[n], `el orden por distancia nombra «${n}» y esa zona no existe en la tabla`);

/* [ERROR CORREGIDO] Esto exigía `b.base > a.base`: que cada zona más
   lejana costara ESTRICTAMENTE más que la anterior.

   Parecía una verdad obvia y no lo es. Desde Córdoba, OCA cobra lo
   mismo a CABA que a Salta — su tarifario no mira la distancia. La
   prueba, al exigir que subiera, obligaba a inventar un escalón de
   precio que el correo no cobra; y cuando lo saqué fusionando las
   dos zonas en una, se llevó puesto el plazo: CABA pasó a prometer
   5 días cuando OCA entrega en 2.

   El precio se agrupa por tarifario y el plazo por distancia. Son
   dos agrupaciones distintas, y una prueba que las fuerza a
   coincidir empuja el código a mentir en una de las dos.

   Ahora se exige que no BAJE. Dos zonas pueden costar igual y
   tardar distinto, que es exactamente lo que mide el correo. */
for (let i = 1; i < orden.length; i++) {
  const a = porNombre[orden[i - 1]], b = porNombre[orden[i]];
  if (!a || !b) continue;
  ok(b.base >= a.base, `${b.nombre} cuesta ${b.base} y ${a.nombre}, que está más cerca de Córdoba, cuesta ${a.base}`);
  ok(b.porKiloExtra >= a.porKiloExtra, `${b.nombre} cobra menos por kilo extra que ${a.nombre}, que está más cerca`);
}

/* [ERROR CORREGIDO] Acá también se exigía que los DÍAS subieran con
   la distancia. Es la tercera suposición geográfica que los datos
   desmienten, y la más obstinada de mi parte.

   Villa María está a 150 km de Córdoba y OCA tarda 4 días. CABA está
   a 700 km y tarda 2. Tucumán, 2. Salta, 5. La red de OCA rutea por
   centros de distribución, así que un pueblo chico cerca puede
   demorar más que una capital lejos: el camión pasa cuando pasa.

   Mantener la regla habría obligado a falsear uno de los dos
   números para que la prueba pasara — y el que se falsea siempre es
   el que no se mide.

   Lo que SÍ tiene que valer, y es lo único que importa de verdad:
   **nunca prometer antes de lo que el correo tardó.** Eso no sale de
   la geografía, sale de la medición, y por eso cada zona guarda el
   peor plazo que se le midió. */
for (const z of ZONAS) {
  if (!z.medido) continue;
  ok(z.diasExtra >= z.medido.dias,
    `${z.nombre} promete +${z.diasExtra} días y OCA tardó ${z.medido.dias} (${z.medido.destino}): `
    + 'la fecha que ve el comprador llegaría antes que el paquete');
}

/* Con `>=` la tabla podría quedar toda plana y pasar igual, así que
   se pide explícitamente que los extremos se distingan: si el envío
   a Ushuaia sale lo mismo que a Córdoba capital, alguien pisó la
   tabla con un solo precio. */
{
  const primera = porNombre[orden[0]], ultima = porNombre[orden[orden.length - 1]];
  if (primera && ultima) {
    ok(ultima.base > primera.base,
      `la tabla quedó plana: ${ultima.nombre} cuesta lo mismo que ${primera.nombre}`);
    ok(ultima.diasExtra > primera.diasExtra,
      `la tabla promete el mismo plazo para ${ultima.nombre} que para ${primera.nombre}`);
  }
}

/* Las zonas son las de OCA, no las nuestras. Cada precio medido
   viene con el ámbito que OCA le puso —Local, Regional, Nacional 1,
   Nacional 2— y dos zonas del mismo ámbito tienen que costar igual:
   es el mismo tarifario. Si alguna vez difieren, o alguien partió un
   ámbito en dos precios inventados, o la medición quedó vieja. */
{
  const porAmbito = new Map();
  for (const z of ZONAS) {
    if (!z.medido) continue;
    const previa = porAmbito.get(z.medido.ambito);
    if (previa) {
      ok(previa.base === z.base,
        `«${z.nombre}» y «${previa.nombre}» son el mismo ámbito de OCA (${z.medido.ambito}) `
        + `y cobran distinto: $${z.base} contra $${previa.base}`);
      ok(previa.medido.costo === z.medido.costo,
        `«${z.nombre}» y «${previa.nombre}» son el mismo ámbito (${z.medido.ambito}) `
        + 'y sus mediciones no coinciden: alguna quedó vieja');
    } else {
      porAmbito.set(z.medido.ambito, z);
    }
  }
}

/* Dos zonas que cuestan igual tienen que diferenciarse en algo, o
   son la misma zona escrita dos veces — y una zona de más es una
   línea más para desactualizar. */
{
  const porPrecio = new Map();
  for (const z of ZONAS) {
    if (!porPrecio.has(z.base)) porPrecio.set(z.base, []);
    porPrecio.get(z.base).push(z);
  }
  for (const [base, zonas] of porPrecio) {
    if (zonas.length < 2) continue;
    const plazos = new Set(zonas.map((z) => z.diasExtra));
    ok(plazos.size === zonas.length,
      `${zonas.map((z) => z.nombre).join(' y ')} cuestan $${base} y prometen el mismo plazo: son la misma zona partida en dos`);
  }
}

/* La zona más barata tiene que ser la de casa. Es una perogrullada
   hasta que no lo es: la tabla anterior cobraba CABA a $ 4.200 y
   Córdoba a $ 8.100, y nadie lo notó durante meses. */
ok(ZONAS.every((z) => z.base >= porNombre[CORDOBA].base),
  `hay una zona más barata que ${CORDOBA}, que es de donde sale el paquete`);

/* ============================================================
   3 bis · La tabla no puede cobrar menos de lo que sale
   ------------------------------------------------------------
   Ésta es la prueba que faltaba y la única que atrapa el error de
   fondo: la tabla es la red de seguridad para cuando OCA no
   contesta, así que se usa justo cuando nadie puede comparar. Si
   queda por debajo del costo real, la diferencia la pone el
   vendedor en cada venta y no aparece en ninguna pantalla.

   Sólo se puede verificar donde hay una medición. Las zonas
   interpoladas se listan al final para que se sepa cuáles siguen
   siendo una estimación.
   ============================================================ */
/* Si el margen no llega, todas las comparaciones de abajo dan NaN y
   NaN nunca es mayor ni menor que nada: la prueba fallaría entera
   con mensajes que hablan de precios y no de un import roto. */
ok(typeof MARGEN_SOBRE_TARIFA_REAL === 'number' && MARGEN_SOBRE_TARIFA_REAL > 0,
  `MARGEN_SOBRE_TARIFA_REAL no llegó desde envio.ts (vale ${MARGEN_SOBRE_TARIFA_REAL}); sin él las comparaciones de precio dan NaN`);

const sinMedir = [];
for (const z of ZONAS) {
  if (!z.medido) { sinMedir.push(z.nombre); continue; }

  /* [ERROR CORREGIDO] Esto comparaba contra `z.medido.costo` pelado.
     OCA cotiza en NETO —lo dice su propia calculadora, y se
     confirmó midiendo el mismo paquete de los dos lados— así que
     ese número no es lo que se paga: falta el 21 %.

     Con la comparación mal hecha, las cuatro zonas pasaban la
     prueba mientras cobraban entre $ 700 y $ 1.000 por debajo del
     costo real. La prueba decía «la tabla cubre el costo» y era
     verdad sobre un costo que no existe. */
  const real = costoRealDe(z);

  ok(z.base >= real,
    `¡GRAVE! ${z.nombre} cobra $${z.base} y el envío sale $${real} con IVA (${z.medido.destino}): pierdes $${real - z.base} en cada envío`);

  const minimo = Math.round(real * (1 + MARGEN_SOBRE_TARIFA_REAL));
  ok(z.base >= minimo,
    `${z.nombre} cobra $${z.base} y el margen declarado del ${Math.round(MARGEN_SOBRE_TARIFA_REAL * 100)} % sobre $${real} pide al menos $${minimo}`);

  /* Y el techo, porque el margen también protege al comprador: si
     la tabla se despega demasiado, deja de ser una red de seguridad
     y pasa a ser un recargo por que el correo no haya contestado. */
  ok(z.base <= real * 1.35,
    `${z.nombre} cobra $${z.base}, un ${Math.round((z.base / real - 1) * 100)} % por encima de lo que sale: la red de seguridad no debería ser un recargo`);

  /* La fecha importa: una tarifa argentina de hace un año no es un
     dato, es una anécdota. */
  const meses = (Date.now() - new Date(z.medido.fecha).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (meses > 6) {
    console.log(`  ⚠ ${z.nombre}: la última medición es de hace ${Math.round(meses)} meses. Corré npm run logistica:vivo.`);
  }
}

/* ============================================================
   3 ter · Nadie copia un precio de la tabla a mano
   ------------------------------------------------------------
   El carrito muestra un envío estimado cuando todavía no hay código
   postal, y ese estimado tiene que ser el piso de la tabla. Estaba
   escrito así:

       const piso = 4200;

   Un número correcto el día que se escribió y una bomba de tiempo
   desde el día siguiente. Al rehacer la tabla el piso pasó a $ 8.800
   y esta copia se quedó donde estaba: el carrito prometía $ 4.200 y
   el checkout cobraba hasta $ 13.900. Justo el costo sorpresa que el
   comentario de esa función dice estar evitando.

   Lo que no se puede es confiar en acordarse. Esta prueba lee el
   archivo y exige que el piso salga de ZONAS. Es una prueba sobre el
   código y no sobre su resultado —poco elegante— y va igual: el
   valor correcto no se distingue del incorrecto mirando la salida,
   porque los dos son un número de pesos plausible.
   ============================================================ */
{
  const carrito = fs.readFileSync(path.join(AQUI, '..', 'src', 'lib', 'carrito.ts'), 'utf8');

  /* Los comentarios se borran ANTES de mirar nada, y no filtrando
     líneas que empiecen con `*`. La explicación de este error, en
     carrito.ts, cita textualmente la línea vieja:

         [ERROR CORREGIDO] Acá decía `const piso = 4200`…

     Con un filtro por línea, la prueba encuentra PRIMERO esa cita
     —está arriba de la línea real— y falla acusando al comentario
     que documenta el arreglo. Una prueba que se dispara con su
     propia documentación se termina desactivando, y ahí se pierde
     de verdad. Cada comentario se reemplaza por espacios en lugar
     de borrarse, para que los números de línea sigan siendo los del
     archivo. */
  const codigo = carrito
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const linea = codigo.split('\n').find((l) => /^\s*const piso\s*=/.test(l));

  ok(linea, 'no se encontró la línea del piso estimado en carrito.ts; si se renombró, actualizá esta prueba');
  if (linea) {
    ok(!/=\s*[\d_]+\s*;/.test(linea),
      `el piso del envío estimado está escrito a mano en carrito.ts (${linea.trim()}); tiene que salir de ZONAS o vuelve a desincronizarse`);
    ok(/ZONAS/.test(linea),
      `el piso del envío estimado no se deriva de ZONAS: ${linea.trim()}`);
  }

  /* Y que no haya ningún otro número igual a un `base` suelto en el
     código: sería la misma copia con otro nombre. */
  const bases = new Set(ZONAS.map((z) => z.base));

  codigo.split('\n').forEach((l, i) => {
    const copiados = [...(l.match(/\b\d{4,6}\b/g) ?? [])].filter((n) => bases.has(Number(n)));
    ok(copiados.length === 0,
      `carrito.ts línea ${i + 1} tiene un precio de la tabla escrito a mano (${copiados.join(', ')}): ${l.trim()}`);
  });
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
ok(liviano.costo === porNombre[CORDOBA].base, 'un paquete liviano no debería pagar extra por peso');
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
console.log('  Origen: Córdoba capital (CP 5000) · la tabla es la red de seguridad de OCA\n');
console.log(`  ${ZONAS.length} zonas · ${cubiertos.length} códigos postales cubiertos · ${REALES.length} ciudades verificadas\n`);
console.log(`  Las tarifas de OCA son netas; la columna «SALE» ya tiene el ${Math.round(IVA_ENVIO * 100)} % de IVA.\n`);
console.log(`  ${'ZONA'.padEnd(30)} ${'RANGOS'.padEnd(28)} ${'COBRA'.padStart(9)}  ${'SALE'.padStart(9)}  ${'MARGEN'.padStart(7)}  DÍAS`);
for (const z of ZONAS) {
  const rangos = z.rangos.map(([a, b]) => `${a}-${b}`).join(', ');
  const real = costoRealDe(z);
  const margen = real ? `${Math.round((z.base / real - 1) * 100)} %` : '·';
  console.log(`  ${z.nombre.padEnd(30)} ${rangos.padEnd(28)} ${('$ ' + z.base).padStart(9)}  ${(real ? '$ ' + real : '· estimada').padStart(9)}  ${margen.padStart(7)}  +${z.diasExtra}`);
}
const operativas = [...new Set(ZONAS.filter((z) => z.medido).map((z) => z.medido.operativa))];
if (operativas.length) {
  console.log(`\n  Las mediciones salen de la operativa ${operativas.join(' y ')} de OCA.`);
  /* Una sola tabla no puede mezclar productos: si dos zonas se
     midieron con operativas distintas, sus precios no son
     comparables entre sí y el orden por distancia deja de significar
     nada. */
  ok(operativas.length === 1,
    `la tabla mezcla mediciones de operativas distintas (${operativas.join(', ')}): son productos de OCA con tarifarios distintos y no se pueden comparar entre sí`);
}
if (sinMedir.length) {
  console.log(`\n  ${sinMedir.length} zona(s) con precio estimado y no medido: ${sinMedir.join(', ')}.`);
  console.log('  Para medirlas:  $env:OCA_MODO = "produccion"  y  npm run logistica:vivo');
  console.log('  (cotizar es una consulta de precio: no da de alta ningún envío)');
}

if (fallos.length) {
  console.log(`\n  ${fallos.length} problema(s):`);
  for (const f of fallos) console.log(`   · ${f}`);
  process.exit(1);
}
console.log('\n✓ la tabla de zonas es coherente y da las zonas reales\n');
