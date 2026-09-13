import { ApplicationRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { concat, interval } from 'rxjs';
import { first } from 'rxjs/operators';
import { mismoBuild } from 'componentes';
import { DialogService } from './dialog.service';

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

        if (await mismoBuild()) {
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
}
