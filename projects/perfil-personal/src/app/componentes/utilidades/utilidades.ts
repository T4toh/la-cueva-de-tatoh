import { Component, inject } from '@angular/core';

import { GeneradorQr } from './generador-qr/generador-qr';
import { ListaApks } from './lista-apks/lista-apks';
import { Seo } from '../../seo';

@Component({
  selector: 'app-utilidades',
  imports: [GeneradorQr, ListaApks],
  templateUrl: './utilidades.html',
  styleUrl: './utilidades.scss',
})
export class Utilidades {
  constructor() {
    inject(Seo).publicar({
      titulo: 'Utilidades',
      descripcion:
        'Generador de códigos QR configurable, con logo y modo WiFi, más las ' +
        'descargas de mis apps.',
      ruta: '/utilidades',
    });
  }

  activeTab = 'qr';

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
}
