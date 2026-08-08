/**
 * La API del panel: lo que lee y escribe los archivos del catálogo.
 * ---------------------------------------------------------------
 * Mismo criterio que `aplicacion.ts`: la configuración se importa por
 * ruta relativa en lugar de por el módulo virtual de Keystatic, que
 * es donde se rompía en Windows.
 *
 * Sólo existe cuando se levanta el panel con `npm run admin`. El sitio
 * publicado no tiene esta ruta, así que no hay ningún punto por donde
 * escribir archivos desde internet.
 */
import { makeHandler } from '@keystatic/astro/api';
import config from '../../keystatic.config';

export const prerender = false;

export const ALL = makeHandler({ config });
export const all = ALL;
