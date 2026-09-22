import { describe, expect, it } from 'vitest';

import { ColaDeGuardado } from './cola-de-guardado';

// Una cola con la corrida de arranque de cada clave ya consumida.
function arrancada(): ColaDeGuardado {
  const cola = new ColaDeGuardado();
  for (const clave of ['meals', 'pantry', 'tags']) {
    cola.debeGuardarAhora(clave);
  }
  return cola;
}

describe('ColaDeGuardado', () => {
  // La primera llamada por clave es el efecto corriendo con lo que había en
  // localStorage. No es una edición y no se anota: si cayera dentro de una
  // ventana de sync, la bajada la saltearía y el drenaje subiría lo viejo.
  it('la primera corrida de cada clave es el arranque: ni guarda ni anota', () => {
    const cola = new ColaDeGuardado();
    cola.iniciarSync();

    expect(cola.debeGuardarAhora('meals')).toBe(false);
    expect(cola.fueTocado('meals')).toBe(false);
    expect(cola.terminarSync()).toEqual([]);
  });

  it('fuera de una sincronización guarda derecho', () => {
    const cola = arrancada();

    expect(cola.debeGuardarAhora('meals')).toBe(true);
  });

  // El bug: el efecto hacía `if (!isSyncing) guardar()` y punto. Lo que caía
  // en la ventana no llegaba nunca a Firestore y no había reintento.
  it('durante una sincronización no descarta la escritura: la anota', () => {
    const cola = arrancada();
    cola.iniciarSync();

    expect(cola.debeGuardarAhora('meals')).toBe(false);
    expect(cola.terminarSync()).toEqual(['meals']);
  });

  // La otra mitad del bug: anotar no alcanza si la bajada igual pisa la
  // edición en memoria. Drenar después mandaría lo bajado, no lo escrito.
  it('lo tocado durante la ventana no se deja pisar por la bajada', () => {
    const cola = arrancada();
    cola.iniciarSync();
    cola.debeGuardarAhora('meals');

    expect(cola.fueTocado('meals')).toBe(true);
    expect(cola.fueTocado('pantry')).toBe(false);
  });

  it('la misma clave dos veces se drena una sola vez', () => {
    const cola = arrancada();
    cola.iniciarSync();
    cola.debeGuardarAhora('meals');
    cola.debeGuardarAhora('meals');

    expect(cola.terminarSync()).toEqual(['meals']);
  });

  it('conserva el orden en que se tocaron las claves', () => {
    const cola = arrancada();
    cola.iniciarSync();
    cola.debeGuardarAhora('pantry');
    cola.debeGuardarAhora('meals');

    expect(cola.terminarSync()).toEqual(['pantry', 'meals']);
  });

  it('terminar la sincronización vacía lo pendiente y vuelve a guardar derecho', () => {
    const cola = arrancada();
    cola.iniciarSync();
    cola.debeGuardarAhora('meals');
    cola.terminarSync();

    expect(cola.terminarSync()).toEqual([]);
    expect(cola.fueTocado('meals')).toBe(false);
    expect(cola.debeGuardarAhora('meals')).toBe(true);
  });

  // `syncFromFirestore` tiene salidas tempranas (remoto vacío, local más
  // nuevo, excepción). Si una de ellas se olvida de cerrar, la cola quedaría
  // trabada anotando para siempre y nada volvería a guardarse.
  it('terminar sin haber empezado no rompe', () => {
    const cola = arrancada();

    expect(cola.terminarSync()).toEqual([]);
    expect(cola.debeGuardarAhora('meals')).toBe(true);
  });

  // La bajada toma la foto antes de aplicar: después, sus propios `set`
  // disparan efectos que se anotan solos y se confundirían con ediciones.
  it('pendientes() es una copia y no cierra la ventana', () => {
    const cola = arrancada();
    cola.iniciarSync();
    cola.debeGuardarAhora('meals');

    const foto = cola.pendientes();
    cola.debeGuardarAhora('pantry');

    expect(foto).toEqual(['meals']);
    expect(cola.pendientes()).toEqual(['meals', 'pantry']);
    expect(cola.debeGuardarAhora('tags')).toBe(false);
  });
});
