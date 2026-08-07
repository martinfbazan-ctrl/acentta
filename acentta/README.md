# acentta

Marketplace de dropshipping de decoración y deco inteligente.
Proyecto conceptual propio, construido como pieza de portafolio.

Argentina · pesos argentinos · español neutro · envío gratis superando $ 50.000.

---

## Ver el sitio sin instalar nada

En la carpeta del proyecto hay dos archivos que se abren con doble clic:

- `vista-previa-sistema.html` — el sistema de diseño completo
- `vista-previa-inicio.html` — el índice de etapas

Son copias autocontenidas del build (estilos y fuente incrustados). Sirven para
mirar, no para desarrollar: el sitio real se corre con Astro.

---

## Correr el proyecto

### 1. Instalar Node.js (una sola vez)

1. Entrá a **https://nodejs.org** y descargá la versión **LTS** para Windows.
2. Ejecutá el instalador y aceptá todas las opciones por defecto.
3. Abrí una terminal nueva (tecla Windows → escribí `powershell` → Enter) y verificá:

```bash
node --version
```

Tiene que responder algo como `v22.x.x`. Si dice "no se reconoce el comando",
cerrá la terminal, abrí una nueva y probá otra vez.

### 2. Instalar las dependencias del proyecto

Desde la terminal, parado en esta carpeta:

```bash
cd "C:\Users\Martín Bazán\Downloads\Martin\PORTFOLIO\Proyecto 4\acentta"
npm install
```

Tarda uno o dos minutos la primera vez. Crea la carpeta `node_modules/`,
que no se sube a git.

### 3. Levantar el sitio

```bash
npm run dev
```

Abrí **http://localhost:4321** en el navegador. Los cambios se ven al instante,
sin recargar.

### Otros comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en localhost:4321 |
| `npm run build` | Genera el sitio estático en `dist/` |
| `npm run preview` | Sirve `dist/` como quedaría publicado |
| `npm run check` | Verifica tipos y accesibilidad del código |

---

## Publicar

El sitio es 100 % estático. Se publica en Vercel sin configurar nada:

1. Subí la carpeta a un repositorio de GitHub.
2. En **vercel.com** → *Add New Project* → elegí el repositorio.
3. Vercel detecta Astro solo. *Deploy*.

Cada rama nueva genera su propia URL de previsualización.

---

## Cómo está organizado

```
acentta/
├─ public/                  archivos que se sirven tal cual
│  ├─ fuentes/              Inter variable, sólo subconjunto latino (48 KB)
│  ├─ logo-acentta.svg
│  └─ favicon.svg
├─ src/
│  ├─ styles/
│  │  ├─ fuentes.css        declaración de la tipografía
│  │  ├─ tokens.css         ← toda decisión visual empieza acá
│  │  ├─ base.css           reset, tipografía y layout
│  │  └─ componentes.css    componentes con todos sus estados
│  ├─ types/
│  │  └─ catalogo.ts        contrato de datos + reglas de negocio
│  ├─ lib/
│  │  └─ formato.ts         precios, fechas y envío en formato argentino
│  ├─ components/           componentes de interfaz
│  ├─ layouts/
│  │  └─ Base.astro         estructura HTML común
│  ├─ scripts/
│  │  └─ base.ts            comportamientos sin librerías
│  └─ pages/                cada archivo acá es una URL
└─ astro.config.mjs
```

### Dónde tocar qué

| Quiero cambiar… | Voy a… |
|---|---|
| Un color, un tamaño, un radio | `src/styles/tokens.css` |
| Cómo se ve un precio o una fecha | `src/lib/formato.ts` |
| El umbral de envío gratis | `src/types/catalogo.ts` → `UMBRAL_ENVIO_GRATIS` |
| Los datos de un producto | `src/data/` (a partir de la etapa 6) |
| Agregar una página | crear un archivo en `src/pages/` |

La capa de datos está aislada a propósito: si el proyecto se vuelve real,
cambiar el mock por un CMS o un proveedor es tocar un solo archivo.

---

## Estado

| Etapa | Entregable | Estado |
|---|---|---|
| 1 | Tokens, tipografía y componentes base | ✅ listo |
| 2 | Home bento + tarjeta de producto | siguiente |
| 3 | Listado con filtros + ficha completa | pendiente |
| 4 | Mini-carrito, carrito y checkout | pendiente |
| 5 | Confirmación, seguimiento y páginas de confianza | pendiente |
| 6 | Deco inteligente + catálogo definitivo | pendiente |
| 7 | Auditoría de rendimiento y accesibilidad | pendiente |
| 8 | Caso de estudio | pendiente |

---

## Nota sobre las imágenes

Las fotos del catálogo son provisorias, tomadas de bancos gratuitos
(Unsplash y Pexels). Están declaradas en `astro.config.mjs` y se reemplazan
por fotos propias cambiando las URLs en la capa de datos.

## Nota sobre honestidad comercial

El sitio no usa contadores que se reinician, stock inventado ni
"12 personas viendo esto". La urgencia se calcula del stock real: si el stock
sube, el badge desaparece solo. Es una decisión deliberada y forma parte del
caso de estudio.
