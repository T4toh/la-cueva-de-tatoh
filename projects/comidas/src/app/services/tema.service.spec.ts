import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TemaService } from 'componentes';

// El servicio vive en `componentes`, pero la librería no tiene target de test:
// `pnpm test` corre sólo comidas. El spec vive acá para que efectivamente se
// ejecute — comidas ya consume la librería desde `dist/componentes`.

function crear(): TemaService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  return TestBed.inject(TemaService);
}

describe('TemaService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['tema'];
  });

  it('sin nada guardado arranca en sistema y no escribe el atributo', () => {
    const servicio = crear();

    expect(servicio.tema()).toBe('sistema');
    expect(document.documentElement.dataset['tema']).toBeUndefined();
  });

  it('cicla sistema → claro → oscuro → sistema', () => {
    const servicio = crear();

    servicio.siguiente();
    expect(servicio.tema()).toBe('claro');

    servicio.siguiente();
    expect(servicio.tema()).toBe('oscuro');

    servicio.siguiente();
    expect(servicio.tema()).toBe('sistema');
  });

  it('la elección explícita escribe data-tema y sistema lo borra', () => {
    const servicio = crear();

    servicio.tema.set('claro');
    TestBed.tick();
    expect(document.documentElement.dataset['tema']).toBe('claro');

    servicio.tema.set('sistema');
    TestBed.tick();
    expect(document.documentElement.dataset['tema']).toBeUndefined();
  });

  it('la elección sobrevive a un arranque nuevo', () => {
    const servicio = crear();
    servicio.tema.set('oscuro');
    TestBed.tick();

    expect(crear().tema()).toBe('oscuro');
  });

  it('un valor basura en localStorage no rompe el arranque', () => {
    localStorage.setItem('tema', 'fucsia');

    expect(crear().tema()).toBe('sistema');
  });
});
