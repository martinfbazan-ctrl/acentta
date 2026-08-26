/**
 * acentta · leer una variable de entorno
 * ---------------------------------------------------------------
 * Una función de cuatro líneas con su propio archivo, y hay motivo.
 *
 * Astro expone las variables en `import.meta.env` durante la
 * construcción y el adaptador de Vercel las expone en `process.env`
 * al ejecutarse. Ninguna de las dos está siempre: en la función
 * desplegada `import.meta.env` no tiene las claves privadas, y en
 * algunas herramientas de prueba `process` directamente no existe.
 * Leer de las dos, en ese orden, es lo único que funciona en los dos
 * lados.
 *
 * Se lee al usarse y no al importarse. Si se guardara en una
 * constante del módulo, el valor quedaría congelado en el momento de
 * la construcción — que es exactamente cuando todavía no están las
 * credenciales.
 *
 * Vive en su propio archivo porque lo necesitan el almacén, la sesión
 * y las dos pasarelas. Si viviera dentro de una de las pasarelas, las
 * demás tendrían que importarla desde ahí y quedaría un enredo de
 * dependencias circulares el día que la pasarela importe el contrato
 * que la nombra.
 */

/**
 * Devuelve la primera de las variables que tenga valor, o texto
 * vacío. Nunca devuelve `undefined`: quien la usa quiere preguntar
 * «¿está configurado esto?», y para eso alcanza con la cadena vacía.
 */
export function variable(...nombres: string[]): string {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const proceso = typeof process !== 'undefined' ? (process.env ?? {}) : {};
  for (const nombre of nombres) {
    const v = proceso[nombre] ?? meta[nombre];
    if (v) return v;
  }
  return '';
}
