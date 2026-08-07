/**
 * acentta · comportamiento de la ficha de producto
 * ---------------------------------------------------------------
 * Galería, variantes, calculadora de envío y barra fija de móvil.
 * Todo vanilla: nada de lo que hace esta página justifica cargar
 * una librería, y el peso de la ficha es lo que decide si el
 * comprador la ve o se va.
 */

import { calcularEnvio } from '@lib/envio';
import { precio as fPrecio, rangoDeEntrega } from '@lib/formato';
import { UMBRAL_ENVIO_GRATIS } from '@tipos/catalogo';

/* ============================================================
   GALERÍA
   ============================================================ */
const galeria = document.querySelector<HTMLElement>('[data-galeria]');
if (galeria) {
  const principal = galeria.querySelector<HTMLImageElement>('[data-galeria-principal]')!;
  const tiras = [...galeria.querySelectorAll<HTMLButtonElement>('.galeria__tira')];
  const zoom = document.querySelector<HTMLDialogElement>('[data-zoom]');
  const zoomFoto = document.querySelector<HTMLImageElement>('[data-zoom-foto]');

  const mostrar = (indice: number) => {
    const tira = tiras[indice];
    if (!tira) return;
    const src = tira.dataset.src!;
    /* Se reemplaza src y srcset a la vez: si queda el srcset viejo,
       el navegador puede seguir sirviendo la foto anterior. */
    principal.src = `https://images.unsplash.com/${src}?auto=format&fit=crop&w=1000&q=72`;
    principal.srcset = [400, 600, 800, 1200, 1600]
      .map((a) => `https://images.unsplash.com/${src}?auto=format&fit=crop&w=${a}&q=72 ${a}w`)
      .join(', ');
    principal.alt = tira.dataset.alt ?? '';
    for (const t of tiras) t.removeAttribute('aria-current');
    tira.setAttribute('aria-current', 'true');
  };

  tiras.forEach((t, i) => {
    t.addEventListener('click', () => mostrar(i));
    /* Flechas para recorrer la galería sin mouse. */
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const siguiente = e.key === 'ArrowRight'
        ? (i + 1) % tiras.length
        : (i - 1 + tiras.length) % tiras.length;
      tiras[siguiente]!.focus();
      mostrar(siguiente);
    });
  });

  if (zoom && zoomFoto) {
    document.querySelector('[data-abrir-zoom]')?.addEventListener('click', () => {
      zoomFoto.src = principal.currentSrc || principal.src;
      zoomFoto.alt = principal.alt;
      zoom.showModal();
    });
    document.querySelector('[data-cerrar-zoom]')?.addEventListener('click', () => zoom.close());
    /* Clic en el fondo cierra: el diálogo ocupa sólo la foto, así que
       cualquier clic fuera de ella cae en el propio <dialog>. */
    zoom.addEventListener('click', (e) => { if (e.target === zoom) zoom.close(); });
  }

  /* ---- Variantes ---- */
  const variantes = document.querySelector<HTMLElement>('[data-variantes]');
  if (variantes) {
    const avisoStock = document.querySelector<HTMLElement>('[data-stock-aviso]');
    const cantidad = document.querySelector<HTMLElement>('[data-cantidad]');

    variantes.addEventListener('change', (e) => {
      const radio = e.target as HTMLInputElement;
      if (!radio.matches('input[type="radio"]')) return;

      const tipo = radio.dataset.tipo!;
      const etiqueta = variantes.querySelector<HTMLElement>(`[data-elegida="${tipo}"]`);
      if (etiqueta) etiqueta.textContent = radio.value;

      /* La galería sigue a la variante de color, sin recargar ni saltar. */
      if (tipo === 'color') mostrar(Number(radio.dataset.imagen ?? 0));

      /* El tope de cantidad es el stock real de la variante elegida. */
      const stock = Number(radio.dataset.stock ?? 0);
      if (cantidad) {
        cantidad.dataset.max = String(Math.max(1, stock));
        const entrada = cantidad.querySelector<HTMLInputElement>('.cantidad__valor');
        if (entrada && Number(entrada.value) > stock) entrada.value = String(Math.max(1, stock));
      }
      if (avisoStock && stock > 0) {
        avisoStock.innerHTML = stock <= 5
          ? `<span class="es-poco">Quedan ${stock} unidades de este color</span>`
          : '<span class="es-hay">Disponible para envío inmediato</span>';
      }
    });
  }
}

/* ============================================================
   CALCULADORA DE ENVÍO
   ============================================================ */
const calc = document.querySelector<HTMLElement>('[data-calculadora]');
if (calc) {
  const forma = calc.querySelector<HTMLFormElement>('[data-calc-forma]')!;
  const entrada = forma.querySelector<HTMLInputElement>('#cp')!;
  const campo = calc.querySelector<HTMLElement>('[data-campo-cp]')!;
  const salida = calc.querySelector<HTMLElement>('[data-calc-salida]')!;
  const peso = Number(calc.dataset.peso ?? 1);
  const plazoMin = Number(calc.dataset.plazoMin ?? 5);
  const plazoMax = Number(calc.dataset.plazoMax ?? 10);

  forma.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = calcularEnvio(entrada.value, peso);

    if (!r.ok) {
      campo.dataset.estado = 'error';
      salida.hidden = false;
      salida.dataset.error = 'true';
      salida.textContent = r.error!;
      entrada.focus();
      return;
    }

    campo.dataset.estado = 'normal';
    delete salida.dataset.error;
    salida.hidden = false;

    const gratis = r.costo === 0;
    const fecha = rangoDeEntrega(plazoMin + r.diasExtra!, plazoMax + r.diasExtra!);

    salida.innerHTML =
      `<b>${r.zona}</b> · ${gratis ? 'Envío gratis' : `Envío ${fPrecio(r.costo!)}`}<br />` +
      `Llega ${fecha}.` +
      (gratis
        ? ''
        : `<br /><span style="color:var(--gris-texto)">Sumando ${fPrecio(UMBRAL_ENVIO_GRATIS)} en el carrito, el envío pasa a ser gratis.</span>`);
  });

  /* Al corregir, el error se va solo: dejarlo puesto mientras la
     persona escribe es castigarla por estar arreglándolo. */
  entrada.addEventListener('input', () => {
    if (campo.dataset.estado === 'error') campo.dataset.estado = 'normal';
  });
}

/* ============================================================
   BARRA FIJA DE MÓVIL
   Aparece recién cuando el botón principal se fue de pantalla.
   Mostrarla desde el arranque tapa contenido sin motivo.
   ============================================================ */
const barra = document.querySelector<HTMLElement>('[data-barra-movil]');
const acciones = document.querySelector<HTMLElement>('.ficha__acciones');
if (barra && acciones && 'IntersectionObserver' in window) {
  barra.hidden = false;
  const observador = new IntersectionObserver(
    ([entrada]) => {
      if (entrada!.isIntersecting) delete barra.dataset.visible;
      else barra.dataset.visible = 'true';
    },
    { threshold: 0 }
  );
  observador.observe(acciones);
}
