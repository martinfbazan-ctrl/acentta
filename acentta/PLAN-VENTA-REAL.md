# De pieza de portafolio a tienda que cobra

Plan para que acentta venda de verdad, conservando el sitio construido.

Modelo: **dropshipping en Argentina**, cobro con **Mercado Pago**, hosting estático con funciones de servidor.

---

## 1. Lo que ya está resuelto

Vale la pena empezar por acá, porque es más de lo que parece y define cuánto falta.

| | Estado |
|---|---|
| Catálogo administrable con panel visual | Listo |
| Carrito con persistencia entre sesiones | Listo |
| Cálculo de envío por código postal y peso | Listo |
| Umbral de envío gratis con barra de progreso | Listo |
| Checkout en tres pasos con validación en vivo | Listo, **falta reemplazar el paso de pago** |
| Página de seguimiento con línea de estados | Listo, **lee datos simulados** |
| Botón de arrepentimiento, términos, privacidad | Listo — son obligatorios por ley en Argentina |
| Contacto visible con tiempo de respuesta | Listo |
| Accesibilidad, rendimiento, teclado | Auditado |

**El 80 % del trabajo de una tienda ya está hecho.** Lo que falta es el 20 % que maneja plata, y es el que hay que hacer con cuidado.

---

## 2. El agujero de seguridad que hay que cerrar primero

Antes de hablar de fases, esto:

**Hoy el total lo calcula el navegador.** El carrito vive en el almacenamiento del navegador y el precio de cada producto viaja adentro. Para una simulación está perfecto. Para cobrar, es la vulnerabilidad clásica de las tiendas hechas a mano:

> Cualquiera abre las herramientas del navegador, cambia el precio de la lámpara de $89.900 a $1, y paga un peso. Mercado Pago le va a cobrar exactamente lo que el sitio le pidió que cobre.

**La regla, entonces:** el navegador manda **qué** se compra —identificadores y cantidades— y **nunca cuánto sale**. La función del servidor recalcula el precio desde el catálogo, suma el envío con la misma tabla que ya usa el sitio, y recién ahí arma el pago.

Esto no es un detalle de implementación. Es *la* decisión de arquitectura de todo el plan, y define por qué hace falta un pedacito de servidor aunque el sitio sea estático.

---

## 3. Cómo queda el circuito

```
NAVEGADOR                    SERVIDOR (funciones)          MERCADO PAGO
─────────                    ────────────────────          ────────────
carrito
  │
  │  ids + cantidades + CP
  ├────────────────────────►  crear-pago
                                 │ recalcula precios
                                 │ del catálogo
                                 │ recalcula envío
                                 │ guarda pedido
                                 │   estado: pendiente
                                 ├──────────────────────►  crea preferencia
                                 │◄──────────────────────  devuelve enlace
  │◄───────────────────────  enlace
  │
  └─── se va a pagar ──────────────────────────────────►  paga acá
                                                            │
                              aviso-de-pago  ◄──────────────┤
                                 │ verifica la firma
                                 │ consulta el pago
                                 │ actualiza el pedido
                                 │   aprobado / rechazado
                                 │ descuenta stock
                                 │ manda el correo
  vuelve a
  /confirmacion ◄────────────────┘
```

Dos funciones. Nada más.

---

## 4. Las cinco decisiones que hay que tomar bien

**1 · Checkout Pro, no Checkout API.**
Con Checkout Pro la persona salta al entorno de Mercado Pago, paga, y vuelve. Vos nunca ves un número de tarjeta. Con Checkout API el formulario queda en tu sitio y entrás en obligaciones de seguridad de datos de tarjeta que no querés tener.

*Costo:* se pierde el paso 3 del checkout tal como está hoy, que es lindo. Se reemplaza por un resumen y un botón. *Beneficio:* el problema de seguridad más grande desaparece por completo.

**2 · El aviso de pago tiene que verificar la firma.**
Mercado Pago avisa por HTTP cuando un pago cambia de estado. Si la función acepta cualquier aviso, cualquiera puede mandar «pago aprobado» y llevarse mercadería gratis. Hay que validar la firma y, además, **volver a consultarle a Mercado Pago** el estado real en vez de creerle al mensaje.

**3 · El aviso llega más de una vez.**
Mercado Pago reintenta si no contestás rápido. Sin protección, un pedido se procesa dos veces: dos correos, stock descontado dos veces. La función tiene que ser idempotente — guardar el identificador del pago y, si ya se procesó, contestar «ok» y no hacer nada.

**4 · El stock, en dropshipping, es una estimación.**
El producto no es tuyo. El stock que carga el panel es lo que el proveedor dice tener. Propuesta honesta: **descontar al aprobarse el pago** y avisar por correo si el proveedor después informa faltante, con devolución inmediata. Prometer stock exacto en dropshipping es prometer algo que no controlás.

**5 · Guardar el número de seguimiento desde el día uno.**
Es lo que te salva de los contracargos. Cuando el proveedor despacha, ese número tiene que entrar al pedido — a mano al principio, está bien. Sin eso, una disputa se pierde sola.

---

## 5. Las fases

Cada fase termina en algo que funciona. Se puede parar en cualquiera.

### Fase 0 · Publicar como está
**Entregable:** el sitio en línea, con dominio y HTTPS, publicación automática en cada cambio.
**Esfuerzo:** una sesión corta.
**Por qué primero:** hasta que no esté publicado no sirve para nada — ni para vender ni para mostrar. Y las fases siguientes se prueban mucho mejor sobre algo publicado.

### Fase 1 · Vender por WhatsApp
**Entregable:** el checkout simulado se reemplaza por un botón que arma el mensaje con el pedido, las variantes, el total y el código postal.
**Esfuerzo:** una sesión.
**Por qué:** empezás a vender esta semana, sin plataforma de pagos, sin base de datos y sin riesgo de contracargo — cobrás por transferencia o por link de pago manual. Sirve para validar si el catálogo vende **antes** de invertir en lo caro.

> Esta fase es opcional pero la recomiendo. Es la diferencia entre construir tres semanas a ciegas y construir sabiendo que hay demanda.

### Fase 2 · Cobrar con Mercado Pago
**Entregable:** circuito de pago real de punta a punta.

Lo que se construye:
- Base de datos de pedidos.
- Función `crear-pago`: recalcula precios y envío desde el catálogo, guarda el pedido como pendiente, pide la preferencia a Mercado Pago.
- Función `aviso-de-pago`: verifica la firma, consulta el estado real, actualiza el pedido, es idempotente.
- El paso 3 del checkout pasa a ser resumen + botón.
- `/confirmacion` lee el pedido real en vez de datos simulados.
- Correo de confirmación al comprador.
- Pruebas del circuito con las tarjetas de prueba de Mercado Pago, incluidos los casos de pago rechazado y pago pendiente.

**Esfuerzo:** el grueso del trabajo. Varias sesiones.

### Fase 3 · Administrar los pedidos
**Entregable:** una pantalla protegida con la lista de pedidos, su estado, y un campo para cargar el número de seguimiento.
**Esfuerzo:** una o dos sesiones.
**Por qué separada:** durante los primeros pedidos se puede mirar la base de datos directamente. Cuando son diez por día, no.

### Fase 4 · Seguimiento real
**Entregable:** `/seguimiento` deja de leer datos simulados y busca el pedido real por número y correo.
**Esfuerzo:** una sesión.
**Ya está construida la parte difícil:** la línea de cinco estados existe y funciona.

### Fase 5 · Facturación
**Entregable:** factura con CAE de ARCA por cada venta.
**Esfuerzo:** variable.
**Se puede postergar:** con pocas ventas se factura a mano. Cuando el volumen lo justifique, se integra.

---

## 6. Lo que hay que tener, y no es código

| Requisito | Sin esto no se puede |
|---|---|
| CUIT y monotributo | Cobrar y facturar |
| Cuenta de Mercado Pago para vender | Cobrar |
| Dominio propio | Nadie compra en una dirección de prueba |
| **Proveedor que entregue número de seguimiento** | Defenderse de un contracargo |
| Política de devoluciones acordada con el proveedor | Cumplir lo que el sitio promete |

El cuarto es el que más veces se pasa por alto y el que más caro sale. **Antes de construir la fase 2, confirmá con tu proveedor que entrega seguimiento por pedido.** Si no lo hace, cambiá de proveedor o no vendas con pago anticipado.

---

## 7. Costos

**Del lado técnico, casi nada.** Hosting con funciones y una base de datos chica entran en los planes gratuitos de Cloudflare o Vercel con holgura para este volumen. El dominio es el único gasto fijo, y es anual.

**Del lado del cobro**, la comisión de Mercado Pago por venta — que existe en todos los caminos, incluido Tiendanube.

**Lo que no pagás por este camino:** el recargo de plataforma. Shopify suma entre 0,5 % y 2 % por transacción en Argentina por usar una pasarela externa, y factura en dólares. Tiendanube tiene abono mensual.

---

## 8. Contra Tiendanube, en concreto

| | Este camino | Tiendanube |
|---|---|---|
| Seguridad del pago | **Idéntica** — cobra Mercado Pago | **Idéntica** |
| Costo fijo mensual | Solo el dominio | Abono |
| Recargo por transacción | Ninguno | Ninguno |
| Conservás este diseño | Completo | No |
| Pedidos, stock, facturación | Los construís | Vienen hechos |
| Tiempo hasta la primera venta | Semanas | Días |
| Si algo se rompe | Lo arreglás vos | Soporte |

**El criterio para decidir no es técnico:**

> **Si vender es el objetivo y el sitio es el medio → Tiendanube.** Te ahorra semanas y el diseño queda como pieza de portafolio, que es para lo que fue hecho.
>
> **Si este sitio es también el producto —tu carta de presentación como freelance— → este camino.** Una tienda propia que cobra de verdad vale mucho más en una entrevista que una tienda en una plataforma.

Las dos respuestas son correctas. Dependen de qué estés tratando de conseguir.

---

## 9. Riesgos, ordenados por lo que duelen

**Contracargos.** El más probable y el más caro. Plazos largos, producto que no tenés, comprobante de entrega en manos de un tercero. *Mitigación:* número de seguimiento en cada pedido, plazos pesimistas en el catálogo, y responder los reclamos dentro de los 7 días hábiles.

**Faltante del proveedor después de cobrar.** *Mitigación:* devolución inmediata y aviso proactivo. Es preferible perder la venta a que la persona tenga que reclamar.

**Un error en el cálculo de precios.** *Mitigación:* que el precio se calcule **solo** en el servidor, y probarlo con casos deliberadamente malintencionados.

**Avisos de pago duplicados o falsos.** *Mitigación:* verificar la firma, reconsultar el estado, y hacer la función idempotente.

**Vos como único punto de falla.** Si el proyecto crece, alguien tiene que poder cargar productos y despachar sin vos. *Mitigación:* el panel ya existe; la pantalla de pedidos de la fase 3 completa el cuadro.

---

## 10. Lo que propongo hacer ahora

**Fase 0 y Fase 1.** Publicar el sitio y habilitar la venta por WhatsApp. Es poco trabajo, te deja vendiendo, y **te da el dato que hoy no tenés: si el catálogo interesa**.

Con ese dato, la decisión entre seguir a la fase 2 o mudarse a Tiendanube deja de ser una apuesta.
