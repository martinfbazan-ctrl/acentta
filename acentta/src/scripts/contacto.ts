/**
 * acentta · formulario de contacto
 * No hay servidor: el envío se confirma en la misma página y se dice
 * con todas las letras que no salió nada. Fingir un envío exitoso en
 * un proyecto de portafolio es exactamente el tipo de mentira chica
 * que este sitio evita en todos lados.
 */

const forma = document.querySelector<HTMLFormElement>('[data-contacto]');

if (forma) {
  const aviso = forma.querySelector<HTMLElement>('[data-contacto-aviso]')!;

  const marcar = (entrada: HTMLInputElement | HTMLTextAreaElement, mensaje: string | null) => {
    const campo = entrada.closest<HTMLElement>('.campo');
    if (!campo) return;
    campo.querySelector('.campo__error')?.remove();
    if (!mensaje) {
      campo.dataset.estado = entrada.value.trim() ? 'exito' : 'normal';
      entrada.removeAttribute('aria-invalid');
      return;
    }
    campo.dataset.estado = 'error';
    entrada.setAttribute('aria-invalid', 'true');
    const p = document.createElement('p');
    p.className = 'campo__error';
    p.setAttribute('role', 'alert');
    p.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.8.8 0 0 0-.8.9l.25 3.1a.55.55 0 0 0 1.1 0l.25-3.1a.8.8 0 0 0-.8-.9Zm0 5.4a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Z"/></svg>' +
      `<span>${mensaje}</span>`;
    campo.appendChild(p);
  };

  const reglas: Record<string, (v: string) => string | null> = {
    'ct-nombre': (v) => (v.trim().length >= 2 ? null : 'Escribí tu nombre para saber cómo dirigirnos a vos.'),
    'ct-email': (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
        ? null
        : 'El correo va con arroba y un punto, por ejemplo nombre@ejemplo.com',
    'ct-mensaje': (v) => (v.trim().length >= 10 ? null : 'Contanos un poco más para poder ayudarte.'),
  };

  forma.addEventListener('submit', (e) => {
    e.preventDefault();
    let primerError: HTMLElement | null = null;

    for (const [id, regla] of Object.entries(reglas)) {
      const entrada = forma.querySelector<HTMLInputElement>(`#${id}`);
      if (!entrada) continue;
      const problema = regla(entrada.value);
      marcar(entrada, problema);
      if (problema && !primerError) primerError = entrada;
    }

    if (primerError) {
      primerError.focus();
      return;
    }

    aviso.hidden = false;
    aviso.innerHTML =
      '<b>Gracias, quedó registrada.</b> En una tienda en operación te llegaría una copia ' +
      'a tu correo y responderíamos dentro de las 24 h hábiles.<br />' +
      'Como acentta es un proyecto conceptual de portafolio, este formulario no envía nada ' +
      'a ningún lado y tus datos no salieron de esta página.';
    aviso.scrollIntoView({ block: 'center', behavior: 'smooth' });
    forma.reset();
    for (const campo of forma.querySelectorAll<HTMLElement>('.campo')) campo.dataset.estado = 'normal';
  });
}

/* Marca el archivo como módulo: sin esto TypeScript lo trata como
   guion global y las constantes de un archivo chocan con las del
   otro aunque nunca convivan en la misma página. */
export {};
