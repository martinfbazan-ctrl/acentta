/**
 * acentta · marquesina
 * ---------------------------------------------------------------
 * Historial de los tres problemas que tuvo esta franja, porque los
 * tres son distintos y sólo el primero era obvio.
 *
 * 1. EL HUECO. La pista llevaba dos copias fijas y se desplazaba
 *    −50 %, o sea el ancho de una copia. Eso funciona sólo si una
 *    copia es más ancha que la pantalla. Los seis mensajes miden
 *    ~1500 px; en un monitor de 1920 sobraban 400 px de vacío al
 *    final de cada vuelta. Ahora se clonan las copias necesarias.
 *
 * 2. LOS SALTOS. Éste es el que quedaba. La animación arrancaba con
 *    valores provisorios y después el guion cambiaba --velocidad y
 *    --desplazamiento sobre la marcha. Modificar la duración o los
 *    fotogramas de una animación en curso la reinicia: el texto
 *    pegaba un salto en cada remedición — al cargar, al terminar de
 *    cargar la tipografía y en cada resize.
 *    Ahora la animación no existe hasta que la medición está hecha,
 *    y cuando hay que remedir se apaga, se recalcula y se vuelve a
 *    encender desde cero. Nunca se toca una animación viva.
 *
 * 3. LA PAUSA QUE SE ROMPÍA. El observador escribía
 *    `style.animationPlayState = 'running'` en línea, y un estilo en
 *    línea le gana a la regla `:hover` de la hoja. Después de que la
 *    franja entrara una vez en pantalla, pasar el mouse ya no la
 *    frenaba. Ahora las pausas se manejan con un atributo y las
 *    decide el CSS, que es donde conviven bien.
 */

const PX_POR_SEGUNDO = 45;

const caja = document.querySelector<HTMLElement>('[data-marquesina]');

if (caja) {
  const pista = caja.querySelector<HTMLElement>('.marquesina__pista')!;
  const original = pista.querySelector<HTMLElement>('.marquesina__grupo')!;

  function medirYArrancar() {
    /* Se apaga antes de tocar nada. */
    delete caja!.dataset.listo;

    for (const g of [...pista.querySelectorAll<HTMLElement>('.marquesina__grupo')].slice(1)) {
      g.remove();
    }

    /* El ancho tiene que ser el exacto, con decimales incluidos: si
       el desplazamiento no coincide al milímetro con el ancho de una
       copia, en cada vuelta queda una costura de medio píxel. */
    const anchoGrupo = original.getBoundingClientRect().width;
    if (anchoGrupo < 1) return;

    const visible = caja!.getBoundingClientRect().width;
    const copias = Math.max(2, Math.ceil(visible / anchoGrupo) + 1);

    for (let i = 1; i < copias; i++) {
      const clon = original.cloneNode(true) as HTMLElement;
      clon.setAttribute('aria-hidden', 'true');
      pista.appendChild(clon);
    }

    pista.style.setProperty('--desplazamiento', `${anchoGrupo}px`);
    pista.style.setProperty('--velocidad', `${anchoGrupo / PX_POR_SEGUNDO}s`);

    /* Reflujo forzado: sin esto el navegador agrupa el apagado y el
       encendido en el mismo cuadro y la animación no se reinicia,
       que es justamente lo que producía el salto. */
    void pista.offsetWidth;

    caja!.dataset.listo = 'true';
  }

  medirYArrancar();

  /* La tipografía cambia el ancho del texto al terminar de cargar.
     Sin esta segunda medición, la cuenta queda tomada con la fuente
     de respaldo y el bucle no cierra. */
  if ('fonts' in document) {
    (document as Document & { fonts: FontFaceSet }).fonts.ready.then(medirYArrancar);
  }

  /* Sólo se remide si cambió el ancho. Un resize vertical —abrir el
     teclado en el teléfono, por ejemplo— no tiene por qué cortar la
     animación. */
  let anchoPrevio = window.innerWidth;
  let reloj: number | undefined;
  window.addEventListener('resize', () => {
    if (window.innerWidth === anchoPrevio) return;
    anchoPrevio = window.innerWidth;
    window.clearTimeout(reloj);
    reloj = window.setTimeout(medirYArrancar, 250);
  });

  /* ---- Pausas ----
     Con atributo, no con estilo en línea: así el CSS puede combinar
     esta pausa con la de :hover sin que una pise a la otra. */
  const pausar = (motivo: string) => caja.setAttribute(`data-pausa-${motivo}`, '');
  const seguir = (motivo: string) => caja.removeAttribute(`data-pausa-${motivo}`);

  if ('IntersectionObserver' in window) {
    const observador = new IntersectionObserver(
      ([entrada]) => (entrada!.isIntersecting ? seguir('fuera') : pausar('fuera')),
      { threshold: 0 }
    );
    observador.observe(caja);
  }

  document.addEventListener('visibilitychange', () => {
    document.hidden ? pausar('oculto') : seguir('oculto');
  });
}
