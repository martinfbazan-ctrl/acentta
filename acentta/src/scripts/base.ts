/* acentta · comportamientos base
   Vanilla y sin dependencias: en esta etapa no hay nada que justifique
   cargar una librería. Astro lo empaqueta y lo versiona solo. */

/* ---- Selector de cantidad ---- */
document.querySelectorAll<HTMLElement>('[data-cantidad]').forEach((caja) => {
  const entrada = caja.querySelector<HTMLInputElement>('.cantidad__valor');
  const menos = caja.querySelector<HTMLButtonElement>('[data-accion="restar"]');
  const mas = caja.querySelector<HTMLButtonElement>('[data-accion="sumar"]');
  if (!entrada || !menos || !mas) return;

  const min = Number(caja.dataset.min ?? 1);
  const max = Number(caja.dataset.max ?? 99);

  const sincronizar = () => {
    const v = Math.min(max, Math.max(min, Number(entrada.value) || min));
    entrada.value = String(v);
    menos.disabled = v <= min;
    mas.disabled = v >= max;
  };

  menos.addEventListener('click', () => { entrada.value = String(Number(entrada.value) - 1); sincronizar(); });
  mas.addEventListener('click', () => { entrada.value = String(Number(entrada.value) + 1); sincronizar(); });
  entrada.addEventListener('change', sincronizar);
  sincronizar();
});

/* ---- Barrido del banner: una sola vez, al entrar en viewport ---- */
const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!sinMovimiento && 'IntersectionObserver' in window) {
  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('esta-visible');
          observador.unobserve(e.target);
        }
      });
    },
    { threshold: 0.35 }
  );
  document.querySelectorAll('[data-banner-oferta]').forEach((b) => observador.observe(b));
}

/* ---- Demostración del estado "cargando" (sólo en /sistema) ---- */
document.querySelectorAll<HTMLElement>('[data-demo-cargando]').forEach((boton) => {
  boton.addEventListener('click', () => {
    boton.dataset.cargando = 'true';
    boton.setAttribute('aria-busy', 'true');
    window.setTimeout(() => {
      delete boton.dataset.cargando;
      boton.removeAttribute('aria-busy');
    }, 1600);
  });
});
