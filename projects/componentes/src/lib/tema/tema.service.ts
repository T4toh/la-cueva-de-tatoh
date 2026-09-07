import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Tema = 'sistema' | 'claro' | 'oscuro';

/** El orden en el que cicla el toggle. */
export const TEMAS: readonly Tema[] = ['sistema', 'claro', 'oscuro'];

const CLAVE = 'tema';

function esTema(valor: string | null): valor is Tema {
  return valor !== null && (TEMAS as readonly string[]).includes(valor);
}

// `sistema` no escribe nada en el `<html>`: deja que mande el
// `prefers-color-scheme` del partial de tema. Los otros dos escriben
// `data-tema`, que en el CSS le gana a la media query.
//
// El mismo valor lo lee un script inline en el `index.html` de cada app, antes
// del primer paint, para que la elección explícita no parpadee mientras Angular
// arranca. Si cambia la clave de localStorage, hay que cambiarla en los dos
// lados.
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly tema = signal<Tema>(this.leer());

  constructor() {
    effect((): void => {
      const tema = this.tema();
      if (!this.esBrowser) {
        return;
      }
      const raiz = document.documentElement;
      if (tema === 'sistema') {
        delete raiz.dataset['tema'];
      } else {
        raiz.dataset['tema'] = tema;
      }
      this.pintarBarraDeEstado(raiz);
      this.guardar(tema);
    });
  }

  siguiente(): void {
    const actual = TEMAS.indexOf(this.tema());
    this.tema.set(TEMAS[(actual + 1) % TEMAS.length]);
  }

  // El `theme-color` del `index.html` es uno solo y sin `media` a propósito.
  // Sacar el color del CSS ya resuelto —en vez de repetir los hex acá— hace
  // que la barra de estado siga al partial de tema sin tocar este archivo, y
  // que valga también para `sistema`, donde el color lo eligió la media query.
  private pintarBarraDeEstado(raiz: HTMLElement): void {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta === null) {
      return;
    }
    const color = getComputedStyle(raiz).getPropertyValue('--bg-surface').trim();
    if (color !== '') {
      meta.setAttribute('content', color);
    }
  }

  private leer(): Tema {
    if (!this.esBrowser) {
      return 'sistema';
    }
    try {
      const guardado = localStorage.getItem(CLAVE);
      return esTema(guardado) ? guardado : 'sistema';
    } catch {
      // Modo privado o storage bloqueado: arranca siguiendo al sistema.
      return 'sistema';
    }
  }

  private guardar(tema: Tema): void {
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      // Idem: la elección vale para esta pestaña y no sobrevive al reload.
      return;
    }
  }
}
