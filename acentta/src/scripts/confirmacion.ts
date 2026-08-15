/**
 * acentta · confirmación
 * ---------------------------------------------------------------
 * Dos orígenes posibles, y el orden importa.
 *
 * 1. `?pedido=AC-…` en la dirección — es lo que devuelve Mercado
 *    Pago al volver del pago. Se consulta el pedido real al
 *    servidor. Éste manda.
 * 2. Sin ese parámetro, el pedido simulado del almacenamiento del
 *    navegador, que es lo que usa la demostración cuando el cobro no
 *    está configurado.
 *
 * POR QUÉ SE CONSULTA AL SERVIDOR EN LUGAR DE CONFIAR EN LA VUELTA
 *
 * Mercado Pago manda de vuelta a `success` apenas el pago se
 * autoriza, y eso no siempre significa cobrado: con Rapipago o Pago
 * Fácil vuelve igual y el pago queda pendiente durante días. Mostrar
 * «confirmado» ahí sería mentir. El estado real lo tiene el pedido,
 * que lo actualiza el aviso de pago.
 *
 * Y el carrito se vacía acá, no antes: si la persona abandona en la
 * pantalla de Mercado Pago y vuelve atrás, tiene que encontrar su
 * carrito donde lo dejó.
 */

import { leerPedido } from '@lib/pedido';
import { vaciar } from '@lib/carrito';
import { precio as fPrecio, rangoDeEntrega } from '@lib/formato';

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);
const texto = (s: string, v: string) => { const n = $(s); if (n) n.textContent = v; };

interface PedidoReal {
  numero: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'devuelto' | 'cancelado';
  creado: string;
  total: number;
  envio: number;
  envioGratis: boolean;
  diasExtra: number;
  ciudad: string;
  provincia: string;
  seguimiento: string | null;
  items: { nombre: string; variante: string; cantidad: number; precio: number; imagen: string }[];
}

/** Qué se le dice a la persona según cómo quedó el pago. */
const SEGUN_ESTADO = {
  aprobado: {
    titulo: 'Listo, tu pedido está confirmado',
    mensaje: 'Guarda el número: con él puedes consultar el estado del envío en cualquier momento.',
    aviso: '',
  },
  pendiente: {
    titulo: 'Tu pedido quedó registrado',
    mensaje: 'El pago todavía se está acreditando. Es normal si elegiste efectivo o transferencia: '
      + 'puede tardar hasta 3 días hábiles. Preparamos el pedido apenas se acredite.',
    aviso: 'Pago pendiente de acreditación',
  },
  rechazado: {
    titulo: 'El pago no se pudo completar',
    mensaje: 'El pedido quedó guardado con este número. Puedes intentar de nuevo desde el carrito, '
      + 'o escribirnos y lo resolvemos.',
    aviso: 'Pago rechazado',
  },
  cancelado: {
    titulo: 'El pedido quedó cancelado',
    mensaje: 'No se cobró nada. Si fue un error, puedes armarlo de nuevo desde el carrito.',
    aviso: 'Pedido cancelado',
  },
  devuelto: {
    titulo: 'Este pedido fue devuelto',
    mensaje: 'El dinero volvió al medio de pago que usaste. Puede tardar unos días en verse en el resumen.',
    aviso: 'Dinero devuelto',
  },
} as const;

function pintarItems(items: PedidoReal['items']) {
  const caja = $('[data-items-pedido]');
  if (!caja) return;
  caja.innerHTML = items.map((i) => `
    <article class="cf-item">
      <img class="cf-item__foto" src="https://images.unsplash.com/${i.imagen}?auto=format&fit=crop&w=150&q=72" alt="" width="52" height="65" loading="lazy" />
      <div class="cf-item__datos">
        <p class="cf-item__nombre">${i.nombre}</p>
        <p class="cf-item__meta">${i.variante ? i.variante + ' · ' : ''}${i.cantidad} u.</p>
      </div>
      <span class="cf-item__precio">${fPrecio(i.precio * i.cantidad)}</span>
    </article>`).join('');
}

/** El botón de copiar. Sin él, el número hay que transcribirlo a mano. */
function habilitarCopiar(numero: string) {
  const boton = $<HTMLButtonElement>('[data-copiar-numero]');
  if (!boton || !navigator.clipboard) return;
  boton.hidden = false;
  boton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(numero);
      texto('[data-copiar-texto]', 'Copiado');
      window.setTimeout(() => texto('[data-copiar-texto]', 'Copiar'), 2000);
    } catch { /* sin permiso: queda el número a la vista para copiarlo a mano */ }
  });
}

async function mostrarPedidoReal(numero: string): Promise<boolean> {
  let datos: PedidoReal;
  try {
    const r = await fetch(`/api/pedido?numero=${encodeURIComponent(numero)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return false;
    datos = (await r.json()) as PedidoReal;
    if (!datos?.numero) return false;
  } catch {
    return false;
  }

  const copia = SEGUN_ESTADO[datos.estado] ?? SEGUN_ESTADO.pendiente;

  texto('[data-titulo-pedido]', copia.titulo);
  texto('[data-mensaje-pedido]', copia.mensaje);
  texto('[data-numero-pedido]', datos.numero);
  habilitarCopiar(datos.numero);

  const sello = $('[data-estado-pago]');
  if (sello && copia.aviso) {
    sello.hidden = false;
    sello.dataset.estado = datos.estado;
    sello.textContent = copia.aviso;
  }

  const extra = datos.diasExtra ?? 0;
  texto('[data-fecha-entrega]', ' ' + rangoDeEntrega(5 + extra, 10 + extra, new Date(datos.creado)));

  const resumen = $('[data-resumen-pedido]');
  if (resumen) resumen.hidden = false;
  texto('[data-total-pedido]', fPrecio(datos.total));
  texto('[data-envio-pedido]', datos.envioGratis || datos.envio === 0 ? 'Gratis' : fPrecio(datos.envio));
  pintarItems(datos.items);

  /* El pedido es real: el aviso de que esto es una demostración deja
     de ser cierto y se apaga. Decirle a alguien que acaba de pagar
     que «no se procesó ningún pago real» es asustarlo por escrito, y
     le da motivo para desconfiar de todo lo demás que diga la
     página. */
  const avisoDemo = $('[data-aviso-demostracion]');
  if (avisoDemo) avisoDemo.hidden = true;

  /* Recién ahora: el pedido existe del lado del servidor, así que el
     carrito ya no hace falta. Sólo si el pago no fue rechazado —si
     fue rechazado, la persona probablemente quiera reintentar y
     vaciarle el carrito sería castigarla por un problema del banco. */
  if (datos.estado !== 'rechazado') vaciar();

  return true;
}

/* ============================================================
   Todo adentro de una función y no suelto en el módulo.

   El `await` de nivel superior necesita un objetivo de compilación
   moderno, y el generador de vista previa —que reempaqueta los
   guiones para poder auditarlos— compila a uno anterior. Con el
   `await` suelto, la compilación de la vista previa falla entera y
   se caen las ocho auditorías por un detalle de empaquetado.
   ============================================================ */
async function arrancar() {
const numeroEnLaUrl = new URLSearchParams(location.search).get('pedido');

if (numeroEnLaUrl) {
  /* Mientras se consulta, se muestra el número que ya tenemos: es
     preferible a un guion que parpadea. */
  texto('[data-numero-pedido]', numeroEnLaUrl);

  const listo = await mostrarPedidoReal(numeroEnLaUrl);
  if (!listo) {
    /* El pedido no se pudo consultar. Se deja el número igual —es lo
       que la persona necesita para reclamar— y se dice la verdad en
       vez de inventar un estado. */
    habilitarCopiar(numeroEnLaUrl);
    texto('[data-mensaje-pedido]',
      'No pudimos mostrar el detalle en este momento. El número de arriba es válido: '
      + 'guárdalo y consulta el estado en la página de seguimiento.');
    texto('[data-fecha-entrega]', ' según tu zona');
  }
} else {
  /* ---- Camino simulado ----
     Sin número en la dirección, la demostración del portafolio. */
  const pedido = leerPedido();

  if (pedido) {
    texto('[data-numero-pedido]', pedido.numero);
    habilitarCopiar(pedido.numero);

    const extra = pedido.diasExtra ?? 0;
    texto('[data-fecha-entrega]', ' ' + rangoDeEntrega(5 + extra, 10 + extra, new Date(pedido.fecha)));

    const resumen = $('[data-resumen-pedido]');
    if (resumen) resumen.hidden = false;
    texto('[data-total-pedido]', fPrecio(pedido.total));
    texto('[data-envio-pedido]', pedido.envio === 0 ? 'Gratis' : fPrecio(pedido.envio));
    pintarItems(pedido.items as PedidoReal['items']);
  } else {
    /* Entrar directo a /confirmacion sin haber comprado no debería
       mostrar un pedido inventado. */
    texto('[data-numero-pedido]', 'sin pedido reciente');
    texto('[data-mensaje-pedido]', 'Si acabas de comprar y llegaste hasta acá sin el número, revisa el historial del navegador.');
    texto('[data-fecha-entrega]', ' según tu zona');
  }
}
}

void arrancar();
