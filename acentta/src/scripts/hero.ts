/**
 * acentta · carrusel del hero
 * ---------------------------------------------------------------
 * Avanza solo cada 6,5 s, se detiene mientras alguien lo mira o lo
 * usa, y no gira nunca si el sistema pide movimiento reducido.
 *
 * Las láminas que no están a la vista quedan fuera del recorrido de
 * teclado: si no se hace eso, tabular desde el hero manda el foco a
 * botones invisibles y la persona se pierde.
 */

const carrusel = document.querySelector<HTMLElement>('[data-carrusel]');

if (carrusel) {
  const pista = carrusel.querySelector<HTMLElement>('[data-hero-pista]')!;
  const laminas = [...carrusel.querySelectorAll<HTMLElement>('[data-lamina]')];
  const puntos = [...carrusel.querySelectorAll<HTMLButtonElement>('[data-hero-punto]')];
  const total = laminas.length;

  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ESPERA = 6500;

  let actual = 0;
  let reloj: number | undefined;

  function mostrar(indice: number) {
    actual = (indice + total) % total;
    pista.style.transform = `translate3d(-${actual * 100}%, 0, 0)`;

    laminas.forEach((l, i) => {
      const visible = i === actual;
      if (visible) l.removeAttribute('aria-hidden');
      else l.setAttribute('aria-hidden', 'true');

      /* Fuera del recorrido de teclado si no se ve. */
      for (const foco of l.querySelectorAll<HTMLElement>('a, button')) {
        foco.tabIndex = visible ? 0 : -1;
      }
    });

    puntos.forEach((p, i) => p.setAttribute('aria-selected', String(i === actual)));
  }

  function arrancar() {
    if (sinMovimiento) return;
    detener();
    reloj = window.setInterval(() => mostrar(actual + 1), ESPERA);
  }
  function detener() {
    if (reloj !== undefined) window.clearInterval(reloj);
    reloj = undefined;
  }

  /* Cada interacción reinicia el reloj: si alguien acaba de elegir
     una lámina, no tiene sentido cambiársela medio segundo después. */
  function irA(indice: number) {
    mostrar(indice);
    arrancar();
  }

  carrusel.querySelector('[data-hero-antes]')?.addEventListener('click', () => irA(actual - 1));
  carrusel.querySelector('[data-hero-despues]')?.addEventListener('click', () => irA(actual + 1));
  puntos.forEach((p, i) => p.addEventListener('click', () => irA(i)));

  carrusel.addEventListener('mouseenter', detener);
  carrusel.addEventListener('mouseleave', arrancar);
  carrusel.addEventListener('focusin', detener);
  carrusel.addEventListener('focusout', (e) => {
    if (!carrusel.contains(e.relatedTarget as Node)) arrancar();
  });

  /* Flechas del teclado cuando el foco está en los puntos. */
  carrusel.addEventListener('keydown', (e) => {
    if (!(e.target as HTMLElement).closest('[data-hero-punto]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); irA(actual + 1); puntos[actual]?.focus(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); irA(actual - 1); puntos[actual]?.focus(); }
  });

  /* Deslizar con el dedo. */
  let inicioX = 0;
  carrusel.addEventListener('touchstart', (e) => { inicioX = e.touches[0]!.clientX; detener(); }, { passive: true });
  carrusel.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0]!.clientX - inicioX;
    if (Math.abs(dx) > 45) irA(actual + (dx < 0 ? 1 : -1));
    else arrancar();
  }, { passive: true });

  /* Con la pestaña en segundo plano no tiene sentido seguir girando. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) detener();
    else arrancar();
  });

  mostrar(0);
  arrancar();
}
