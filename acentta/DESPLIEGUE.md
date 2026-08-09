# Publicar acentta en Vercel

Fase 0 del plan de venta. Objetivo: una dirección web que se pueda mandar, con HTTPS, que se actualice sola cada vez que se cambia algo.

Todo lo que sigue es gratis y no requiere tarjeta.

---

## Antes de empezar: qué quedó preparado

No hay que configurar nada en Vercel más allá de un campo. La configuración vive en el repositorio, versionada, y se puede auditar:

| Archivo | Qué resuelve |
|---|---|
| `vercel.json` | Cabeceras de seguridad, caché de un año para lo que no cambia, direcciones sin barra final |
| `public/robots.txt` | Qué recorren los buscadores y dónde está el mapa del sitio |
| `public/og.png` | La tarjeta que se ve al pegar el enlace en WhatsApp o LinkedIn |
| `astro.config.mjs` | Mapa del sitio automático, y cero guiones incrustados en el HTML |
| `pruebas/publicacion.mjs` | Verifica las cuatro cosas anteriores antes de que salgan |

Para comprobar que todo sigue en orden, en cualquier momento:

```powershell
cd "C:\Users\Martín Bazán\Downloads\Martin\PORTFOLIO\Proyecto 4\acentta"
npm.cmd install
npm.cmd run auditar
```

La última línea tiene que decir **`nada bloquea la publicación`**.

> `npm.cmd` y no `npm`: la política de seguridad de PowerShell de esta máquina bloquea `npm.ps1`. No hay que cambiar esa política — sólo llamar al archivo `.cmd`, que hace exactamente lo mismo.

---

## Paso 1 · Subir el proyecto a GitHub

Vercel publica leyendo un repositorio. El repositorio local ya existe y tiene todo el historial; falta darle una copia en GitHub.

**Con GitHub Desktop**, que ya está instalado:

1. `File → Add local repository`
2. En el campo de texto, **pegar esta ruta tal cual** en lugar de navegar con `Choose...`:

   ```
   C:\Users\Martín Bazán\Downloads\Martin\PORTFOLIO\Proyecto 4
   ```

   > **La carpeta es `Proyecto 4`, entera.** No `acentta`, que está adentro, y no `.git`, que es una carpeta oculta que usa Git para su propio funcionamiento. Si se selecciona cualquiera de esas dos, GitHub Desktop contesta *«this directory does not appear to be a Git repository»*. Con la ruta correcta el mensaje desaparece solo y el botón `Add repository` se habilita.

3. `Publish repository`
4. Nombre: `acentta`. **Destildar «Keep this code private»** si se quiere que el código sea visible como parte del portafolio; dejarlo tildado si no.

> Se sube la carpeta entera, incluidos los dos PDF del brief y la paleta. Para una pieza de portafolio eso suma: muestra que hubo un encargo escrito antes del código. Si se prefiere que no estén, borrarlos antes de publicar.

---

## Paso 2 · Importar en Vercel

1. Entrar a `vercel.com` y crear la cuenta **con GitHub**. Así queda conectada sola.
2. `Add New → Project` y elegir el repositorio `acentta`.
3. **El único campo que hay que tocar:**

   > **Root Directory** → `acentta`

   Es importante y es fácil pasarlo por alto. El repositorio tiene la carpeta `acentta/` adentro; si Vercel busca en la raíz no encuentra el `package.json` y el despliegue falla con «no framework detected».

4. El resto se detecta solo: framework Astro, comando `astro build`, salida `dist`. Si aparecen ya completados, dejarlos.
5. `Deploy`.

La primera compilación tarda un par de minutos —tiene que instalar las dependencias—. Las siguientes son de segundos.

Al terminar queda algo como `acentta-xxxx.vercel.app`.

---

## Paso 3 · Fijar la dirección definitiva

Éste es el paso que **no** hay que saltear, y explico por qué.

El sitio tiene escrita su propia dirección en tres lugares: la etiqueta canónica de cada página, el mapa del sitio y la tarjeta social. Todas salen de una sola línea:

```js
// astro.config.mjs
site: 'https://acentta.vercel.app',
```

Si la dirección real termina siendo otra, esas tres cosas apuntan a un lugar equivocado. No se rompe nada visible —el sitio se ve igual— pero los buscadores indexan mal y la tarjeta social no carga la imagen. Es el error silencioso más común al publicar.

**Dos caminos:**

**A · Quedarse con el subdominio de Vercel.** En `Settings → Domains`, agregar `acentta.vercel.app`. Si está libre, listo: la configuración ya dice eso y no hay nada que cambiar.

**B · Dominio propio** (`acentta.com.ar`, por ejemplo). Comprarlo en NIC Argentina o donde sea, agregarlo en `Settings → Domains`, y seguir las instrucciones de DNS que da Vercel. El certificado HTTPS lo emite Vercel solo, gratis, en unos minutos.

En cualquiera de los dos casos, si la dirección final **no** es `acentta.vercel.app`, hay que cambiar tres archivos:

1. `astro.config.mjs` → `site`
2. `public/robots.txt` → la línea `Sitemap:`
3. `pruebas/publicacion.mjs` → la constante `SITIO`

Y volver a correr `npm.cmd run auditar`, que precisamente falla si los tres no coinciden.

> Para vender de verdad hace falta el camino B. Nadie deja los datos de su tarjeta en una dirección terminada en `.vercel.app`. Para mostrar en el portafolio, el camino A alcanza y sobra.

---

## Paso 4 · Comprobar que salió bien

Con el sitio arriba, cuatro chequeos de un minuto:

1. **Recorrerlo.** Home, una categoría, una ficha, agregar al carrito, llegar al checkout.
2. **La tarjeta social.** Pegar la dirección en un chat de WhatsApp con uno mismo, sin enviar. Tiene que aparecer la imagen naranja con el logo. Si aparece un recuadro gris, la caché del lector todavía tiene la versión vieja: en LinkedIn se fuerza desde su *Post Inspector*.
3. **El mapa del sitio.** Abrir `/sitemap-index.xml`. Tiene que listar `sitemap-0.xml`, y ése 59 direcciones.
4. **Las cabeceras.** En el navegador, `F12 → Network`, recargar, clic en el primer pedido, pestaña *Headers*. Tiene que estar `content-security-policy`.

---

## Cómo se actualiza a partir de ahora

```
cargar productos en el panel  →  archivos YAML en src/contenido/
        ↓
GitHub Desktop: Commit + Push
        ↓
Vercel compila y publica solo   (~40 segundos)
```

No hay que subir archivos a ningún lado ni entrar a Vercel. Se sube el código y el sitio se rehace.

**Importante:** el panel de carga (`npm.cmd run admin`) sigue corriendo **sólo en esta computadora**. No queda expuesto en internet, y es deliberado: escribe archivos, y un panel que escribe archivos abierto a internet es un problema de seguridad, no una comodidad. El circuito es cargar acá, commitear, y que Vercel publique.

---

## Dos cosas que conviene saber de antemano

**La barra de comentarios de Vercel no va a andar en las vistas previas.** Esa barra carga código desde `vercel.live`, y la política de seguridad del sitio sólo permite código propio. Es el precio de tener la política estricta, y me parece el lado correcto de la balanza: la barra es una comodidad, la política es lo que impide que un guion ajeno se ejecute en una página donde la gente va a dejar sus datos. Si se la quiere igual, se apaga la barra en `Settings → General` o se agrega `https://vercel.live` a `script-src` en `vercel.json`.

**El rendimiento no va a cambiar por publicar.** El LCP de 2,1 a 4,4 segundos que reporta la auditoría es culpa de las fotos provisorias, que se sirven desde un dominio ajeno. Vercel las va a servir igual de lento porque no son suyas. **Ese número sólo baja con fotos propias**, optimizadas y servidas desde el mismo dominio. Publicar no lo arregla y no hay que esperar que lo haga.

---

## Si el despliegue falla

| Lo que dice | Qué pasó |
|---|---|
| `No framework detected` | Falta el **Root Directory** en `acentta` (paso 2.3) |
| `npm ci can only install with an existing package-lock.json` | Falta subir `package-lock.json` — está versionado, revisar que no lo haya excluido el `.gitignore` |
| `Cannot find package '@astrojs/sitemap'` | El `package-lock.json` subido es viejo. Correr `npm.cmd install` local, commitear el lock y volver a subir |
| Compila pero se ve sin estilos | Casi siempre es la caché del navegador. `Ctrl + F5` |

El registro completo de cada intento queda en Vercel, en la pestaña del despliegue. Dice en qué línea se cortó.
