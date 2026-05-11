import { Component, input, signal } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { Dialogo } from '../dialogo/dialogo';
import { VERSION } from '../version';

@Component({
  selector: 'lib-footer',
  standalone: true,
  imports: [Dialogo, MarkdownComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  readonly changelogUrl = input<string>('/CHANGELOG.md');
  readonly version = VERSION;
  protected readonly mostrarChangelog = signal(false);

  abrir(): void {
    this.mostrarChangelog.set(true);
  }
}
