import { Component, computed, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-panel',
  imports: [CommonModule],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  readonly texto = input<string>();
  readonly colorFondo = input<string>();
  readonly colorTexto = input<string>();
  readonly colapsable = input<boolean>(false);
  readonly iconoColapsar = input<string>();
  readonly colapsado = input<boolean>(false);
  readonly negrita = input<boolean>(false);
  readonly tamanoFuente = input<string>();
  readonly transparente = input<boolean>(false);
  readonly sombreado = input<boolean>(false);

  readonly isCollapsed = signal(false);

  constructor() {
    effect(() => {
      this.isCollapsed.set(this.colapsado());
    });
  }

  readonly textoMostrado = computed(() => {
    const txt = this.texto() || '';
    if (this.isCollapsed()) {
      return txt.length > 10 ? txt.substring(0, 10) + '...' : txt;
    }
    return txt;
  });

  isUrl = (str: string | undefined): boolean => {
    return str ? str.startsWith('http') || str.startsWith('https') || str.startsWith('/') : false;
  };

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // Handle 3-digit hex colors
    const shortHex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (shortHex) {
      return {
        r: parseInt(shortHex[1] + shortHex[1], 16),
        g: parseInt(shortHex[2] + shortHex[2], 16),
        b: parseInt(shortHex[3] + shortHex[3], 16),
      };
    }

    // Handle 6-digit hex colors
    const longHex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return longHex
      ? {
          r: parseInt(longHex[1], 16),
          g: parseInt(longHex[2], 16),
          b: parseInt(longHex[3], 16),
        }
      : null;
  }

  private namedColors: Record<string, string> = {
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    black: '#000000',
    white: '#ffffff',
    gray: '#808080',
    grey: '#808080',
    orange: '#ffa500',
    purple: '#800080',
    pink: '#ffc0cb',
    brown: '#a52a2a',
    navy: '#000080',
    maroon: '#800000',
    lime: '#00ff00',
    aqua: '#00ffff',
    teal: '#008080',
    olive: '#808000',
    silver: '#c0c0c0',
  };

  private colorToRgba(color: string, alpha = 1): string {
    // Handle hex colors
    if (color.startsWith('#')) {
      const rgb = this.hexToRgb(color);
      if (rgb) {
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      }
    }

    // Handle rgb/rgba colors
    if (color.startsWith('rgb')) {
      const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
      if (rgbaMatch) {
        const values = rgbaMatch[1].split(',').map((v) => v.trim());
        if (values.length >= 3) {
          const r = values[0];
          const g = values[1];
          const b = values[2];
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      }
    }

    // Handle named colors
    const hexColor = this.namedColors[color.toLowerCase()];
    if (hexColor) {
      const rgb = this.hexToRgb(hexColor);
      if (rgb) {
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      }
    }

    // Fallback: try to parse as hex without #
    const rgb = this.hexToRgb('#' + color);
    if (rgb) {
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }

    // Last fallback: return original color
    return color;
  }

  readonly backgroundColor = computed(() => {
    const fondo = this.colorFondo();
    if (!fondo) {
      return '#fff';
    }

    // Sombreao tiene prioridad sobre transparente
    if (this.sombreado()) {
      return this.colorToRgba(fondo, 0.3);
    }

    if (this.transparente()) {
      return 'transparent';
    }

    return fondo;
  });

  toggleColapsar(): void {
    this.isCollapsed.set(!this.isCollapsed());
  }
}
