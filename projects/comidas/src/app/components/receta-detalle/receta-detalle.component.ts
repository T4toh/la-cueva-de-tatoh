import {
  Component,
  computed,
  HostListener,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Icon, Tag } from 'componentes';

import { Meal } from '../../models/meal.model';
import { DialogService } from '../../services/dialog.service';
import {
  multiplyQuantity,
  recetaComoMarkdown,
} from '../../services/meal.service';

const PORCIONES = [1, 2, 3] as const;

@Component({
  selector: 'app-receta-detalle',
  standalone: true,
  imports: [Icon, Tag],
  templateUrl: './receta-detalle.component.html',
  styleUrls: ['./receta-detalle.component.scss'],
})
export class RecetaDetalleComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  readonly meal = input.required<Meal>();

  // El multiplicador lo puede fijar la pantalla de arriba: un plato agendado ya
  // sabe para cuántas porciones es, así que ahí volver a preguntarlo sobra.
  // En la ficha suelta no hay quién lo diga, y se eligen ×1 ×2 ×3 a mano.
  readonly porcionesFijas = input<number | null>(null);

  // La página pública la pasa en true: un desconocido sin cuenta no es el
  // dueño de la receta, así que las afordancias de edición no van.
  readonly soloLectura = input(false);

  readonly opcionesPorciones = PORCIONES;
  readonly porcionesElegidas = signal(1);

  readonly porciones = computed(
    () => this.porcionesFijas() ?? this.porcionesElegidas()
  );

  // Las cantidades se guardan por porción y se multiplican al mostrar, igual
  // que hace la lista de compras.
  readonly ingredientes = computed(() =>
    this.meal().ingredients.map((ing) => ({
      ...ing,
      quantity: multiplyQuantity(ing.quantity, this.porciones()),
    }))
  );

  readonly pasos = computed(() => this.meal().pasos ?? []);

  // Guarda el id de la receta cuya foto rompió, no un booleano: así, al
  // cambiar de receta, la comparación con `meal().id` deja de coincidir sola
  // y no hace falta resetear nada a mano en un efecto aparte.
  private readonly fotoConError = signal<string | null>(null);
  readonly hayFoto = computed(
    () => !!this.meal().foto && this.fotoConError() !== this.meal().id
  );

  readonly cocinando = signal(false);
  readonly pasoActual = signal(0);

  // El lock de pantalla del modo cocina. Es una comodidad, no una función: si
  // el navegador no lo tiene o lo niega, cocinar sigue andando igual y no hay
  // cartel.
  private sentinel: WakeLockSentinel | null = null;

  readonly pasoEnCurso = computed(() => this.pasos()[this.pasoActual()]);
  readonly esUltimoPaso = computed(
    () => this.pasoActual() >= this.pasos().length - 1
  );

  // Mismo patrón que `fotoConError`, pero clavado al índice del paso en vez
  // del id de la receta: dos pasos consecutivos con foto comparten el mismo
  // `<img>` del template, así que sin esto una foto rota en el paso 3 dejaría
  // sin verse a la del 4, que está perfecta.
  private readonly pasoFotoConError = signal<number | null>(null);
  readonly hayFotoPaso = computed(
    () =>
      !!this.pasoEnCurso()?.foto &&
      this.pasoFotoConError() !== this.pasoActual()
  );

  editar(): void {
    this.router.navigate(['/meals/edit', this.meal().id]);
  }

  // Un link ajeno se puede morir en cualquier momento: la banda tiene que
  // volver al estado "sin foto" completo (imagen, clase y color de texto
  // juntos), no a una imagen escondida con el texto claro de la foto que ya
  // no está.
  fotoFallo(): void {
    this.fotoConError.set(this.meal().id);
  }

  pasoFotoFallo(): void {
    this.pasoFotoConError.set(this.pasoActual());
  }

  cocinar(): void {
    this.pasoActual.set(0);
    this.cocinando.set(true);
    void this.pedirWakeLock();
  }

  salirDeCocina(): void {
    this.cocinando.set(false);
    void this.soltarWakeLock();
  }

  // Irse a otra ruta con el modo cocina abierto no pasa por `salirDeCocina`.
  ngOnDestroy(): void {
    void this.soltarWakeLock();
  }

  // El navegador suelta el lock solo cuando la pestaña se esconde, así que sin
  // esto mirar el teléfono un segundo y volver deja la pantalla apagándose.
  @HostListener('document:visibilitychange')
  alCambiarVisibilidad(): void {
    if (document.visibilityState === 'visible' && this.cocinando()) {
      void this.pedirWakeLock();
    }
  }

  private async pedirWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator) || this.sentinel) {
      return;
    }
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      // El navegador lo suelta por su cuenta (pestaña oculta, batería baja).
      // Sin limpiar la referencia, `pedirWakeLock` se cree con lock y no lo
      // vuelve a pedir al volver al frente.
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      // Contexto no seguro, permiso denegado, batería baja: sin lock y sin
      // ruido.
      this.sentinel = null;
    }
  }

  private async soltarWakeLock(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    try {
      await sentinel?.release();
    } catch {
      // Ya estaba suelto. No hay nada que hacer al respecto.
    }
  }

  // El último "hecho" sale del modo cocina en vez de dejarte en una pantalla
  // sin salida obvia con las manos sucias.
  pasoHecho(): void {
    if (this.esUltimoPaso()) {
      this.salirDeCocina();
      return;
    }
    this.pasoActual.update((i) => i + 1);
  }

  pasoAnterior(): void {
    this.pasoActual.update((i) => Math.max(0, i - 1));
  }

  async copiarMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(recetaComoMarkdown(this.meal()));
    } catch {
      // El portapapeles lo puede negar el navegador (permisos, foco, contexto
      // no seguro). Sin este aviso el botón no hace nada visible y parece roto.
      this.dialogService.alert(
        'No se pudo copiar',
        'El navegador bloqueó el acceso al portapapeles.'
      );
      return;
    }

    this.dialogService.alert(
      'Copiado',
      'La receta quedó en el portapapeles, lista para pegar en un post.'
    );
  }
}
