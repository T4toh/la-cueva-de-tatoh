import { Component, input, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-panel',
  imports: [CommonModule],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  texto = input<string>();
  colorFondo = input<string>();
  colorTexto = input<string>();
  colapsable = input<boolean>(false);
  iconoColapsar = input<string>();
  colapsado = input<boolean>(false);

  isCollapsed = signal(false);

  constructor() {
    effect(() => {
      this.isCollapsed.set(this.colapsado());
    });
  }

  textoMostrado = computed(() => {
    const txt = this.texto() || '';
    if (this.isCollapsed()) {
      return txt.length > 10 ? txt.substring(0, 10) + '...' : txt;
    }
    return txt;
  });

  isUrl = (str: string | undefined): boolean => {
    return str ? str.startsWith('http') || str.startsWith('https') || str.startsWith('/') : false;
  };

  toggleColapsar() {
    this.isCollapsed.set(!this.isCollapsed());
  }
}
