/**
 * acentta · pantalla de pedidos
 * ---------------------------------------------------------------
 * Todo el contenido llega por una llamada autenticada. Este guion no
 * decide nada sobre permisos: si la sesión no vale, el servidor
 * contesta 401 y acá se vuelve a mostrar el formulario. Un control de
 * acceso del lado del navegador es una cortina, no una puerta.
 */

import { precio as fPrecio } from '@lib/formato';

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

interface PedidoPanel {
  numero: string;
  creado: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'devuelto' | 'cancelado';
  total: number;
  envio: number;
  envioGratis: boolean;
  metodoPago: string;
  pagoId: string | null;
  detallePago: string | null;
  seguimiento: string | null;
  comprador: { email: string; nombre: string; apellido: string; dni: string; telefono: string };
  entrega: {
    metodo: string; cp: string; provincia: string; ciudad: string;
    calle: string; numero: string; piso?: string; entre?: string; referencias?: string;
  };
  items: { nombre: string; variante: string; cantidad: number; precio: number }[];
}

let todos: PedidoPanel[] = [];
let filtro = 'todos';

/** Nada de lo que escribió una persona se inserta sin escapar. */
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function tarjeta(p: PedidoPanel): string {
  const dir = [
    `${p.entrega.calle} ${p.entrega.numero}`,
    p.entrega.piso,
    `${p.entrega.ciudad}, ${p.entrega.provincia}`,
    `CP ${p.entrega.cp}`,
  ].filter(Boolean).join(' · ');

  const items = p.items
    .map((i) => `${i.cantidad} × ${esc(i.nombre)}${i.variante ? ` (${esc(i.variante)})` : ''}`)
    .join('<br>');

  return `
  <article class="pedido" data-pedido="${esc(p.numero)}">
    <div>
      <div class="pedido__cabeza">
        <span class="pedido__numero">${esc(p.numero)}</span>
        <span class="chapa chapa--${esc(p.estado)}">${esc(p.estado)}</span>
        <span class="pedido__fecha">${esc(fecha(p.creado))}</span>
        <span class="pedido__total">${esc(fPrecio(p.total))}</span>
      </div>

      <dl>
        <div class="pedido__dato"><dt>Comprador</dt><dd>${esc(p.comprador.nombre)} ${esc(p.comprador.apellido)} · DNI ${esc(p.comprador.dni)}</dd></div>
        <div class="pedido__dato"><dt>Contacto</dt><dd>${esc(p.comprador.telefono)} · ${esc(p.comprador.email)}</dd></div>
        <div class="pedido__dato"><dt>Entrega</dt><dd>${p.entrega.metodo === 'sucursal' ? 'Retiro en sucursal' : 'A domicilio'} · ${esc(dir)}</dd></div>
        ${p.entrega.referencias ? `<div class="pedido__dato"><dt>Indicaciones</dt><dd>${esc(p.entrega.referencias)}</dd></div>` : ''}
        <div class="pedido__dato"><dt>Pago</dt><dd>${esc(p.metodoPago)}${p.detallePago ? ` · ${esc(p.detallePago)}` : ''}${p.envioGratis ? ' · envío gratis' : ` · envío ${esc(fPrecio(p.envio))}`}</dd></div>
      </dl>

      <div class="pedido__items">${items}</div>
    </div>

    <div class="pedido__envio">
      <span class="pedido__envio-titulo">Número de seguimiento</span>
      <input type="text" value="${esc(p.seguimiento ?? '')}" placeholder="Pegar el del proveedor"
             aria-label="Número de seguimiento del pedido ${esc(p.numero)}" data-campo-seguimiento />
      <button class="boton boton--secundario" type="button" data-guardar>
        <span class="boton__texto">Guardar</span>
      </button>
      <p class="pedido__envio-aviso" hidden data-aviso></p>
      ${p.seguimiento ? '' : `<p class="pedido__envio-nota">Sin este número, un contracargo se pierde: es la única forma de probar que el pedido llegó.</p>`}
    </div>
  </article>`;
}

function pintar() {
  const lista = $('[data-lista]');
  const vacio = $('[data-vacio]');
  if (!lista || !vacio) return;

  const visibles = todos.filter((p) => {
    if (filtro === 'todos') return true;
    if (filtro === 'sin-seguimiento') return !p.seguimiento && p.estado === 'aprobado';
    return p.estado === filtro;
  });

  lista.innerHTML = visibles.map(tarjeta).join('');
  vacio.hidden = visibles.length > 0;

  const sinSeguimiento = todos.filter((p) => p.estado === 'aprobado' && !p.seguimiento).length;
  const cuenta = $('[data-cuenta]');
  if (cuenta) {
    cuenta.textContent = `${visibles.length} de ${todos.length} pedidos`
      + (sinSeguimiento ? ` · ${sinSeguimiento} aprobado${sinSeguimiento > 1 ? 's' : ''} sin seguimiento` : '');
  }
}

async function cargar(): Promise<boolean> {
  const r = await fetch('/api/admin', { headers: { Accept: 'application/json' } });
  if (r.status === 401) return false;
  if (!r.ok) throw new Error('No se pudo leer la lista de pedidos.');
  todos = ((await r.json()) as { pedidos: PedidoPanel[] }).pedidos ?? [];
  pintar();
  return true;
}

function mostrarPanel() {
  $('[data-forma-entrar]')!.hidden = true;
  $('[data-panel]')!.hidden = false;
  $('[data-salir]')!.hidden = false;
}

/* ---- Guardar el seguimiento ---- */
document.addEventListener('click', async (e) => {
  const boton = (e.target as HTMLElement).closest('[data-guardar]');
  if (!boton) return;

  const tarjetaDom = boton.closest<HTMLElement>('[data-pedido]');
  const campo = tarjetaDom?.querySelector<HTMLInputElement>('[data-campo-seguimiento]');
  const aviso = tarjetaDom?.querySelector<HTMLElement>('[data-aviso]');
  if (!tarjetaDom || !campo || !aviso) return;

  const numero = tarjetaDom.dataset.pedido!;
  const r = await fetch('/api/admin?accion=seguimiento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero, seguimiento: campo.value }),
  });

  aviso.hidden = false;
  if (r.ok) {
    aviso.textContent = 'Guardado';
    const p = todos.find((x) => x.numero === numero);
    if (p) p.seguimiento = campo.value.trim() || null;
    window.setTimeout(() => { aviso.hidden = true; }, 2500);
  } else {
    aviso.textContent = r.status === 401
      ? 'La sesión venció. Recargá la página.'
      : 'No se pudo guardar.';
  }
});

/* ---- Filtros ---- */
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-filtro]')) {
  b.addEventListener('click', () => {
    filtro = b.dataset.filtro!;
    for (const otro of document.querySelectorAll('[data-filtro]')) {
      otro.setAttribute('aria-pressed', String(otro === b));
    }
    pintar();
  });
}

/* ---- Entrar ---- */
$<HTMLFormElement>('[data-forma-entrar]')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const clave = $<HTMLInputElement>('#clave')!;
  const error = $('[data-error-entrar]')!;
  error.hidden = true;

  const r = await fetch('/api/admin?accion=entrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clave: clave.value }),
  });

  if (r.ok) {
    clave.value = '';
    mostrarPanel();
    await cargar();
    return;
  }

  const datos = (await r.json().catch(() => ({}))) as { error?: string };
  error.textContent = datos.error ?? 'No se pudo entrar.';
  error.hidden = false;
});

/* ---- Salir ---- */
$('[data-salir]')?.addEventListener('click', async () => {
  await fetch('/api/admin?accion=salir', { method: 'POST' });
  location.reload();
});

/* ---- Al abrir: si la sesión sigue viva, se entra derecho ---- */
async function arrancar() {
  try {
    if (await cargar()) mostrarPanel();
  } catch { /* sin sesión o sin servidor: queda el formulario */ }
}
void arrancar();
