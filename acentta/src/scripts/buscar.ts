/**
 * acentta · página de resultados
 * ---------------------------------------------------------------
 * Las 36 tarjetas ya están en el HTML. Acá sólo se decide cuáles se
 * ven y en qué orden.
 *
 * Se esconde con el atributo `hidden` y se ordena con `order` de CSS
 * en vez de sacar y volver a insertar nodos. Mover elementos del DOM
 * obliga al navegador a recalcular todo el listado y, peor, hace que
 * las imágenes se vuelvan a decodificar: la grilla parpadea en cada
 * tecla. Con `hidden` y `order` no se toca ni un nodo.
 *
 * La URL se mantiene sincronizada con lo escrito, así que un
 * resultado se puede compartir o guardar en favoritos. Va con
 * replaceState y no con pushState: si cada letra dejara una entrada
 * en el historial, el botón "atrás" tardaría veinte toques en salir.
 */

import { buscar, type Indice } from '@lib/buscador';

const grillaOpcional = document.querySelector<HTMLElement>('[data-busqueda-grilla]');
const datos = document.getElementById('indice-buscador');

if (grillaOpcional && datos) {
  /* Se reasigna a una constante ya estrechada: dentro de las funciones
     de abajo, TypeScript no puede saber que el `if` de arriba sigue
     valiendo cuando se ejecuten. */
  const grilla = grillaOpcional;

  const campo = document.querySelector<HTMLInputElement>('[data-busqueda-campo]')!;
  const forma = document.querySelector<HTMLFormElement>('[data-busqueda-forma]')!;
  const limpiar = document.querySelector<HTMLButtonElement>('[data-busqueda-limpiar]')!;
  const titulo = document.querySelector<HTMLElement>('[data-busqueda-titulo]')!;
  const cuenta = document.querySelector<HTMLElement>('[data-busqueda-cuenta]')!;
  const aviso = document.querySelector<HTMLElement>('[data-busqueda-aviso]')!;
  const bloqueVacio = document.querySelector<HTMLElement>('[data-busqueda-vacio]')!;
  const textoVacio = document.querySelector<HTMLElement>('[data-busqueda-vacio-texto]')!;

  const indice: Indice = JSON.parse(datos.textContent || '{"entradas":[],"sinonimos":{}}');
  const celdas = new Map<string, HTMLElement>();
  for (const c of grilla.querySelectorAll<HTMLElement>('[data-slug]')) {
    celdas.set(c.dataset.slug!, c);
  }
  const TOTAL = celdas.size;

  function aplicar(consulta: string, empujarUrl = true) {
    const q = consulta.trim();

    if (!q) {
      for (const c of celdas.values()) {
        c.hidden = false;
        c.style.order = '';
      }
      grilla.hidden = false;
      bloqueVacio.hidden = true;
      titulo.textContent = 'Buscar en el catálogo';
      cuenta.textContent = `${TOTAL} productos en dos rubros. Escribe arriba para filtrar por nombre, categoría o característica.`;
      limpiar.hidden = true;
      aviso.textContent = '';
      if (empujarUrl) urlSin();
      return;
    }

    const encontrados = buscar(indice, q, TOTAL);
    const posicion = new Map(encontrados.map((e, i) => [e.slug, i]));

    for (const [slug, celda] of celdas) {
      const i = posicion.get(slug);
      celda.hidden = i === undefined;
      celda.style.order = i === undefined ? '' : String(i);
    }

    const n = encontrados.length;
    grilla.hidden = n === 0;
    bloqueVacio.hidden = n > 0;
    limpiar.hidden = false;

    titulo.textContent = `Resultados para “${q}”`;
    cuenta.textContent =
      n === 0
        ? 'Ningún producto coincide.'
        : `${n} ${n === 1 ? 'producto' : 'productos'} de ${TOTAL}.`;
    textoVacio.textContent = `Ningún producto coincide con “${q}”. Puede ser una palabra demasiado específica: probar con el tipo de producto suele funcionar mejor que con la marca o la medida.`;

    /* El aviso se escribe una sola vez y con el número: un lector de
       pantalla no ve que la grilla cambió, y "resultados actualizados"
       no dice si hay uno o cuarenta. */
    aviso.textContent =
      n === 0 ? `Sin resultados para ${q}` : `${n} ${n === 1 ? 'resultado' : 'resultados'} para ${q}`;

    if (empujarUrl) urlCon(q);
  }

  /* history falla con una excepción sobre file://, que es como se abre
     la vista previa local. Sin el try, la búsqueda quedaría a mitad. */
  function urlCon(q: string) {
    try {
      history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
    } catch {
      /* vista previa local: la URL no se puede tocar y no importa */
    }
  }
  function urlSin() {
    try {
      history.replaceState(null, '', location.pathname);
    } catch {
      /* ídem */
    }
  }

  campo.addEventListener('input', () => aplicar(campo.value));
  limpiar.addEventListener('click', () => {
    campo.value = '';
    aplicar('');
    campo.focus();
  });

  /* El formulario ya no navega: la página es la que responde. */
  forma.addEventListener('submit', (ev) => {
    ev.preventDefault();
    aplicar(campo.value);
    campo.blur(); // en el teléfono, cierra el teclado y deja ver el resultado
  });

  /* Consulta inicial: puede venir de la barra fija de otra página, de
     un enlace compartido o de un favorito. */
  const inicial = new URLSearchParams(location.search).get('q') ?? '';
  if (inicial) {
    campo.value = inicial;
    aplicar(inicial, false);
  }
  campo.focus();
}

export {};
