import { Component } from '@angular/core';

import { GeneradorQr } from './generador-qr/generador-qr';
import { ListaApks } from './lista-apks/lista-apks';

@Component({
  selector: 'app-utilidades',
  imports: [GeneradorQr, ListaApks],
  templateUrl: './utilidades.html',
  styleUrl: './utilidades.scss',
})
export class Utilidades {
  activeTab = 'qr';

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
}
