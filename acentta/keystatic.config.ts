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
  { label: 'Bazar · Vasos y botellas', value: 'vasos-y-botellas' },
  { label: 'Bazar · Termos', value: 'termos' },
  { label: 'Bazar · Mate', value: 'mate' },
  { label: 'Bazar · Café', value: 'cafe' },
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
            { label: 'Bazar', value: 'bazar' },
            { label: 'Decoración', value: 'decoracion' },
            { label: 'Deco inteligente', value: 'deco-inteligente' },
          ],
          defaultValue: 'bazar',
        }),

        categoria: fields.select({
          label: 'Categoría',
          description: 'Tiene que corresponder al rubro elegido arriba.',
          options: [...CATEGORIAS],
          defaultValue: 'vasos-y-botellas',
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
            /* [ERROR CORREGIDO] Esto era `fields.integer`, y las medidas
               de producto tienen decimales: un termo mide 32,8 cm.
               Al no aceptar la coma, «32,8» se guardó como 328 y el
               termo pasó a medir tres metros y veintiocho.

               No dio ningún error: dio un producto enorme, y con él
               una cotización de envío enorme que se le habría cobrado
               a un comprador. El número se ve raro en la ficha, pero
               hay que estar mirando para notarlo. */
            alto: fields.number({
              label: 'Alto (cm)',
              description: 'Del producto, no de la caja. Con decimales: 32.8',
              validation: { isRequired: true, min: 0.1 },
            }),
            ancho: fields.number({
              label: 'Ancho (cm)',
              description: 'En un producto cilíndrico, el diámetro.',
              validation: { isRequired: true, min: 0.1 },
            }),
            profundidad: fields.number({
              label: 'Profundidad (cm)',
              description: 'En un producto cilíndrico, el diámetro otra vez.',
              validation: { isRequired: true, min: 0.1 },
            }),
          },
          {
            /* [ERROR CORREGIDO] Esto decía «Dimensiones del paquete» y
               son las del PRODUCTO. La diferencia no es de redacción:
               el sitio estima la caja sumándole 2 cm por lado a lo que
               se carga acá. Quien leyera la etiqueta y midiera la caja
               real habría hecho que el correo cotice una caja más
               grande de la que viaja, y esa diferencia se le cobra al
               comprador en cada venta. */
            label: 'Medidas del producto',
            description:
              'Medí el producto, no la caja: el sitio le suma el embalaje solo. '
              + 'Con esto y el peso se le pide la tarifa al correo.',
          }
        ),

        peso: fields.number({
          label: 'Peso (kg)',
          description: 'Del producto embalado. Define el costo del envío. Con decimales: 0.6',
          validation: { isRequired: true, min: 0.01 },
        }),

        iva: fields.select({
          label: 'IVA del producto',
          description:
            'Sólo se usa si el sitio muestra el precio sin impuestos. Casi todo va al 21 %.',
          options: [
            { label: '21 % (general)', value: '0.21' },
            { label: '10,5 % (reducida)', value: '0.105' },
            { label: 'Exento', value: '0' },
          ],
          defaultValue: '0.21',
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
          fields.text({
            label: 'Producto relacionado',
            description:
              'El identificador o la dirección del producto, como figura en su ficha. '
              + 'Por ejemplo: b01 o vaso-stanley-quencher-protour-wild-blooms-887.',
          }),
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
