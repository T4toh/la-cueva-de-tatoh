import { Ejercicio } from './modelo';

export const EJERCICIOS: readonly Ejercicio[] = [
  {
    id: 'sentadilla-banco',
    nombre: 'Sentadilla a banco',
    como: 'Parate de espaldas a un banco o escalón. Bajá la cola hasta rozarlo y subí empujando con los talones.',
    necesita: 'banco',
    medida: 'reps',
  },
  {
    id: 'sentadilla-libre',
    nombre: 'Sentadilla libre',
    como: 'Pies al ancho de los hombros. Bajá con la espalda derecha hasta que los muslos queden paralelos y subí.',
    medida: 'reps',
  },
  {
    id: 'sentadilla-pausa',
    nombre: 'Sentadilla con pausa',
    como: 'Bajá como en la sentadilla libre y quedate abajo dos segundos. Subí fuerte y sin rebotar.',
    medida: 'reps',
  },
  {
    id: 'silla-pared',
    nombre: 'Silla en la pared',
    como: 'Apoyá la espalda en la pared y bajá hasta formar una silla con las piernas. Aguantá sin apoyar las manos.',
    necesita: 'pared',
    medida: 'segundos',
  },
  {
    id: 'flexion-pared',
    nombre: 'Flexión en pared',
    como:
      'Apoyá las manos en la pared a la altura del pecho. Acercá el ' +
      'pecho y empujá para volver, con el cuerpo recto.',
    necesita: 'pared',
    medida: 'reps',
  },
  {
    id: 'flexion-banco',
    nombre: 'Flexión en banco',
    como: 'Manos en el borde del banco y cuerpo en línea recta. Bajá el pecho hacia el banco y empujá.',
    necesita: 'banco',
    medida: 'reps',
  },
  {
    id: 'flexion-inclinada-baja',
    nombre: 'Flexión inclinada baja',
    como:
      'Manos en un escalón bajo, cuerpo recto de cabeza a talones. Bajá ' +
      'el pecho al borde y subí sin arquear la espalda.',
    necesita: 'banco',
    medida: 'reps',
  },
  {
    id: 'flexion-piso',
    nombre: 'Flexión en el piso',
    como:
      'Manos bajo los hombros y cuerpo recto. Bajá hasta casi tocar el piso ' +
      'con el pecho y empujá. Si no podés, apoyá las rodillas.',
    necesita: 'piso',
    medida: 'reps',
  },
  {
    id: 'puente-gluteo',
    nombre: 'Puente de glúteo',
    como:
      'Acostado boca arriba, rodillas dobladas y pies apoyados. Levantá ' +
      'la cadera apretando los glúteos y bajá lento.',
    necesita: 'piso',
    medida: 'reps',
  },
  {
    id: 'zancada-atras',
    nombre: 'Zancada atrás',
    como:
      'Da un paso largo hacia atrás y bajá la rodilla trasera casi al piso. ' +
      'Volvé empujando con la pierna de adelante y alterná.',
    medida: 'reps',
  },
  {
    id: 'zancada-caminando',
    nombre: 'Zancada caminando',
    como: 'Da un paso largo al frente y bajá la rodilla trasera. Empujá y pasá directo a la otra pierna, avanzando.',
    medida: 'reps',
  },
  {
    id: 'plancha-rodillas',
    nombre: 'Plancha con rodillas',
    como: 'Apoyá antebrazos y rodillas, con el cuerpo recto de las rodillas a la cabeza. Aguantá apretando la panza.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'plancha',
    nombre: 'Plancha',
    como:
      'Apoyá antebrazos y puntas de los pies, con el cuerpo recto. ' +
      'Apretá panza y glúteos y no dejes caer la cadera.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'escaladores',
    nombre: 'Escaladores',
    como: 'En posición de flexión, llevá una rodilla al pecho y cambiá de pierna a buen ritmo. Mantené la cadera baja.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'puente-una-pierna',
    nombre: 'Puente a una pierna',
    como:
      'Hacé el puente con una pierna estirada en el aire. Subí y bajá la ' +
      'cadera con la otra y cambiá a mitad de tiempo.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'circulos-hombros',
    nombre: 'Círculos de hombros',
    como: 'Brazos sueltos. Hacé círculos grandes con los hombros hacia atrás y después hacia adelante.',
    medida: 'segundos',
  },
  {
    id: 'gato-vaca',
    nombre: 'Gato y vaca',
    como:
      'En cuatro apoyos, redondeá la espalda mirando al ombligo y después ' +
      'hundila mirando al frente. Lento y con el aire.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'rotacion-columna',
    nombre: 'Rotación de columna',
    como: 'Sentado o parado, girá el torso hacia un lado llevando la mirada atrás. Volvé al centro y cambiá de lado.',
    medida: 'segundos',
  },
  {
    id: 'estirada-cadera',
    nombre: 'Estirada de cadera',
    como:
      'Una rodilla abajo y la otra pierna adelante. Empujá la cadera al ' +
      'frente hasta sentir el estiramiento y cambiá de lado.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'estirada-cuadriceps',
    nombre: 'Estirada de cuádriceps',
    como:
      'Parado, llevá un talón hacia la cola con la mano. Mantené las ' +
      'rodillas juntas y apoyate en algo si hace falta.',
    medida: 'segundos',
  },
  {
    id: 'estirada-isquios',
    nombre: 'Estirada de isquios',
    como:
      'Con una pierna estirada adelante y el talón apoyado, inclinate con la ' +
      'espalda recta hasta sentir la parte de atrás del muslo.',
    medida: 'segundos',
  },
  {
    id: 'estirada-pantorrillas',
    nombre: 'Estirada de pantorrillas',
    como: 'Apoyá las manos en la pared y llevá una pierna atrás con el talón en el piso. Empujá la cadera adelante.',
    necesita: 'pared',
    medida: 'segundos',
  },
  {
    id: 'apertura-pecho',
    nombre: 'Apertura de pecho',
    como: 'Entrelazá las manos detrás de la espalda, estirá los brazos y abrí el pecho mirando al frente.',
    medida: 'segundos',
  },
];

export function ejercicio(id: string): Ejercicio {
  const e = EJERCICIOS.find((x) => x.id === id);
  if (!e) {
    throw new Error(`Ejercicio desconocido: ${id}`);
  }
  return e;
}
