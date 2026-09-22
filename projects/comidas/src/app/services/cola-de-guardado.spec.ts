import { beforeEach, describe, expect, it } from 'vitest';

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
  beforeEach(() => localStorage.clear());

  // La primera llamada por clave es el efecto corriendo con lo que había en
  // localStorage. No es una edición y no se anota: si cayera dentro de una
  // ventana de sync, la bajada la saltearía y el drenaje subiría lo viejo.
  it('la primera corrida de cada clave es el arranque: ni guarda ni anota', () => {
    const cola = new ColaDeGuardado();
    cola.iniciarSync();

    expect(cola.debeGuardarAhora('meals')).toBe(false);
    expect(cola.fueTocado('meals')).toBe(false);
    expect(cola.pendientes()).toEqual([]);
  });

  it('fuera de una sincronización guarda derecho', () => {
    const cola = arrancada();

    expect(cola.debeGuardarAhora('meals')).toBe(true);
  });

  // Se anota ANTES de escribir: una escritura colgada (sin red, pestaña
  // cerrada) tiene que quedar pendiente aunque nunca llegue a fallar.
  it('queda pendiente desde que se decide mandar hasta que se confirma', () => {
    const cola = arrancada();

    cola.debeGuardarAhora('meals');
    expect(cola.fueTocado('meals')).toBe(true);

    cola.confirmada('meals');
    expect(cola.fueTocado('meals')).toBe(false);
  });

  it('una escritura fallida vuelve a la cola', () => {
    const cola = arrancada();
    cola.debeGuardarAhora('meals');
    cola.confirmada('meals');

    cola.pendiente('meals');

    expect(cola.pendientes()).toEqual(['meals']);
  });

  // Lo pendiente sobrevive al reinicio: es lo que hace que un cambio hecho
  // sin red no lo pise la bajada de la próxima apertura.
  it('lo pendiente se persiste y se relee en una cola nueva', () => {
    const cola = arrancada();
    cola.debeGuardarAhora('pantry');
    cola.debeGuardarAhora('meals');

    const otra = new ColaDeGuardado();

    expect(otra.pendientes()).toEqual(['pantry', 'meals']);
    expect(otra.fueTocado('meals')).toBe(true);
  });

  it('confirmar todo vacía la cola', () => {
    const cola = arrancada();
    cola.debeGuardarAhora('pantry');
    cola.debeGuardarAhora('meals');

    cola.confirmadas();

    expect(cola.pendientes()).toEqual([]);
    expect(new ColaDeGuardado().pendientes()).toEqual([]);
  });

  // El bug original: el efecto hacía `if (!isSyncing) guardar()` y punto. Lo
  // que caía en la ventana no llegaba nunca a Firestore y no había reintento.
  it('durante una sincronización no descarta la escritura: la anota', () => {
    const cola = arrancada();
    cola.iniciarSync();

    expect(cola.debeGuardarAhora('meals')).toBe(false);
    expect(cola.pendientes()).toEqual(['meals']);
  });

  it('la misma clave dos veces queda pendiente una sola vez', () => {
    const cola = arrancada();
    cola.debeGuardarAhora('meals');
    cola.debeGuardarAhora('meals');

    expect(cola.pendientes()).toEqual(['meals']);
  });

  // La bajada toma la foto antes de aplicar; sus propios `set` disparan
  // efectos que se anotan solos. Cerrar la ventana vuelve a esa foto.
  it('cerrar la ventana vuelve a la foto y descarta lo que anotó la bajada', () => {
    const cola = arrancada();
    cola.iniciarSync();
    cola.debeGuardarAhora('meals');
    const foto = cola.pendientes();
    cola.debeGuardarAhora('pantry');
    cola.debeGuardarAhora('tags');

    cola.terminarSync(foto);

    expect(cola.pendientes()).toEqual(['meals']);
    expect(cola.debeGuardarAhora('tags')).toBe(true);
  });

  // `aplicarDocumento` tiene salidas tempranas. Una llamada de más no rompe.
  it('terminar sin haber empezado no rompe', () => {
    const cola = arrancada();

    cola.terminarSync([]);

    expect(cola.pendientes()).toEqual([]);
    expect(cola.debeGuardarAhora('meals')).toBe(true);
  });

  it('ignora un localStorage roto', () => {
    localStorage.setItem('comidas_pendientes', '{no es');

    expect(new ColaDeGuardado().pendientes()).toEqual([]);
  });
});
