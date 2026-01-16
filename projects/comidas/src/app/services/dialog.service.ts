import { Injectable, signal } from '@angular/core';
import { DialogoAccion } from 'componentes';

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  readonly visible = signal(false);
  readonly title = signal<string>('');
  readonly message = signal<string>('');
  readonly actions = signal<DialogoAccion[]>([]);

  open(options: {
    title: string;
    message: string;
    actions: DialogoAccion[];
  }): void {
    this.title.set(options.title);
    this.message.set(options.message);
    this.actions.set(options.actions);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  confirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.open({
        title,
        message,
        actions: [
          {
            texto: 'Cancelar',
            estilo: 'text',
            color: '#666',
            accion: (): void => {
              this.close();
              resolve(false);
            },
          },
          {
            texto: 'Confirmar',
            estilo: 'normal',
            color: 'var(--color-3)', // Using app theme color
            accion: (): void => {
              this.close();
              resolve(true);
            },
          },
        ],
      });
    });
  }
}
