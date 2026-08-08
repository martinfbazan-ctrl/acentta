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
import { precio as fPrecio, cuota, rangoDeEntrega } from '@lib/formato';
import { normalizarCP, calcularEnvio } from '@lib/envio';

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
    tarjeta: (v) => {
      const n = v.replace(/\D/g, '');
      if (n.length < 13) return 'Faltan números. Una tarjeta tiene entre 13 y 19.';
      return luhn(n) ? null : 'Ese número no es válido. Revisa si se coló un dígito de más.';
    },
    titular: (v) => (v.trim().length >= 4 ? null : 'El nombre tal como figura impreso en la tarjeta.'),
    vencimiento: (v) => {
      const m = v.match(/^(\d{2})\/?(\d{2})$/);
      if (!m) return 'El vencimiento va como MM/AA, por ejemplo 07/29.';
      const mes = Number(m[1]);
      const anio = 2000 + Number(m[2]);
      if (mes < 1 || mes > 12) return 'El mes va del 01 al 12.';
      const hoy = new Date();
      const vence = new Date(anio, mes, 0);
      return vence >= hoy ? null : 'Esa tarjeta está vencida.';
    },
    cvv: (v) => (/^\d{3,4}$/.test(v) ? null : 'Son los tres números del dorso de la tarjeta.'),
  };

  /** Algoritmo de Luhn: la misma verificación que hace el banco.
   *  Atrapa el error de tipeo antes de que la operación se rechace. */
  function luhn(numero: string): boolean {
    let suma = 0;
    let doble = false;
    for (let i = numero.length - 1; i >= 0; i--) {
      let d = Number(numero[i]);
      if (doble) { d *= 2; if (d > 9) d -= 9; }
      suma += d;
      doble = !doble;
    }
    return suma % 10 === 0;
  }

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
  const tarjeta = document.querySelector<HTMLInputElement>('#tarjeta');
  tarjeta?.addEventListener('input', () => {
    const n = tarjeta.value.replace(/\D/g, '').slice(0, 19);
    tarjeta.value = n.replace(/(\d{4})(?=\d)/g, '$1 ');
  });

  const vencimiento = document.querySelector<HTMLInputElement>('#vencimiento');
  vencimiento?.addEventListener('input', () => {
    const n = vencimiento.value.replace(/\D/g, '').slice(0, 4);
    vencimiento.value = n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
  });

  /* El código postal completa la provincia: un dato menos para
     escribir es un dato menos para equivocarse. */
  const cpCheckout = document.querySelector<HTMLInputElement>('#cp-checkout');
  const provincia = document.querySelector<HTMLInputElement>('#provincia');
  cpCheckout?.addEventListener('input', () => {
    const r = calcularEnvio(cpCheckout.value, 1);
    if (r.ok && provincia && !provincia.dataset.tocado) {
      provincia.value = r.zona!;
      limpiarError(provincia);
      guardarCP(cpCheckout.value);
      pintarResumen();
      pintarEnvio();
    }
  });
  provincia?.addEventListener('input', () => { provincia.dataset.tocado = 'true'; });
  if (cpCheckout) {
    cpCheckout.value = leerCP();
    if (cpCheckout.value) {
      const r = calcularEnvio(cpCheckout.value, 1);
      if (r.ok && provincia) provincia.value = r.zona!;
    }
  }

  /* ============================================================
     PASOS
     ============================================================ */
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
    /* Al cambiar de paso, el foco va al título: quien navega con
       teclado o lector de pantalla necesita saber que la pantalla
       cambió, no descubrirlo tabulando. */
    const titulo = formas[n - 1]?.querySelector<HTMLElement>('h1');
    titulo?.setAttribute('tabindex', '-1');
    titulo?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

      /* El acuerdo de términos, en el último paso. */
      const acepto = forma.querySelector<HTMLInputElement>('#acepto');
      if (acepto && !acepto.checked) {
        acepto.closest('.acuerdo')!.classList.add('acuerdo--error');
        if (!primerError) { acepto.focus(); return; }
      }

      /* Foco automático en el campo con problema: en un formulario
         largo, un error arriba de todo y el foco abajo es un error
         que nadie encuentra. */
      if (primerError) {
        primerError.focus();
        primerError.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }

      if (pasoActual < 3) { irAPaso(pasoActual + 1); return; }

      confirmar(forma);
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

  function descuentoTransferencia(): number {
    const elegido = metodoPagoRadios.find((r) => r.checked)?.value;
    return elegido === 'transferencia' ? Math.round(subtotal() * 0.1) : 0;
  }

  function ajusteSucursal(): number {
    const elegido = metodoEnvioRadios.find((r) => r.checked)?.value;
    return elegido === 'sucursal' ? -1200 : 0;
  }

  function pintarResumen() {
    const items = leer();
    const r = resumen(leerCP(), items);
    const envio = r.envioGratis ? 0 : Math.max(0, r.envio + ajusteSucursal());
    const descuento = descuentoTransferencia();
    const total = r.subtotal + envio - descuento;

    document.querySelector<HTMLElement>('[data-ck-items]')!.innerHTML = items.map((i) => `
      <article class="ck-item">
        <img class="ck-item__foto" src="https://images.unsplash.com/${i.imagen}?auto=format&fit=crop&w=150&q=72" alt="" width="52" height="65" loading="lazy" />
        <div class="ck-item__datos">
          <p class="ck-item__nombre">${i.nombre}</p>
          <p class="ck-item__meta">${i.variante ? i.variante + ' · ' : ''}${i.cantidad} u.</p>
        </div>
        <span class="ck-item__precio">${fPrecio(i.precio * i.cantidad)}</span>
      </article>`).join('');

    document.querySelector<HTMLElement>('[data-ck-subtotal]')!.textContent = fPrecio(r.subtotal);

    const rotulo = document.querySelector<HTMLElement>('[data-ck-envio-rotulo]')!;
    const valorEnvio = document.querySelector<HTMLElement>('[data-ck-envio]')!;
    if (r.envioGratis) {
      rotulo.textContent = 'Envío';
      valorEnvio.textContent = 'Gratis';
      valorEnvio.style.color = 'var(--verde)';
    } else if (r.envioEstimado) {
      rotulo.textContent = 'Envío (estimado)';
      valorEnvio.textContent = `desde ${fPrecio(envio)}`;
      valorEnvio.style.color = '';
    } else {
      rotulo.textContent = `Envío a ${r.zona}`;
      valorEnvio.textContent = fPrecio(envio);
      valorEnvio.style.color = '';
    }

    const filaDesc = document.querySelector<HTMLElement>('[data-ck-descuento-fila]')!;
    filaDesc.hidden = descuento === 0;
    document.querySelector<HTMLElement>('[data-ck-descuento]')!.textContent = `− ${fPrecio(descuento)}`;

    for (const nodo of document.querySelectorAll<HTMLElement>('[data-ck-total], [data-ck-total-2]')) {
      nodo.textContent = fPrecio(total);
    }

    /* Cuotas calculadas sobre el total real */
    const selectorCuotas = document.querySelector<HTMLSelectElement>('[data-cuotas]');
    if (selectorCuotas) {
      const previo = selectorCuotas.value;
      selectorCuotas.innerHTML = [1, 3, 6, 12]
        .map((c) => `<option value="${c}">${c === 1 ? `1 pago de ${fPrecio(total)}` : `${c} cuotas sin interés de ${cuota(total, c)}`}</option>`)
        .join('');
      if (previo) selectorCuotas.value = previo;
    }

    /* Fecha de entrega */
    const entrega = document.querySelector<HTMLElement>('[data-ck-entrega]')!;
    const extra = r.diasExtra ?? 0;
    const sucursal = metodoEnvioRadios.find((x) => x.checked)?.value === 'sucursal';
    entrega.textContent = leerCP()
      ? `Llega ${rangoDeEntrega(5 + extra - (sucursal ? 1 : 0), 10 + extra - (sucursal ? 1 : 0))}.`
      : 'La fecha exacta aparece al completar el código postal.';
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
    if (suc) suc.textContent = r.envioGratis ? 'Gratis' : fPrecio(Math.max(0, r.envio - 1200));

    const desc = document.querySelector<HTMLElement>('[data-descuento-transferencia]');
    if (desc) desc.textContent = `− ${fPrecio(Math.round(subtotal() * 0.1))}`;
  }

  for (const r of [...metodoPagoRadios, ...metodoEnvioRadios]) {
    r.addEventListener('change', () => { pintarResumen(); pintarEnvio(); });
  }

  /* Los campos de tarjeta se ocultan si se paga por transferencia:
     pedir una tarjeta a quien eligió transferencia es pedir un dato
     que no se va a usar. */
  for (const r of metodoPagoRadios) {
    r.addEventListener('change', () => {
      const campos = document.querySelector<HTMLElement>('[data-campos-tarjeta]');
      if (!campos) return;
      const esTarjeta = metodoPagoRadios.find((x) => x.checked)?.value === 'tarjeta';
      campos.hidden = !esTarjeta;
      for (const e of campos.querySelectorAll<HTMLInputElement>('input')) e.required = esTarjeta;
    });
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
  function confirmar(forma: HTMLFormElement) {
    const boton = forma.querySelector<HTMLButtonElement>('[data-pagar]')!;
    boton.dataset.cargando = 'true';
    boton.setAttribute('aria-busy', 'true');
    if (!boton.querySelector('.boton__girador')) {
      const girador = document.createElement('span');
      girador.className = 'boton__girador';
      girador.setAttribute('aria-hidden', 'true');
      boton.appendChild(girador);
    }

    /* El pedido se guarda para que la confirmación pueda mostrarlo.
       No hay servidor: es lo más parecido a un pedido real que se
       puede hacer sin inventar que existe uno. */
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
