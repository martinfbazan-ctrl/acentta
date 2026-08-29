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
import { foto, srcset } from '@lib/imagenes';
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
  const zoomCuenta = document.querySelector<HTMLElement>('[data-zoom-cuenta]');

  /* Cuál se está viendo. Una sola variable para la galería y para el
     zoom: si fueran dos, cerrar el zoom en la foto 3 devolvería a la
     página mostrando la 1, y esa desincronización es de las que nadie
     reporta como error pero deja la sensación de que algo falla. */
  let actual = 0;

  const mostrar = (indice: number) => {
    const tira = tiras[indice];
    if (!tira) return;
    actual = indice;
    const src = tira.dataset.src!;

    /* [ERROR CORREGIDO] Acá había una segunda copia de cómo se arma
       la dirección de una foto, escrita a mano y clavada al dominio
       del banco de fotos: pegaba el identificador de la foto detrás
       de la dirección de Unsplash y le agregaba los parámetros de
       recorte.

       Mientras todas las fotos eran de banco, funcionaba. Cuando se
       sumó soporte para fotos propias se actualizó el componente que
       pinta la galería, pero no este guion — y nadie se dio cuenta
       porque no había ningún producto con fotos propias todavía.

       El resultado con una foto propia era el dominio del banco con
       la ruta del archivo propio pegada detrás, una dirección que
       no existe: la miniatura se veía —la pinta el componente, que sí
       estaba bien— y al hacerle clic la foto grande desaparecía. Y
       volver a la primera tampoco la recuperaba, porque pasaba por
       este mismo código.

       Ahora usa las mismas funciones que el componente. Una sola
       forma de armar una dirección de foto en todo el sitio: cuando
       cambie, cambia en un lugar.

       Se reemplazan src y srcset a la vez: si queda el srcset viejo,
       el navegador puede seguir sirviendo la foto anterior. */
    principal.src = foto(src, 1000);

    /* Una foto propia no tiene srcset: se sirve tal cual, porque no
       hay servicio de recorte detrás. Ahí el atributo hay que
       BORRARLO, no asignarle nada — `img.srcset = undefined` deja la
       cadena literal «undefined» y el navegador sale a buscar un
       archivo con ese nombre. Es el mismo error de una línea que
       acabamos de arreglar, disfrazado. */
    const conjunto = srcset(src);
    if (conjunto) principal.srcset = conjunto;
    else principal.removeAttribute('srcset');

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
    /**
     * Pinta el zoom con la foto que corresponda.
     *
     * Mueve también la galería de atrás con `mostrar()`. Es a
     * propósito: al cerrar, la página queda en la foto que se estaba
     * mirando, no en la que se abrió. Lo contrario es un salto que
     * hace dudar de si el clic hizo algo.
     *
     * Se piden 1600 px y no la que está en pantalla: el zoom existe
     * justamente para ver detalle, y reutilizar la versión chica de
     * la galería sería ampliar una foto ya reducida.
     */
    const pintarZoom = (indice: number) => {
      const tira = tiras[indice];
      if (!tira) return;
      mostrar(indice);

      const src = tira.dataset.src!;
      zoomFoto.src = foto(src, 1600);
      const conjunto = srcset(src);
      if (conjunto) zoomFoto.srcset = conjunto;
      else zoomFoto.removeAttribute('srcset');
      zoomFoto.alt = tira.dataset.alt ?? '';

      if (zoomCuenta) zoomCuenta.textContent = `${indice + 1} de ${tiras.length}`;
    };

    /* El resto se calcula con módulo: de la última se pasa a la
       primera. Un carrusel que se planta en la punta obliga a
       retroceder una por una para volver, y nadie lo hace. */
    const correr = (paso: number) => pintarZoom((actual + paso + tiras.length) % tiras.length);

    document.querySelector('[data-abrir-zoom]')?.addEventListener('click', () => {
      pintarZoom(actual);
      zoom.showModal();
    });
    document.querySelector('[data-cerrar-zoom]')?.addEventListener('click', () => zoom.close());
    document.querySelector('[data-zoom-antes]')?.addEventListener('click', () => correr(-1));
    document.querySelector('[data-zoom-despues]')?.addEventListener('click', () => correr(1));

    /* Las flechas del teclado, que es como se recorre una galería
       abierta a pantalla completa. Escape ya lo cierra solo: es
       comportamiento propio de <dialog> y no hay que programarlo. */
    zoom.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      correr(e.key === 'ArrowRight' ? 1 : -1);
    });

    /* Y el gesto de arrastrar, que en un teléfono es lo primero que
       intenta cualquiera frente a una foto abierta. Se exige un
       desplazamiento horizontal claro y mayor que el vertical: sin
       eso, un intento de desplazar la página cambia de foto sin
       querer. */
    let inicioX = 0;
    let inicioY = 0;
    zoom.addEventListener('touchstart', (e) => {
      inicioX = e.changedTouches[0]!.clientX;
      inicioY = e.changedTouches[0]!.clientY;
    }, { passive: true });
    zoom.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0]!.clientX - inicioX;
      const dy = e.changedTouches[0]!.clientY - inicioY;
      if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
      correr(dx < 0 ? 1 : -1);
    }, { passive: true });

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
