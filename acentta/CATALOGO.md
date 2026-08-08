# Cargar y editar productos

El catálogo se administra desde un panel visual. No hace falta tocar código.

---

## Abrir el panel

En PowerShell, parado en la carpeta `acentta`:

```
npm.cmd install
npm.cmd run admin
```

Y abrir **http://localhost:4321/keystatic**

La primera vez `install` tarda unos minutos. Después, `admin` levanta en segundos.

Esa ventana queda ocupada mientras el panel esté abierto. Para cerrarlo: clic dentro y `Ctrl` + `C`.

---

## Dar de alta un producto

1. **Productos → New entry**
2. Completar el formulario. Cada campo explica para qué sirve.
3. **Create**

Se guarda como un archivo en `src/contenido/productos/`. El sitio lo toma al compilar.

### Lo mínimo para que compile

| Campo | Por qué es obligatorio |
|---|---|
| Nombre | Es también la dirección del producto en el sitio |
| Precio | Mayor a cero |
| Al menos una variante | Aunque el producto no tenga colores ni medidas |
| Al menos una foto con descripción | Sin descripción no compila: la lee quien no ve la imagen |
| Peso | Define el costo del envío |

Si falta algo, **el sitio no se publica y dice cuál es el producto y qué le falta**. Es a propósito: es preferible un error al compilar que una ficha rota en vivo.

---

## Dar de baja un producto

**Productos → abrir el producto → Delete**

Desaparece del sitio en la próxima compilación: su ficha, su lugar en la categoría, en el buscador y en las sugerencias de otros productos.

**Es reversible.** El catálogo está versionado: queda registrado qué se borró y cuándo, y se puede recuperar.

> Si el producto sólo está sin stock, **no lo borres**: poné el stock en 0. El sitio lo muestra como «Agotado» pero mantiene la página viva. Borrarlo pierde el tráfico de quien ya lo busca en Google.

---

## Las fotos

Se suben arrastrándolas al campo **Foto**. Van a `public/imagenes/productos/` y se sirven desde el mismo dominio del sitio.

- **Tamaño recomendado:** 800 × 1000 px o más, en vertical.
- **La primera foto es la que se ve en la grilla.** El orden importa.
- **La descripción es obligatoria.** Una frase sobre qué se ve.

Cada producto puede convivir con fotos propias y con las provisorias del prototipo. Si un producto tiene el campo **Identificador de foto provisoria** completo y le subís un archivo, gana el archivo.

**Reemplazar las fotos provisorias es lo que falta para llegar a la meta de velocidad.** Hoy vienen de un servidor ajeno y por eso la imagen grande tarda entre 2 y 4 segundos en aparecer. Servidas desde el propio dominio, ese número baja solo.

---

## Lo que el panel *no* deja hacer, a propósito

**«Agotado» y «Últimas unidades» no se pueden escribir.** Los calcula el sitio del stock real de cada variante: 0 muestra agotado, 5 o menos muestra últimas unidades. No existe un campo para ponerlos a mano, y por eso esos avisos nunca pueden mentir.

**El precio anterior tiene que ser mayor al actual.** Inflar el precio tachado para que el descuento parezca más grande hace que el sitio no compile.

**El contador de unidades vendidas es opcional.** Vacío significa que el producto no entra en el ranking de más vendidos. Es la respuesta correcta cuando no se tiene el dato.

---

## Publicar los cambios

```
npm.cmd run build
```

Genera el sitio en `dist/`, listo para subir a cualquier hosting.

Antes de publicar conviene correr:

```
npm.cmd run auditar
```

Revisa tipos, accesibilidad, contraste, peso, el buscador y el circuito de compra con teclado. Tarda menos de un minuto y avisa si algo que cargaste rompió algo.

---

## Por qué el panel está separado del sitio

Son dos configuraciones distintas:

| Comando | Qué levanta |
|---|---|
| `npm run dev` | El sitio, sin panel |
| `npm run admin` | El panel, para cargar productos |
| `npm run build` | El sitio publicable, estático puro |

El panel necesita React y un servidor para poder escribir archivos. Si eso viviera en la configuración del sitio, el resultado publicado dejaría de ser HTML plano y **quien entra a comprar descargaría React para nada**.

Separados, el sitio publicado pesa exactamente lo mismo que antes de que existiera el panel, y el panel nunca queda expuesto en internet: se usa en la máquina de quien carga los productos.

---

## Si más adelante hacen falta varios editores

Hoy el panel corre en una sola máquina. Para que varias personas carguen productos desde cualquier lado hay dos caminos:

- **Conectar el panel a GitHub.** Keystatic soporta un modo donde cada cambio se guarda en el repositorio remoto y se puede editar desde el navegador, con permisos. Es configuración, no reescritura.
- **Mover el catálogo a un CMS en la nube** tipo Sanity o Storyblok. Sólo cambia `src/data/productos.ts`, que es la frontera: ninguna página del sitio se entera.
