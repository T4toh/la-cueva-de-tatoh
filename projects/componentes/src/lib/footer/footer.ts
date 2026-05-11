import {
  Component,
  ElementRef,
  HostListener,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { VERSION } from '../version';

@Component({
  selector: 'lib-footer',
  standalone: true,
  imports: [MarkdownComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  readonly changelogUrl = input<string>('/CHANGELOG.md');
  readonly version = VERSION;
  protected readonly cargado = signal(false);
  protected readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  abrir(): void {
    this.cargado.set(true);
    document.body.classList.add('modal-open');
    this.dialogRef()?.nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogRef()?.nativeElement.close();
    document.body.classList.remove('modal-open');
  }

  onDialogClick(event: MouseEvent): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (event.target === dialog) {
      this.cerrar();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.dialogRef()?.nativeElement.open) {
      this.cerrar();
    }
  }
}
