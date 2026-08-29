/**
 * acentta · lo que hay que revisar antes de publicar
 * ---------------------------------------------------------------
 * Las otras tres auditorías miran el sitio por dentro. Ésta mira la
 * frontera entre el sitio y el servidor que lo va a servir, que es
 * donde viven los errores que sólo aparecen en producción: la
 * política de seguridad que bloquea un guion, el mapa del sitio que
 * apunta a una página que ya no existe, la tarjeta social con una
 * ruta relativa que ningún lector de enlaces sabe resolver.
 *
 * Son cinco comprobaciones, y todas se hacen contra la salida
 * compilada y contra `vercel.json` de verdad. Ninguna asume nada:
 * si mañana alguien agrega un guion incrustado, una foto de un
 * dominio nuevo o una página sin canónica, esto lo detiene antes de
 * que llegue a internet.
 *
 *     node pruebas/publicacion.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const DIST = path.join(RAIZ, 'dist');

if (!fs.existsSync(DIST)) {
  console.error('No existe dist/. Correr primero: npm run build');
  process.exit(1);
}

const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); };

/** Todas las páginas compiladas, con su ruta pública. */
function paginas() {
  const salida = [];
  (function recorrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name === 'index.html') {
        const rel = path.relative(DIST, path.dirname(p)).split(path.sep).join('/');
        salida.push({ archivo: p, ruta: rel ? `/${rel}/` : '/', html: fs.readFileSync(p, 'utf8') });
      }
    }
  })(DIST);
  return salida.sort((a, b) => a.ruta.localeCompare(b.ruta));
}

const TODAS = paginas();
const SITIO = 'https://acentta.vercel.app';

/* ============================================================
   1 · La política de seguridad no rompe nada
   ------------------------------------------------------------
   Se lee la política que Vercel va a mandar de verdad, se saca de
   ahí qué permite cada directiva, y se compara contra lo que las
   páginas piden. El error que esto evita —descubrir en producción
   que el carrusel no anda porque el navegador bloqueó su guion— es
   invisible en desarrollo, porque en desarrollo no hay cabeceras.
   ============================================================ */
const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
const cabeceras = vercel.headers.find((h) => h.source === '/(.*)').headers;
const csp = cabeceras.find((h) => h.key === 'Content-Security-Policy').value;

const directivas = Object.fromEntries(
  csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [nombre, ...valores] = d.split(/\s+/);
    return [nombre, valores];
  })
);

/** ¿La directiva permite este origen? 'self' vale para rutas propias. */
function permite(directiva, url) {
  const lista = directivas[directiva] ?? directivas['default-src'] ?? [];
  if (url.startsWith('data:')) return lista.includes('data:');
  if (/^https?:\/\//.test(url)) {
    const origen = new URL(url).origin;
    return lista.includes(origen) || origen === SITIO && lista.includes("'self'");
  }
  return lista.includes("'self'"); // ruta relativa o absoluta del propio sitio
}

for (const { ruta, html } of TODAS) {
  /* Guiones incrustados. Los bloques de datos —application/json y
     ld+json— no se ejecutan y la política no los mira; cualquier
     otro <script> sin src, sí. */
  for (const [, atributos] of html.matchAll(/<script([^>]*)>/g)) {
    if (/\bsrc=/.test(atributos)) continue;
    const tipo = atributos.match(/type="([^"]+)"/)?.[1] ?? '';
    const esDato = tipo === 'application/json' || tipo === 'application/ld+json';
    ok(esDato, `${ruta} · guion incrustado que la política va a bloquear (type="${tipo || 'módulo'}")`);
  }

  /* Hojas de estilo incrustadas: la política permite 'unsafe-inline'
     para estilo, así que esto no falla — pero se avisa igual si
     alguna vez se quiere endurecer. */

  for (const [, src] of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
    ok(permite('script-src', src), `${ruta} · script-src bloquea ${src}`);
  }
  for (const [, src] of html.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)) {
    ok(permite('img-src', src), `${ruta} · img-src bloquea ${src}`);
  }
  for (const [, rel, href] of html.matchAll(/<link[^>]*\brel="([^"]+)"[^>]*\bhref="([^"]+)"/g)) {
    if (rel.includes('stylesheet')) ok(permite('style-src', href), `${ruta} · style-src bloquea ${href}`);
    if (rel.includes('preload') && /\.woff2?$/.test(href)) ok(permite('font-src', href), `${ruta} · font-src bloquea ${href}`);
  }
}

/* Las hojas de estilo pueden pedir imágenes que el HTML no menciona. */
for (const css of fs.readdirSync(path.join(DIST, '_astro')).filter((f) => f.endsWith('.css'))) {
  const texto = fs.readFileSync(path.join(DIST, '_astro', css), 'utf8');
  for (const [, url] of texto.matchAll(/url\((?!['"]?#)['"]?([^'")]+)['"]?\)/g)) {
    const directiva = /\.woff2?($|\?)/.test(url) ? 'font-src' : 'img-src';
    ok(permite(directiva, url), `${css} · ${directiva} bloquea ${url}`);
  }
}

/* ============================================================
   2 · El mapa del sitio y el HTML dicen lo mismo
   ------------------------------------------------------------
   Una página que está en el mapa y además lleva `noindex` es una
   contradicción por escrito: el mapa pide que la indexen y el HTML
   pide que no. El buscador resuelve la contradicción desconfiando
   del mapa entero, así que el costo no lo paga esa página sola.
   ============================================================ */
const mapa = path.join(DIST, 'sitemap-0.xml');
ok(fs.existsSync(mapa), 'no se generó sitemap-0.xml');

if (fs.existsSync(mapa)) {
  const xml = fs.readFileSync(mapa, 'utf8');
  const enElMapa = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));

  for (const { ruta, html } of TODAS) {
    const sinIndexar = /<meta name="robots" content="noindex"/.test(html);
    const listada = enElMapa.has(ruta) || enElMapa.has(ruta.replace(/\/$/, ''));
    if (sinIndexar) ok(!listada, `${ruta} · lleva noindex y aun así está en el mapa del sitio`);
    else ok(listada, `${ruta} · es indexable y falta en el mapa del sitio`);
  }

  /* Y al revés: que el mapa no prometa páginas que no existen. */
  for (const p of enElMapa) {
    const normal = p.endsWith('/') ? p : `${p}/`;
    ok(TODAS.some((x) => x.ruta === normal), `el mapa lista ${p}, que no existe en dist/`);
  }
}

/* robots.txt tiene que apuntar al mapa real, no a uno viejo. */
const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
ok(robots.includes(`${SITIO}/sitemap-index.xml`), 'robots.txt no apunta al mapa del sitio de este dominio');

/* ============================================================
   3 · La tarjeta social existe y es absoluta
   ------------------------------------------------------------
   Los lectores de enlaces de WhatsApp, LinkedIn y Slack no resuelven
   rutas relativas. Un `og:image` que diga "/og.png" no falla: muestra
   un recuadro gris, que es peor, porque parece que anduvo.
   ============================================================ */
for (const { ruta, html } of TODAS) {
  const imagen = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  ok(imagen, `${ruta} · sin og:image`);
  if (imagen) {
    ok(imagen.startsWith('https://'), `${ruta} · og:image no es absoluta: ${imagen}`);
    const local = path.join(DIST, new URL(imagen).pathname);
    ok(fs.existsSync(local), `${ruta} · og:image apunta a ${imagen}, que no está en dist/`);
  }
  ok(/<meta name="twitter:card" content="summary_large_image"/.test(html), `${ruta} · sin tarjeta de Twitter`);
}

/* La imagen tiene que medir lo que dice medir: si el alto y el ancho
   declarados no coinciden, la tarjeta se recorta sola. */
const og = fs.readFileSync(path.join(DIST, 'og.png'));
const ancho = og.readUInt32BE(16), alto = og.readUInt32BE(20);
ok(ancho === 1200 && alto === 630, `og.png mide ${ancho}×${alto} y debería medir 1200×630`);

/* ============================================================
   4 · Ninguna canónica quedó apuntando a otro lado
   ============================================================ */
for (const { ruta, html } of TODAS) {
  const canonica = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  ok(canonica?.startsWith(SITIO), `${ruta} · canónica fuera del dominio: ${canonica}`);
}

/* ============================================================
   5 · Las cabeceras que importan están puestas
   ============================================================ */
for (const clave of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security']) {
  ok(cabeceras.some((h) => h.key === clave), `falta la cabecera ${clave} en vercel.json`);
}
ok(vercel.trailingSlash === false,
  'vercel.json no fija trailingSlash: los enlaces del sitio no llevan barra final y sin esto cada uno paga una redirección');

/* ============================================================
   6 · Nadie arma una dirección de foto por su cuenta
   ------------------------------------------------------------
   Existe por un defecto que costó caro y que no se vio durante
   meses. Seis guiones escribían la dirección de las fotos a mano:

       src="https://images.unsplash.com/${i.imagen}?w=200&q=72"

   Mientras todas las fotos fueron de banco, funcionó. El día que
   entró el primer producto con foto propia, esa línea produjo
   `https://images.unsplash.com//imagenes/productos/...webp` —una
   dirección que no existe— y la foto desapareció de la galería, del
   mini-carrito, del carrito, del checkout, de la confirmación y del
   seguimiento. Seis pantallas, un solo error, repetido seis veces.

   Lo encontró el dueño del sitio mirando su primer producto real, no
   una prueba. Por eso esto ahora es una prueba.

   La regla: la única que sabe cómo se arma la dirección de una foto
   es `src/lib/imagenes.ts`. Cualquier otro archivo que nombre el
   dominio del banco de fotos está duplicando esa lógica, y la copia
   va a quedar desactualizada — no es una hipótesis, ya pasó.
   ============================================================ */
{
  const permitidos = new Set([
    path.join('src', 'lib', 'imagenes.ts'),
    /* El layout abre la conexión al banco por adelantado. Nombra el
       dominio pero no arma ninguna dirección de foto. */
    path.join('src', 'layouts', 'Base.astro'),
  ]);

  const recorrer = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return recorrer(completo);
    return /\.(ts|astro|mjs)$/.test(e.name) ? [completo] : [];
  });

  for (const archivo of recorrer(path.join(RAIZ, 'src'))) {
    const relativo = path.relative(RAIZ, archivo);
    if (permitidos.has(relativo)) continue;
    const texto = fs.readFileSync(archivo, 'utf8');
    /* Sólo cuenta cuando se está construyendo una dirección, no
       cuando el dominio aparece en un comentario que explica
       justamente este error. */
    if (/["'`]https:\/\/images\.unsplash\.com\//.test(texto)) {
      fallos.push(
        `${relativo} arma una dirección de foto a mano. Tiene que usar foto() o srcset() `
        + 'de @lib/imagenes, o las fotos propias se rompen en esa pantalla',
      );
    }
  }
}

/* ============================================================
   7 · Todo producto nombrado a mano existe en el catálogo
   ------------------------------------------------------------
   Varias páginas piden un producto puntual por su dirección para
   armar el hero, la portada del caso de estudio o los ejemplos del
   sistema de diseño, y lo hacen con `!`:

       const arco = porSlug('lampara-de-pie-arco')!;

   Ese signo le promete al compilador que el producto existe. La
   promesa vale hasta que alguien edita el catálogo. El día que se
   recortó, tres promesas se volvieron falsas y el sitio dejó de
   compilar con un «Cannot read properties of undefined» que no
   menciona ni el producto ni el catálogo: hay que ir a buscarlo.

   Esta comprobación convierte ese rastro de pila en una línea que
   dice qué archivo nombra qué producto inexistente. Y corre sin
   construir nada, así que avisa antes.
   ============================================================ */
{
  const dirProductos = path.join(RAIZ, 'src', 'contenido', 'productos');
  const existentes = new Set(
    fs.readdirSync(dirProductos)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => f.replace(/\.yaml$/, '')),
  );

  const recorrer = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return recorrer(completo);
    return /\.(ts|astro)$/.test(e.name) ? [completo] : [];
  });

  for (const archivo of recorrer(path.join(RAIZ, 'src'))) {
    const relativo = path.relative(RAIZ, archivo);
    for (const linea of fs.readFileSync(archivo, 'utf8').split('\n')) {
      /* Los comentarios se saltean: varios explican justamente este
         error y nombran el producto que ya no está. Documentar un
         defecto no puede contar como cometerlo. */
      const limpia = linea.trim();
      if (limpia.startsWith('*') || limpia.startsWith('//') || limpia.startsWith('/*')) continue;

      for (const m of linea.matchAll(/porSlug\(\s*'([^']+)'/g)) {
        if (!existentes.has(m[1])) {
          fallos.push(
            `${relativo} nombra el producto «${m[1]}», que ya no está en el catálogo`,
          );
        }
      }
    }
  }
}

/* ============================================================ */
console.log('\n=== LISTO PARA PUBLICAR ===');
console.log(`  ${TODAS.length} páginas revisadas`);
console.log(`  política de seguridad: ${Object.keys(directivas).length} directivas`);

if (fallos.length) {
  console.log(`\n  ${fallos.length} problema(s):`);
  for (const f of fallos) console.log(`   · ${f}`);
  process.exit(1);
}
console.log('\n✓ nada bloquea la publicación\n');
