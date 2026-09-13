/**
 * acentta · checkout
 * ---------------------------------------------------------------
 * Validación en vivo, tres pasos y resumen sincronizado.
 *
 * Criterio de los mensajes de error: dicen qué hacer, no qué falló.
 * "El correo va con arroba, por ejemplo nombre@ejemplo.com" sirve;
 * "Campo inválido" es sólo una forma educada de decir "arreglátelas".
 */

import { leer, resumen, leerCP, guardarCP, vaciar, subtotal } from '@lib/carrito';
import { precio as fPrecio, cuota, rangoDeEntrega, CUOTAS_SIN_INTERES } from '@lib/formato';
import { foto } from '@lib/imagenes';
import { normalizarCP, calcularEnvio } from '@lib/envio';
import { DESCUENTO_SUCURSAL, DESCUENTO_TRANSFERENCIA } from '@lib/cotizacion';
import { PREPARACION } from '@tipos/catalogo';

const contenedor = document.querySelector<HTMLElement>('.checkout');
if (contenedor) {
  const formas = [...document.querySelectorAll<HTMLFormElement>('[data-paso-forma]')];
  const pasosUI = [...document.querySelectorAll<HTMLElement>('.progreso__paso')];
  let pasoActual = 1;

  /* Sin carrito no hay checkout. */
  if (leer().length === 0) location.replace('/carrito');

  /* ============================================================
     VALIDACIÓN
     ============================================================ */
  type Regla = (v: string) => string | null;

  const reglas: Record<string, Regla> = {
    email: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
        ? null
        : 'El correo va con arroba y un punto, por ejemplo nombre@ejemplo.com',
    nombre: (v) => (v.trim().length >= 2 ? null : 'Escribe tu nombre para poder facturar el pedido.'),
    apellido: (v) => (v.trim().length >= 2 ? null : 'Falta el apellido.'),
    dni: (v) =>
      /^\d{7,8}$/.test(v.replace(/\D/g, ''))
        ? null
        : 'El DNI va sin puntos, con 7 u 8 números.',
    telefono: (v) =>
      v.replace(/\D/g, '').length >= 8
        ? null
        : 'Un teléfono con característica, por ejemplo 11 2345 6789.',
    'cp-checkout': (v) =>
      normalizarCP(v) === null
        ? 'El código postal lleva cuatro números. Prueba con 1425.'
        : calcularEnvio(v, 1).ok
          ? null
          : 'Todavía no llegamos a ese código postal. Escríbenos y lo vemos.',
    provincia: (v) => (v.trim().length >= 3 ? null : 'Falta la provincia.'),
    ciudad: (v) => (v.trim().length >= 2 ? null : 'Falta la ciudad o localidad.'),
    calle: (v) => (v.trim().length >= 3 ? null : 'Falta el nombre de la calle.'),
    numero: (v) => (v.trim().length >= 1 ? null : 'Falta la altura. Si no tiene, escribe S/N.'),
  };

  /* [SE FUERON] Acá vivían las reglas de tarjeta, titular,
     vencimiento y código de seguridad, con el algoritmo de Luhn para
     atrapar el dígito mal tipeado antes de que el banco lo rechace.
     Era buen código y ya no tiene lugar: la tarjeta se carga en
     Mercado Pago, así que este sitio no la ve. Validar un dato que no
     se recibe es mantener una comprobación que no comprueba nada. */

  function campoDe(entrada: HTMLElement): HTMLElement | null {
    return entrada.closest('.campo');
  }

  function marcarError(entrada: HTMLInputElement, mensaje: string) {
    const campo = campoDe(entrada);
    if (!campo) return;
    campo.dataset.estado = 'error';
    entrada.setAttribute('aria-invalid', 'true');

    let error = campo.querySelector<HTMLElement>('.campo__error');
    if (!error) {
      error = document.createElement('p');
      error.className = 'campo__error';
      error.id = `${entrada.id}-error`;
      error.setAttribute('role', 'alert');
      error.innerHTML =
        '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">' +
        '<path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.8.8 0 0 0-.8.9l.25 3.1a.55.55 0 0 0 1.1 0l.25-3.1a.8.8 0 0 0-.8-.9Zm0 5.4a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Z"/></svg><span></span>';
      campo.appendChild(error);
      entrada.setAttribute('aria-describedby', error.id);
    }
    error.querySelector('span')!.textContent = mensaje;
  }

  function limpiarError(entrada: HTMLInputElement) {
    const campo = campoDe(entrada);
    if (!campo) return;
    campo.dataset.estado = entrada.value.trim() ? 'exito' : 'normal';
    entrada.removeAttribute('aria-invalid');
    campo.querySelector('.campo__error')?.remove();
  }

  function validar(entrada: HTMLInputElement): boolean {
    const regla = reglas[entrada.id];
    const requerido = entrada.required;

    if (!entrada.value.trim()) {
      if (!requerido) { limpiarError(entrada); return true; }
      marcarError(entrada, 'Este dato es necesario para completar el pedido.');
      return false;
    }
    if (!regla) { limpiarError(entrada); return true; }

    const problema = regla(entrada.value);
    if (problema) { marcarError(entrada, problema); return false; }
    limpiarError(entrada);
    return true;
  }

  /* La validación corre al salir del campo, no mientras se escribe.
     Marcar en rojo a alguien que todavía está escribiendo su correo
     es corregirlo antes de que termine la frase. */
  for (const forma of formas) {
    for (const entrada of forma.querySelectorAll<HTMLInputElement>('input, textarea, select')) {
      entrada.addEventListener('blur', () => { if (entrada.value.trim()) validar(entrada); });
      entrada.addEventListener('input', () => {
        if (campoDe(entrada)?.dataset.estado === 'error') validar(entrada);
      });
    }
  }

  /* ============================================================
     FORMATO ASISTIDO
     ============================================================ */
  /* El código postal completa la provincia: un dato menos para
     escribir es un dato menos para equivocarse. */
  const cpCheckout = document.querySelector<HTMLInputElement>('#cp-checkout');
  cpCheckout?.addEventListener('input', () => {
    const r = calcularEnvio(cpCheckout.value, 1);
    if (r.ok) {
      guardarCP(cpCheckout.value);
      pintarResumen();
      pintarEnvio();
      /* Las sucursales dependen del código postal, así que se
         refrescan cuando cambia. `traerSucursales` no vuelve a
         llamar a OCA si el código es el mismo que ya consultó: sin
         ese freno, cada tecla sería una llamada. */
      void traerSucursales();
    }
  });

  /* Los dos campos arrancan vacíos, mostrando su ejemplo.
     Antes se rellenaba el código postal con el que se hubiera escrito
     en el carrito. Suena a comodidad y en la práctica confunde: quien
     abre el checkout se encuentra dos casillas con texto adentro y no
     puede distinguir un dato propio de un relleno de la simulación,
     y para corregirlo tiene que seleccionar y borrar.
     El código postal del carrito no se pierde: sigue guardado y es el
     que usa el resumen para estimar el envío hasta que se escriba uno
     acá. Lo que cambia es que la casilla no miente sobre su estado. */

  /* ============================================================
     PASOS
     ============================================================ */
  /** Se apaga apenas se dibuja el primer paso. */
  let inicial = true;

  function irAPaso(n: number) {
    pasoActual = n;
    for (const f of formas) f.hidden = Number(f.dataset.pasoForma) !== n;
    for (const p of pasosUI) {
      const num = Number(p.dataset.paso);
      p.removeAttribute('aria-current');
      delete p.dataset.estado;
      if (num < n) p.dataset.estado = 'hecho';
      if (num === n) p.setAttribute('aria-current', 'step');
    }
    /* El botón de confirmar vive en la tarjeta del pedido y sólo se
       muestra en el paso de pago. En los dos primeros sería un botón
       que promete terminar algo que todavía está a medias. */
    const accion = document.querySelector<HTMLElement>('[data-ck-accion]');
    if (accion) accion.hidden = n !== 3;

    /* Las filas de «lo elegido» dependen del paso: la entrega recién
       vale cuando se pasó por el paso de envío, y el pago cuando se
       llegó al de pago. */
    pintarElegido();

    /* Al cambiar de paso, el foco va al título: quien navega con
       teclado o lector de pantalla necesita saber que la pantalla
       cambió, no descubrirlo tabulando.
       No se hace en la primera carga —`inicial`— porque ahí nadie
       cambió de pantalla: la página recién se abrió, el foco ya está
       donde corresponde y lo único que lograba era dibujar un
       recuadro alrededor del titular apenas entrar. */
    if (!inicial) {
      /* h2, no h1: el h1 es de la página entera ("Finalizar compra").
         Cada paso tiene su h2, y es ése el que anuncia el cambio. */
      const titulo = formas[n - 1]?.querySelector<HTMLElement>('h2');
      titulo?.setAttribute('tabindex', '-1');
      titulo?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    inicial = false;
  }

  for (const forma of formas) {
    forma.addEventListener('submit', (e) => {
      e.preventDefault();
      const entradas = [...forma.querySelectorAll<HTMLInputElement>('input, textarea')]
        .filter((i) => i.type !== 'radio' && i.type !== 'checkbox');

      let primerError: HTMLInputElement | null = null;
      for (const entrada of entradas) {
        if (!validar(entrada) && !primerError) primerError = entrada;
      }

      /* Retiro en sucursal sin sucursal elegida no puede avanzar.
         ------------------------------------------------------------
         Un pedido así no se puede despachar: al ir a darlo de alta en
         OCA falta el dato, y para conseguirlo hay que escribirle al
         comprador y preguntarle algo que el sitio tendría que haberle
         preguntado antes de cobrarle.

         Se corta acá, con el mensaje al lado de la lista, siguiendo
         la misma regla que el error de los términos: bloquear en
         silencio es lo que hace que alguien apriete el botón y crea
         que el sitio no anda. */
      const pasoDeEnvio = Number(forma.dataset.pasoForma) === 2;
      if (pasoDeEnvio && eligeSucursal() && !sucursalElegida()) {
        if (notaSucursales) {
          notaSucursales.textContent = cpConsultado
            ? 'Elegí en cuál sucursal la vas a retirar.'
            : 'Completá tu código postal arriba para ver las sucursales, o elegí entrega a domicilio.';
          notaSucursales.dataset.error = 'true';
        }
        const primera = listaSucursales?.querySelector<HTMLInputElement>('input')
          ?? document.querySelector<HTMLInputElement>('#cp-checkout');
        primera?.focus({ preventScroll: true });
        primera?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      if (notaSucursales) delete notaSucursales.dataset.error;

      /* [ERROR CORREGIDO] Un envío bloqueado tiene que DECIR que está
         bloqueado, y decirlo donde se apretó.

         Antes, no tildar los términos hacía esto: agregaba una clase
         —que no tenía ninguna regla de estilo, así que no se veía—,
         mandaba el foco a la casilla, que está oculta por diseño, y
         volvía. Sin mensaje, sin desplazamiento, sin nada. Y el botón
         de confirmar vive en la tarjeta del pedido, lejos de la
         casilla, así que ni siquiera había a dónde mirar.

         El síntoma era exacto: «aprieto Confirmar compra y no pasa
         nada». Tenía razón: no pasaba nada. */
      const acepto = forma.querySelector<HTMLInputElement>('#acepto');
      if (acepto && !acepto.checked) {
        const caja = acepto.closest('.acuerdo')!;
        caja.classList.add('acuerdo--error');
        if (!primerError) {
          avisoEnElBoton('Falta aceptar los términos y condiciones.');
          caja.scrollIntoView({ block: 'center', behavior: 'smooth' });
          acepto.focus({ preventScroll: true });
          return;
        }
      }

      /* Foco automático en el campo con problema: en un formulario
         largo, un error arriba de todo y el foco abajo es un error
         que nadie encuentra. */
      if (primerError) {
        avisoEnElBoton('Hay datos que faltan o no son válidos. Los marcamos más arriba.');
        primerError.focus();
        primerError.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }

      /* Se pudo seguir: si había un aviso de un intento anterior, se
         borra. Un cartel de error que sobrevive a su causa es peor
         que no tenerlo. */
      avisoEnElBoton('');

      if (pasoActual < 3) { irAPaso(pasoActual + 1); return; }

      void confirmar(forma);
    });

    forma.querySelector('[data-atras]')?.addEventListener('click', () => irAPaso(pasoActual - 1));
  }

  document.querySelector('#acepto')?.addEventListener('change', function (this: HTMLInputElement) {
    this.closest('.acuerdo')!.classList.toggle('acuerdo--error', !this.checked);
  });

  /* ============================================================
     RESUMEN
     ============================================================ */
  const metodoPagoRadios = [...document.querySelectorAll<HTMLInputElement>('[name="metodo-pago"]')];
  const metodoEnvioRadios = [...document.querySelectorAll<HTMLInputElement>('[name="metodo-envio"]')];

  /* Las dos constantes se importan de `cotizacion.ts` y no se copian.
     Éste es el número que el servidor va a usar para cobrar: si acá
     dice 10 % y allá 12 %, el resumen y el cobro no coinciden, y el
     comprador lo descubre en la pantalla de Mercado Pago. */
  function descuentoTransferencia(): number {
    const elegido = metodoPagoRadios.find((r) => r.checked)?.value;
    return elegido === 'transferencia'
      ? Math.round(subtotal() * DESCUENTO_TRANSFERENCIA)
      : 0;
  }

  function ajusteSucursal(): number {
    const elegido = metodoEnvioRadios.find((r) => r.checked)?.value;
    return elegido === 'sucursal' ? -DESCUENTO_SUCURSAL : 0;
  }

  function pintarResumen() {
    const items = leer();
    const r = resumen(leerCP(), items);
    const envio = r.envioGratis ? 0 : Math.max(0, r.envio + ajusteSucursal());
    const descuento = descuentoTransferencia();
    const total = r.subtotal + envio - descuento;

    document.querySelector<HTMLElement>('[data-ck-items]')!.innerHTML = items.map((i) => `
      <article class="ck-item">
        <img class="ck-item__foto" src="${foto(i.imagen, 150)}" alt="" width="52" height="52" loading="lazy" />
        <div class="ck-item__datos">
          <p class="ck-item__nombre">${i.nombre}</p>
          <p class="ck-item__meta">${i.variante ? i.variante + ' · ' : ''}${i.cantidad} u.</p>
        </div>
        <span class="ck-item__precio">${fPrecio(i.precio * i.cantidad)}</span>
      </article>`).join('');

    document.querySelector<HTMLElement>('[data-ck-subtotal]')!.textContent = fPrecio(r.subtotal);

    const rotulo = document.querySelector<HTMLElement>('[data-ck-envio-rotulo]')!;
    const valorEnvio = document.querySelector<HTMLElement>('[data-ck-envio]')!;
    /* El verde del envío gratis se pone con una clase y no con estilo
       en línea. Un color escrito en el elemento le gana a la hoja y
       deja de poder cambiarse desde el sistema de diseño. */
    const filaEnvio = valorEnvio.closest('.resumen__linea')!;
    filaEnvio.classList.toggle('resumen__linea--gratis', r.envioGratis);

    if (r.envioGratis) {
      rotulo.textContent = 'Envío';
      valorEnvio.textContent = 'Gratis';
    } else if (r.envioEstimado) {
      rotulo.textContent = 'Envío (estimado)';
      valorEnvio.textContent = `desde ${fPrecio(envio)}`;
    } else {
      rotulo.textContent = `Envío a ${r.zona}`;
      valorEnvio.textContent = fPrecio(envio);
    }

    const filaDesc = document.querySelector<HTMLElement>('[data-ck-descuento-fila]')!;
    filaDesc.hidden = descuento === 0;
    document.querySelector<HTMLElement>('[data-ck-descuento]')!.textContent = `− ${fPrecio(descuento)}`;

    for (const nodo of document.querySelectorAll<HTMLElement>('[data-ck-total], [data-ck-total-2]')) {
      nodo.textContent = fPrecio(total);
    }

    const nodoCuotas = document.querySelector<HTMLElement>('[data-ck-cuotas]');
    if (nodoCuotas) {
      nodoCuotas.innerHTML =
        `o ${CUOTAS_SIN_INTERES} cuotas sin interés de <b>${cuota(total)}</b>`;
    }

    /* [SE FUE] El selector de cuotas. Las cuotas se eligen en la
       pantalla de Mercado Pago, que es donde se sabe qué ofrece el
       banco de esa tarjeta en particular. Elegirlas acá era adivinar
       y después volver a preguntarlas allá. */

    /* Fecha de entrega.
     *
     * Preparación nuestra + tránsito del correo. El tránsito ya viene
     * medido por el operador, así que no se le resta un día por elegir
     * sucursal: cuando la cotización es de una operativa sucursal a
     * sucursal, ese día ya está adentro de `diasExtra`. Restarlo acá
     * lo contaba dos veces y prometía un día antes de lo posible. */
    const entrega = document.querySelector<HTMLElement>('[data-ck-entrega]')!;
    const extra = r.diasExtra ?? 0;
    entrega.textContent = leerCP()
      ? `Llega ${rangoDeEntrega(PREPARACION.min + extra, PREPARACION.max + extra)}.`
      : 'La fecha exacta aparece al completar el código postal.';

    /* El selector de cuotas se rehace acá arriba con el total nuevo,
       así que la fila de pago tiene que volver a leerlo. */
    pintarElegido();
  }

  function pintarEnvio() {
    const r = resumen(leerCP());
    const nota = document.querySelector<HTMLElement>('[data-envio-resumen]');
    if (nota) {
      nota.textContent = r.envioGratis
        ? 'Tu pedido supera el umbral, así que el envío es gratis en las dos opciones.'
        : 'El costo depende de la zona. Se muestra actualizado en el resumen de la derecha.';
    }
    const dom = document.querySelector<HTMLElement>('[data-precio-domicilio]');
    const suc = document.querySelector<HTMLElement>('[data-precio-sucursal]');
    if (dom) dom.textContent = r.envioGratis ? 'Gratis' : fPrecio(r.envio);
    /* `suc` puede no existir: la opción de retiro en sucursal sólo se
       imprime si la operativa está contratada. Es un estimado —el
       precio real lo devuelve el servidor al cotizar— y por eso usa
       el mismo descuento que la tabla propia. */
    if (suc) {
      suc.textContent = r.envioGratis
        ? 'Gratis'
        : fPrecio(Math.max(0, r.envio - DESCUENTO_SUCURSAL));
    }

    const desc = document.querySelector<HTMLElement>('[data-descuento-transferencia]');
    if (desc) {
      desc.textContent = `− ${fPrecio(Math.round(subtotal() * DESCUENTO_TRANSFERENCIA))}`;
    }
  }

  /* ============================================================
     ELEGIR SUCURSAL DE RETIRO
     ------------------------------------------------------------
     Faltaba entero: se podía marcar «retiro en sucursal», pagar, y
     ni el comprador ni el vendedor sabían a cuál iba el paquete.

     Las sucursales las tiene OCA y dependen del código postal, así
     que se piden a `/api/sucursales`. Tres decisiones que valen la
     pena nombrar:

     1 · La lista se pide con el código postal ya escrito, no antes.
         Sin código postal no hay lista posible, y un desplegable
         vacío al marcar la opción se lee como «esto no anda».

     2 · Si no se puede traer la lista —OCA caído, sin credenciales,
         sin cobertura— **se vuelve a domicilio**, con aviso. La
         alternativa era dejar elegir sucursal sin sucursal, que es
         cobrar por una promesa que no se puede cumplir.

     3 · La elección es obligatoria para avanzar. Un pedido de retiro
         sin sucursal no se puede despachar, y descubrirlo al
         despachar significa escribirle al comprador para preguntarle
         algo que el sitio tendría que haberle preguntado.
     ============================================================ */
  interface SucursalOCA { id: string; nombre: string; direccion: string; localidad: string }

  const cajaSucursales = document.querySelector<HTMLElement>('[data-sucursales]');
  const listaSucursales = document.querySelector<HTMLElement>('[data-sucursales-lista]');
  const notaSucursales = document.querySelector<HTMLElement>('[data-sucursales-nota]');

  /** El último código postal para el que ya se pidió la lista. */
  let cpConsultado = '';
  let pidiendo = false;

  function eligeSucursal(): boolean {
    return metodoEnvioRadios.find((r) => r.checked)?.value === 'sucursal';
  }

  /** La sucursal marcada, o `null` si no hay ninguna. */
  function sucursalElegida(): { id: string; nombre: string; direccion: string } | null {
    const marcado = listaSucursales?.querySelector<HTMLInputElement>('input:checked');
    if (!marcado) return null;
    return {
      id: marcado.value,
      nombre: marcado.dataset.nombre ?? '',
      direccion: marcado.dataset.direccion ?? '',
    };
  }

  function pintarSucursales(lista: SucursalOCA[]) {
    if (!listaSucursales || !notaSucursales) return;

    if (lista.length === 0) {
      listaSucursales.innerHTML = '';
      notaSucursales.textContent =
        'OCA no tiene sucursales de retiro en tu zona. Elegí entrega a domicilio.';
      return;
    }

    notaSucursales.textContent = `${lista.length} sucursal(es) cerca de tu código postal. Llevá tu DNI.`;
    listaSucursales.innerHTML = lista.map((s, i) => `
      <label class="metodo">
        <input type="radio" name="sucursal-retiro" value="${esc(s.id)}"
               data-nombre="${esc(s.nombre)}" data-direccion="${esc(s.direccion)}"
               ${i === 0 ? 'checked' : ''} />
        <span class="metodo__cuerpo">
          <span class="sucursal__nombre">${esc(s.nombre)}</span>
          <span class="sucursal__direccion">${esc(s.direccion)}${s.localidad ? ` · ${esc(s.localidad)}` : ''}</span>
        </span>
      </label>`).join('');
  }

  /** Escapa lo que viene de la API antes de meterlo en el HTML. */
  function esc(s: string): string {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
    ));
  }

  async function traerSucursales() {
    if (!cajaSucursales || !listaSucursales || !notaSucursales) return;

    const cp = leerCP();
    cajaSucursales.hidden = !eligeSucursal();
    if (!eligeSucursal()) return;

    if (!cp) {
      listaSucursales.innerHTML = '';
      notaSucursales.textContent = 'Completá tu código postal arriba y te mostramos las de tu zona.';
      cpConsultado = '';
      return;
    }
    if (cp === cpConsultado || pidiendo) return;

    pidiendo = true;
    notaSucursales.textContent = 'Buscando sucursales…';
    try {
      const r = await fetch(`/api/sucursales?cp=${encodeURIComponent(cp)}`, {
        signal: AbortSignal.timeout(8000),
      });
      const d = (await r.json()) as { sucursales?: SucursalOCA[]; error?: string };
      if (!r.ok) throw new Error(d.error ?? 'sin respuesta');

      cpConsultado = cp;
      pintarSucursales(d.sucursales ?? []);
      pintarResumen();
    } catch {
      /* Volver a domicilio y decirlo. Dejar marcada una opción que no
         se puede completar es peor que sacarla: el comprador paga
         creyendo que va a retirar en algún lado. */
      const domicilio = metodoEnvioRadios.find((r) => r.value === 'domicilio');
      if (domicilio) { domicilio.checked = true; domicilio.dispatchEvent(new Event('change', { bubbles: true })); }
      cajaSucursales.hidden = true;
      const aviso = document.querySelector<HTMLElement>('[data-envio-resumen]');
      if (aviso) {
        aviso.textContent =
          'No pudimos traer las sucursales de retiro, así que dejamos la entrega a domicilio. '
          + 'Podés intentar de nuevo en un momento.';
      }
    } finally {
      pidiendo = false;
    }
  }

  for (const r of metodoEnvioRadios) r.addEventListener('change', () => void traerSucursales());

  /* Delegado y no por radio: la lista se rehace entera cada vez que
     cambia el código postal, así que escuchar en cada `input` sería
     volver a atar todo en cada dibujo, y olvidarse una vez deja una
     opción que se marca sin actualizar el resumen. */
  listaSucursales?.addEventListener('change', () => {
    if (notaSucursales) delete notaSucursales.dataset.error;
    pintarElegido();
  });

  /* ============================================================
     LO ELEGIDO
     ------------------------------------------------------------
     La tarjeta mostraba cuánto sale y cuándo llega, pero no a dónde
     va ni cómo se paga. Para repasar eso había que volver dos pasos
     atrás, y volver atrás en un checkout es la forma más común de no
     volver: se pierde el hilo, se relee todo y se cierra la pestaña.

     Cada fila aparece sola cuando tiene algo que decir. Nada de
     rótulos con la nada al lado: una tarjeta con tres campos vacíos
     en el primer paso da la sensación de formulario incompleto justo
     donde hace falta lo contrario.
     ============================================================ */
  function valor(id: string): string {
    return (document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '').trim();
  }

  function fila(marca: string, nodo: string, texto: string) {
    const contenedorFila = document.querySelector<HTMLElement>(`[${marca}]`);
    const destino = document.querySelector<HTMLElement>(`[${nodo}]`);
    if (!contenedorFila || !destino) return Boolean(texto);
    destino.textContent = texto;
    contenedorFila.hidden = !texto;
    return Boolean(texto);
  }

  function pintarElegido() {
    const bloque = document.querySelector<HTMLElement>('[data-ck-datos]');
    if (!bloque) return;

    /* Entrega: sólo tiene sentido una vez que se pasó por el paso de
       envío. Antes, la opción marcada es la de fábrica y mostrarla
       sería informar una decisión que nadie tomó todavía. */
    const enSucursal = metodoEnvioRadios.find((r) => r.checked)?.value === 'sucursal';
    /* Con retiro en sucursal, el dato que la persona vuelve a mirar
       antes de pagar no es «retiro en sucursal» sino A CUÁL. Decir
       sólo la modalidad la obliga a subir dos veces a comprobarlo. */
    const suc = enSucursal ? sucursalElegida() : null;
    const hayEntrega = fila(
      'data-ck-fila-entrega', 'data-ck-metodo-envio',
      pasoActual < 2 ? ''
        : enSucursal
          ? (suc ? `Retiro en ${suc.nombre}${suc.direccion ? ` · ${suc.direccion}` : ''}` : 'Retiro en sucursal del correo')
          : 'A domicilio'
    );

    /* Dirección: se arma con lo que haya. Un renglón a medias
       —"Av. Colón 1234"— ya sirve para reconocer si uno se equivocó
       de calle, que es para lo que está. */
    const calle = [valor('calle'), valor('numero')].filter(Boolean).join(' ');
    const localidad = [valor('ciudad'), valor('provincia')].filter(Boolean).join(', ');
    const cp = valor('cp-checkout');
    const direccion = [calle, valor('piso'), localidad, cp && `CP ${cp}`]
      .filter(Boolean).join(' · ');
    const hayDireccion = fila('data-ck-fila-direccion', 'data-ck-direccion', direccion);

    /* Pago: con las cuotas elegidas, que es el dato que la gente
       vuelve a mirar antes de apretar. */
    let pago = '';
    if (pasoActual >= 3) {
      const porTarjeta = metodoPagoRadios.find((r) => r.checked)?.value === 'tarjeta';
      pago = porTarjeta
        ? `Tarjeta · hasta ${CUOTAS_SIN_INTERES} cuotas sin interés`
        : `Transferencia bancaria · ${Math.round(DESCUENTO_TRANSFERENCIA * 100)} % de descuento`;
    }
    const hayPago = fila('data-ck-fila-pago', 'data-ck-metodo-pago', pago);

    bloque.hidden = !(hayEntrega || hayDireccion || hayPago);
  }

  /* Se repinta con cualquier cosa que cambie alguno de esos datos. */
  for (const id of ['calle', 'numero', 'piso', 'ciudad', 'provincia', 'cp-checkout']) {
    document.querySelector(`#${id}`)?.addEventListener('input', pintarElegido);
  }
  for (const r of [...metodoPagoRadios, ...metodoEnvioRadios]) {
    r.addEventListener('change', () => { pintarResumen(); pintarEnvio(); pintarElegido(); });
  }

  /* Resumen plegable en móvil */
  const toggle = document.querySelector<HTMLButtonElement>('[data-toggle-resumen]');
  const contenido = document.querySelector<HTMLElement>('[data-resumen-contenido]');
  if (toggle && contenido) {
    const chico = window.matchMedia('(max-width: 899px)');
    const sincronizar = () => { contenido.hidden = chico.matches; toggle.setAttribute('aria-expanded', String(!chico.matches)); };
    sincronizar();
    chico.addEventListener('change', sincronizar);
    toggle.addEventListener('click', () => {
      contenido.hidden = !contenido.hidden;
      toggle.setAttribute('aria-expanded', String(!contenido.hidden));
      toggle.querySelector('span')!.textContent = contenido.hidden ? 'Ver el detalle' : 'Ocultar el detalle';
    });
  }

  /* ============================================================
     CONFIRMAR
     ============================================================ */
  /**
   * Manda el pedido a cobrar.
   *
   * Lo que viaja son identificadores y cantidades. Ni un precio: el
   * total lo calcula la función del servidor leyendo el catálogo, y
   * es el único que cuenta. Si acá se mandara un precio habría que
   * decidir si creerle, y la respuesta correcta a esa pregunta
   * siempre es que no.
   *
   * Devuelve a dónde ir después, y son tres destinos distintos:
   *
   *   · `pasarela`      → el enlace de Mercado Pago
   *   · `transferencia` → no hay a dónde redirigir; se paga por
   *                       fuera y hay que mostrar los datos
   *   · `null`          → el cobro no está configurado en este
   *                       despliegue, y sigue el camino simulado
   *
   * Antes devolvía sólo el enlace, y eso alcanzaba mientras todo
   * pasaba por la pasarela. Con la transferencia hay una respuesta
   * legítima que no trae enlace, y con la firma vieja se leía como
   * una falla: el comprador veía «No pudimos abrir el pago» sobre un
   * pedido que se había guardado bien.
   */
  type Cobro =
    | { tipo: 'pasarela'; enlace: string }
    | { tipo: 'transferencia'; numero: string };

  async function pedirCobro(): Promise<Cobro | null> {
    const campo = (id: string) => (document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '').trim();

    const cuerpo = JSON.stringify({
        items: leer().map((i) => ({ id: i.id, cantidad: i.cantidad, variante: i.variante })),
        metodoEnvio: metodoEnvioRadios.find((r) => r.checked)?.value ?? 'domicilio',
        metodoPago: metodoPagoRadios.find((r) => r.checked)?.value ?? 'tarjeta',
        comprador: {
          email: campo('email'), nombre: campo('nombre'), apellido: campo('apellido'),
          dni: campo('dni'), telefono: campo('telefono'),
        },
        entrega: {
          cp: campo('cp-checkout'), provincia: campo('provincia'), ciudad: campo('ciudad'),
          calle: campo('calle'), numero: campo('numero'), piso: campo('piso'),
          entre: campo('entre'), referencias: campo('referencias'),
          /* La sucursal viaja con el pedido y no se deduce después.
             Al despachar hay que decirle a OCA a dónde va, y volver
             a calcularla desde el código postal daría la primera de
             la lista, no la que la persona eligió. */
          sucursal: sucursalElegida(),
        },
    });

    /* La llamada va envuelta. Si no hay nadie del otro lado, `fetch`
       no devuelve un código de error: rechaza la promesa. Eso pasa en
       los dos lugares donde más se prueba —la vista previa local, que
       se abre como archivo, y cualquier despliegue anterior a estas
       funciones— y era exactamente lo que se escapaba. */
    let respuesta: Response;
    try {
      respuesta = await fetch('/api/crear-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* Si el servidor tarda, es preferible caer al camino simulado
           que dejar a alguien mirando un botón girando sin final. */
        signal: AbortSignal.timeout(15000),
        body: cuerpo,
      });
    } catch {
      return null;
    }

    /* [ERROR CORREGIDO] Devolver null —seguir por el camino simulado—
       tiene que pasar en TODOS los casos en que no hay una función de
       cobro contestando, y no sólo cuando contesta 503.

       La primera versión sólo miraba el 503, y con eso rompí la
       demostración en los dos lugares donde más se prueba: la vista
       previa local, que se abre como archivo y no tiene servidor
       detrás, y cualquier despliegue anterior a estas funciones. En
       los dos, `fetch` falla o contesta con la página 404, y el error
       terminaba en un aviso rojo en lugar de en la simulación de
       siempre. Desde afuera se ve como «aprieto confirmar y no pasa
       nada», que es exactamente lo que no debería pasar.

       El criterio correcto: sólo se muestra un error cuando la
       función existió y dijo que no —falta stock, código postal sin
       cobertura, Mercado Pago rechazó—. Si no hubo nadie del otro
       lado, el sitio se comporta como la demostración que es. */
    if (respuesta.status === 503 || respuesta.status === 404 || respuesta.status === 405) return null;

    let datos: { enlace?: string; numero?: string; transferencia?: unknown; error?: string };
    try {
      datos = (await respuesta.json()) as typeof datos;
    } catch {
      /* Contestó algo que no es JSON: es la página 404 del sitio, no
         nuestra función. */
      return null;
    }

    if (!respuesta.ok) {
      throw new Error(datos.error ?? 'No pudimos abrir el pago. Probá de nuevo en un momento.');
    }
    /* La transferencia se reconoce por lo que TRAE y no por lo que le
       falta: un pedido sin enlace y sin datos de transferencia es una
       respuesta rota, no un pago por transferencia. */
    if (datos.transferencia && datos.numero) {
      return { tipo: 'transferencia', numero: datos.numero };
    }
    if (datos.enlace) return { tipo: 'pasarela', enlace: datos.enlace };

    throw new Error(datos.error ?? 'No pudimos abrir el pago. Probá de nuevo en un momento.');
  }

  /**
   * El aviso va pegado al botón que se apretó.
   *
   * Quien acaba de tocar «Confirmar compra» está mirando el botón. Un
   * mensaje a dos pantallas de distancia —o peor, ninguno— es un
   * mensaje que no existe. Con el texto vacío se borra.
   */
  function avisoEnElBoton(mensaje: string) {
    const donde = document.querySelector<HTMLElement>('[data-ck-accion]');
    if (!donde) return;
    let aviso = donde.querySelector<HTMLElement>('.aviso-pago');
    if (!mensaje) { aviso?.remove(); return; }
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.className = 'aviso-pago';
      aviso.setAttribute('role', 'alert');
      donde.appendChild(aviso);
    }
    aviso.textContent = mensaje;
  }
  const mostrarErrorDePago = avisoEnElBoton;

  async function confirmar(forma: HTMLFormElement) {
    /* El botón ya no está adentro del formulario: se mudó a la tarjeta
       del pedido y se conecta con el atributo `form`. Se busca en el
       documento, no dentro de la forma. */
    void forma;
    const boton = document.querySelector<HTMLButtonElement>('[data-pagar]')!;
    boton.dataset.cargando = 'true';
    boton.setAttribute('aria-busy', 'true');
    boton.disabled = true;
    if (!boton.querySelector('.boton__girador')) {
      const girador = document.createElement('span');
      girador.className = 'boton__girador';
      girador.setAttribute('aria-hidden', 'true');
      boton.appendChild(girador);
    }

    let cobro: Cobro | null = null;
    try {
      cobro = await pedirCobro();
    } catch (err) {
      boton.dataset.cargando = 'false';
      boton.removeAttribute('aria-busy');
      boton.disabled = false;
      mostrarErrorDePago(err instanceof Error ? err.message : 'No pudimos abrir el pago.');
      return;
    }

    if (cobro?.tipo === 'pasarela') {
      /* El carrito NO se vacía acá. Todavía no se pagó nada: si la
         persona vuelve atrás desde Mercado Pago, tiene que encontrar
         su carrito donde lo dejó. Se vacía en la confirmación, con el
         pedido ya registrado. */
      location.href = cobro.enlace;
      return;
    }

    if (cobro?.tipo === 'transferencia') {
      /* No hay a dónde redirigir: la plata va del banco de la persona
         al tuyo, sin nadie en el medio. El pedido ya quedó registrado
         del lado del servidor; acá se guarda la copia local que usan
         la confirmación y el seguimiento, y se va a la página donde
         están los datos para transferir.

         El carrito SÍ se vacía en este caso, y es la diferencia con
         el camino de la pasarela: con Mercado Pago la compra todavía
         puede no completarse y hay que poder volver: acá el pedido
         está tomado y esperando el depósito. Un carrito que sigue
         lleno después de eso invita a comprar dos veces. */
      const items = leer();
      const r = resumen(leerCP(), items);
      try {
        /* La misma clave y la misma forma que el camino simulado de
           más abajo. Se escribe con `localStorage` directo, igual que
           allá, para no tener dos maneras de guardar lo mismo. */
        localStorage.setItem('acentta:pedido:v1', JSON.stringify({
          numero: cobro.numero,
          fecha: new Date().toISOString(),
          items,
          total: r.subtotal + (r.envioGratis ? 0 : r.envio) - descuentoTransferencia(),
          envio: r.envioGratis ? 0 : r.envio,
          zona: r.zona ?? '',
          email: (document.querySelector<HTMLInputElement>('#email')?.value ?? '').trim(),
          diasExtra: r.diasExtra,
          /* Lo que la confirmación necesita para mostrar los datos
             bancarios en vez del «ya está, te avisamos». */
          metodoPago: 'transferencia',
        }));
      } catch { /* sin almacenamiento: la confirmación igual lo busca por número */ }

      vaciar();
      location.href = '/confirmacion';
      return;
    }

    /* ---- Camino simulado ----
       Sin cobro configurado, el sitio se comporta como hasta ahora:
       arma un pedido de mentira y va a la confirmación. Es lo que
       mantiene la demostración del portafolio en pie mientras las
       credenciales no estén puestas. */
    const items = leer();
    const r = resumen(leerCP(), items);
    const numero = 'AC-' + String(Date.now()).slice(-8);
    try {
      localStorage.setItem('acentta:pedido:v1', JSON.stringify({
        numero,
        fecha: new Date().toISOString(),
        items,
        total: r.subtotal + (r.envioGratis ? 0 : r.envio) - descuentoTransferencia(),
        envio: r.envioGratis ? 0 : r.envio,
        zona: r.zona ?? '',
        email: (document.querySelector<HTMLInputElement>('#email')?.value ?? '').trim(),
        diasExtra: r.diasExtra,
      }));
    } catch { /* sin almacenamiento: la confirmación muestra el genérico */ }

    window.setTimeout(() => {
      vaciar();
      location.href = '/confirmacion';
    }, 1400);
  }

  pintarResumen();
  pintarEnvio();
  irAPaso(1);
}
