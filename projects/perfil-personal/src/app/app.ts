import {
  Component,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, take } from 'rxjs/operators';
import { Sidebar } from './componentes/sidebar/sidebar';
import { Navigator } from './componentes/navigator/navigator';

// Mismo corte que el @media de app.scss. Si cambia uno, cambia el otro:
// abajo de este ancho el panel deja de ser columna y pasa a ser drawer.
const ANCHO_MOBILE = 768;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, Navigator],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly updates = inject(SwUpdate);
  private readonly router = inject(Router);
  private readonly cuerpo =
    viewChild.required<ElementRef<HTMLElement>>('cuerpo');
  private readonly scrollPorUrl = new Map<string, number>();
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly sidebarAbierto = signal(true);

  constructor() {
    this.gestionarScrollAlNavegar();
    this.configurarSidebar();

    // isEnabled es false en dev y durante el prerender, donde no hay
    // navigator.serviceWorker.
    if (!this.updates.isEnabled) {
      return;
    }

    // El service worker baja el build nuevo en segundo plano pero sigue
    // sirviendo el viejo hasta que se cierran todas las pestañas del sitio.
    // Sin esto uno queda clavado en una versión vieja por tiempo indefinido.
    //
    // Comidas resuelve lo mismo de otra forma: su ngsw-custom.js hace
    // skipWaiting() + clients.claim(). Acá eso NO sirve. Comidas no tiene
    // rutas lazy; perfil-personal sí, y si el worker nuevo tomara control a
    // mitad de sesión, la página ya cargada seguiría pidiendo chunks con
    // hashes que el deploy nuevo borró. No unificar las dos apps.
    this.updates.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.aplicarEnLaProximaNavegacion());
  }

  alternarSidebar(): void {
    this.sidebarAbierto.update((abierto) => !abierto);
  }

  // Arranca abierto porque en desktop es una columna más, pero en mobile
  // es un drawer que tapa todo. El prerender no mide nada y emite el HTML
  // con el panel abierto, que es lo correcto para el estático.
  private configurarSidebar(): void {
    if (!this.esBrowser) {
      return;
    }

    if (window.innerWidth <= ANCHO_MOBILE) {
      this.sidebarAbierto.set(false);
    }

    // Escape cierra el drawer. Va por addEventListener y no por un host
    // binding a document para no atarlo al render del servidor.
    window.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && window.innerWidth <= ANCHO_MOBILE) {
        this.sidebarAbierto.set(false);
      }
    });
  }

  // El scroll no vive en el document sino en .body: .layout es 100vh con
  // overflow hidden. Por eso withInMemoryScrolling de Angular no sirve acá,
  // apunta al viewport y el viewport no se mueve nunca.
  //
  // Ruta nueva arranca arriba; volver con el botón de atrás devuelve a la
  // altura que tenía esa URL, igual que haría scrollPositionRestoration.
  //
  // ponytail: el alto guardado es el que la ruta tenía al salir. En un post
  // el markdown se baja por HTTP después de renderizar, así que si volvés a
  // uno muy largo antes de que cargue, el scroll queda corto.
  private gestionarScrollAlNavegar(): void {
    // En el prerender no hay elemento que scrollear.
    if (!this.esBrowser) {
      return;
    }

    let volviendo = false;

    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart) {
        // router.url todavía apunta a la ruta que estamos dejando.
        this.scrollPorUrl.set(
          this.router.url,
          this.cuerpo().nativeElement.scrollTop,
        );
        volviendo = evento.navigationTrigger === 'popstate';
        return;
      }

      if (evento instanceof NavigationEnd) {
        // En mobile el panel tapa el contenido: si tocaste un link de
        // adentro, quedarte con el drawer abierto esconde el destino.
        if (window.innerWidth <= ANCHO_MOBILE) {
          this.sidebarAbierto.set(false);
        }

        const destino = volviendo
          ? this.scrollPorUrl.get(evento.urlAfterRedirects) ?? 0
          : 0;
        // En NavigationEnd la vista nueva todavía no se dibujó: sin esperar
        // un tick el contenedor no tiene alto y el scroll se clava en 0.
        setTimeout(() => {
          this.cuerpo().nativeElement.scrollTop = destino;
        });
      }
    });
  }

  // Recargar en el momento le cortaría la lectura a alguien a la mitad de un
  // post. Esperar al próximo cambio de ruta hace el salto invisible: la página
  // que pidió llega servida ya por la versión nueva.
  private aplicarEnLaProximaNavegacion(): void {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        take(1),
      )
      .subscribe(async () => {
        await this.updates.activateUpdate();
        document.location.reload();
      });
  }
}
