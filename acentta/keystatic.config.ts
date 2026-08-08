/**
 * acentta · panel de administración del catálogo
 * ---------------------------------------------------------------
 * Este archivo define los formularios que se ven en /keystatic.
 * Es la única parte del proyecto escrita para que la use alguien que
 * no programa, así que las etiquetas y las descripciones son parte
 * del trabajo, no comentarios: cada campo dice para qué sirve y qué
 * pasa si se completa mal.
 *
 * DÓNDE SE GUARDA
 * Los productos van a `src/contenido/productos/` como archivos YAML,
 * uno por producto, dentro del propio repositorio. No hay base de
 * datos ni servicio externo. Consecuencias que importan:
 *
 *   · Dar de baja un producto es reversible. Queda en el historial
 *     quién lo sacó y cuándo, y se puede recuperar.
 *   · El catálogo se versiona junto con el código, así que un cambio
 *     de precio y el diseño que lo muestra viajan juntos.
 *   · No hay costo mensual y no hay nada que se pueda caer.
 *
 * EL CONTRATO SIGUE MANDANDO
 * Lo que se carga acá lo lee `src/data/productos.ts`, que valida cada
 * producto contra los tipos de `types/catalogo.ts` antes de compilar.
 * Si alguien guarda un producto sin foto, con un precio anterior
 * menor al actual o con opiniones sin puntaje, el sitio no compila y
 * dice cuál es. El panel evita la mayoría de esos errores con sus
 * propias validaciones; el contrato es la red por si alguna se pasa.
 */

import { config, fields, collection } from '@keystatic/core';

/* Las mismas claves que usa el código. Si se agrega una categoría acá,
   hay que agregarla también en lib/catalogo.ts — están separadas a
   propósito: el panel no puede inventar una categoría que el sitio no
   sepa mostrar. */
const CATEGORIAS = [
  { label: 'Decoración · Iluminación', value: 'iluminacion' },
  { label: 'Decoración · Textil', value: 'textil' },
  { label: 'Decoración · Alfombras', value: 'alfombras' },
  { label: 'Decoración · Muebles chicos', value: 'muebles-chicos' },
  { label: 'Deco inteligente · Proyectores', value: 'proyectores' },
  { label: 'Deco inteligente · Limpieza', value: 'limpieza' },
  { label: 'Deco inteligente · Aromatización', value: 'aromatizacion' },
  { label: 'Deco inteligente · Seguridad', value: 'seguridad' },
  { label: 'Deco inteligente · Conectividad', value: 'conectividad' },
] as const;

export default config({
  storage: { kind: 'local' },

  ui: {
    brand: { name: 'acentta' },
    navigation: {
      Catálogo: ['productos'],
    },
  },

  collections: {
    productos: collection({
      label: 'Productos',
      path: 'src/contenido/productos/*',
      format: { data: 'yaml' },
      slugField: 'nombre',
      columns: ['nombre', 'precio'],

      schema: {
        /* ---------- Identidad ---------- */
        nombre: fields.slug({
          name: {
            label: 'Nombre del producto',
            description:
              'Como lo va a leer quien compra. Se puede escribir largo: la grilla lo corta sola.',
            validation: { length: { min: 3, max: 120 } },
          },
          slug: {
            label: 'Dirección en el sitio',
            description:
              'La parte final de la URL. Se genera sola del nombre. Si el producto ya se publicó, conviene NO cambiarla: los enlaces viejos dejan de funcionar.',
          },
        }),

        rubro: fields.select({
          label: 'Rubro',
          options: [
            { label: 'Decoración', value: 'decoracion' },
            { label: 'Deco inteligente', value: 'deco-inteligente' },
          ],
          defaultValue: 'decoracion',
        }),

        categoria: fields.select({
          label: 'Categoría',
          description: 'Tiene que corresponder al rubro elegido arriba.',
          options: [...CATEGORIAS],
          defaultValue: 'iluminacion',
        }),

        /* ---------- Precio ---------- */
        precio: fields.integer({
          label: 'Precio (ARS)',
          description: 'Sin puntos ni centavos. Por ejemplo: 89900.',
          validation: { isRequired: true, min: 1 },
        }),

        precioAnterior: fields.integer({
          label: 'Precio anterior (ARS)',
          description:
            'Sólo si hay una rebaja real. Tiene que ser MAYOR al precio actual — inflar este número para que el descuento parezca más grande es lo que el sitio no hace. Dejar vacío si no hay oferta.',
        }),

        /* ---------- Stock y variantes ---------- */
        variantes: fields.array(
          fields.object({
            tipo: fields.select({
              label: 'Tipo',
              options: [
                { label: 'Color', value: 'color' },
                { label: 'Medida', value: 'medida' },
                { label: 'Material', value: 'material' },
              ],
              defaultValue: 'color',
            }),
            nombre: fields.text({
              label: 'Nombre visible',
              description: 'Por ejemplo: «Negro mate», «120 × 170 cm», «Roble macizo».',
              validation: { isRequired: true },
            }),
            muestra: fields.text({
              label: 'Color en hexadecimal',
              description: 'Sólo para variantes de color. Por ejemplo: #1C1C1C.',
            }),
            stock: fields.integer({
              label: 'Stock',
              description:
                'El sitio calcula los avisos de esto: 0 muestra «Agotado», 5 o menos muestra «Últimas unidades». No hay forma de escribir esos avisos a mano, y es a propósito.',
              defaultValue: 0,
              validation: { isRequired: true, min: 0 },
            }),
            imagen: fields.integer({
              label: 'Foto asociada',
              description:
                'Número de orden de la foto que corresponde a esta variante, empezando por 0. Al elegir la variante, la galería salta a esa foto.',
            }),
          }),
          {
            label: 'Variantes',
            description: 'Al menos una. Cada una lleva su propio stock.',
            itemLabel: (props) => props.fields.nombre.value || 'Variante sin nombre',
          }
        ),

        /* ---------- Fotos ---------- */
        imagenes: fields.array(
          fields.object({
            archivo: fields.image({
              label: 'Foto',
              description:
                'Se sube desde acá y se sirve desde el propio dominio, que es lo que hace que el sitio cargue rápido. Recomendado: 800 × 1000 px o más, en vertical.',
              directory: 'public/imagenes/productos',
              publicPath: '/imagenes/productos/',
            }),
            idRemoto: fields.text({
              label: 'Identificador de foto provisoria',
              description:
                'Sólo para las fotos de banco que quedaron del prototipo. Si subiste un archivo arriba, dejá esto vacío: se ignora.',
            }),
            alt: fields.text({
              label: 'Descripción de la foto',
              description:
                'Qué se ve, en una frase. Lo lee quien no puede ver la imagen y lo usa Google. Sin esto el sitio no compila.',
              validation: { isRequired: true, length: { min: 8 } },
            }),
            ancho: fields.integer({ label: 'Ancho en píxeles', defaultValue: 800 }),
            alto: fields.integer({ label: 'Alto en píxeles', defaultValue: 1000 }),
          }),
          {
            label: 'Fotos',
            description:
              'Tres o más, salvo que el proveedor sólo haya mandado una. La primera es la que se ve en la grilla.',
            itemLabel: (props) => props.fields.alt.value || 'Foto sin descripción',
          }
        ),

        /* ---------- Texto ---------- */
        descripcion: fields.text({
          label: 'Descripción',
          description:
            'Dos o tres frases. Qué resuelve y para quién, no una lista de adjetivos. Las medidas van abajo, en especificaciones.',
          multiline: true,
          validation: { isRequired: true, length: { min: 20 } },
        }),

        especificaciones: fields.array(
          fields.object({
            clave: fields.text({ label: 'Dato', validation: { isRequired: true } }),
            valor: fields.text({ label: 'Valor', validation: { isRequired: true } }),
          }),
          {
            label: 'Especificaciones',
            description: 'Por ejemplo: Altura → 210 cm. Aparecen en la columna de compra.',
            itemLabel: (props) =>
              `${props.fields.clave.value || '—'}: ${props.fields.valor.value || '—'}`,
          }
        ),

        /* ---------- Envío ---------- */
        dimensiones: fields.object(
          {
            alto: fields.integer({ label: 'Alto (cm)', defaultValue: 0 }),
            ancho: fields.integer({ label: 'Ancho (cm)', defaultValue: 0 }),
            profundidad: fields.integer({ label: 'Profundidad (cm)', defaultValue: 0 }),
          },
          { label: 'Dimensiones del paquete' }
        ),

        peso: fields.number({
          label: 'Peso (kg)',
          description: 'Define el costo del envío. Con decimales, por ejemplo 14.2.',
          validation: { isRequired: true, min: 0.01 },
        }),

        plazoEnvio: fields.object(
          {
            min: fields.integer({ label: 'Mínimo (días hábiles)', defaultValue: 5 }),
            max: fields.integer({ label: 'Máximo (días hábiles)', defaultValue: 10 }),
          },
          {
            label: 'Plazo de entrega',
            description:
              'El sitio no muestra estos días: los convierte en una fecha real. Conviene ser pesimista, porque una fecha que no se cumple cuesta más que una venta.',
          }
        ),

        /* ---------- Prueba social ---------- */
        rating: fields.number({
          label: 'Puntaje promedio',
          description:
            'De 1 a 5. Dejar vacío si el producto todavía no tiene opiniones: el sitio muestra «Todavía sin opiniones» en lugar de cinco estrellas apagadas.',
        }),

        cantidadOpiniones: fields.integer({
          label: 'Cantidad de opiniones',
          defaultValue: 0,
          validation: { isRequired: true, min: 0 },
        }),

        unidadesVendidas: fields.integer({
          label: 'Unidades vendidas',
          description:
            'Sólo si el dato es real. Vacío significa que el producto no entra en el ranking de más vendidos — que es lo correcto cuando no se sabe.',
        }),

        /* ---------- Presentación ---------- */
        badges: fields.multiselect({
          label: 'Marcas',
          description:
            'Sólo «Oferta», «Más vendido» y «Nuevo» se cargan a mano. «Agotado» y «Últimas unidades» los calcula el sitio del stock real y no aparecen acá a propósito.',
          options: [
            { label: 'Oferta', value: 'oferta' },
            { label: 'Más vendido', value: 'mas_vendido' },
            { label: 'Nuevo', value: 'nuevo' },
          ],
          defaultValue: [],
        }),

        crossSell: fields.array(
          fields.text({ label: 'Dirección del producto' }),
          {
            label: 'Completá el ambiente',
            description:
              'Direcciones de otros productos para sugerir en la ficha. Por ejemplo: puff-tejido-nube. Los agotados se saltean solos.',
            itemLabel: (props) => props.value || 'sin elegir',
          }
        ),
      },
    }),
  },
});
