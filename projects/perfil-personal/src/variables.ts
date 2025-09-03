export interface Skill {
  skill: string;
  nivel: number;
  color: string;
  textColor: string;
}
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
