/**
 * La aplicación del panel, con la configuración importada a mano.
 * ---------------------------------------------------------------
 * Keystatic trae sus propias páginas internas, pero cargan la
 * configuración a través de un módulo virtual —`virtual:keystatic-config`—
 * que su integración arma resolviendo el archivo del proyecto. Cuando
 * esa resolución falla, y en Windows falla, no hay error: las rutas
 * simplemente no quedan registradas y el panel devuelve 404.
 *
 * Acá la configuración se importa por ruta relativa, como cualquier
 * otro módulo. Es una línea más y una capa de magia menos: si el
 * archivo no existiera, el error diría exactamente eso.
 */
import { makePage } from '@keystatic/astro/ui';
import config from '../../keystatic.config';

export const Panel = makePage(config);
