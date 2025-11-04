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

export type Apk = {
  nombre: string;
  descripcion: string;
  version: string;
  url: string;
  icono?: string;
  color: string;
};

export const APKS: Apk[] = [
  {
    nombre: 'Kanji no Ryoushi - 漢字の漁師',
    descripcion: 'OCR orientado al Japonés',
    version: 'v0.0.2',
    url: 'https://github.com/T4toh/Kanji-no-Ryoushi/releases/download/v0.0.2/kanji_no_ryoushi.apk',
    icono: '🎣 🗾',
    color: 'indigo',
  },
  // Agrega más APKs aquí
];
