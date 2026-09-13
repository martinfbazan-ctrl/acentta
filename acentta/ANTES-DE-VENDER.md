# Antes de vender de verdad

Qué falta, qué hay que cambiar y en qué orden, para pasar de la tienda de prueba que funciona hoy a una que cobra plata real.

Nada de esto hace falta mientras sigas en modo de prueba. Está escrito para el día que decidas dar el paso.

---

## Cómo está hoy

Lo que ya funciona, verificado de punta a punta:

| | |
|---|---|
| El total lo calcula el servidor desde el catálogo | El navegador manda qué se compra, nunca cuánto sale |
| El pedido se registra **antes** de cobrar | Un aviso perdido es recuperable, no un cobro sin registro |
| Cobro con checkout alojado | El sitio nunca ve un número de tarjeta |
| El aviso de pago se verifica | Firma en Mercado Pago, token en Mobbex |
| **Al aviso no se le cree** | El estado sale siempre de una consulta a la API |
| Idempotencia | Ocho reintentos procesan una sola vez, pero un cambio de estado sí entra |
| Comprobación de monto | Si lo cobrado no coincide con lo cotizado, no se aprueba |
| Consulta manual de estados | La red de seguridad para el aviso que se pierde |
| Pantalla de pedidos con clave | Con el campo de seguimiento, que es lo que gana un contracargo |
| La pasarela es intercambiable | Mobbex hoy, Mercado Pago a una variable de distancia |

**El circuito de cobro está resuelto.** Lo que sigue son las piezas de alrededor.

> **Cambió la pasarela.** El sitio cobraba con Mercado Pago y ahora cobra con **Mobbex**: el arancel de Mercado Pago resultó casi el doble. El código de Mercado Pago no se borró, quedó apagado y con sus pruebas. Los detalles están en `COBRO.md`; lo único que hay que retener acá es que **Mobbex no firma sus avisos**, así que la defensa entera descansa en no creerle al aviso y consultar siempre a la API.

---

## 1 · Los interruptores

Lo que se cambia el día del salto. Son cuatro cosas y ninguna es código.

| Variable en Vercel | De prueba | De verdad |
|---|---|---|
| `MOBBEX_API_KEY` | la pública de la documentación | la de tu aplicación |
| `MOBBEX_ACCESS_TOKEN` | el público de la documentación | el de tu entidad |
| `MOBBEX_MODO` | `prueba` | `produccion` |

**Los tres, en la misma tanda.** Si cambiás sólo las credenciales, seguís cobrando de mentira contra tu comercio real. Si cambiás sólo el modo, estarías intentando cobrar de verdad con las credenciales públicas de demostración, que no son tuyas.

Y las otras dos:

**Dominio propio.** Nadie deja los datos de su tarjeta en una dirección terminada en `.vercel.app`. Al cambiarlo hay que actualizar dos lugares: `site` en `astro.config.mjs` y la línea `Sitemap:` de `robots.txt`. La auditoría de publicación falla si no coinciden, así que no se puede olvidar uno.

> **La dirección del aviso de pago ya no hay que configurarla en ningún panel.** Con Mercado Pago se cargaba a mano en su sitio, y era un lugar más para olvidarse al cambiar de dominio. Mobbex la recibe en cada pedido de cobro, armada a partir de la dirección real de la petición: funciona igual en la dirección de Vercel, en una vista previa y en el dominio propio, sin tocar nada.

**El token del aviso.** `MOBBEX_WEBHOOK_TOKEN`, de al menos 32 caracteres al azar. Sin él —o con uno corto— la ruta de avisos rechaza todo y lo dice en el registro.

> ⚠️ **Esta sección quedó desactualizada.** Describe Mobbex, que se apagó: hoy la pasarela activa es Mercado Pago. Las variables `MOBBEX_*` siguen existiendo para el día que vuelva, pero no son las que hay que cargar. Hay que reescribirla.

### Las variables de OCA

| Variable | Para qué | Sin ella |
|---|---|---|
| `OCA_CUIT` | cotizar | no cotiza: cae a la tabla propia |
| `OCA_OPERATIVA` | cotizar | usa la de prueba, que no es tuya |
| `OCA_MODO` | `prueba` o `produccion` | queda en prueba, con tarifas de laboratorio |
| `OCA_USUARIO`, `OCA_CLAVE`, `OCA_CUENTA`, `OCA_CENTRO_COSTO` | despachar | cotiza pero no da de alta envíos |
| `OCA_DESPACHO_REAL` | permiso aparte para dar de alta envíos de verdad | el despacho queda bloqueado aunque el modo sea producción |
| `OCA_OPERATIVA_SUCURSAL` | cotizar sucursal a sucursal | **el retiro en sucursal no aparece en el checkout** |

**`OCA_MODO` y `OCA_DESPACHO_REAL` están separadas a propósito.** Cotizar es una consulta de precio y no crea nada; dar de alta un envío genera una orden de retiro real que alguien tiene que ir a cancelar si estuvo mal. Con un solo interruptor había que aceptar las dos juntas — y como el entorno de prueba de OCA no conoce las operativas de tu cuenta, para ver tarifas reales hay que ir a producción sí o sí.

### Cobrar por transferencia

| Variable | Para qué |
|---|---|
| `TRANSFERENCIA_CBU` | los 22 dígitos, sin espacios ni guiones |
| `TRANSFERENCIA_ALIAS` | el alias de tu cuenta |
| `TRANSFERENCIA_TITULAR` | a nombre de quién está |
| `TRANSFERENCIA_CUIT` | opcional; algunos bancos lo piden para validar |
| `TRANSFERENCIA_BANCO` | opcional; sólo para que el comprador reconozca |

**Las tres primeras son todo o nada.** Sin alguna, la opción de pagar por transferencia no aparece en el checkout. Es a propósito: una pantalla que muestra el alias pero no el CBU deja a alguien con la plata en la mano y sin poder mandarla.

El CBU se valida: si no tiene exactamente 22 dígitos, la opción tampoco aparece. Un dígito de menos manda a transferir a una cuenta que no existe.

> **Por qué la transferencia no pasa por Mercado Pago.** El descuento del 10 % se paga solo con la comisión que te ahorrás. Antes el sitio aplicaba el descuento y mandaba igual a la pasarela: perdías las dos cosas en la misma venta. Ahora el pedido queda pendiente, el comprador ve el CBU con su número de pedido como concepto, y vos lo marcás cobrado desde `/pedidos` cuando la plata está acreditada.
>
> Ese último paso es a mano a propósito. Automatizarlo pide leer el resumen del banco, que es una integración aparte y con acceso a bastante más de lo que hace falta.

---

### Cuál operativa va en cada variable

OCA genera las ocho de una vez y las manda en una tabla, en números consecutivos. Dos van al sitio:

| Producto de OCA | Variable | Qué significa |
|---|---|---|
| **Sucursal a Puerta** | `OCA_OPERATIVA` | llevamos el paquete a una sucursal, OCA entrega en el domicilio |
| **Sucursal a Sucursal** | `OCA_OPERATIVA_SUCURSAL` | llevamos el paquete, el comprador lo retira |

Las otras seis —Puerta a Puerta, Puerta a Sucursal y las cuatro de logística inversa— no se usan todavía. Las de logística inversa son las de **devoluciones**, y el sitio promete 30 días para devolver sin cargo: hoy esa devolución se coordina a mano.

> ⚠️ **Los ocho números se parecen y ninguno dice qué es.** Son consecutivos, y la respuesta de OCA a una cotización devuelve un precio sin nombrar el servicio. Poner el de al lado no da error: da una tarifa distinta que parece igual de razonable.
>
> Ya pasó una vez. Se cargó el de Sucursal a Sucursal en `OCA_OPERATIVA` y todas las tarifas bajaron entre un 25 % y un 30 %. Parecía que OCA había abaratado; era el sitio cobrándole tarifa de retiro en sucursal a quien pedía entrega en su casa — unos $ 2.000 a $ 3.000 menos por envío, puestos por el vendedor. Ahora `npm run logistica:vivo` falla si la operativa cambió respecto de la que se usó para medir la tabla.

Mientras `OCA_OPERATIVA_SUCURSAL` esté vacía, el sitio no ofrece el retiro en sucursal: mostrarlo cobrando la tarifa de entrega a domicilio sería peor que no mostrarlo.

Para medir tarifas reales sin riesgo de despachar nada:

```powershell
$env:OCA_MODO = "produccion"
npm.cmd run logistica:vivo
```

---

## 2 · Lo que hay que arreglar antes, por riesgo

### 🔴 Nadie puede pedir mil cobros por minuto

**Esto es lo primero y aplica ya, incluso en prueba.**

`/api/crear-pago` no tiene límite de uso. Un guion sencillo puede llamarla en bucle, y cada llamada escribe un pedido en la base y abre un cobro en la pasarela.

El daño concreto: el plan gratuito del almacén tiene un tope de operaciones por día. **Alguien puede agotarlo en minutos y dejar la tienda sin poder registrar pedidos** — o sea, sin poder vender. No hace falta que sea un ataque: alcanza con un error en un guion propio.

*Qué hace falta:* un límite por dirección, como el que ya tiene la pantalla de pedidos. Es media hora de trabajo.

### 🔴 Sacar los andamios

Dos rutas existen sólo para diagnosticar y no deberían estar en una tienda que cobra:

- **`/api/probar-preferencia`** — crea preferencias de Mercado Pago a demanda. Ya no se usa para nada: era el andamio para diagnosticar el botón de pagar apagado. Se puede borrar hoy.
- **`/api/estado`** — dice qué variables están configuradas. No muestra ningún valor, pero le regala a un desconocido el mapa de la infraestructura.

Se borran quitando tres líneas de `astro.produccion.config.mjs` y dos archivos.

### ✅ El aviso de pago ya no falla en silencio

*Resuelto.* Antes, si faltaba el secreto del webhook, la función contestaba «ok» y no hacía nada: correcto —no se puede verificar sin secreto— pero desde afuera se veía igual que si todo anduviera, y los pedidos se quedaban en pendiente sin que nadie entendiera por qué.

Ahora ese caso **rechaza el aviso con un 503 y grita en el registro**. Es el modo de fallo que hay que elegir: un circuito que parece funcionar mientras la puerta está abierta es peor que uno que se planta.

### 🟠 El comprador no recibe nada

No se manda correo. Ni la confirmación, ni el número de seguimiento cuando lo cargás.

Para vender de verdad esto no es opcional: alguien que pagó y no recibe nada por correo asume que algo salió mal, y el primer mensaje que escribe es a soporte. Además, el aviso de despacho es parte de lo que sostiene una defensa ante un contracargo.

*Qué hace falta:* un proveedor de correo y una clave más. Es una sesión de trabajo.

### 🟠 Los precios quedan congelados hasta el próximo despliegue

El catálogo se compila con el sitio. Si cambiás un precio en el panel, **el sitio sigue cobrando el precio viejo hasta que se vuelva a publicar**.

No es un defecto: es la consecuencia de un sitio estático, y a cambio da velocidad y cero costo de servidor. Con stock propio y un catálogo chico, publicar después de tocar precios es una rutina razonable.

*Qué hacer:* después de tocar precios, publicar. Y si algún día los precios cambian a diario, moverlos del catálogo compilado a la base de datos.

### 🔴 El stock no se descuenta — y ahora sí importa

**Esto subió de gravedad al pasar a stock propio.** Dos personas pueden comprar la última unidad y las dos pagan.

Cuando el catálogo era de un proveedor, descontar sobre un número que no controlábamos habría sido inventar precisión. Ahora el número es real: son las unidades que tenés en tu casa. Vender dos veces la misma es una devolución y una disculpa, y con un catálogo chico de productos parecidos —termos y botellas— la probabilidad de que dos pedidos caigan sobre la misma variante no es despreciable.

*Qué hace falta:* reservar el stock al crear el pedido y liberarlo si el cobro se cae o el checkout vence. Mobbex avisa el vencimiento del checkout con un webhook propio, así que la pieza para liberar la reserva ya existe del lado de la pasarela; falta escribirla de este lado.

### 🟡 No hay flujo de devoluciones

Cancelar y marcar como devuelto se hace a mano en la pantalla de pedidos, y la devolución del dinero se hace desde el panel de Mobbex. Funciona; simplemente no está integrado. Mobbex tiene API de devoluciones, así que el día que el volumen lo justifique se conecta.

---

## 3 · Seguridad: qué está protegido y qué no

**Protegido:**

- El precio no se puede manipular desde el navegador — probado con un intento deliberado.
- El aviso de pago no se puede falsificar — once formas de firma inválida en Mercado Pago, cinco de token inválido en Mobbex.
- **Un aviso falsificado con el token correcto tampoco sirve de nada** — probado con un aviso que grita «aprobado, 999.999» mientras la API dice «rechazado, 45.900». Gana la API.
- Un aviso repetido no procesa dos veces — probado con los ocho reintentos.
- Los estados que parecen cobrados y no lo son (autorización sin capturar, cupón de efectivo sin pagar) se tratan como pendientes.
- Los datos de tarjeta nunca pasan por el sitio.
- La pantalla de pedidos: clave comparada en tiempo constante, sesión del lado del servidor, galleta que ningún guion puede leer, diez intentos cada quince minutos.
- Cabeceras de seguridad y política de contenido que sólo permite ejecutar código propio.
- Los datos personales caducan solos a los 90 días.

**No protegido, y conviene saberlo:**

- **Sin límite de uso en el checkout** (ver arriba). Es el agujero real que queda.
- **Sin protección contra bots** en el formulario. Alguien puede generar pedidos basura; no roba nada, pero ensucia la pantalla y gasta cuota.
- **Una sola clave, sin segundo factor.** Si se filtra, se entra. La contramedida es que sea larga y no se use en ningún otro lado.
- **Sin registro de auditoría.** No queda constancia de quién cambió qué en la pantalla de pedidos. Con un solo operador no importa; con dos, sí.

---

## 4 · Lo legal y lo fiscal

No soy abogado ni contador, así que esto es para que sepas qué preguntar, no para reemplazar la consulta.

**Lo que el sitio ya tiene:** botón de arrepentimiento, términos, política de privacidad, política de devoluciones y contacto visible con tiempo de respuesta.

**Lo que hay que revisar antes de vender:**

**El botón de arrepentimiento tiene un requisito que hoy no se cumple.** La normativa exige entregar al consumidor un **código de identificación del trámite dentro de las 24 horas**. El formulario que hay es una simulación: recibe el pedido de cancelación y no emite ningún código. Hay que hacerlo funcionar de verdad antes de vender.

**Tus datos como vendedor tienen que estar visibles:** razón social o nombre, CUIT y domicilio. Hoy el sitio no los muestra porque no era una tienda real.

**La normativa se actualizó hace poco** —hay disposiciones de 2025 y 2026 sobre el derecho de arrepentimiento y la verificación de identidad—, así que conviene chequear el texto vigente en lugar de confiar en un resumen.

**Facturación.** Cada venta necesita factura con CAE de ARCA. Con pocas ventas se hace a mano; cuando el volumen lo justifique, se integra.

**Importar para revender siendo monotributista** tiene límites y condiciones. Preguntale a un contador antes de comprar el primer lote, no después.

---

## 5 · La operación de todos los días, despachando vos

```
entra el pedido            → aparece en /pedidos
apretás «Consultar estados» → los pendientes se resuelven
                              (el aviso llega solo, pero
                               a veces se pierde)
armás el paquete
lo despachás por Andreani  → te da el seguimiento
cargás el seguimiento      → queda guardado en el pedido
```

**El filtro «Sin seguimiento» es tu lista de tareas.** Son los pedidos ya cobrados que todavía no podés defender ante un contracargo. Dejarla vacía todos los días es la rutina que más plata te ahorra.

> **Esto cambió.** El plan original era dropshipping con Dropi y el catálogo era de decoración. Ahora vendés **bazar y algo de tecnología** —termos y botellas Stanley y Coleman— con stock propio y despacho propio. Dos consecuencias que ya están anotadas arriba: el stock pasó a ser un número real que hay que descontar, y el seguimiento depende de vos y no de un proveedor, que es una preocupación menos.

**La integración con Andreani está pendiente de credenciales.** Cuando las tengas, lo que hace falta es la familia **Transporte y distribución** (cotizar, dar de alta un envío, imprimir la etiqueta, trazabilidad), no la de Fulfillment —ésa es para cuando la mercadería vive en el depósito de ellos—. Del lado del catálogo falta sumar **medidas y peso del paquete**, que hoy no están: los productos tienen sus dimensiones, la caja en la que se despachan no. Con termos y botellas es un dato corto de cargar.

---

## 6 · El orden

**Antes de tocar nada:**

1. Poner el límite de uso en `/api/crear-pago`.
2. Sacar `/api/probar-preferencia` y `/api/estado`.
3. **Descontar y reservar stock.** Subió a esta lista al pasar a stock propio.
4. Migrar el catálogo de decoración a bazar y tecnología, con medidas y peso de paquete.
5. Hacer funcionar el botón de arrepentimiento con código de trámite.
6. Publicar tus datos de vendedor: CUIT, nombre, domicilio.
7. Conectar el correo al comprador.

**El día del salto:**

8. Dominio propio, y actualizar los dos lugares que lo mencionan.
9. `MOBBEX_API_KEY`, `MOBBEX_ACCESS_TOKEN` y `MOBBEX_MODO` en la misma tanda. Redesplegar.
10. Comprobar en `/pedidos` que la pantalla responde.
11. **Una compra real de monto chico** —Mobbex sugiere más de $100— y devolverla después.

**Desde el primer día de ventas:**

12. Revisar «Sin seguimiento» todos los días.
13. Apretar «Consultar estados» una vez por día.
14. Facturar.

---

## Una cosa que no está en ninguna lista

El riesgo más caro de este negocio ya no es el proveedor: ahora despachás vos, y eso es una dependencia menos.

El que queda es el **stock**. Con plata puesta en mercadería que compraste, el error caro pasó de «el proveedor no entrega» a «compraste treinta termos que no se venden». Ningún código ayuda con eso.

Lo que sí se puede hacer, y es media hora: **guardar las búsquedas que no encuentran nada.** Hoy el buscador muestra el estado vacío y ahí termina — la consulta se pierde. Anotarla en el almacén, junto a los pedidos, arma con el tiempo una lista de lo que la gente vino a buscar y no tenías. Para decidir el próximo pedido al proveedor vale más que una corazonada.

Y una que sí es técnica y conviene no olvidar: sin número de seguimiento cargado, un contracargo se pierde solo. Da igual quién despache.
