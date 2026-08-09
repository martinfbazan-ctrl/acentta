# Auditoría técnica · acentta

Etapa 7 del plan. Todo lo que sigue se puede reproducir con `npm run auditar`.

Se audita la **salida compilada**, no el código fuente: lo que importa es lo que recibe el navegador después de que el compilador y el minificador hicieron lo suyo. Dos de los errores más difíciles de este proyecto —el desenfoque del encabezado y el guion partido de la vista previa— sólo eran visibles ahí.

---

## Qué se midió y qué no

Un informe honesto empieza por su propio límite.

| Medido acá, y es concluyente | Requiere un navegador de verdad |
|---|---|
| axe-core sobre las 64 páginas | LCP, INP y CLS reales |
| Contraste, con la fórmula de WCAG | Puntaje de Lighthouse |
| Peso por página, con y sin comprimir | Tiempo de bloqueo del hilo principal |
| Imágenes sin medidas declaradas | |
| El circuito de compra con teclado | |

Lo de la derecha depende de red, CPU y motor de layout. Para eso está `npm run auditar:lighthouse`, que levanta el sitio, corre Lighthouse en móvil sobre las cuatro pantallas del circuito de compra y falla si alguna meta del brief no se cumple. Necesita Chrome y dos dependencias que pesan más de 100 MB, por eso no vienen instaladas.

**No se reporta ningún número que no se haya medido.**

---

## Lighthouse · primera corrida

Lighthouse 13.4.1, perfil **móvil** con red y CPU limitadas. Ésta es la medición inicial, **antes** de las correcciones que aparecen más abajo.

| Página | Rend. | A11y | B. prácticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Home | 85 | **100** | **100** | **100** | 4359 ms | **0** | **0** |
| Categoría | 99 | 98 | **100** | **100** | 2120 ms | **0** | **0** |
| Ficha | 92 | **100** | **100** | **100** | 3394 ms | **0** | **0** |
| Carrito | 90 | **100** | **100** | 66 | 1658 ms | 0,21 | **0** |

Lo que se cumple sin discusión: **accesibilidad 100** en tres de cuatro, **buenas prácticas 100** en todas, y **TBT 0 ms** en todas — el hilo principal nunca se bloquea, que es la mitad de lo que hace que un sitio se sienta rápido.

### Lo que no se cumplió, y por qué

**LCP entre 2,1 y 4,4 segundos.** El elemento más grande es siempre la foto del hero, y todas las fotos son de `images.unsplash.com`. Antes de poder pedir el primer byte hay que resolver el DNS, abrir el TCP y negociar el TLS contra un dominio ajeno: en una red móvil simulada eso son varios cientos de milisegundos de nada. Se agregó `preconnect` para que esa negociación arranque junto con el HTML.

Pero el techo real es otro: son fotos provisorias servidas por un tercero. **Con las fotos propias, optimizadas y servidas desde el mismo dominio, este número cae solo** — y ése es justamente el plan del brief. No hay forma honesta de llegar a 2 segundos con placeholders remotos.

**CLS de 0,21 en el carrito.** El único desplazamiento de todo el sitio, y era real: el carrito pinta sus líneas desde el almacenamiento del navegador, así que el bloque nace vacío y crece un instante después, empujando el pie de página. Se reservó la altura mientras no hay contenido, y se libera sola en cuanto entra la primera línea.

**Accesibilidad 98 en categoría.** Orden de encabezados: la página saltaba de `h1` a los `h3` de las tarjetas. El mismo defecto que ya se había corregido en la búsqueda, en el otro componente. Corregido.

**SEO 66 en el carrito.** Es un falso positivo: la página lleva `noindex` a propósito —nadie quiere su carrito en Google— y Lighthouse lo penaliza igual. La auditoría ahora no exige SEO en páginas marcadas como no indexables.

> Volver a correr `npm run auditar:lighthouse` para medir después de estas correcciones.

---

## Resultados

### Accesibilidad — axe-core, 64 páginas

**Sin infracciones.** Se corrigieron tres.

**Contenido fuera de todo punto de referencia — 60 de 64 páginas.** La franja de promesas vivía suelta antes del `<header>`. Quien recorre una página saltando entre landmarks —que es como navega mucha gente con lector de pantalla— se salteaba el único lugar donde el sitio dice que el envío puede ser gratis.

Meterla dentro del encabezado lo habría arreglado, pero el encabezado es fijo: la franja se habría quedado pegada arriba ocupando alto para siempre. Pasó a ser un `<aside>` con nombre accesible, que ya es una región complementaria por sí sola. Se arregla sin mover nada, y además es lo que la franja es.

**Tres `h1` en el checkout.** Uno por paso. Sólo se ve uno a la vez, pero el árbol de accesibilidad no sabe de pasos: ve tres títulos de nivel uno y ninguna jerarquía. Ahora hay un `h1` para la página y un `h2` por paso.

**Salto de `h1` a `h3` en la búsqueda.** Los nombres de producto son `h3` dentro de la tarjeta, que es un componente compartido. Faltaba el escalón del medio.

### Contraste — fórmula WCAG sobre los colores reales

**32 de 32 combinaciones cumplen.**

No es una matriz de todos los colores contra todos los fondos. Eso suena más riguroso y es lo contrario: marca como falla el gris de un metadato sobre el verde oliva de la zona de ofertas, donde ese gris nunca aparece, y entierra los casos que importan entre veinte que no. Se auditan las combinaciones que el sitio usa de verdad, cada una con el mínimo que le corresponde según para qué se usa el color.

**Se corrigió una.** El gris del precio tachado daba **2,998:1** sobre el fondo arena, contra un mínimo de 3. Pasar o no pasar por dos milésimas es lo mismo que no pasar. Se oscureció de `#9C8C7A` a `#918170`: 3,47:1 sobre arena y 3,09:1 sobre el arena honda, que es el fondo más difícil donde aparece.

Este chequeo es aritmética pura: da el mismo número que cualquier herramienta, sin navegador.

### Peso — HTML + CSS + JS, sin imágenes

Meta del brief: **menos de 300 KB**.

| Página | Sin comprimir | Comprimida |
|---|---|---|
| `/buscar` | 240 KB | **33 KB** |
| `/ofertas` | 186 KB | 31 KB |
| `/` | 163 KB | 31 KB |
| `/deco-inteligente` | 160 KB | 30 KB |
| ficha de producto | 144 KB | 32 KB |

La más pesada queda **60 KB por debajo de la meta**, y eso sin contar la compresión: servida por HTTP son 33 KB.

`/buscar` es la más grande porque lleva las 36 tarjetas renderizadas en HTML. Es deliberado: permite que el buscador conteste sin una sola petición y que Google indexe el catálogo entero. El costo real —33 KB comprimidos— es menor que el de una sola foto.

### Estabilidad de carga

**Sin avisos.** Se corrigió uno.

**Prioridad de carga repartida entre varias imágenes.** Diez páginas pedían prioridad alta para tres o cuatro fotos. `fetchpriority="high"` está pensado para un solo elemento: el que va a ser el LCP. Repartirlo no adelanta ninguna —se disputan el mismo ancho de banda— y sí le quita turno al CSS y a la tipografía, que son lo que bloquea el primer pintado. Ahora esa prioridad la tiene la foto del hero, y nadie más. Las primeras tarjetas siguen cargando sin diferir, que es lo que hacía falta.

Todas las imágenes que participan del flujo declaran `width` y `height`, así que el navegador reserva el espacio antes de descargarlas y nada se mueve al aparecer.

### Teclado — el circuito de compra completo sin mouse

**Se completa entero.** No se verifica mirando: la prueba lo recorre.

Camina ficha → agregar → mini-carrito → carrito → checkout → confirmar usando sólo Tab, Enter, las flechas y Escape, y en cada parada comprueba tres cosas: que el control sea alcanzable con Tab en un orden que siga la lectura, que Enter haga lo mismo que el clic, y que el foco no se pierda ni quede atrapado.

Lo que quedó verificado, punto por punto:

- El primer Tab de cada página es «saltar al contenido».
- Los enlaces de las láminas del carrusel que no se ven **no** reciben foco.
- Al agregar al carrito, el foco entra al panel; con Escape sale y vuelve exactamente a donde estaba.
- Todos los campos del checkout tienen etiqueta asociada.
- Al cambiar de paso, el foco va al título del paso nuevo — sin dibujar el anillo, porque el título no es interactivo y el anillo no orientaría a nadie.
- El botón de confirmar, que vive fuera del formulario, está conectado con el atributo `form`: sin eso el teclado llegaría a un botón que no hace nada.
- Ningún `tabindex` positivo en todo el sitio.
- Ningún control con manejador de clic que no sea enfocable.

### Publicación — la frontera entre el sitio y el servidor

**65 páginas revisadas, nada bloquea la publicación.**

Las cuatro auditorías anteriores miran el sitio por dentro. Ésta mira lo que sólo existe cuando hay un servidor delante, que es donde viven los errores que no se pueden ver en desarrollo: en desarrollo no hay cabeceras.

Comprueba cinco cosas contra `vercel.json` de verdad y contra la salida compilada:

- **Que la política de seguridad no bloquee nada del propio sitio.** Lee las directivas de la política que Vercel va a mandar y compara cada guion, hoja de estilo, tipografía e imagen —incluidas las que piden los CSS y no aparecen en el HTML— contra lo que la política permite.
- **Que el mapa del sitio y el HTML no se contradigan.** Una página que está en el mapa y además lleva `noindex` pide dos cosas opuestas; el buscador resuelve la contradicción desconfiando del mapa entero, así que el costo no lo paga esa página sola. También al revés: que el mapa no prometa direcciones que no existen.
- **Que la tarjeta social sea absoluta y exista.** Los lectores de enlaces de WhatsApp y LinkedIn no resuelven rutas relativas. Un `og:image` que diga `/og.png` no da error: muestra un recuadro gris, que es peor, porque parece que funcionó.
- **Que ninguna canónica haya quedado apuntando a otro dominio.**
- **Que las cabeceras de seguridad estén puestas.**

La primera es la que justifica la prueba. La política dice `script-src 'self'`: sólo se ejecuta código que venga de un archivo propio. Astro, por defecto, incrusta los guiones chicos dentro del HTML para ahorrar una petición — y un guion incrustado no viene de ningún archivo. Con la configuración anterior se caían **el carrusel de la home y la validación de los formularios de contacto y arrepentimiento**, en producción y sólo en producción.

Se arregló poniendo el umbral de incrustado en cero, que es más barato que las dos alternativas habituales: agregar `'unsafe-inline'` es desactivar justo lo que la política existe para impedir, y firmar cada guion con su hash obliga a rehacer las firmas en cada compilación. El costo real son tres pedidos más en tres páginas, sobre HTTP/2 y cacheados un año.

**La prueba se verificó al revés.** Se revirtió el cambio a propósito y la auditoría nombró exactamente las tres páginas afectadas, con código de salida 1. Una prueba que nunca falla no prueba nada.

---

## Cómo repetirlo

### Lo que se rompió en móvil, y por qué no lo vio nadie

Tres defectos que llegaron a estar publicados, los tres invisibles para las auditorías de arriba. Vale la pena la lista porque cada uno dejó una prueba nueva.

**Una variable de CSS que no existía.** El campo de búsqueda decía `padding: 0 110px 0 var(--e-11)`, y `--e-11` no está en la escala —que salta 6, 8, 10, 12—. Una variable sin declarar no deja la propiedad en un valor parecido: **invalida la declaración entera**, así que se caían también los 110 px de la derecha. Sangría cero, y el texto escribiéndose por debajo de la lupa. Aparecieron tres casos, todos por suponer que existía el número del medio; dos dejaron sin separación las filas de rubro de la portada. Ninguno emite advertencia en el navegador, ni en el compilador, ni en `astro check`.

**El botón de pagar, plegado.** En pantalla angosta el resumen arranca cerrado. El botón «Confirmar compra» y el plan de cuotas vivían adentro de la parte plegable, así que en un teléfono había que descubrir «Ver el detalle» para poder pagar. axe no lo ve —el botón está en el HTML y bien etiquetado— y la prueba de teclado tampoco, porque corre con el ancho de escritorio, donde el resumen nunca se pliega.

**Media Argentina, cobrada como Buenos Aires.** La zona «Provincia de Buenos Aires» declaraba el rango 1901-8199 y la búsqueda devuelve la primera coincidencia, así que se comía enteras a «Centro y Cuyo» y a «Norte». Córdoba, Rosario, Mendoza, Tucumán y Salta pagaban $ 7.300 en lugar de $ 8.100 o $ 9.400, con dos días de plazo en lugar de tres o cuatro. Dos de las seis zonas eran código muerto. No hay excepción ni consola: la calculadora contestaba rápido y con una zona plausible.

De paso apareció otro hueco: los códigos 8200-8299 no los cubría nadie.

**Lo que tienen en común.** Ninguno rompe nada de forma visible para una máquina. Son errores de valor, no de estructura, y por eso hicieron falta preguntas nuevas: ¿existe cada variable que se usa?, ¿se puede pagar sin desplegar nada?, ¿alguna zona se pisa con otra?

---

## Cómo repetirlo

```
npm run auditar              # todo lo que corre sin navegador
npm run auditar:a11y         # axe-core + contraste + peso + estabilidad + variables de CSS
npm run auditar:envio        # solapamientos, huecos y 16 ciudades reales
npm run auditar:teclado      # el circuito de compra sin mouse
npm run auditar:buscador     # 16 consultas, relevancia, combobox
npm run auditar:checkout     # el checkout a ancho de teléfono y de escritorio
npm run auditar:publicacion  # política de seguridad, mapa del sitio, tarjeta social, canónicas
npm run auditar:movil        # desborde horizontal y altura del precio — necesita Chrome
npm run auditar:lighthouse   # LCP, INP, CLS y puntajes — necesita Chrome
```

Las siete primeras corren en segundos y no necesitan nada instalado además del proyecto. Las dos últimas abren un Chrome de verdad, porque miden cosas que sólo existen cuando hay layout: `auditar:movil` abre siete páginas a 390 y a 360 px y falla si alguna se puede arrastrar para el costado o si el precio de la ficha queda debajo del pliegue.

**En Windows**, si PowerShell contesta *«no se puede cargar el archivo npm.ps1 porque la ejecución de scripts está deshabilitada»*, usar `npm.cmd` en lugar de `npm`:

```
npm.cmd run auditar
```

Es el mismo programa. `npm` a secas resuelve al envoltorio `npm.ps1`, y la política de ejecución de PowerShell lo bloquea de fábrica; la versión `.cmd` hace lo mismo sin pasar por ahí. No hace falta cambiar ninguna configuración de seguridad del sistema.
