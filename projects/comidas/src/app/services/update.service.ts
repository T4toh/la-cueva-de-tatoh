import { ApplicationRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { concat, interval } from 'rxjs';
import { first } from 'rxjs/operators';
import { DialogService } from './dialog.service';

type Manifiesto = { hashTable: Record<string, string> };

// El service worker decide "versión nueva" por el hash del ngsw.json, y ese
// hash incluye el `timestamp` del build. O sea: todo deploy es una versión
// nueva aunque los bundles sean byte a byte los mismos — que es lo que pasa
// en cada merge a main que sólo tocó perfil-personal. De ahí el cartel de
// "Nueva versión disponible" cuando el usuario ya tenía la última.
//
// Los nombres de los archivos llevan content hash: si los que esta página
// tiene cargados siguen estando en el manifiesto nuevo, el código es el mismo
// y no hay nada que avisar.
//
// ponytail: compara sólo los subrecursos cargados; un cambio que toque
// únicamente el index.html (un meta, el title) pasa como "sin cambios". Si
// alguna vez importa, comparar además el hash de /index.html.
export function mismoCodigo(
  cargados: string[],
  hashTable: Record<string, string>
): boolean {
  const nuevos = Object.keys(hashTable);
  return cargados.length > 0 && cargados.every((ruta) => nuevos.includes(ruta));
}

@Injectable({ providedIn: 'root' })
export class UpdateService {
  appRef = inject(ApplicationRef);
  updates = inject(SwUpdate);
  dialogService = inject(DialogService);

  constructor() {
    if (!this.updates.isEnabled) {
      console.log('SW not enabled');
      return;
    }

    // Allow the app to stabilize first, before starting
    // polling for updates with `interval()`.
    // appIsStable$ ya dispara el primer chequeo: un checkForUpdate() extra al
    // arrancar corre en paralelo con este, y dos setupUpdate() concurrentes
    // emiten dos VERSION_READY (dos carteles) para el mismo deploy.
    const appIsStable$ = this.appRef.isStable.pipe(
      first((isStable) => isStable === true)
    );
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    const everySixHoursOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

    everySixHoursOnceAppIsStable$.subscribe(async () => {
      try {
        const updateFound = await this.updates.checkForUpdate();
        console.log(
          updateFound
            ? 'A new version is available.'
            : 'Already on the latest version.'
        );
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    });
  }

  checkForUpdates(): void {
    this.updates.versionUpdates.subscribe((evt) => void this.manejar(evt));
  }

  private async manejar(evt: VersionEvent): Promise<void> {
    switch (evt.type) {
      case 'VERSION_DETECTED':
        console.log(`Downloading new app version: ${evt.version.hash}`);
        break;
      case 'VERSION_READY': {
        console.log(`Current app version: ${evt.currentVersion.hash}`);
        console.log(`New app version ready for use: ${evt.latestVersion.hash}`);

        if (await this.mismoBuild()) {
          // Sólo cambió el timestamp del manifiesto: activamos en silencio y
          // no molestamos con el cartel.
          console.log('Same assets, only a new manifest timestamp.');
          await this.updates.activateUpdate();
          break;
        }

        const confirmado = await this.dialogService.confirm(
          'Actualización Disponible',
          'Nueva versión disponible. ¿Recargar ahora?'
        );
        if (confirmado) {
          await this.updates.activateUpdate();
          document.location.reload();
        }
        break;
      }
      case 'VERSION_INSTALLATION_FAILED':
        console.log(
          `Failed to install app version '${evt.version.hash}': ${evt.error}`
        );
        break;
    }
  }

  // ngsw.json no está en ningún assetGroup, así que este fetch sale a la red
  // (el bust es para los caches HTTP intermedios) y trae el manifiesto nuevo.
  private async mismoBuild(): Promise<boolean> {
    try {
      const respuesta = await fetch(`/ngsw.json?bust=${Date.now()}`, {
        cache: 'no-store',
      });
      const manifiesto = (await respuesta.json()) as Manifiesto;
      return mismoCodigo(this.rutasCargadas(), manifiesto.hashTable);
    } catch (err) {
      console.error('Failed to fetch ngsw.json:', err);
      return false;
    }
  }

  private rutasCargadas(): string[] {
    const scripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[src]')
    ).map((el) => el.src);
    const hojas = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    ).map((el) => el.href);

    return [...scripts, ...hojas]
      .filter((url) => url.startsWith(location.origin))
      .map((url) => new URL(url).pathname);
  }
}
