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
| Cobro con Checkout Pro | El sitio nunca ve un número de tarjeta |
| Firma del aviso verificada, comparada en tiempo constante | Nadie puede mandar un «pago aprobado» falso |
| Idempotencia | Ocho reintentos de Mercado Pago procesan una sola vez |
| Comprobación de monto | Si lo cobrado no coincide con lo cotizado, no se aprueba |
| Consulta manual de estados | La red de seguridad para el aviso que se pierde |
| Pantalla de pedidos con clave | Con el campo de seguimiento, que es lo que gana un contracargo |

**El circuito de cobro está resuelto.** Lo que sigue son las piezas de alrededor.

---

## 1 · Los interruptores

Lo que se cambia el día del salto. Son cuatro cosas y ninguna es código.

| Variable en Vercel | De prueba | De verdad |
|---|---|---|
| `MP_ACCESS_TOKEN` | el de *Credenciales de prueba* | el de *Credenciales de producción* |
| `MP_MODO` | `prueba` | `produccion` |

**Las dos, en la misma tanda.** Si cambiás sólo el token, el sitio bloquea el cobro a propósito y parece roto. Si cambiás sólo el modo, sigue cobrando de mentira. El bloqueo molesta un minuto y evita el error que no se puede deshacer.

Y las otras dos:

**Dominio propio.** Nadie deja los datos de su tarjeta en una dirección terminada en `.vercel.app`. Al cambiarlo hay que actualizar tres lugares: `site` en `astro.config.mjs`, la línea `Sitemap:` de `robots.txt`, y la URL del webhook en el panel de Mercado Pago. La auditoría de publicación falla si los tres no coinciden, así que no se puede olvidar uno.

**La URL del webhook en Mercado Pago**, en la pestaña de **modo productivo**. Es distinta de la de prueba.

---

## 2 · Lo que hay que arreglar antes, por riesgo

### 🔴 Nadie puede pedir mil cobros por minuto

**Esto es lo primero y aplica ya, incluso en prueba.**

`/api/crear-pago` no tiene límite de uso. Un guion sencillo puede llamarla en bucle, y cada llamada escribe un pedido en la base y crea una preferencia en Mercado Pago.

El daño concreto: el plan gratuito del almacén tiene un tope de operaciones por día. **Alguien puede agotarlo en minutos y dejar la tienda sin poder registrar pedidos** — o sea, sin poder vender. No hace falta que sea un ataque: alcanza con un error en un guion propio.

*Qué hace falta:* un límite por dirección, como el que ya tiene la pantalla de pedidos. Es media hora de trabajo.

### 🔴 Sacar los andamios

Dos rutas existen sólo para diagnosticar y no deberían estar en una tienda que cobra:

- **`/api/probar-preferencia`** — crea preferencias a demanda. Hoy sólo responde en modo de prueba, así que al pasar a producción se apaga sola. Igual conviene borrarla.
- **`/api/estado`** — dice qué variables están configuradas. No muestra ningún valor, pero le regala a un desconocido el mapa de la infraestructura.

Se borran quitando tres líneas de `astro.produccion.config.mjs` y dos archivos.

### 🟠 El aviso de pago falla en silencio si falta el secreto

Si `MP_WEBHOOK_SECRET` no está cargado, la función contesta «ok» y no hace nada. Es el comportamiento correcto —no se puede verificar una firma sin secreto— pero **desde afuera se ve igual que si todo anduviera**, y los pedidos se quedan en pendiente sin que nadie entienda por qué.

*Qué hace falta:* que ese caso avise de forma visible en la pantalla de pedidos.

### 🟠 El comprador no recibe nada

No se manda correo. Ni la confirmación, ni el número de seguimiento cuando lo cargás.

Para vender de verdad esto no es opcional: alguien que pagó y no recibe nada por correo asume que algo salió mal, y el primer mensaje que escribe es a soporte. Además, el aviso de despacho es parte de lo que sostiene una defensa ante un contracargo.

*Qué hace falta:* un proveedor de correo y una clave más. Es una sesión de trabajo.

### 🟠 Los precios quedan congelados hasta el próximo despliegue

El catálogo se compila con el sitio. Si mañana el proveedor sube un precio y vos lo cambiás en el panel, **el sitio sigue cobrando el precio viejo hasta que se vuelva a publicar**.

No es un defecto: es la consecuencia de un sitio estático, y a cambio da velocidad y cero costo de servidor. Pero hay que saberlo, porque en dropshipping los precios se mueven.

*Qué hacer:* después de tocar precios, publicar. Y si algún día los precios cambian a diario, moverlos del catálogo compilado a la base de datos.

### 🟡 El stock no se descuenta

Dos personas pueden comprar la última unidad. En dropshipping el stock es lo que dice el proveedor, así que descontar sobre un número que no controlás sería inventar precisión — pero la consecuencia es real: vas a tener que cancelar y devolver alguna vez.

*Qué hacer:* tener resuelta la devolución antes de que pase. Cancelar y devolver el mismo día es aceptable; hacer esperar dos semanas, no.

### 🟡 No hay flujo de devoluciones

Cancelar y marcar como devuelto se hace a mano en la pantalla de pedidos, y la devolución del dinero se hace desde Mercado Pago. Funciona; simplemente no está integrado.

---

## 3 · Seguridad: qué está protegido y qué no

**Protegido:**

- El precio no se puede manipular desde el navegador — probado con un intento deliberado.
- El aviso de pago no se puede falsificar — probado con once formas distintas de firma inválida.
- Un aviso repetido no procesa dos veces — probado con los ocho reintentos.
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

## 5 · La operación de todos los días, con Dropi

```
entra el pedido            → aparece en /pedidos
apretás «Consultar estados» → los pendientes se resuelven
                              (en producción llega solo, pero
                               el aviso a veces se pierde)
pedís el producto en Dropi
Dropi te da el seguimiento → lo cargás en el pedido
```

**El filtro «Sin seguimiento» es tu lista de tareas.** Son los pedidos ya cobrados que todavía no podés defender ante un contracargo. Dejarla vacía todos los días es la rutina que más plata te ahorra.

---

## 6 · El orden

**Antes de tocar nada:**

1. Poner el límite de uso en `/api/crear-pago`.
2. Sacar `/api/probar-preferencia` y `/api/estado`.
3. Hacer funcionar el botón de arrepentimiento con código de trámite.
4. Publicar tus datos de vendedor: CUIT, nombre, domicilio.
5. Conectar el correo al comprador.

**El día del salto:**

6. Dominio propio, y actualizar los tres lugares que lo mencionan.
7. Webhook de producción configurado en Mercado Pago.
8. `MP_ACCESS_TOKEN` y `MP_MODO` en la misma tanda. Redesplegar.
9. Comprobar en `/pedidos` que la pantalla responde.
10. **Una compra real de monto chico, hecha por otra persona.** Es la única prueba que vale: vos no podés pagarte a vos mismo.

**Desde el primer día de ventas:**

11. Revisar «Sin seguimiento» todos los días.
12. Apretar «Consultar estados» una vez por día.
13. Facturar.

---

## Una cosa que no está en ninguna lista

El riesgo más caro de este negocio no es técnico. Es el proveedor.

Sin número de seguimiento por pedido, un contracargo se pierde solo — no hay forma de probar que entregaste. **Confirmá con Dropi que entrega seguimiento en todos los pedidos, no en algunos**, antes de poner plata en stock. Si no lo hace, ningún código te salva.
