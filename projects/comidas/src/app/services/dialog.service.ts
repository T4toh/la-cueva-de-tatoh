import { Injectable, signal } from '@angular/core';
import { DialogoAccion } from 'componentes';

// Un input opcional en el cuerpo del diálogo. `lib-dialogo` ya proyecta con
// <ng-content>, así que lo dibuja el template del App y la librería no cambia.
export type DialogoCampo = {
  etiqueta: string;
  valor: string;
  placeholder?: string;
  onChange: (valor: string) => void;
};

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  readonly visible = signal(false);
  readonly title = signal<string>('');
  readonly message = signal<string>('');
  readonly actions = signal<DialogoAccion[]>([]);
  readonly campo = signal<DialogoCampo | null>(null);

  open(options: {
    title: string;
    message: string;
    actions: DialogoAccion[];
    campo?: DialogoCampo;
  }): void {
    this.title.set(options.title);
    this.message.set(options.message);
    this.actions.set(options.actions);
    // Se resetea siempre y no sólo cuando viene: `confirm` y `alert` pasan por
    // acá, y sin el reset el input del diálogo anterior sobrevive al siguiente.
    this.campo.set(options.campo ?? null);
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
            color: 'var(--accent)',
            accion: (): void => {
              this.close();
              resolve(true);
            },
          },
        ],
      });
    });
  }

  alert(title: string, message: string): void {
    this.open({
      title,
      message,
      actions: [
        {
          texto: 'Aceptar',
          estilo: 'normal',
          color: 'var(--accent)',
          accion: (): void => {
            this.close();
          },
        },
      ],
    });
  }
}
