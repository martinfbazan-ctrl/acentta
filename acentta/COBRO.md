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

Vercel inyecta solo las variables de conexión. No hay que copiarlas a ningún lado: el código acepta los dos nombres con que se inyectan según cómo se haya conectado.

El plan gratuito son 256 MB y decenas de miles de operaciones por día. Un pedido pesa menos de dos kilobytes.

---

## Paso 4 · Las dos variables que sí cargás a mano

En Vercel: **Settings → Environment Variables**. Las dos para *Production*, *Preview* y *Development*:

| Nombre | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | el Access Token de prueba del paso 1 |
| `MP_WEBHOOK_SECRET` | la clave secreta del paso 2 |

Después, **Deployments → el último → Redeploy**. Las variables no entran en un despliegue que ya existe.

> Si alguna vez pegás una de estas dos en un chat, un correo o un archivo, generá una nueva desde el panel de Mercado Pago. Es un botón.

---

## Paso 5 · Probar

**El circuito de compra**, con las [tarjetas de prueba de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards):

| Qué querés ver | Nombre del titular |
|---|---|
| Pago aprobado | `APRO` |
| Pago rechazado por fondos | `FUND` |
| Pago pendiente | `CONT` |

Cualquier número de tarjeta de prueba, vencimiento futuro, cualquier código de seguridad.

**El aviso de pago** hay que probarlo aparte, y esto conviene saberlo antes de pelearse con ello:

> **Los pagos de prueba no envían notificaciones.** Es una limitación de Mercado Pago, no del código. La única forma de probar el receptor es con el botón **Simular** en *Tus integraciones → Webhooks*, eligiendo el evento *Pagos* y un identificador de pago.

Si la simulación devuelve **200**, la firma se está verificando bien. Si devuelve **401**, la clave secreta no coincide con la que cargaste.

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

Cuando el circuito esté verificado en prueba, cambiar `MP_ACCESS_TOKEN` por el de producción —el que no empieza con `TEST-`— y volver a desplegar. Nada más del código cambia.

Antes de eso, las tres cosas que te faltaban cuando armamos esto:

**1 · Cuenta de Mercado Pago para vender.** Sin esto no hay credenciales de producción.

**2 · Proveedor que entregue número de seguimiento por pedido.** El más importante y el que más se pasa por alto. Sin seguimiento, un contracargo se pierde solo: no hay forma de probar que entregaste. El pedido ya tiene el campo `seguimiento` esperando ese dato.

**3 · Dominio propio.** Nadie deja los datos de su tarjeta en una dirección terminada en `.vercel.app`. Al cambiarlo hay que actualizar la URL del webhook en Mercado Pago y `site` en `astro.config.mjs`.

---

## Lo que todavía no está

Honesto, para que no te agarre de sorpresa:

- **No se manda correo de confirmación.** El pedido queda registrado y se consulta por número. Sumar correo pide otro proveedor y otra clave, y el circuito de cobro tiene que estar verificado antes de agregarle piezas.
- **La página de confirmación sigue leyendo el pedido simulado.** El endpoint real ya existe (`/api/pedido`); falta conectarla.
- **No hay pantalla de administración de pedidos.** Con los primeros se puede mirar la base directamente. Cuando sean diez por día, no.
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
