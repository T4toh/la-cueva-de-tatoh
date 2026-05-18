import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'home'
  | 'wrench'
  | 'book-open'
  | 'book'
  | 'utensils'
  | 'calendar'
  | 'calendar-days'
  | 'arrow-down-a-z'
  | 'x'
  | 'download'
  | 'external-link'
  | 'shopping-cart'
  | 'package'
  | 'settings'
  | 'user'
  | 'sparkles'
  | 'check'
  | 'triangle-alert'
  | 'languages'
  | 'swords'
  | 'pen-tool'
  | 'gamepad-2'
  | 'terminal'
  | 'music'
  | 'telescope'
  | 'flask-conical'
  | 'dice-6'
  | 'laptop'
  | 'arrow-right'
  | 'trash-2'
  | 'plus'
  | 'minus'
  | 'pencil'
  | 'clipboard-list'
  | 'upload'
  | 'refresh-cw'
  | 'wifi-off'
  | 'copy';

@Component({
  selector: 'lib-icon',
  imports: [],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<number>(18);
  readonly strokeWidth = input<number>(1.75);
  readonly label = input<string>('');
}
