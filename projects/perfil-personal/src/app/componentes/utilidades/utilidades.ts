import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeneradorQr } from './generador-qr/generador-qr';

@Component({
  selector: 'app-utilidades',
  imports: [CommonModule, GeneradorQr],
  templateUrl: './utilidades.html',
  styleUrl: './utilidades.scss',
})
export class Utilidades {
  activeTab = 'qr';

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
}
