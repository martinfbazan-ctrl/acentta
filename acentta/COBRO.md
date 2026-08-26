# Conectar el cobro con Mobbex

El código está escrito y probado. Falta conectar las llaves, y eso lo hacés vos: **yo no toco credenciales**. Una clave en un archivo del repositorio es una clave pública, y una clave que pasa por un chat es una clave quemada.

Arrancamos en **modo de prueba**: tarjetas falsas, ningún peso real. Pasar a producción después son dos variables.

> **Por qué Mobbex y no Mercado Pago.** El arancel: casi el doble. El código de Mercado Pago **no se borró** — sigue entero en `src/lib/mercadopago.ts`, con sus pruebas, y se vuelve a encender poniendo `PASARELA=mercadopago`. Esa posibilidad es medio motivo por el que existe `src/lib/pasarela.ts`.

---

## Lo que ya está hecho

| | Dónde |
|---|---|
| El contrato que cumple cualquier pasarela | `src/lib/pasarela.ts` |
| El adaptador de Mobbex | `src/lib/mobbex.ts` |
| El adaptador de Mercado Pago, apagado | `src/lib/mercadopago.ts` |
| El total se recalcula en el servidor desde el catálogo | `src/lib/cotizacion.ts` |
| El pedido se registra **antes** de cobrar | `src/lib/pedidos.ts` |
| Crear el cobro | `src/api/crear-pago.ts` |
| Recibir el aviso, verificarlo y no creerle | `src/api/aviso-de-pago.ts` |
| Consultar un pedido sin exponer datos personales | `src/api/pedido.ts` |
| Pruebas, incluido un intento de fraude y un aviso mentiroso | `npm run auditar:cobro` |

**Mientras las variables no estén puestas, el sitio se comporta como hoy**: el checkout simula la compra y va a la confirmación. No se rompe nada por publicar esto antes de configurarlo.

---

## Lo que cambia respecto de Mercado Pago (y es lo que más importa)

**Mobbex no firma sus avisos de pago.** Mercado Pago manda una cabecera `x-signature` con un HMAC que se puede recalcular y comparar. Mobbex manda `content-type: application/json` y nada más.

Eso obliga a apoyarse en dos cosas en lugar de una:

1. **Un token secreto en la propia dirección del aviso.** Es más débil que una firma —viaja en la URL, y las URLs terminan en registros de servidor— así que se trata como una molestia para el que tantea, no como la defensa.

2. **La defensa de verdad: no creerle al aviso.** Del cuerpo del aviso sale una sola cosa: el número de pedido por el que hay que preguntar. El estado y el monto se consultan después, directo a la API de Mobbex, con tus credenciales, y el monto se compara contra el cotizado antes de aprobar nada.

Con la regla 2 puesta, lo peor que consigue un aviso falsificado es que consultemos un pago que ya existe y volvamos a escribir el mismo estado que ya tenía. No hay forma de que un mensaje inventado apruebe un pedido, porque ningún dato del mensaje llega a escribirse.

Esto está probado al revés: la prueba manda un aviso con el token correcto que grita «aprobado, 999.999 pesos» mientras la API dice «rechazado, 45.900». Si alguna vez alguien «optimiza» esto leyendo el estado del cuerpo para ahorrarse una llamada, la prueba se pone roja.

**A cambio, el modo de prueba es más seguro que el de Mercado Pago.** Con Mercado Pago el entorno lo decidían las credenciales: si por error subías las de producción, el cobro era real y lo único que se podía hacer era darse cuenta después y cancelar el pedido — el cobro ya existía. Mobbex tiene un campo `test` en el propio pedido de cobro: mientras `MOBBEX_MODO` no diga producción, ese campo va en `true` y el cobro **no puede** ser real, ni con credenciales de producción cargadas. Deja de ser una alarma y pasa a ser un impedimento.

---

## Paso 1 · Probar hoy, sin cuenta

Ésta es la parte buena y conviene aprovecharla: **Mobbex publica credenciales de prueba en su documentación**, abiertas, sin registrarse. Son las de su comercio de demostración.

| Variable | Valor |
|---|---|
| `MOBBEX_API_KEY` | `zj8lftbx6ba8d611e9io13fdzawj0qmko1hn1yij` |
| `MOBBEX_ACCESS_TOKEN` | `d31f0721-2f85-44e7-bcc6-15e19d1a53cc` |

Sirven para ver el circuito entero funcionando antes de hablar con nadie. Comparado con Mercado Pago —donde el enredo de usuarios de prueba comprador/vendedor nos costó varias vueltas— es otra cosa.

Son **públicas y compartidas**: cualquiera que lea la documentación las tiene. No las dejes puestas cuando vayas a vender.

## Paso 1 bis · Tus credenciales propias

Cuando quieras las tuyas:

1. Entrar a la **[consola de Mobbex](https://mobbex.com/console)** y crear la entidad con tu CUIT.
2. Ir al **[portal de desarrollo](https://mobbex.com/devportal)** y crear una aplicación. Ahí sale la **API Key**.
3. Desde la aplicación, **solicitar acceso a la entidad** por CUIT.
4. Volver a la consola y **autorizar** ese acceso. Ahí sale el **Access Token**, que es el que representa a tu comercio.

Son dos objetos distintos y es fácil confundirlos: la API Key es de tu aplicación (el software), el Access Token es de tu comercio (quien cobra). El código necesita los dos.

---

## Paso 2 · El token del aviso, que lo inventás vos

A diferencia de Mercado Pago, acá el secreto no lo genera la pasarela: lo elegís vos y viaja en la dirección que Mobbex va a llamar.

Generá uno largo y al azar. En PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

**Mínimo 32 caracteres.** El código rechaza cualquiera de menos de 24 y lo dice en el registro: un token corto se puede probar a fuerza bruta contra una dirección pública y da la misma sensación de seguridad que uno largo.

No hay que configurar nada del lado de Mobbex: la dirección del aviso, con el token adentro, viaja en cada pedido de cobro que hace el sitio.

> Si alguna vez lo pegás en un chat, un correo o una captura, cambiá la variable por otro. Es un botón y un redeploy.

---

## Paso 3 · La base de datos

Sin cambios respecto de antes. En Vercel: **Storage → Create Database → Redis** (el proveedor es Upstash) y conectarla al proyecto `acentta`.

Vercel inyecta cinco variables al conectar la base. **De esas, el código usa dos:**

| Variable | Para qué |
|---|---|
| `KV_REST_API_URL` | la dirección del almacén |
| `KV_REST_API_TOKEN` | la llave con permiso de escritura |

Las otras tres se ignoran, y conviene saber por qué para no confundirse: `REDIS_URL` y `KV_URL` son cadenas de conexión para un cliente de Redis, y este código habla por la API REST; `KV_REST_API_READ_ONLY_TOKEN` es de sólo lectura, y los pedidos hay que escribirlos.

> **En «Allowed Environments», conviene «All environments».** Con «Production environment only» las variables se marcan como sensibles y dejan de verse en el panel —lo que hace difícil verificar que estén—, y cualquier conexión sin destino de producción se desconecta sola.

El plan gratuito son 256 MB y decenas de miles de operaciones por día. Un pedido pesa menos de dos kilobytes.

---

## Paso 4 · Las variables

En Vercel: **Settings → Environment Variables**, todas para *Production*, *Preview* y *Development*:

| Nombre | Valor |
|---|---|
| `MOBBEX_API_KEY` | la del paso 1 |
| `MOBBEX_ACCESS_TOKEN` | el del paso 1 |
| `MOBBEX_WEBHOOK_TOKEN` | el que generaste en el paso 2 |
| `MOBBEX_MODO` | `prueba` |
| `ADMIN_CLAVE` | una clave larga que inventes, mínimo 12 caracteres |

`PASARELA` no hace falta: sin ella el sitio usa Mobbex. Se pone sólo para volver a Mercado Pago.

> `ADMIN_CLAVE` es la que abre la pantalla de pedidos en `/pedidos`. Esa pantalla muestra nombre, DNI, teléfono y dirección de cada persona que te compró — es la información más delicada del sitio. **Poné una clave larga y que no uses en ningún otro lado.** Doce caracteres es el mínimo que el código acepta; veinte es mejor, y como la escribís una sola vez, que sea incómoda no molesta.

> **Sobre `MOBBEX_MODO`, que es el freno de mano.** Mientras no diga `produccion`, cada cobro se abre con `test: true` y no puede cobrar plata real. Si no ponés la variable, el valor de fábrica es `prueba`, a propósito: si alguien se olvida, lo que falla es un cobro de mentira y no uno de verdad.

Después, **Deployments → el último → Redeploy**. Las variables no entran en un despliegue que ya existe.

Para verificar que quedaron bien: `https://TU-SITIO.vercel.app/api/estado`. Devuelve nombres y booleanos, nunca valores.

---

## Paso 5 · Comprar de mentira

No hace falta ninguna cuenta de comprador de prueba. Se entra al checkout y se paga con una tarjeta falsa.

**El resultado lo decide el código de seguridad**, no la tarjeta. Es el mismo plástico para todos los casos, y es bastante más cómodo que el truco del nombre del titular de Mercado Pago.

| Tarjeta | Número |
|---|---|
| Visa crédito | `4507 9831 9008 2450` |
| Visa débito | `4507 9900 0000 0010` |
| Mastercard crédito | `5323 6299 9312 1008` |
| Mastercard débito | `5204 8651 1890 0397` |
| Naranja crédito | `5895 6200 0000 0010` |
| American Express | `3764 112345 31007` |

Datos genéricos para todas: vencimiento **12/34**, titular **demo**, documento **12123123**.

| Qué querés ver | Código de seguridad | En Amex |
|---|---|---|
| Pago aprobado | `200` | `0200` |
| Rechazado | `400` | `0400` |
| Pago en espera | `002` | `0002` |

Vale la pena probar los tres y no sólo el que sale bien. **`002` es el más importante**: deja el pago en espera, que es lo que pasa de verdad con un cupón de efectivo, y es el camino que casi nadie prueba y el que después rompe en producción. El código lo trata como **pendiente**, no como cobrado — un cupón emitido y sin pagar no se despacha.

Sirve además cualquier otro código de la tabla de estados de Mobbex: `410` para fondos insuficientes, `602` para una devolución.

---

## La pantalla de pedidos

```
https://acentta.vercel.app/pedidos
```

Pide la clave y muestra lo que entró: quién compró, a dónde va, cómo pagó, y un campo por pedido para **cargar el número de seguimiento**.

Ese campo parece el menos interesante de la pantalla y es el más importante. **Es lo único que gana un contracargo.** Cuando alguien desconoce un pago, la única defensa es probar que la mercadería llegó, y eso se prueba con un número de seguimiento cargado en su momento. Por eso existe el filtro **«Sin seguimiento»**: son los pedidos cobrados que todavía no podés defender.

El estado del pago no se toca desde acá — lo pone el aviso de la pasarela y nadie más. Un clic distraído no puede marcar como cobrado algo que no se cobró. Lo único que se cambia a mano es cancelar o marcar como devuelto, que sí son decisiones tuyas.

La sesión dura ocho horas y se corta después de diez intentos fallidos en quince minutos.

### El botón de consultar estados

Toma los pedidos que quedaron en *pendiente* y le pregunta a la pasarela, uno por uno, si el pago entró.

**Es la red de seguridad, y no es una función de laboratorio.** El aviso de pago es un mensaje que viaja por internet, y los mensajes que viajan por internet se pierden: un despliegue justo en ese momento, un corte, una función que tardó de más. **Un pedido que quedó pendiente por un aviso perdido es un pago cobrado que nadie va a despachar.** Conviene apretarlo una vez por día.

Sólo mira los pendientes: re-preguntar por algo aprobado hace ocho meses es gastar llamadas para confirmar lo que ya sabemos.

Y hace la misma comprobación de monto que el aviso automático — es literalmente el mismo código, a propósito. Dos copias de esa lógica terminarían divergiendo, y la que divergiera sería la que menos se usa: justo la que nadie mira.

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

1. `MOBBEX_API_KEY` y `MOBBEX_ACCESS_TOKEN` → los de tu entidad, no los públicos de la documentación.
2. `MOBBEX_MODO` → `produccion`.

**Las dos.** Si cambiás sólo las credenciales, el sitio sigue cobrando de mentira contra tu comercio real; si cambiás sólo `MOBBEX_MODO`, estarías intentando cobrar de verdad con las credenciales públicas de demostración, que no son tuyas.

Mobbex recomienda que las primeras pruebas en producción sean por **más de $100**, con una tarjeta real tuya, y después devolverte la operación.

Antes de eso, lo que falta del lado del negocio está en `ANTES-DE-VENDER.md`.

---

## Volver a Mercado Pago

Si alguna vez cambia el arancel, o si querés mostrar las dos integraciones funcionando:

1. `PASARELA` → `mercadopago`
2. `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `MP_MODO` cargadas.
3. Redeploy.

El resto del sitio no se entera. La cotización, el almacén de pedidos, la conciliación, el checkout, la confirmación y la pantalla de despacho no nombran ninguna pasarela — se puede verificar buscando `mercadopago` o `mobbex` en `src/`: aparecen en el adaptador, en el contrato y en el cableado de tres rutas, y en ningún lado más.

---

## Lo que todavía no está

Honesto, para que no te agarre de sorpresa:

- **No se manda correo de confirmación.** El pedido queda registrado y se consulta por número. Sumar correo pide otro proveedor y otra clave, y el circuito de cobro tiene que estar verificado antes de agregarle piezas.
- **La pantalla de pedidos no manda el seguimiento al comprador.** Lo cargás vos y queda guardado; falta que se le avise, y eso depende del correo.
- **El stock no se descuenta.** Con stock propio esto ya tiene sentido y pasa a ser una tarea real, no como cuando el catálogo era de un proveedor.
- **`/api/crear-pago` no tiene límite de llamadas.** Es lo primero de `ANTES-DE-VENDER.md`: sin tope, alguien puede vaciar el plan gratuito del almacén creando pedidos vacíos.

---

## Cómo se verifica que sigue bien

```powershell
cd "C:\Users\Martín Bazán\Downloads\Martin\PORTFOLIO\Proyecto 4\acentta"
npm.cmd run auditar:cobro
```

Corre sin red y sin credenciales —el almacén y las dos APIs se reemplazan por dobles— y comprueba:

- Que un precio mandado desde el navegador **no** cambie el total. Es la vulnerabilidad clásica de las tiendas hechas a mano: abrir las herramientas del navegador, cambiar $ 89.900 por $ 1 y pagar un peso.
- Que un aviso de Mercado Pago con firma inválida se rechace — probado con once formas distintas de firma falsa.
- Que un aviso de Mobbex sin el token, con el token cortado o con un carácter de más se rechace.
- **Que un aviso que miente no cambie nada**, aunque traiga el token correcto.
- Que los treinta y pico de códigos de estado de Mobbex se traduzcan bien, con atención especial a los dos que parecen cobrados y no lo son: `3` (autorizada, sin capturar) y `2` (cupón emitido, sin pagar).
- Que el mismo aviso repetido ocho veces se procese una sola, pero que un cambio real de estado —de aprobado a devuelto— sí entre.
- Que si el monto cobrado no coincide con el cotizado, el pedido **no** se apruebe.
