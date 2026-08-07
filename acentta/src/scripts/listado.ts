/**
 * acentta · filtros y orden del listado
 * ---------------------------------------------------------------
 * Trabaja sobre las tarjetas que ya están en el HTML. No hay red de
 * por medio, así que no hay estado de carga que fingir.
 *
 * El estado vive en la URL. Eso hace que un listado filtrado se pueda
 * compartir, que el botón Atrás funcione, y que recargar no borre lo
 * que la persona eligió — tres cosas que se dan por sentadas y que
 * casi ningún filtro del lado del cliente respeta.
 */

const raiz = document.querySelector<HTMLElement>('[data-listado]');

if (raiz) {
  const grilla = raiz.querySelector<HTMLElement>('[data-grilla]')!;
  const tarjetas = [...grilla.querySelectorAll<HTMLElement>('.ficha-prod')];
  const vacio = raiz.querySelector<HTMLElement>('[data-vacio]')!;
  const cuenta = raiz.querySelector<HTMLElement>('[data-cuenta]')!;
  const cuentaPalabra = raiz.querySelector<HTMLElement>('[data-cuenta-palabra]')!;
  const cuentaBoton = document.querySelector<HTMLElement>('[data-cuenta-boton]');
  const globo = raiz.querySelector<HTMLElement>('[data-cuenta-filtros]')!;
  const chips = raiz.querySelector<HTMLElement>('[data-chips]')!;
  const chipsLista = raiz.querySelector<HTMLElement>('[data-chips-lista]')!;
  const selectorOrden = raiz.querySelector<HTMLSelectElement>('[data-orden]')!;
  const panel = document.querySelector<HTMLElement>('#filtros')!;
  const velo = document.querySelector<HTMLElement>('[data-velo]')!;

  const casillas = [...panel.querySelectorAll<HTMLInputElement>('[data-filtro]')];

  /* Orden original, para poder volver a "más relevantes". */
  const ordenOriginal = new Map(tarjetas.map((t, i) => [t, i]));

  type Estado = Record<string, string[]>;

  const leerEstado = (): Estado => {
    const estado: Estado = {};
    for (const c of casillas) {
      if (!c.checked) continue;
      const clave = c.dataset.filtro!;
      (estado[clave] ??= []).push(c.value);
    }
    return estado;
  };

  const cumple = (t: HTMLElement, estado: Estado): boolean => {
    if (estado.disponible && t.dataset.disponible !== 'true') return false;
    if (estado.oferta && t.dataset.oferta !== 'true') return false;

    if (estado.categoria && !estado.categoria.includes(t.dataset.categoria!)) return false;

    if (estado.color) {
      const propios = (t.dataset.colores ?? '').split('|');
      if (!estado.color.some((c) => propios.includes(c))) return false;
    }

    if (estado.precio) {
      const p = Number(t.dataset.precio);
      const entra = estado.precio.some((tramo) => {
        const [min, max] = tramo.split('-');
        return p >= Number(min) && p < (max === 'Infinity' ? Infinity : Number(max));
      });
      if (!entra) return false;
    }

    return true;
  };

  const ordenar = (visibles: HTMLElement[]): HTMLElement[] => {
    const modo = selectorOrden.value;
    const n = (t: HTMLElement, k: string) => Number(t.dataset[k] ?? 0);
    const copia = [...visibles];
    switch (modo) {
      case 'precio-asc':  return copia.sort((a, b) => n(a, 'precio') - n(b, 'precio'));
      case 'precio-desc': return copia.sort((a, b) => n(b, 'precio') - n(a, 'precio'));
      case 'vendidas':    return copia.sort((a, b) => n(b, 'vendidas') - n(a, 'vendidas'));
      case 'rating':      return copia.sort((a, b) => n(b, 'rating') - n(a, 'rating'));
      case 'descuento':   return copia.sort((a, b) => n(b, 'descuento') - n(a, 'descuento'));
      default:            return copia.sort((a, b) => ordenOriginal.get(a)! - ordenOriginal.get(b)!);
    }
  };

  const etiquetaDe = (c: HTMLInputElement): string => {
    const texto = c.closest('label')?.querySelector('.opcion__texto, .color__nombre');
    return texto?.textContent?.trim() ?? c.value;
  };

  const pintarChips = () => {
    const activas = casillas.filter((c) => c.checked);
    chipsLista.innerHTML = '';
    for (const c of activas) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip chip--activo';
      chip.innerHTML =
        `${etiquetaDe(c)}<span class="chip__quitar" aria-hidden="true">` +
        `<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>`;
      chip.setAttribute('aria-label', `Quitar filtro ${etiquetaDe(c)}`);
      chip.addEventListener('click', () => {
        c.checked = false;
        aplicar();
      });
      chipsLista.appendChild(chip);
    }
    chips.hidden = activas.length === 0;
    globo.hidden = activas.length === 0;
    globo.textContent = String(activas.length);
  };

  const guardarEnURL = (estado: Estado) => {
    const params = new URLSearchParams();
    for (const [clave, valores] of Object.entries(estado)) {
      if (valores.length) params.set(clave, valores.join(','));
    }
    if (selectorOrden.value !== 'relevancia') params.set('orden', selectorOrden.value);
    const url = params.toString() ? `?${params}` : location.pathname;
    /* La History API rechaza escribir una query cuando la página se
       abrió como archivo local, y algunos contextos embebidos también
       la bloquean. Que no se pueda guardar el estado en la URL no
       puede romper el filtro: es una mejora, no un requisito. */
    try {
      history.replaceState(null, '', url);
    } catch {
      /* sin URL compartible en este contexto */
    }
  };

  const aplicar = () => {
    const estado = leerEstado();

    grilla.dataset.filtrando = 'true';

    const visibles: HTMLElement[] = [];
    for (const t of tarjetas) {
      const pasa = cumple(t, estado);
      t.hidden = !pasa;
      if (pasa) visibles.push(t);
    }

    for (const t of ordenar(visibles)) grilla.appendChild(t);

    cuenta.textContent = String(visibles.length);
    cuentaPalabra.textContent = visibles.length === 1 ? 'producto' : 'productos';
    if (cuentaBoton) cuentaBoton.textContent = String(visibles.length);

    vacio.hidden = visibles.length > 0;
    grilla.hidden = visibles.length === 0;

    pintarChips();
    guardarEnURL(estado);

    window.setTimeout(() => { delete grilla.dataset.filtrando; }, 120);
  };

  const limpiar = () => {
    for (const c of casillas) c.checked = false;
    selectorOrden.value = 'relevancia';
    aplicar();
  };

  /* ---- Panel en móvil ---- */
  const abrir = () => {
    panel.dataset.abierto = 'true';
    velo.hidden = false;
    document.body.style.overflow = 'hidden';
    panel.querySelector<HTMLElement>('[data-cerrar-filtros]')?.focus();
  };
  const cerrar = () => {
    delete panel.dataset.abierto;
    velo.hidden = true;
    document.body.style.overflow = '';
    document.querySelector<HTMLElement>('[data-abrir-filtros]')?.focus();
  };

  document.querySelector('[data-abrir-filtros]')?.addEventListener('click', abrir);
  for (const b of document.querySelectorAll('[data-cerrar-filtros]')) b.addEventListener('click', cerrar);
  velo.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.dataset.abierto) cerrar();
  });

  /* ---- Enganches ---- */
  for (const c of casillas) c.addEventListener('change', aplicar);
  selectorOrden.addEventListener('change', aplicar);
  for (const b of document.querySelectorAll('[data-limpiar-filtros]')) b.addEventListener('click', limpiar);

  /* ---- Restaurar desde la URL al entrar ---- */
  const params = new URLSearchParams(location.search);
  for (const c of casillas) {
    const valores = params.get(c.dataset.filtro!)?.split(',') ?? [];
    if (valores.includes(c.value)) c.checked = true;
  }
  const ordenGuardado = params.get('orden');
  if (ordenGuardado) selectorOrden.value = ordenGuardado;
  if ([...params.keys()].length) aplicar();
  else pintarChips();
}
