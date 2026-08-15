# Conectar el cobro con Mercado Pago

El código está escrito y probado. Falta conectar las llaves, y eso lo hacés vos: **yo no toco credenciales**. Un token de Mercado Pago en un archivo del repositorio es un token público, y un token que pasa por un chat es un token quemado.

Arrancamos en **modo de prueba**: tarjetas falsas, ningún peso real. Pasar a producción después son dos variables.

---

## Lo que ya está hecho

| | Dónde |
|---|---|
| El total se recalcula en el servidor desde el catálogo | `src/lib/cotizacion.ts` |
| El pedido se registra **antes** de cobrar | `src/lib/pedidos.ts` |
| Crear el pago | `src/api/crear-pago.ts` |
| Recibir el aviso, con firma e idempotencia | `src/api/aviso-de-pago.ts` |
| Consultar un pedido sin exponer datos personales | `src/api/pedido.ts` |
| Pruebas, incluido un intento de fraude | `npm run auditar:cobro` |

**Mientras las variables no estén puestas, el sitio se comporta como hoy**: el checkout simula la compra y va a la confirmación. No se rompe nada por publicar esto antes de configurarlo.

---

## Paso 1 · Cuenta y credenciales de prueba

1. Crear cuenta en Mercado Pago si no tenés, y entrar a **[Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app)**.
2. **Crear aplicación**. Producto: *Checkout Pro*.
3. En **Credenciales de prueba**, copiar el **Access Token**. Empieza con `TEST-`.

> Ese prefijo lo usa el código para saber en qué modo está: con `TEST-` manda a la gente al entorno de prueba de Mercado Pago, donde las tarjetas son falsas. No hay que configurar el modo por separado.

---

## Paso 2 · La dirección donde avisan los pagos

En la misma aplicación, **Webhooks → Configurar notificación**:

1. Pestaña **Modo productivo**, URL:

   ```
   https://TU-SITIO.vercel.app/api/aviso-de-pago
   ```

2. Marcar el evento **Pagos**.
3. **Guardar configuración**. Ahí aparece una **clave secreta** — copiala.

> Esa clave es la que hace que nadie más pueda mandar «pago aprobado» a tu sitio. Es, de todo lo que hay acá, lo que más caro sale perder.

---

## Paso 3 · La base de datos

En Vercel: **Storage → Create Database → Redis** (el proveedor es Upstash) y conectarla al proyecto `acentta`.

Vercel inyecta solo cinco variables al conectar la base al proyecto. **De esas, el código usa dos:**

| Variable | Para qué |
|---|---|
| `KV_REST_API_URL` | la dirección del almacén |
| `KV_REST_API_TOKEN` | la llave con permiso de escritura |

Las otras tres se ignoran, y conviene saber por qué para no confundirse: `REDIS_URL` y `KV_URL` son cadenas de conexión pensadas para un cliente de Redis, y este código habla por la API REST; `KV_REST_API_READ_ONLY_TOKEN` es de sólo lectura, y los pedidos hay que escribirlos.

> **En «Allowed Environments», conviene «All environments».** Con «Production environment only» las variables se marcan como sensibles y dejan de verse en el panel —lo que hace difícil verificar que estén—, y además cualquier conexión que no tenga destino de producción se desconecta sola. La credencial delicada de todo esto no es la del almacén: es la de Mercado Pago, que cargás vos en el paso siguiente.

El plan gratuito son 256 MB y decenas de miles de operaciones por día. Un pedido pesa menos de dos kilobytes.

---

## Paso 4 · Las dos variables que sí cargás a mano

En Vercel: **Settings → Environment Variables**. Las dos para *Production*, *Preview* y *Development*:

| Nombre | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | el Access Token de **Credenciales de prueba** |
| `MP_WEBHOOK_SECRET` | la clave secreta del paso 2 |
| `MP_MODO` | `prueba` |
| `ADMIN_CLAVE` | una clave larga que inventes, mínimo 12 caracteres |

> `ADMIN_CLAVE` es la que abre la pantalla de pedidos en `/pedidos`. Esa pantalla muestra nombre, DNI, teléfono y dirección de cada persona que te compró — es la información más delicada del sitio. **Poné una clave larga y que no uses en ningún otro lado.** Doce caracteres es el mínimo que el código acepta; veinte es mejor, y como la escribís una sola vez, que sea incómoda no molesta.

> **Sobre `MP_MODO`, que es el freno de mano.** Mercado Pago unificó el formato de las credenciales: hoy **las de prueba y las de producción empiezan igual, con `APP_USR-`**, así que mirando el token es imposible saber en qué entorno estás. Lo único que lo dice es un campo, `live_mode`, que viene en la respuesta de la API — o sea, después de haber pedido el cobro.
>
> Por eso el entorno se declara acá a mano, y el código lo contrasta contra lo que contesta Mercado Pago. Si pide un cobro y la respuesta dice que es real mientras `MP_MODO` dice `prueba`, **no devuelve el enlace**: cancela el pedido y corta. Un cobro real disparado por accidente es plata de otra persona y una entrega comprometida.
>
> Si no ponés la variable, el valor de fábrica es `prueba`. A propósito: si alguien se olvida, lo que falla es un cobro de mentira y no uno de verdad.

Después, **Deployments → el último → Redeploy**. Las variables no entran en un despliegue que ya existe.

> Si alguna vez pegás una de estas dos en un chat, un correo o un archivo, generá una nueva desde el panel de Mercado Pago. Es un botón.

---

## Paso 5 · Encontrar el comprador de prueba

Éste es el paso que hace perder una tarde, y por un motivo tonto: **la cuenta de comprador ya existe — se crea sola junto con la aplicación**. No hay que crearla, hay que ir a buscarla, y está detrás de un selector que es fácil no ver.

1. **[Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) → tu aplicación → Cuentas de prueba** (en el menú de la izquierda).
2. **En el selector, elegir «Comprador».** Ahí aparecen el país, el User ID, el **usuario** y la **contraseña**.
3. Si al entrar te pide un código de 6 dígitos, está en esa misma pantalla.

> **Cuidado con confundirla con la otra.** En *Credenciales de prueba* también figura un «Usuario de prueba»: **ése es el vendedor**, la identidad de prueba de tu tienda. Si entrás con ése, sos comprador y vendedor a la vez, y Mercado Pago no deja pagarte a vos mismo. No lo dice con un cartel: **deja el botón de pagar apagado, sin explicación**.
>
> Y **pagar como invitado tampoco sirve**: un invitado es una parte real frente a una tienda de prueba, y ahí el error es «Una de las partes con la que intentás hacer el pago es de prueba».
>
> Las dos cosas se ven como que el sitio está roto, y ninguna lo está.

---

## Paso 6 · Comprar de mentira

**En una ventana de incógnito**, siempre. Mezclar tu sesión real con la de prueba da errores de credenciales duplicadas que parecen bugs del sitio y no lo son.

1. Ventana de incógnito → entrar a Mercado Pago e iniciar sesión **con el comprador de prueba**.
2. En la misma ventana, abrir `acentta.vercel.app`, armar un carrito y llegar al checkout.
3. Apretar **Confirmar compra**. Ahí sí tenés que salir a Mercado Pago.

**Las tarjetas de prueba.** El resultado del pago lo decide el **nombre del titular**, no la tarjeta: es el mismo plástico para todos los casos.

| Tarjeta | Número | Cód. | Vence |
|---|---|---|---|
| Visa crédito | `4509 9535 6623 3704` | 123 | 11/30 |
| Mastercard crédito | `5031 7557 3453 0604` | 123 | 11/30 |
| Visa débito | `4002 7686 9439 5619` | 123 | 11/30 |

| Qué querés ver | Nombre del titular | Documento |
|---|---|---|
| Pago aprobado | `APRO` | DNI 12345678 |
| Rechazado por fondos | `FUND` | — |
| Pago pendiente | `CONT` | — |
| Rechazado, error general | `OTHE` | DNI 12345678 |
| Código de seguridad inválido | `SECU` | — |

Vale la pena probar los tres primeros y no sólo el que sale bien. **`CONT` es el más importante de los tres**: deja el pago pendiente, que es lo que pasa de verdad con Rapipago y Pago Fácil, y es el camino que casi nadie prueba y el que después rompe en producción.

---

## Paso 7 · Probar el aviso de pago

Esto va aparte, y conviene saberlo antes de pelearse con ello:

> **Los pagos de prueba no envían notificaciones.** Es una limitación de Mercado Pago, no del código. La única forma de probar el receptor es con el botón **Simular** en *Tus integraciones → Webhooks*, eligiendo el evento *Pagos* y un identificador de pago.

Si la simulación devuelve **200**, la firma se está verificando bien. Si devuelve **401**, la clave secreta no coincide con la que cargaste.

---

## Si querés ver la pantalla antes de configurar nada

Mercado Pago tiene una **[demostración de Checkout Pro](https://www.mercadopago.com.ar/developers/es/live-demo/checkout-pro)** que muestra la pantalla de pago tal cual la va a ver un comprador, sin cuenta y sin integrar nada. Sirve para saber a qué se sale desde el botón.

Lo que **no** conviene es fabricar una pantalla propia que imite a Mercado Pago. Como pieza de portafolio resta en vez de sumar: una pasarela de mentira se nota, y la pregunta que va a hacer quien mire el proyecto —«¿esto cobra de verdad?»— se contesta sola y mal. Con el modo de prueba la respuesta es que sí, sólo que con tarjetas falsas.

---

## La pantalla de pedidos

```
https://acentta.vercel.app/pedidos
```

Pide la clave y muestra lo que entró: quién compró, a dónde va, cómo pagó, y un campo por pedido para **cargar el número de seguimiento**.

Ese campo parece el menos interesante de la pantalla y es el más importante. **Es lo único que gana un contracargo.** Cuando alguien desconoce un pago, la única defensa es probar que la mercadería llegó, y eso se prueba con un número de seguimiento cargado en su momento. Por eso el filtro **«Sin seguimiento»** existe: son los pedidos cobrados que todavía no podés defender.

El estado del pago no se toca desde acá — lo pone el aviso de Mercado Pago y nadie más. Un clic distraído no puede marcar como cobrado algo que no se cobró. Lo único que se puede cambiar a mano es cancelar o marcar como devuelto, que sí son decisiones tuyas.

La sesión dura ocho horas y se corta después de diez intentos fallidos en quince minutos.

---

## Cómo se ve un pedido

Cada pedido queda guardado noventa días con un número tipo `AC-260810-K7M2QX`. Se consulta así:

```
https://TU-SITIO.vercel.app/api/pedido?numero=AC-260810-K7M2QX
```

Devuelve estado, total, productos y ciudad. **No devuelve DNI, teléfono, dirección exacta ni correo**: el número viaja en direcciones y capturas de pantalla, así que la respuesta está armada como si fuera pública.

Los seis caracteres al azar del final existen para que nadie pueda recorrer los números de a uno.

---

## Para cobrar de verdad

Cuando el circuito esté verificado en prueba, cambiar **dos** variables y volver a desplegar:

1. `MP_ACCESS_TOKEN` → el de **Credenciales de producción**.
2. `MP_MODO` → `produccion`.

**Las dos, y en ese orden mental.** Si cambiás sólo el token, el sitio bloquea el cobro a propósito y no vende nada; si cambiás sólo `MP_MODO`, sigue cobrando de mentira. El bloqueo molesta un minuto y evita el error que no se puede deshacer.

Antes de eso, las tres cosas que te faltaban cuando armamos esto:

**1 · Cuenta de Mercado Pago para vender.** Sin esto no hay credenciales de producción.

**2 · Proveedor que entregue número de seguimiento por pedido.** El más importante y el que más se pasa por alto. Sin seguimiento, un contracargo se pierde solo: no hay forma de probar que entregaste. El pedido ya tiene el campo `seguimiento` esperando ese dato.

**3 · Dominio propio.** Nadie deja los datos de su tarjeta en una dirección terminada en `.vercel.app`. Al cambiarlo hay que actualizar la URL del webhook en Mercado Pago y `site` en `astro.config.mjs`.

---

## Lo que todavía no está

Honesto, para que no te agarre de sorpresa:

- **No se manda correo de confirmación.** El pedido queda registrado y se consulta por número. Sumar correo pide otro proveedor y otra clave, y el circuito de cobro tiene que estar verificado antes de agregarle piezas.
- **La página de confirmación sigue leyendo el pedido simulado.** El endpoint real ya existe (`/api/pedido`); falta conectarla.
- **La pantalla de pedidos no manda el seguimiento al comprador.** Lo cargás vos y queda guardado; falta que se le avise, y eso depende del correo.
- **El stock no se descuenta.** En dropshipping el stock es lo que dice el proveedor, así que descontar sobre un número que no controlamos es inventar precisión.

---

## Cómo se verifica que sigue bien

```powershell
cd "C:\Users\Martín Bazán\Downloads\Martin\PORTFOLIO\Proyecto 4\acentta"
npm.cmd run auditar:cobro
```

Corre sin red y sin credenciales, y comprueba tres cosas:

- Que un precio mandado desde el navegador **no** cambie el total. Es la vulnerabilidad clásica de las tiendas hechas a mano: abrir las herramientas del navegador, cambiar $ 89.900 por $ 1 y pagar un peso.
- Que un aviso con firma inválida se rechace — probado con once formas distintas de firma falsa.
- Que el mismo aviso repetido ocho veces se procese una sola. Mercado Pago reintenta hasta ocho veces.
