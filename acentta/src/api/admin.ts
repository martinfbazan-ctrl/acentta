/**
 * /api/admin — entrar, listar pedidos y cargar el seguimiento
 * ---------------------------------------------------------------
 * Las tres operaciones de la pantalla de pedidos, en una sola ruta
 * porque comparten exactamente la misma pregunta previa: **¿quién
 * está preguntando?** Separarlas en tres archivos repetiría el
 * control de sesión tres veces, y un control repetido es un control
 * que alguna vez se va a olvidar en uno de los tres.
 *
 *     POST ?accion=entrar   { clave }        → abre la sesión
 *     POST ?accion=salir                     → la cierra
 *     GET                                    → lista los pedidos
 *     POST ?accion=seguimiento { numero, seguimiento, estado? }
 *
 * Todo lo que no sea «entrar» exige sesión.
 */

import type { APIRoute } from 'astro';
import { actualizarPedido, hayAlmacen, listarPedidos } from '@lib/pedidos';
import { buscarPagoPorPedido } from '@lib/mercadopago';
import { aplicarPago } from '@lib/conciliacion';
import {
  cerrarSesion, claveCorrecta, crearSesion, galletaBorrada, galletaDeSesion,
  hayClaveConfigurada, huellaDe, permiteIntentar, sesionValida, tokenDe,
} from '@lib/sesion';

export const prerender = false;

const CABECERAS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (datos: unknown, estado = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { ...CABECERAS, ...extra } });

async function autorizado(request: Request): Promise<boolean> {
  return sesionValida(tokenDe(request));
}

export const GET: APIRoute = async ({ request }) => {
  if (!hayAlmacen()) return json({ error: 'El registro de pedidos no está disponible.' }, 503);
  if (!(await autorizado(request))) return json({ error: 'Sesión no válida.' }, 401);

  const pedidos = await listarPedidos(100);

  /* Se devuelve todo, incluidos los datos personales: es la pantalla
     de trabajo de quien despacha, y sin dirección y teléfono no puede
     despachar. Por eso mismo está detrás de sesión. */
  return json({
    pedidos: pedidos.map((p) => ({
      numero: p.numero,
      creado: p.creado,
      estado: p.estado,
      total: p.cotizacion.total,
      envio: p.cotizacion.envio,
      envioGratis: p.cotizacion.envioGratis,
      metodoPago: p.metodoPago,
      pagoId: p.pagoId ?? null,
      detallePago: p.detallePago ?? null,
      seguimiento: p.seguimiento ?? null,
      comprador: p.comprador,
      entrega: p.entrega,
      items: p.cotizacion.lineas.map((l) => ({
        nombre: l.nombre, variante: l.variante, cantidad: l.cantidad, precio: l.precio,
      })),
    })),
  });
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!hayAlmacen()) return json({ error: 'El registro de pedidos no está disponible.' }, 503);

  const accion = url.searchParams.get('accion') ?? '';

  /* ---- Entrar ---- */
  if (accion === 'entrar') {
    if (!hayClaveConfigurada()) {
      return json({ error: 'Falta configurar ADMIN_CLAVE, con 12 caracteres o más.' }, 503);
    }
    if (!(await permiteIntentar(huellaDe(request)))) {
      return json({ error: 'Demasiados intentos. Probar de nuevo en quince minutos.' }, 429);
    }

    let clave = '';
    try { clave = String(((await request.json()) as { clave?: unknown }).clave ?? ''); } catch { /* vacío */ }

    /* Mismo mensaje para clave vacía y clave equivocada: decir cuál
       de las dos es le regala información a quien está probando. */
    if (!claveCorrecta(clave)) return json({ error: 'Clave incorrecta.' }, 401);

    const { token, segundos } = await crearSesion();
    return json({ ok: true }, 200, { 'Set-Cookie': galletaDeSesion(token, segundos) });
  }

  /* ---- Salir ---- */
  if (accion === 'salir') {
    await cerrarSesion(tokenDe(request));
    return json({ ok: true }, 200, { 'Set-Cookie': galletaBorrada() });
  }

  /* ---- De acá en adelante, hace falta sesión ---- */
  if (!(await autorizado(request))) return json({ error: 'Sesión no válida.' }, 401);

  /* ---- Cargar el número de seguimiento ---- */
  if (accion === 'seguimiento') {
    let cuerpo: { numero?: string; seguimiento?: string; estado?: string };
    try { cuerpo = (await request.json()) as typeof cuerpo; } catch { return json({ error: 'Pedido mal formado.' }, 400); }

    const numero = String(cuerpo.numero ?? '').trim().toUpperCase();
    if (!/^AC-\d{6}-[A-Z0-9]{6}$/.test(numero)) return json({ error: 'Número de pedido inválido.' }, 400);

    const seguimiento = String(cuerpo.seguimiento ?? '').trim().slice(0, 60);

    /* El estado sólo se puede mover a mano a los dos que dependen de
       una decisión humana. Aprobado y rechazado los pone el aviso de
       Mercado Pago y nadie más: si se pudieran tocar desde acá, un
       clic distraído marcaría como cobrado algo que no se cobró. */
    const cambios: Record<string, unknown> = { seguimiento: seguimiento || undefined };
    if (cuerpo.estado === 'cancelado' || cuerpo.estado === 'devuelto') {
      cambios.estado = cuerpo.estado;
    }

    const actualizado = await actualizarPedido(numero, cambios);
    if (!actualizado) return json({ error: 'No encontramos ese pedido.' }, 404);

    return json({ ok: true, numero, seguimiento: actualizado.seguimiento ?? null, estado: actualizado.estado });
  }

  /* ---- Preguntarle a Mercado Pago por los pedidos pendientes ----

     La red de seguridad del circuito de cobro. El aviso de pago es un
     mensaje que llega por la red, y los mensajes que llegan por la
     red se pierden: un despliegue justo en ese momento, un corte, una
     función que tardó más de 22 segundos. Y en modo de prueba Mercado
     Pago directamente no los envía.

     Un pedido que quedó pendiente por un aviso perdido es un pago
     cobrado que nadie va a despachar. Esto invierte la dirección: en
     vez de esperar a que nos avisen, preguntamos.

     Sólo mira los pendientes. Los ya resueltos no se vuelven a tocar:
     re-preguntar por un pedido aprobado hace ocho meses es gastar
     llamadas para confirmar algo que ya sabemos. */
  if (accion === 'sincronizar') {
    const pedidos = (await listarPedidos(100)).filter((p) => p.estado === 'pendiente');

    let revisados = 0;
    let cambiados = 0;
    let sinPago = 0;
    const paraRevisar: string[] = [];

    for (const p of pedidos) {
      revisados++;
      try {
        const pago = await buscarPagoPorPedido(p.numero);
        if (!pago) { sinPago++; continue; }
        const r = await aplicarPago(p, pago);
        if (r.cambio) cambiados++;
        if (r.revisar) paraRevisar.push(`${p.numero}: ${r.nota}`);
      } catch {
        /* Un pedido que falla no puede frenar a los demás. */
      }
    }

    return json({ ok: true, revisados, cambiados, sinPago, paraRevisar });
  }

  return json({ error: 'Acción desconocida.' }, 400);
};
