import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Meal } from '../../models/meal.model';
import { RecetaPublicaService } from '../../services/receta-publica.service';
import { aMeal, rutaPublica } from '../../services/receta-publica';
import { RecetaDetalleComponent } from '../receta-detalle/receta-detalle.component';

@Component({
  selector: 'app-receta-publica-view',
  standalone: true,
  imports: [RecetaDetalleComponent],
  templateUrl: './receta-publica-view.component.html',
  styleUrls: ['./receta-publica-view.component.scss'],
})
export class RecetaPublicaViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly recetasPublicas = inject(RecetaPublicaService);

  readonly meal = signal<Meal | null>(null);
  readonly cargando = signal(true);
  readonly autor = signal('');
  readonly error = signal(false);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      const receta = await this.recetasPublicas.leer(id);
      if (receta) {
        this.meal.set(aMeal(receta, id));
        this.autor.set(receta.alias ?? '');
        // El link viejo sigue entrando; la barra se corrige a la ruta al día.
        // La ruta se rearma acá y no se lee del campo `ruta`: las reglas de
        // Firestore validan quién escribe, no qué escribe, así que ese campo es
        // texto libre de cualquier usuario autenticado y podría hacer que la
        // barra dijera `/settings` o la receta de otro. `rutaPublica` pasa todo
        // por `slug()`, que deja `[a-z0-9-]` y nada más.
        history.replaceState(null, '', rutaPublica(receta.nombre, receta.alias, id));
      }
    } catch (err) {
      // Sin conexión, Firestore caído, permission-denied: no importa la
      // causa, quien abrió el link no puede diagnosticarla y no es lo mismo
      // que "no existe" — ahí sí puede tener sentido reintentar.
      console.error('No se pudo cargar la receta pública', err);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  reintentar(): void {
    location.reload();
  }
}
