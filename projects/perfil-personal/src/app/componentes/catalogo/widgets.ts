import type { IconName } from 'componentes';

export type ApiEntrada = {
  nombre: string;
  tipo: string;
  // El valor por defecto tal como está escrito en el `input()`. Sin valor
  // quiere decir que llega `undefined` si no se lo pasan.
  porDefecto?: string;
};

export type Widget = {
  // El slug es la URL de la ficha (/componentes/<slug>) y lo que el
  // `@switch` del template usa para elegir la demo.
  slug: string;
  nombre: string;
  selector: string;
  icono: IconName;
  descripcion: string;
  inputs: ApiEntrada[];
  outputs?: ApiEntrada[];
  // El snippet es el mismo markup que dibuja la demo de al lado. Se copia al
  // portapapeles tal cual, así que va con las comillas que van en un template.
  snippet: string;
};

// ponytail: la tabla de la API está escrita a mano, así que un `input()` nuevo
// en la librería no aparece acá hasta que alguien lo agregue. Salida: generar
// las entradas parseando los `input<>()` de cada componente en un script de
// build. No vale el parser todavía: son 11 componentes y cambian poco.
export const WIDGETS: Widget[] = [
  {
    slug: 'avatar',
    nombre: 'Avatar',
    selector: 'lib-avatar',
    icono: 'user',
    descripcion:
      'Foto redonda con el nombre debajo. Si la imagen no carga, muestra ' +
      'el texto de error en su lugar en vez de dejar el hueco.',
    inputs: [
      { nombre: 'imagenUrl', tipo: 'string' },
      { nombre: 'nombre', tipo: 'string' },
      {
        nombre: 'textoError',
        tipo: 'string',
        porDefecto: "'No se pudo cargar la imagen'",
      },
    ],
    snippet:
      '<lib-avatar imagenUrl="LSK-A.jpg" nombre="Ignacio Martín Arano" />',
  },
  {
    slug: 'boton',
    nombre: 'Botón',
    selector: 'lib-boton',
    icono: 'check',
    descripcion:
      'Botón con cuatro estilos y tres tamaños. Con enlace se dibuja ' +
      'como <a>; loading lo deshabilita y le pone el spinner.',
    inputs: [
      { nombre: 'texto', tipo: 'string', porDefecto: "''" },
      { nombre: 'estilo', tipo: "'normal' | 'outline' | 'text' | 'icon'", porDefecto: "'normal'" },
      { nombre: 'tamaño', tipo: "'pequeño' | 'mediano' | 'grande'", porDefecto: "'mediano'" },
      { nombre: 'tipo', tipo: "'button' | 'submit' | 'reset'", porDefecto: "'button'" },
      { nombre: 'color', tipo: 'string' },
      { nombre: 'enlace', tipo: 'string' },
      { nombre: 'icono', tipo: 'string' },
      { nombre: 'clase', tipo: 'string' },
      { nombre: 'deshabilitado', tipo: 'boolean', porDefecto: 'false' },
      { nombre: 'loading', tipo: 'boolean', porDefecto: 'false' },
      { nombre: 'onClick', tipo: '() => void' },
    ],
    snippet: `<lib-boton texto="Guardar" />
<lib-boton estilo="outline" texto="Cancelar" />
<lib-boton estilo="text" texto="Ver más" />
<lib-boton texto="Guardando" [loading]="true" />
<lib-boton tamaño="pequeño" texto="No disponible" [deshabilitado]="true" />`,
  },
  {
    slug: 'dialogo',
    nombre: 'Diálogo',
    selector: 'lib-dialogo',
    icono: 'triangle-alert',
    descripcion:
      'Modal con título, mensaje y una lista de acciones. visible es un ' +
      'model, así que se ata con [(visible)] y el propio diálogo lo baja al ' +
      'cerrarse.',
    inputs: [
      { nombre: 'visible', tipo: 'boolean (model)', porDefecto: 'false' },
      { nombre: 'titulo', tipo: 'string' },
      { nombre: 'mensaje', tipo: 'string' },
      { nombre: 'acciones', tipo: 'DialogoAccion[]', porDefecto: '[]' },
      { nombre: 'ancho', tipo: 'string', porDefecto: "'500px'" },
      { nombre: 'cerrarAlHacerClickAfuera', tipo: 'boolean', porDefecto: 'true' },
    ],
    outputs: [{ nombre: 'alCerrar', tipo: 'void' }],
    snippet: `<lib-dialogo
  mensaje="Se van a borrar los ingredientes cargados."
  titulo="¿Borrar la receta?"
  [acciones]="acciones"
  [(visible)]="dialogoVisible"
/>

// DialogoAccion: { texto, estilo?, color?, icono?, accion? }
acciones = [
  { texto: 'Cancelar', estilo: 'text' as const },
  { texto: 'Borrar', color: '#b04a4a' },
];`,
  },
  {
    slug: 'footer',
    nombre: 'Footer',
    selector: 'lib-footer',
    icono: 'terminal',
    descripcion:
      'Pie con la versión de la librería. Al hacer click abre el CHANGELOG ' +
      'en un <dialog>, renderizado con ngx-markdown y bajado recién ahí.',
    inputs: [
      { nombre: 'changelogUrl', tipo: 'string', porDefecto: "'/CHANGELOG.md'" },
    ],
    snippet: '<lib-footer />',
  },
  {
    slug: 'generador-qr',
    nombre: 'Generador de QR',
    selector: 'lib-generador-qr',
    icono: 'settings',
    descripcion:
      'Widget entero, sin inputs: trae su propio formulario de color, ' +
      'tamaño, forma del punto y logo, y el botón de descarga. Arma el QR ' +
      'detrás de isPlatformBrowser, así que sobrevive al prerender.',
    inputs: [],
    snippet: '<lib-generador-qr />',
  },
  {
    slug: 'icon',
    nombre: 'Icono',
    selector: 'lib-icon',
    icono: 'sparkles',
    descripcion:
      'Los SVG de Lucide inlineados en un @switch: no hay request ni ' +
      'librería de iconos. name está tipado, así que un nombre que no ' +
      'existe no compila.',
    inputs: [
      { nombre: 'name', tipo: 'IconName (requerido)' },
      { nombre: 'size', tipo: 'number', porDefecto: '18' },
      { nombre: 'strokeWidth', tipo: 'number', porDefecto: '1.75' },
      { nombre: 'label', tipo: 'string', porDefecto: "''" },
    ],
    snippet: `<lib-icon name="book-open" [size]="16" />

// ICON_NAMES tiene los nombres en runtime; IconName se deriva de esa lista.
import { ICON_NAMES, type IconName } from 'componentes';`,
  },
  {
    slug: 'libro',
    nombre: 'Libro',
    selector: 'lib-libro',
    icono: 'book',
    descripcion:
      'Tarjeta de portada con título y subtítulo. Con enlace se vuelve ' +
      'clickeable —teclado incluido— y abre en una pestaña nueva.',
    inputs: [
      { nombre: 'imagen', tipo: 'string' },
      { nombre: 'titulo', tipo: 'string' },
      { nombre: 'subtitulo', tipo: 'string' },
      { nombre: 'enlace', tipo: 'string' },
    ],
    snippet: `<lib-libro
  imagen="/img/portadas/la-caballera-esmeralda.jpg"
  subtitulo="Milky Way #1"
  titulo="La caballera esmeralda"
/>`,
  },
  {
    slug: 'panel',
    nombre: 'Panel',
    selector: 'lib-panel',
    icono: 'package',
    descripcion:
      'Caja con texto propio y <ng-content> para el resto. Con ' +
      'colapsable gana cabecera y botón de plegado, con su estado adentro. ' +
      'sombreado y transparente sólo hacen algo si además se le pasa un ' +
      'colorFondo.',
    inputs: [
      { nombre: 'texto', tipo: 'string' },
      { nombre: 'colapsable', tipo: 'boolean', porDefecto: 'false' },
      { nombre: 'colapsado', tipo: 'boolean', porDefecto: 'false' },
      { nombre: 'iconoColapsar', tipo: 'string' },
      { nombre: 'colorFondo', tipo: 'string' },
      { nombre: 'colorTexto', tipo: 'string' },
      { nombre: 'negrita', tipo: 'boolean', porDefecto: 'false' },
      { nombre: 'tamanoFuente', tipo: 'string' },
      { nombre: 'transparente', tipo: 'boolean', porDefecto: 'false' },
      { nombre: 'sombreado', tipo: 'boolean', porDefecto: 'false' },
    ],
    snippet: `<lib-panel texto="Los cambios se guardan solos." />

<lib-panel texto="Detalles" [colapsable]="true">
  <p>Lo que va adentro entra por ng-content.</p>
</lib-panel>`,
  },
  {
    slug: 'redes',
    nombre: 'Redes',
    selector: 'lib-redes',
    icono: 'external-link',
    descripcion:
      'Fila de links a perfiles. Recibe nombre de red y usuario, y arma la ' +
      'URL y el SVG de cada una. Conoce twitter, github y linkedin.',
    inputs: [{ nombre: 'redes', tipo: 'Red[]', porDefecto: '[]' }],
    snippet: `<lib-redes [redes]="redes" />

// Red: { nombre, usuario, tipo?, formato?, size? }
redes = [
  { nombre: 'github', usuario: 'T4toh' },
  { nombre: 'linkedin', usuario: 'ignacio-arano' },
];`,
  },
  {
    slug: 'skill-bar',
    nombre: 'Skill bar',
    selector: 'lib-skill-bar',
    icono: 'arrow-down-a-z',
    descripcion:
      'Chip con el nombre de una tecnología y el relleno al porcentaje que ' +
      'se le pase. Es el que dibuja la lista de skills del sidebar.',
    inputs: [
      { nombre: 'skill', tipo: 'string' },
      { nombre: 'nivel', tipo: 'number', porDefecto: '0' },
      { nombre: 'color', tipo: 'string', porDefecto: "'blue'" },
      { nombre: 'textColor', tipo: 'string', porDefecto: "'#333'" },
    ],
    snippet: `<lib-skill-bar color="#5b5bab" skill="Angular" [nivel]="90" />`,
  },
  {
    slug: 'tag',
    nombre: 'Tag',
    selector: 'lib-tag',
    icono: 'pen-tool',
    descripcion:
      'Etiqueta chica con icono opcional. El icono es el texto que se le ' +
      'pase —un emoji, una letra—, no un nombre de lib-icon.',
    inputs: [
      { nombre: 'texto', tipo: 'string' },
      { nombre: 'icono', tipo: 'string' },
      { nombre: 'colorFondo', tipo: 'string' },
      { nombre: 'colorTexto', tipo: 'string' },
    ],
    snippet: `<lib-tag texto="angular" />
<lib-tag icono="🚀" texto="deploy" />`,
  },
];
