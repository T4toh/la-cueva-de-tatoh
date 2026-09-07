import { Component, computed, inject } from '@angular/core';
import { Icon, IconName } from '../icon/icon';
import { Tema, TemaService } from './tema.service';

type Estado = { icono: IconName; texto: string };

const ESTADOS: Record<Tema, Estado> = {
  sistema: { icono: 'monitor', texto: 'Tema: el del sistema' },
  claro: { icono: 'sun', texto: 'Tema: claro' },
  oscuro: { icono: 'moon', texto: 'Tema: oscuro' },
};

@Component({
  selector: 'lib-tema-toggle',
  imports: [Icon],
  templateUrl: './tema-toggle.html',
  styleUrl: './tema-toggle.scss',
})
export class TemaToggle {
  private readonly servicio = inject(TemaService);

  readonly tema = this.servicio.tema;
  readonly estado = computed<Estado>(() => ESTADOS[this.tema()]);

  alternar(): void {
    this.servicio.siguiente();
  }
}
