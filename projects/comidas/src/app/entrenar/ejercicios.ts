import { Ejercicio, Necesidad } from './modelo';

export const TEXTO_NECESIDAD: Record<Necesidad, string> = {
  banco: 'un escalón o banco',
  piso: '2 m² de piso',
  pared: 'una pared',
  'tramo-trote': 'un tramo donde puedas trotar',
};

export const EJERCICIOS: readonly Ejercicio[] = [
  {
    id: 'sentadilla-banco',
    nombre: 'Sentadilla a banco',
    como: 'Parate de espaldas a un banco o escalón. Bajá la cola hasta rozarlo y subí empujando con los talones.',
    ojo: 'Que las rodillas no se vayan hacia adentro y que los talones no se despeguen.',
    necesita: 'banco',
    medida: 'reps',
  },
  {
    id: 'sentadilla-libre',
    nombre: 'Sentadilla libre',
    como: 'Pies al ancho de los hombros. Bajá con la espalda derecha hasta que los muslos queden paralelos y subí.',
    ojo: 'Los talones quedan apoyados todo el tiempo; si se levantan, bajá menos.',
    medida: 'reps',
  },
  {
    id: 'sentadilla-pausa',
    nombre: 'Sentadilla con pausa',
    como: 'Bajá como en la sentadilla libre y quedate abajo dos segundos. Subí fuerte y sin rebotar.',
    ojo: 'En la pausa no aflojes: quedate firme abajo, sin sentarte sobre los talones.',
    medida: 'reps',
  },
  {
    id: 'silla-pared',
    nombre: 'Silla en la pared',
    como: 'Apoyá la espalda en la pared y bajá hasta formar una silla con las piernas. Aguantá sin apoyar las manos.',
    ojo: 'Las rodillas quedan sobre los tobillos, no más adelante que la punta de los pies.',
    necesita: 'pared',
    medida: 'segundos',
  },
  {
    id: 'flexion-pared',
    nombre: 'Flexión en pared',
    como:
      'Apoyá las manos en la pared a la altura del pecho. Acercá el ' +
      'pecho y empujá para volver, con el cuerpo recto.',
    ojo: 'Cadera alineada con el cuerpo: que no quede atrás ni se arquee la espalda.',
    necesita: 'pared',
    medida: 'reps',
  },
  {
    id: 'flexion-banco',
    nombre: 'Flexión en banco',
    como: 'Manos en el borde del banco y cuerpo en línea recta. Bajá el pecho hacia el banco y empujá.',
    ojo: 'Codos a unos 45° del cuerpo, no abiertos en cruz.',
    necesita: 'banco',
    medida: 'reps',
  },
  {
    id: 'flexion-inclinada-baja',
    nombre: 'Flexión inclinada baja',
    como:
      'Manos en un escalón bajo, cuerpo recto de cabeza a talones. Bajá ' +
      'el pecho al borde y subí sin arquear la espalda.',
    ojo: 'Si la cadera se cae o los codos se abren, volvé a la flexión en banco.',
    necesita: 'banco',
    medida: 'reps',
  },
  {
    id: 'puente-gluteo',
    nombre: 'Puente de glúteo',
    como:
      'Acostado boca arriba, rodillas dobladas y pies apoyados. Levantá ' +
      'la cadera apretando los glúteos y bajá lento.',
    ojo: 'Arriba, la fuerza la hacen los glúteos: no arquees la zona lumbar.',
    necesita: 'piso',
    medida: 'reps',
  },
  {
    id: 'zancada-atras',
    nombre: 'Zancada atrás',
    como:
      'Da un paso largo hacia atrás y bajá la rodilla trasera casi al piso. ' +
      'Volvé empujando con la pierna de adelante y alterná.',
    ojo: 'La rodilla de adelante queda sobre el tobillo y apunta al pie.',
    medida: 'reps',
  },
  {
    id: 'zancada-caminando',
    nombre: 'Zancada caminando',
    como: 'Da un paso largo al frente y bajá la rodilla trasera. Empujá y pasá directo a la otra pierna, avanzando.',
    ojo: 'Pasos largos y torso derecho; si perdés el equilibrio, hacela en el lugar.',
    medida: 'reps',
  },
  {
    id: 'plancha-rodillas',
    nombre: 'Plancha con rodillas',
    como: 'Apoyá antebrazos y rodillas, con el cuerpo recto de las rodillas a la cabeza. Aguantá apretando la panza.',
    ojo: 'Que la cola no quede para arriba: rodillas, cadera y hombros en línea.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'plancha',
    nombre: 'Plancha',
    como:
      'Apoyá antebrazos y puntas de los pies, con el cuerpo recto. ' +
      'Apretá panza y glúteos y no dejes caer la cadera.',
    ojo: 'Si la cadera empieza a caer, cortá antes: vale más poco tiempo bien hecho.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'rodillas-altas',
    nombre: 'Rodillas altas',
    como: 'Parado, marchá en el lugar llevando las rodillas a la cadera, a ritmo parejo y con la panza firme.',
    ojo: 'Pisá suave con la punta del pie y mantené el torso derecho.',
    medida: 'segundos',
  },
  {
    id: 'puente-una-pierna',
    nombre: 'Puente a una pierna',
    como:
      'Hacé el puente con una pierna estirada en el aire. Subí y bajá la ' +
      'cadera con la otra y cambiá a mitad de tiempo.',
    ojo: 'La cadera sube pareja, sin que se incline hacia el lado de la pierna en el aire.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'circulos-hombros',
    nombre: 'Círculos de hombros',
    como: 'Brazos sueltos. Hacé círculos grandes con los hombros hacia atrás y después hacia adelante.',
    ojo: 'Movés los hombros, no el cuello: la cabeza queda quieta.',
    medida: 'segundos',
  },
  {
    id: 'gato-vaca',
    nombre: 'Gato y vaca',
    como:
      'En cuatro apoyos, redondeá la espalda mirando al ombligo y después ' +
      'hundila mirando al frente. Lento y con el aire.',
    ojo: 'Sin forzar ninguna de las dos puntas; el movimiento es lento y sin dolor.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'rotacion-columna',
    nombre: 'Rotación de columna',
    como: 'Sentado o parado, girá el torso hacia un lado llevando la mirada atrás. Volvé al centro y cambiá de lado.',
    ojo: 'Gira el torso, la cadera queda mirando al frente.',
    medida: 'segundos',
  },
  {
    id: 'estirada-cadera',
    nombre: 'Estirada de cadera',
    como:
      'Una rodilla abajo y la otra pierna adelante. Empujá la cadera al ' +
      'frente hasta sentir el estiramiento y cambiá de lado.',
    ojo: 'La espalda queda derecha: el estiramiento viene de empujar la cadera, no de arquearse.',
    necesita: 'piso',
    medida: 'segundos',
  },
  {
    id: 'estirada-cuadriceps',
    nombre: 'Estirada de cuádriceps',
    como:
      'Parado, llevá un talón hacia la cola con la mano. Mantené las ' +
      'rodillas juntas y apoyate en algo si hace falta.',
    ojo: 'Rodillas juntas y cadera adelante; si tira en la rodilla, soltá un poco.',
    medida: 'segundos',
  },
  {
    id: 'estirada-isquios',
    nombre: 'Estirada de isquios',
    como:
      'Apoyá el talón adelante, en el piso o en un escalón bajo, con la pierna estirada. ' +
      'Inclinate con la espalda recta hasta sentir la parte de atrás del muslo.',
    ojo: 'Te inclinás desde la cadera con la espalda recta, no redondeando la espalda.',
    medida: 'segundos',
  },
  {
    id: 'estirada-pantorrillas',
    nombre: 'Estirada de pantorrillas',
    como: 'Apoyá las manos en la pared y llevá una pierna atrás con el talón en el piso. Empujá la cadera adelante.',
    ojo: 'El talón de atrás no se despega del piso y el pie apunta al frente.',
    necesita: 'pared',
    medida: 'segundos',
  },
  {
    id: 'apertura-pecho',
    nombre: 'Apertura de pecho',
    como: 'Entrelazá las manos detrás de la espalda, estirá los brazos y abrí el pecho mirando al frente.',
    ojo: 'Los hombros van atrás y abajo, lejos de las orejas.',
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
