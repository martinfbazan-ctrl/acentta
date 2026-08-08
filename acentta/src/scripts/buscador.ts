/**
 * acentta · sugerencias de la barra de búsqueda
 * ---------------------------------------------------------------
 * Combobox según el patrón de la APG. Lo único no obvio:
 *
 * · El foco se queda SIEMPRE en el campo. Lo que se mueve con las
 *   flechas es aria-activedescendant, no el foco real. Si el foco
 *   saltara a la sugerencia, seguir escribiendo para afinar la
 *   búsqueda obligaría a volver al campo con Tab.
 *
 * · La lista se filtra en cada tecla, sin retardo. El retardo existe
 *   para no saturar una red; acá no hay red, así que esperar sería
 *   agregar lentitud a cambio de nada.
 *
 * · El panel se cierra al hacer clic afuera y con Escape, pero
 *   Escape no borra lo escrito la primera vez: cierra. Recién si ya
 *   está cerrado, borra. Borrar de un saque lo que alguien tardó en
 *   escribir es de las cosas que más irritan de un buscador.
 */

import { buscar, enlaceProducto, type Indice, type EntradaIndice } from '@lib/buscador';
import { precio as fPrecio } from '@lib/formato';

interface Entrada extends EntradaIndice {
  foto: string;
}

const caja = document.querySelector<HTMLElement>('[data-buscador]');
const datos = document.getElementById('indice-buscador');

if (caja && datos) {
  const campo = caja.querySelector<HTMLInputElement>('[data-buscador-campo]')!;
  const panel = caja.querySelector<HTMLElement>('[data-buscador-panel]')!;
  const lista = caja.querySelector<HTMLUListElement>('[data-buscador-lista]')!;
  const verTodo = caja.querySelector<HTMLAnchorElement>('[data-buscador-todo]')!;
  const vacio = caja.querySelector<HTMLElement>('[data-buscador-vacio]')!;
  const limpiar = caja.querySelector<HTMLButtonElement>('[data-buscador-limpiar]')!;
  const aviso = caja.querySelector<HTMLElement>('[data-buscador-aviso]')!;
  const forma = caja.querySelector<HTMLFormElement>('[data-buscador-forma]')!;

  const indice: Indice = JSON.parse(datos.textContent || '{"entradas":[],"sinonimos":{}}');
  const MAXIMO = 6;

  let resultados: Entrada[] = [];
  let activo = -1;

  /** La ruta de /buscar cambia entre el sitio publicado y la copia local. */
  const raiz = (window as unknown as { __raiz?: string }).__raiz;
  const rutaBuscar = raiz ? `${raiz}buscar/index.html` : '/buscar';
  forma.setAttribute('action', rutaBuscar);

  const urlBusqueda = (q: string) => `${rutaBuscar}?q=${encodeURIComponent(q)}`;

  /** Resalta en el nombre lo que la persona escribió, sin romper el HTML. */
  function resaltar(nombre: string, consulta: string): string {
    const escapado = nombre.replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
    );
    const palabras = consulta
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (palabras.length === 0) return escapado;
    /* La "i" no alcanza para el español: "lampara" tiene que iluminar
       "Lámpara". Se compara sin tildes con la marca "d" de Unicode. */
    return escapado.replace(
      new RegExp(`(${palabras.join('|')})`, 'gid'),
      '<b>$1</b>'
    );
  }

  function pintar(consulta: string) {
    resultados = buscar(indice, consulta, MAXIMO + 1) as Entrada[];
    const mostrados = resultados.slice(0, MAXIMO);
    activo = -1;

    lista.innerHTML = mostrados
      .map(
        (e, i) => `
        <li class="sugerencias__item" role="option" id="sug-${i}" aria-selected="false"
            data-indice="${i}" data-slug="${e.slug}">
          <img class="sugerencias__foto" src="${e.foto}" alt="" width="44" height="44" loading="lazy" decoding="async">
          <span class="sugerencias__datos">
            <span class="sugerencias__nombre">${resaltar(e.nombre, consulta)}</span>
            <span class="sugerencias__rotulo">${e.rotulo}</span>
          </span>
          ${
            e.agotado
              ? '<span class="sugerencias__agotado">Agotado</span>'
              : `<span class="sugerencias__precio tabular">${fPrecio(e.precio)}</span>`
          }
        </li>`
      )
      .join('');

    const hay = mostrados.length > 0;
    vacio.hidden = hay;
    if (!hay) {
      vacio.textContent = `No hay productos que coincidan con “${consulta}”. Prueba con una palabra más general.`;
    }

    /* El "ver todo" sólo aparece si de verdad hay más de lo que se
       muestra. Un enlace que promete más y lleva a lo mismo enseña a
       no confiar en los enlaces. */
    const hayMas = resultados.length > MAXIMO;
    verTodo.hidden = !hayMas;
    if (hayMas) {
      verTodo.textContent = `Ver todos los resultados de “${consulta}”`;
      verTodo.href = urlBusqueda(consulta);
    }

    abrir();
    aviso.textContent = hay
      ? `${mostrados.length} ${mostrados.length === 1 ? 'sugerencia' : 'sugerencias'}`
      : 'Sin resultados';
  }

  function abrir() {
    panel.hidden = false;
    campo.setAttribute('aria-expanded', 'true');
  }

  function cerrar() {
    panel.hidden = true;
    campo.setAttribute('aria-expanded', 'false');
    campo.removeAttribute('aria-activedescendant');
    activo = -1;
  }

  function marcar(i: number) {
    const items = [...lista.querySelectorAll<HTMLLIElement>('.sugerencias__item')];
    if (items.length === 0) return;
    /* Da la vuelta en los dos extremos: bajar desde el último lleva
       al primero. Con listas de seis, chocar contra el borde es un
       error de la interfaz, no del usuario. */
    activo = (i + items.length) % items.length;
    items.forEach((li, n) => li.setAttribute('aria-selected', String(n === activo)));
    campo.setAttribute('aria-activedescendant', `sug-${activo}`);
    items[activo]!.scrollIntoView?.({ block: 'nearest' });
  }

  function ir(i: number) {
    const e = resultados[i];
    if (e) location.href = enlaceProducto(e.slug);
  }

  /* ---- Escritura ---- */
  campo.addEventListener('input', () => {
    const q = campo.value.trim();
    limpiar.hidden = q.length === 0;
    if (q.length < 2) {
      cerrar();
      return;
    }
    pintar(q);
  });

  campo.addEventListener('focus', () => {
    if (campo.value.trim().length >= 2) pintar(campo.value.trim());
  });

  /* ---- Teclado ---- */
  campo.addEventListener('keydown', (ev) => {
    const abierto = !panel.hidden;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (!abierto && campo.value.trim().length >= 2) pintar(campo.value.trim());
      else marcar(activo + 1);
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (abierto) marcar(activo - 1);
      return;
    }
    if (ev.key === 'Enter') {
      /* Con una sugerencia marcada, Enter va a esa ficha. Sin nada
         marcado, Enter hace lo que promete el formulario: la página
         de resultados. */
      if (abierto && activo >= 0) {
        ev.preventDefault();
        ir(activo);
      }
      return;
    }
    if (ev.key === 'Escape') {
      if (abierto) {
        ev.preventDefault();
        cerrar();
      } else if (campo.value) {
        campo.value = '';
        limpiar.hidden = true;
      }
      return;
    }
    if (ev.key === 'Tab') cerrar();
  });

  /* ---- Mouse ---- */
  lista.addEventListener('mousemove', (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLLIElement>('.sugerencias__item');
    if (li) marcar(Number(li.dataset.indice));
  });

  lista.addEventListener('click', (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLLIElement>('.sugerencias__item');
    if (li) ir(Number(li.dataset.indice));
  });

  limpiar.addEventListener('click', () => {
    campo.value = '';
    limpiar.hidden = true;
    cerrar();
    campo.focus();
  });

  document.addEventListener('click', (ev) => {
    if (!caja.contains(ev.target as Node)) cerrar();
  });

  /* En la vista previa local el formulario no puede hacer GET a un
     archivo: se navega a mano con la consulta en la URL. */
  forma.addEventListener('submit', (ev) => {
    if (!raiz) return;
    ev.preventDefault();
    const q = campo.value.trim();
    if (q) location.href = urlBusqueda(q);
  });
}

export {};
