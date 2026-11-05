import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { diaCorto } from '../../compras/partes';

// Los días pendientes de un renglón de la vista por góndola, y los que ya se compraron.
@Component({
  selector: 'app-dias-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (d of dias() ?? []; track d) {
      <span class="dia-chip">{{ capitalizado(d) }}</span>
    }
    @if (comprados()?.length && dias()?.length) {
      <span class="detalle">ya compraste {{ comprados()!.map(corto).join(', ') }}</span>
    }
  `,
  styles: `
    .dia-chip {
      display: inline-block;
      margin-left: 0.3rem;
      padding: 0 0.4rem;
      border-radius: 999px;
      background: var(--accent-muted);
      color: var(--fg-primary);
      font-size: 0.7rem;
      line-height: 1.4;
    }

    // Abajo del nombre, como el resto de los detalles del renglón.
    .detalle {
      display: block;
      color: var(--fg-secondary);
      font-size: 0.8rem;
    }
  `,
})
export class DiasChips {
  readonly dias = input<string[]>();
  readonly comprados = input<string[]>();
  protected readonly corto = diaCorto;
  protected capitalizado(dia: string): string {
    const c = diaCorto(dia);
    return c.charAt(0).toUpperCase() + c.slice(1);
  }
}
