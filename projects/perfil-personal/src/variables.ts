export type Skill = {
  skill: string;
  nivel: number;
  color: string;
  textColor: string;
};
export const SKILLS: Skill[] = [
  // Habilidades Técnicas
  // Básicas
  { skill: 'HTML', nivel: 90, color: '#E34F26', textColor: '#fff' },
  { skill: 'CSS', nivel: 80, color: '#1572B6', textColor: '#fff' },
  { skill: 'JavaScript', nivel: 80, color: '#F7DF1E', textColor: '#000' },
  { skill: 'TypeScript', nivel: 95, color: '#3178C6', textColor: '#fff' },
  { skill: 'Python', nivel: 50, color: '#3776AB', textColor: '#fff' },
  // Frameworks y Librerías
  { skill: 'Angular', nivel: 90, color: '#DD0031', textColor: '#fff' },
  { skill: 'React', nivel: 50, color: '#61DAFB', textColor: '#000' },
  { skill: 'Node.js', nivel: 90, color: '#339933', textColor: '#fff' },
  { skill: 'Express.js', nivel: 70, color: '#000000', textColor: '#fff' },
  { skill: 'NestJS', nivel: 80, color: '#E0234E', textColor: '#fff' },
  { skill: 'Openlayers', nivel: 80, color: '#339933', textColor: '#fff' },
  { skill: 'Google Maps API', nivel: 70, color: '#4285F4', textColor: '#fff' },
  { skill: 'Capacitor', nivel: 60, color: '#3367D6', textColor: '#fff' },
  { skill: 'Flutter', nivel: 40, color: '#02569B', textColor: '#fff' },
  // Bases de Datos
  { skill: 'MongoDB', nivel: 85, color: '#47A248', textColor: '#fff' },
  { skill: 'SQL', nivel: 45, color: '#003B57', textColor: '#fff' },
  // Control de Versiones y Otros
  { skill: 'Git', nivel: 80, color: '#F05032', textColor: '#fff' },
  { skill: 'GitHub', nivel: 95, color: '#181717', textColor: '#fff' },
  { skill: 'Docker', nivel: 90, color: '#2496ED', textColor: '#fff' },
  { skill: 'Kubernetes', nivel: 80, color: '#326CE5', textColor: '#fff' },
  { skill: 'Google Cloud', nivel: 60, color: '#4285F4', textColor: '#fff' },
  { skill: 'Linux', nivel: 90, color: '#FCC624', textColor: '#000' },
  { skill: 'CI/CD', nivel: 70, color: '#4B0082', textColor: '#fff' },
];

export type Interes = {
  nombre: string;
  icono: string;
  color: string;
  textColor: string;
};
export const INTERESES: Interes[] = [
  // Intereses Personales
  // Libros, metal, literatura, manga, japonés, fútbol, juegos, tecnología, linux, comida
  // Astronomía, ciencia, dungeons and dragons
  { nombre: 'Libros', icono: '📚', color: '#6F4E37', textColor: '#fff' },
  { nombre: 'Metal', icono: '🤘', color: '#000000', textColor: '#fff' },
  { nombre: 'Literatura', icono: '🖋️', color: '#8B4513', textColor: '#fff' },
  { nombre: 'Manga', icono: '📖', color: '#FF4500', textColor: '#fff' },
  { nombre: 'Japonés', icono: '🗾', color: '#DC143C', textColor: '#fff' },
  { nombre: 'Fútbol', icono: '⚽', color: '#228B22', textColor: '#fff' },
  { nombre: 'Juegos', icono: '🎮', color: '#1E90FF', textColor: '#fff' },
  { nombre: 'Tecnología', icono: '💻', color: '#4B0082', textColor: '#fff' },
  { nombre: 'Linux', icono: '🐧', color: '#FCC624', textColor: '#000' },
  { nombre: 'Comida', icono: '🍣', color: '#FF6347', textColor: '#fff' },
  { nombre: 'Astronomía', icono: '🌌', color: '#00008B', textColor: '#fff' },
  { nombre: 'Ciencia', icono: '🔬', color: '#2E8B57', textColor: '#fff' },
  {
    nombre: 'Dungeons & Dragons',
    icono: '🐉',
    color: '#8B0000',
    textColor: '#fff',
  },
];

export type Red = {
  nombre: string;
  usuario: string;
  tipo?: 'logo' | 'tc';
  formato?: 'svg' | 'png';
  size?: number;
};

export const REDES: Red[] = [
  { nombre: 'github', usuario: 'T4toh' },
  { nombre: 'linkedin', usuario: 'in/ignacio-martín-arano-ba787353' },
];

import type { IconName } from 'componentes';

export type Apk = {
  nombre: string;
  descripcion: string;
  version: string;
  url: string;
  icono?: IconName;
  color: string;
  tipo?: 'android' | 'desktop';
  nota?: string;
};

export const APKS: Apk[] = [
  {
    nombre: 'Kanji no Ryoushi - 漢字の漁師',
    descripcion: 'OCR orientado al Japonés',
    version: 'v0.0.4',
    url: 'https://github.com/T4toh/Kanji-no-Ryoushi/releases/download/v0.0.4/kanji_no_ryoushi.apk',
    icono: 'languages',
    color: 'indigo',
  },
  {
    nombre: 'Contador de Truco',
    descripcion: 'Nombre autodescriptivo',
    version: 'v0.0.1',
    url: 'https://github.com/T4toh/contador-de-truco/releases/download/v0.0.1/contador_de_truco.apk',
    icono: 'swords',
    color: 'midnightblue',
  },
  {
    nombre: 'tWriter',
    descripcion:
      'Editor de novelas con conversor de diálogos RAE y export a EPUB. Tauri 2 + Angular.',
    version: 'alpha',
    url: 'https://github.com/T4toh/tWriter',
    icono: 'pen-tool',
    color: '#4a3a8e',
    tipo: 'desktop',
    nota: 'Pronto en AUR',
  },
  {
    nombre: 'Dokusho Renshuu - 読書練習',
    descripcion:
      'Lector de japonés con diccionario de kanji, historias precargadas ' +
      '(Momotarō, Kintarō) y export de cartas a Anki.',
    version: 'v0.1.0-beta.3',
    url: 'https://github.com/T4toh/dokusho-renshuu/releases/download/v0.1.0-beta.3/app-release.apk',
    icono: 'book-open',
    color: '#7F52FF',
  },
  // Agrega más APKs aquí
];

// Lo que se muestra en el landing y no es ni una APK ni un libro: repos y
// sitios. Se cura a mano en vez de leer la API de GitHub, así el HTML sale
// entero del prerender y no hay forks ni experimentos colgados en la vidriera.
export type Proyecto = {
  nombre: string;
  descripcion: string;
  url: string;
  icono: IconName;
  color: string;
  // Qué te llevás al hacer click: 'repo' abre GitHub, 'web' abre el sitio.
  tipo: 'repo' | 'web';
};

export const PROYECTOS: Proyecto[] = [
  {
    nombre: 'Cyberpunk 2077 Mod Manager',
    descripcion:
      'Gestor de mods de Cyberpunk 2077 para Linux y Steam Deck. Fork de ' +
      'NexusMods.App, que quedó discontinuado.',
    url: 'https://github.com/T4toh/cp2077-mm',
    icono: 'gamepad-2',
    color: '#fcee0a',
    tipo: 'repo',
  },
  {
    nombre: 'Comidas',
    descripcion:
      'Planificador de comidas semanal con lista de compras. Angular y ' +
      'Firebase, también como app de Android.',
    url: 'https://comidas.tatoh.ar',
    icono: 'utensils',
    color: '#2E8B57',
    tipo: 'web',
  },
  {
    nombre: 'Jitendex Parser',
    descripcion:
      'Convierte el diccionario Jitendex a SQLite para consultarlo desde ' +
      'una app Flutter.',
    url: 'https://github.com/T4toh/jitendex-parser',
    icono: 'terminal',
    color: '#3776AB',
    tipo: 'repo',
  },
  {
    nombre: 'KDE Indigo',
    descripcion: 'Tema piola para KDE.',
    url: 'https://github.com/T4toh/kde-indigo',
    icono: 'laptop',
    color: '#1d99f3',
    tipo: 'repo',
  },
];

export type Post = {
  title: string;
  src: string;
  fecha: string;
  tags?: string[];
  // Lo que sale como og:description del post. Opcional: sin esto cae en
  // DESCRIPCION_SITIO. No se puede sacar del markdown porque el cuerpo lo baja
  // el browser por HTTP y el prerender no lo tiene.
  descripcion?: string;
};

export const POSTS: Post[] = [
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #1',
    src: 'posts/japones-1.md',
    fecha: '3/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Estoy aprendiendo japonés con el curso de Cure Dolly y quiero respaldar en ' +
      'texto lo que vengo viendo. Primer paso: meterse los kanas en la cabeza.',
  },
  {
    title: 'Installar Warp en Fedora',
    src: 'posts/instalar-warp-fedora.md',
    fecha: '4/11/25',
    tags: ['linux', 'fedora', 'terminal'],
    descripcion:
      'Warp siempre fue un dolor de instalar en Fedora porque no había repo RPM. ' +
      'Ahora sí lo hay, así que instalarla y actualizarla son dos comandos.',
  },
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #2',
    src: 'posts/japones-2.md',
    fecha: '5/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Cure Dolly sigue con el sujeto tácito como segunda lección, cosa que suena ' +
      'rara si venís del español, donde el sujeto tácito es lo normal.',
  },
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #3',
    src: 'posts/japones-3.md',
    fecha: '7/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Por fin llega 「は」, la partícula que marca el tema de la oración y que se ' +
      'confunde todo el tiempo con 「が」.',
  },
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #3.5',
    src: 'posts/japones-4.md',
    fecha: '7/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'La comparación entre 「は」 y 「が」 se hizo larga: la otra mitad de la lección ' +
      'va acá.',
  },
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #4',
    src: 'posts/japones-5.md',
    fecha: '10/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Teoría antes de la lección: cómo se ordenan las formas del verbo en presente ' +
      'y en pasado, y qué hace distinto el japonés.',
  },
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #5',
    src: 'posts/japones-6.md',
    fecha: '12/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Cómo se arman los verbos en japonés: los tres grupos —Ichidan 「一段」, Godan ' +
      '「五段」 e irregulares 「不規則」— y de dónde sale cada forma.',
  },

  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #5.5',
    src: 'posts/japones-7.md',
    fecha: '12/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Segunda parte: cómo armar la forma 「て」. En japonés los verbos no se ' +
      'conjugan, cambian de forma para engancharles funciones.',
  },
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #6',
    src: 'posts/japones-8.md',
    fecha: '20/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Los adjetivos y la partícula 「の」, pero al revés que Cure Dolly: primero la ' +
      'partícula, que ya veníamos usando sin darnos cuenta.',
  },
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #7',
    src: 'posts/japones-9.md',
    fecha: '28/11/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Negar con 「ない」: el adjetivo más básico del japonés, y el que sirve para ' +
      'negar cualquier cosa.',
  },
  {
    title: '¡Primer libro en Amazon!',
    src: 'posts/la-caballera-esmeralda.md',
    fecha: '28/11/25',
    tags: ['libros', 'meridian', 'fantasia'],
    descripcion:
      'Publiqué mi primera novela de Meridian en Amazon: fantasía barata, romance ' +
      'y acción. Detesto los blurbs, así que esto es lo que hay.',
  },
  {
    title: 'Aprendiendo Japonés con un Gordo Barbudo #8',
    src: 'posts/japones-10.md',
    fecha: '29/12/25',
    tags: ['japonés', 'lenguaje'],
    descripcion:
      'Lo más jodido según internet: las ramas de los verbos. No son conjugaciones, ' +
      'el verbo cambia de rama para engancharle funciones.',
  },
  {
    title: 'tWriter - Escribiendo como un gordo barbudo',
    src: 'posts/twriter.md',
    fecha: '11/5/26',
    tags: ['linux', 'rust', 'angular', 'tauri', 'escritura'],
    descripcion:
      'Escribir una novela eran cuatro herramientas sin conexión entre ellas. ' +
      'tWriter es el intento de juntarlas en una sola.',
  },
  {
    title: 'Más que un Trabajo — Meridian #2',
    src: 'posts/mas-que-un-trabajo.md',
    fecha: '3/9/26',
    tags: ['libros', 'meridian', 'fantasia'],
    descripcion:
      'Segunda novela de Meridian, ya en Amazon. Aedan y sus compañeros llegan a ' +
      'Brickwell como invitados, dispuestos a pasar unos días lejos de los caminos.',
  },
  {
    title: 'Deployment — Milky Way #1',
    src: 'posts/deployment.md',
    fecha: '3/9/26',
    tags: ['libros', 'milky-way', 'space-opera'],
    descripcion:
      'Primera novela de Milky Way y la primera que escribo en inglés: space ' +
      'opera. John nunca salió del sistema solar, y su primer trabajo lo saca.',
  },
];

// Dominio público del sitio. Solo se usa para armar og:url absoluto:
// los crawlers (WhatsApp, Twitter) no resuelven URLs relativas.
export const SITIO_URL = 'https://tatoh.ar';
export const TITULO_SITIO = 'Ignacio Martín Arano';

// Piso de los previews: lo que ve un chat cuando la ruta no aporta nada más
// específico. La imagen tiene que existir en `public/`, porque el checker
// verifica que el og:image esté de verdad en el build.
export const DESCRIPCION_SITIO =
  'Portfolio, blog y libros de Ignacio Martín Arano: desarrollo, Angular, ' +
  'Linux, japonés y fantasía.';
export const IMAGEN_SITIO = '/LSK-A.jpg';

// Cada tienda dibuja su propio logo en el botón de compra. Sumar una es
// agregar el nombre acá y su `@case` en logo-tienda; sin `@case` cae en el
// ícono genérico de libro, que es lo que pasa hoy con 'nook'.
export type LogoTienda =
  'amazon' | 'kobo' | 'apple-books' | 'google-play' | 'nook';

export type Tienda = {
  nombre: string;
  url: string;
  logo: LogoTienda;
};

// Los perfiles de autor que muestra el navegador de arriba, uno por tienda.
// Es una lista y no un link suelto para que sumar Google Play y Apple Books
// cuando existan los listados sea agregar una entrada. Una tienda sin URL no
// va acá: preferimos que no se dibuje antes que un link muerto.
export const TIENDAS_AUTOR: Tienda[] = [
  {
    nombre: 'Amazon',
    url:
      'https://www.amazon.com/s?i=digital-text&rh=p_27%3AIgnacio%2BMart%25C3%25' +
      'ADn%2BArano&s=relevancerank&text=Ignacio%20Mart%C3%ADn%20Arano',
    logo: 'amazon',
  },
];

export type Libro = {
  // El slug es la URL del libro (/libros/<slug>) y va impresa dentro del EPUB.
  // Una vez publicado no se cambia: rompería los links de las copias vendidas.
  slug: string;
  titulo: string;
  // Ruta absoluta desde la raíz del sitio (/img/portadas/...). Se sirve
  // desde el repo a propósito: una URL de Amazon la controla Amazon, y si
  // cambia el listado se rompe el og:image sin que nos enteremos.
  imagen: string;
  // Saga y orden van separados a propósito: `/libros` agrupa por `saga` y
  // ordena por `numero`. La etiqueta "Milky Way #1" la arma quien la muestra.
  saga: string;
  numero: number;
  sinopsis: string;
  tiendas: Tienda[];
};

export const LIBROS: Libro[] = [
  // Agrega tus libros aquí
  {
    slug: 'la-caballera-esmeralda',
    titulo: 'La Caballera Esmeralda',
    saga: 'Meridian',
    numero: 1,
    imagen: '/img/portadas/la-caballera-esmeralda.jpg',
    sinopsis: [
      'Aedan, por fin, puede dejar atrás la obligada prisión de su hogar y',
      'explorar el reino que hasta ahora solo conocía por historias.',
      '',
      'Junto a su hermana y su mejor amigo, está listo para dar el primer paso',
      'y comenzar su vida como cazador de monstruos.',
      '',
      'El mundo está ahí afuera. Es hora de conocerlo.',
    ].join('\n'),
    tiendas: [
      {
        nombre: 'Amazon',
        url: 'https://www.amazon.com/dp/B0G3JTSR43',
        logo: 'amazon',
      },
    ],
  },
  {
    slug: 'mas-que-un-trabajo',
    titulo: 'Más que un Trabajo',
    saga: 'Meridian',
    numero: 2,
    imagen: '/img/portadas/mas-que-un-trabajo.jpg',
    sinopsis: [
      'Aedan y sus compañeros llegan a Brickwell como invitados, dispuestos a',
      'pasar unos días lejos de los caminos.',
      '',
      'Un nuevo pueblo, nuevas personas y nuevas experiencias esperan a los',
      'cuatro.',
      '',
      'Pero para un cazador de monstruos, incluso una visita puede terminar',
      'siendo más que un trabajo.',
    ].join('\n'),
    tiendas: [
      {
        nombre: 'Amazon',
        url: 'https://www.amazon.com/dp/B0HHKNV1QP',
        logo: 'amazon',
      },
    ],
  },
  {
    slug: 'deployment',
    titulo: 'Deployment',
    imagen: '/img/portadas/deployment.jpg',
    saga: 'Milky Way',
    numero: 1,
    // La novela está escrita en inglés. Va la traducción primero porque el
    // primer párrafo es el que sale como og:description y el sitio está en
    // español; abajo, el blurb original.
    sinopsis: [
      'John nunca salió del sistema solar.',
      '',
      'Después de una vida miserable en la Tierra, su primer trabajo lo lleva',
      'de Marte a Elysium.',
      '',
      'Es la primera vez que se aleja de casa. Lo espera un mundo nuevo, lleno',
      'de gente, culturas y lugares de los que solo escuchó hablar.',
      '',
      'John está por descubrir que la humanidad es apenas una parte pequeña de',
      'una galaxia mucho más grande.',
      '',
      'Y para alguien que pasó toda su vida sabiendo tan poco del mundo más',
      'allá de la Tierra, queda mucho por descubrir.',
      '',
      '---',
      '',
      '*Escrita en inglés. El blurb original:*',
      '',
      'John has never left the Sol system.',
      '',
      'After a miserable life on Earth, his first job takes him from Mars to',
      'Elysium.',
      '',
      'It is the first time he has ever left home. A new world awaits him,',
      'filled with people, cultures, and places he has only ever heard about.',
      '',
      'John is about to discover that humanity is only a small part of a much',
      'larger galaxy.',
      '',
      'And for someone who has spent his entire life knowing so little of the',
      'world beyond Earth, there is a lot left to discover.',
    ].join('\n'),
    // Faltan Google Play y Apple Books: los dos tienen su `@case` en
    // logo-tienda, así que darlos de alta es agregar la entrada con su URL.
    tiendas: [
      {
        nombre: 'Amazon',
        url: 'https://www.amazon.com/dp/B0HHR3XX88',
        logo: 'amazon',
      },
    ],
  },
];
