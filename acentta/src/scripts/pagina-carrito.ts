/**
 * acentta · página del carrito
 */

import {
  leer, suscribir, cambiarCantidad, quitar, reponer,
  subtotal, resumen, guardarCP, leerCP,
  type ItemCarrito,
} from '@lib/carrito';
import { precio as fPrecio, cuota, estadoEnvioGratis } from '@lib/formato';
import { normalizarCP } from '@lib/envio';
import { UMBRAL_ENVIO_GRATIS } from '@tipos/catalogo';
import { mostrarAviso } from './carrito';

const carro = document.querySelector<HTMLElement>('[data-carro]');
if (carro) {
  const vacio = document.querySelector<HTMLElement>('[data-carro-vacio]')!;
  const cross = document.querySelector<HTMLElement>('[data-carro-cross]')!;
  const items = document.querySelector<HTMLElement>('[data-carro-items]')!;
  const entradaCP = document.querySelector<HTMLInputElement>('#cp-carrito')!;
  const campoCP = document.querySelector<HTMLElement>('[data-campo-cp]')!;
  const formaCP = document.querySelector<HTMLFormElement>('[data-cp-forma]')!;

  entradaCP.value = leerCP();

  const pintarItems = (lista: ItemCarrito[]) => {
    items.innerHTML = lista.map((i) => {
      const pocoStock = i.stockMax <= 5;
      return `
      <article class="carro-item">
        <img class="carro-item__foto" src="https://images.unsplash.com/${i.imagen}?auto=format&fit=crop&w=250&q=72" alt="" width="96" height="120" loading="lazy" />
        <div class="carro-item__datos">
          <p class="carro-item__nombre"><a href="/producto/${i.slug}">${i.nombre}</a></p>
          ${i.variante ? `<p class="carro-item__variante">${i.variante}</p>` : ''}
          ${pocoStock ? `<p class="carro-item__aviso">Quedan ${i.stockMax} unidades</p>` : ''}
          <div class="carro-item__pie">
            <div class="cantidad" data-cantidad data-min="1" data-max="${i.stockMax}" data-linea="${i.id}" data-linea-variante="${i.variante}">
              <button class="cantidad__boton" type="button" data-accion="restar" aria-label="Quitar uno" ${i.cantidad <= 1 ? 'disabled' : ''}>
                <svg width="14" height="2" viewBox="0 0 14 2" aria-hidden="true"><rect width="14" height="2" rx="1" fill="currentColor"/></svg>
              </button>
              <label class="vo" for="cant-${i.id}-${i.variante}">Cantidad de ${i.nombre}</label>
              <input class="cantidad__valor tabular" id="cant-${i.id}-${i.variante}" type="number" value="${i.cantidad}" min="1" max="${i.stockMax}" inputmode="numeric" />
              <button class="cantidad__boton" type="button" data-accion="sumar" aria-label="Agregar uno" ${i.cantidad >= i.stockMax ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M6 0h2v14H6z M0 6h14v2H0z" fill="currentColor"/></svg>
              </button>
            </div>
            <div style="text-align:right">
              <p class="carro-item__precio">${fPrecio(i.precio * i.cantidad)}</p>
              ${i.cantidad > 1 ? `<p class="carro-item__unitario">${fPrecio(i.precio)} por unidad</p>` : ''}
            </div>
            <button class="carro-item__quitar" type="button" data-quitar-linea="${i.id}" data-variante="${i.variante}">Quitar</button>
          </div>
        </div>
      </article>`;
    }).join('');

    /* Cantidad */
    for (const caja of items.querySelectorAll<HTMLElement>('[data-cantidad]')) {
      const entrada = caja.querySelector<HTMLInputElement>('.cantidad__valor')!;
      const id = caja.dataset.linea!;
      const variante = caja.dataset.lineaVariante!;
      const aplicar = (v: number) => cambiarCantidad(id, variante, v);
      caja.querySelector('[data-accion="restar"]')!.addEventListener('click', () => aplicar(Number(entrada.value) - 1));
      caja.querySelector('[data-accion="sumar"]')!.addEventListener('click', () => aplicar(Number(entrada.value) + 1));
      entrada.addEventListener('change', () => aplicar(Number(entrada.value)));
    }

    /* Quitar con deshacer */
    for (const b of items.querySelectorAll<HTMLButtonElement>('[data-quitar-linea]')) {
      b.addEventListener('click', () => {
        const quitado = quitar(b.dataset.quitarLinea!, b.dataset.variante!);
        if (!quitado) return;
        mostrarAviso(`Quitaste ${quitado.item.nombre}`, 'Deshacer', () =>
          reponer(quitado.item, quitado.posicion)
        );
      });
    }
  };

  const pintarResumen = (lista: ItemCarrito[]) => {
    const cp = leerCP();
    const r = resumen(cp, lista);
    const sub = subtotal(lista);

    document.querySelector<HTMLElement>('[data-carro-subtotal]')!.textContent = fPrecio(sub);
    document.querySelector<HTMLElement>('[data-carro-total]')!.textContent = fPrecio(r.total);

    const rotulo = document.querySelector<HTMLElement>('[data-carro-envio-rotulo]')!;
    const valor = document.querySelector<HTMLElement>('[data-carro-envio]')!;

    if (r.envioGratis) {
      rotulo.textContent = 'Envío';
      valor.textContent = 'Gratis';
      valor.style.color = 'var(--verde)';
    } else if (r.envioEstimado) {
      rotulo.textContent = 'Envío (estimado)';
      valor.textContent = `desde ${fPrecio(r.envio)}`;
      valor.style.color = 'var(--gris-800)';
    } else {
      rotulo.textContent = `Envío a ${r.zona}`;
      valor.textContent = fPrecio(r.envio);
      valor.style.color = '';
    }

    /* Cuotas sobre el total, no sobre el subtotal: la cuota que
       importa es la que se va a pagar. */
    document.querySelector<HTMLElement>('[data-carro-cuotas]')!.innerHTML =
      `12 cuotas sin interés de <b>${cuota(r.total, 12)}</b>`;

    /* Barra de envío gratis */
    const estado = estadoEnvioGratis(sub, UMBRAL_ENVIO_GRATIS);
    const caja = document.querySelector<HTMLElement>('[data-carro-envio-caja]')!;
    const texto = document.querySelector<HTMLElement>('[data-carro-envio-texto]')!;
    const barra = document.querySelector<HTMLElement>('[data-carro-barra]')!;
    caja.dataset.logrado = String(estado.logrado);
    texto.innerHTML = estado.logrado
      ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M6.2 11.4 3.3 8.5l-1.1 1.1 4 4 7.6-7.6-1.1-1.1z"/></svg> Tienes envío gratis'
      : `Te faltan <b>${fPrecio(estado.falta)}</b> para el envío gratis`;
    barra.setAttribute('aria-valuenow', String(estado.progreso));
    barra.querySelector<HTMLElement>('.envio-gratis__relleno')!
      .style.setProperty('--progreso', `${estado.progreso}%`);

    /* El cross-sell aparece sólo si sirve: cuando falta poco. */
    cross.hidden = lista.length === 0 || estado.logrado || estado.falta > 25000;
  };

  suscribir((lista) => {
    const hay = lista.length > 0;
    carro.hidden = !hay;
    vacio.hidden = hay;
    if (!hay) { cross.hidden = true; return; }
    pintarItems(lista);
    pintarResumen(lista);
  });

  /* Código postal */
  formaCP.addEventListener('submit', (e) => {
    e.preventDefault();
    if (normalizarCP(entradaCP.value) === null) {
      campoCP.dataset.estado = 'error';
      let error = campoCP.querySelector<HTMLElement>('.campo__error');
      if (!error) {
        error = document.createElement('p');
        error.className = 'campo__error';
        error.setAttribute('role', 'alert');
        campoCP.appendChild(error);
      }
      error.textContent = 'El código postal lleva cuatro números. Prueba con 1425.';
      entradaCP.focus();
      return;
    }
    campoCP.dataset.estado = 'exito';
    campoCP.querySelector('.campo__error')?.remove();
    guardarCP(entradaCP.value);
    pintarResumen(leer());
  });

  entradaCP.addEventListener('input', () => {
    if (campoCP.dataset.estado === 'error') {
      campoCP.dataset.estado = 'normal';
      campoCP.querySelector('.campo__error')?.remove();
    }
  });
}
