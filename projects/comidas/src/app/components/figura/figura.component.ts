import { Component, computed, input } from '@angular/core';

// Dibujo de un ejercicio (public/figuras, generados por scripts/figuras-entrenar.mjs).
// El SVG se usa como máscara para que tome el color del texto y siga el tema.
@Component({
  selector: 'app-figura',
  template: '',
  host: {
    // Sin `alt` es decorativa: el nombre ya está escrito al lado.
    '[attr.role]': 'alt() ? "img" : null',
    '[attr.aria-label]': 'alt() || null',
    '[attr.aria-hidden]': 'alt() ? null : "true"',
    '[style.mask-image]': 'url()',
    '[style.-webkit-mask-image]': 'url()',
  },
  styles: `
    :host {
      aspect-ratio: 21 / 10;
      background-color: currentColor;
      display: block;
      mask-position: center;
      mask-repeat: no-repeat;
      mask-size: contain;
      -webkit-mask-position: center;
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-size: contain;
    }
  `,
})
export class FiguraComponent {
  readonly id = input.required<string>();
  readonly alt = input('');
  protected readonly url = computed(() => `url(figuras/${this.id()}.svg)`);
}
