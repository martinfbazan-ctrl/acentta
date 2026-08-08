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

---

## Cómo repetirlo

```
npm run auditar              # todo: tipos, accesibilidad, contraste, peso, teclado, buscador
npm run auditar:a11y         # axe-core + contraste + peso + estabilidad
npm run auditar:teclado      # el circuito de compra sin mouse
npm run auditar:buscador     # 16 consultas, relevancia, combobox
npm run auditar:lighthouse   # LCP, INP, CLS y puntajes — necesita Chrome
```

Las cuatro primeras corren en segundos y no necesitan nada instalado además del proyecto.
