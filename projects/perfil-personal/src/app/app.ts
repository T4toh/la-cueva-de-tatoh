import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, take } from 'rxjs/operators';
import { Sidebar } from './componentes/sidebar/sidebar';
import { Navigator } from './componentes/navigator/navigator';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, Navigator],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly updates = inject(SwUpdate);
  private readonly router = inject(Router);

  constructor() {
    // isEnabled es false en dev y durante el prerender, donde no hay
    // navigator.serviceWorker.
    if (!this.updates.isEnabled) {
      return;
    }

    // El service worker baja el build nuevo en segundo plano pero sigue
    // sirviendo el viejo hasta que se cierran todas las pestañas del sitio.
    // Sin esto uno queda clavado en una versión vieja por tiempo indefinido.
    this.updates.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.aplicarEnLaProximaNavegacion());
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
