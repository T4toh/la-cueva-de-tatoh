import { describe, expect, it } from 'vitest';

// El Worker de `/r/*` (projects/comidas/worker/index.js). Lo que se testea acá
// es su lógica pura: `HTMLRewriter` y el binding `ASSETS` no existen fuera del
// runtime de Workers, así que el `fetch` se sigue verificando a mano con
// `wrangler dev`.
import {
  describir,
  ID_VALIDO,
  imagenDe,
  normalizar,
} from '../../worker/index.js';

describe('ID_VALIDO', () => {
  it('acepta el id de ocho caracteres que genera la publicación', () => {
    expect(ID_VALIDO.test('a1b2c3d4')).toBe(true);
  });

  it('rechaza lo que no es un id, sin pegarle a Firestore', () => {
    // Es la guarda de la que cuelga que un path raro no se convierta en una
    // llamada a la REST de Firestore con basura pegada.
    for (const malo of ['', 'corto', 'demasiadolargo', 'A1B2C3D4', '../secreto', 'a1b2c3d!']) {
      expect(ID_VALIDO.test(malo)).toBe(false);
    }
  });
});

describe('normalizar', () => {
  it('lee la forma REST de Firestore', () => {
    const receta = normalizar({
      nombre: { stringValue: 'Milanesas' },
      descripcion: { stringValue: 'Con puré' },
      alias: { stringValue: 'Tatoh' },
      foto: { stringValue: 'https://ejemplo.com/mila.jpg' },
      ingredientes: { arrayValue: { values: [{}, {}, {}] } },
      pasos: { arrayValue: { values: [{}, {}] } },
    });

    expect(receta).toEqual({
      nombre: 'Milanesas',
      descripcion: 'Con puré',
      alias: 'Tatoh',
      foto: 'https://ejemplo.com/mila.jpg',
      ingredientes: 3,
      pasos: 2,
    });
  });

  it('un documento sin foto devuelve string vacío, no undefined', () => {
    const receta = normalizar({ nombre: { stringValue: 'Mila' } });

    expect(receta!.foto).toBe('');
  });

  it('sin fields devuelve null: el documento no existe', () => {
    expect(normalizar(undefined)).toBe(null);
  });

  it('un documento con campos faltantes no explota', () => {
    // Documentos publicados por versiones viejas de la app: cada campo puede
    // no estar, y un `arrayValue` sin `values` es una lista vacía.
    expect(normalizar({ ingredientes: { arrayValue: {} } })).toEqual({
      nombre: 'Receta',
      descripcion: '',
      alias: '',
      foto: '',
      ingredientes: 0,
      pasos: 0,
    });
  });
});

describe('imagenDe', () => {
  it('usa la foto de la receta cuando es https', () => {
    expect(imagenDe({ foto: 'https://ejemplo.com/a.jpg' })).toBe(
      'https://ejemplo.com/a.jpg',
    );
  });

  // http sobre una página https es contenido mixto: varios crawlers lo
  // descartan y el link queda sin preview en vez de con uno feo.
  it('cae al ícono con http, con vacío y con basura', () => {
    const icono = 'https://comidas.tatoh.ar/icon.png';

    expect(imagenDe({ foto: 'http://ejemplo.com/a.jpg' })).toBe(icono);
    expect(imagenDe({ foto: '' })).toBe(icono);
    expect(imagenDe({ foto: 'javascript:alert(1)' })).toBe(icono);
  });
});

describe('describir', () => {
  const receta = {
    nombre: 'Milanesas',
    descripcion: '',
    alias: '',
    ingredientes: 3,
    pasos: 2,
  };

  it('usa la descripción cuando la hay', () => {
    expect(describir({ ...receta, descripcion: 'Con puré' })).toBe('Con puré');
  });

  it('trata la descripción de sólo espacios como vacía', () => {
    // `firestore.rules` valida quién escribe, no qué escribe, y hay documentos
    // publicados antes del fix que traen sólo espacios.
    expect(describir({ ...receta, descripcion: '   \n  ' })).toBe(
      '3 ingredientes, 2 pasos',
    );
  });

  it('sin descripción arma el conteo', () => {
    expect(describir(receta)).toBe('3 ingredientes, 2 pasos');
  });

  it('sin pasos no menciona pasos', () => {
    expect(describir({ ...receta, pasos: 0 })).toBe('3 ingredientes');
  });

  it('firma con el alias cuando está', () => {
    expect(describir({ ...receta, alias: 'Tatoh' })).toBe(
      'Receta de Tatoh · 3 ingredientes, 2 pasos',
    );
  });
});
