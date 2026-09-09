import {
  inject,
  Injectable,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';

import { Meal } from '../models/meal.model';
import { AuthService } from './auth.service';
import {
  aRecetaPublica,
  generarIdPublico,
  RecetaPublica,
} from './receta-publica';

const COLECCION = 'recetasPublicas';

@Injectable({ providedIn: 'root' })
export class RecetaPublicaService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  // AngularFire avisa cuando sus APIs se llaman fuera del contexto de
  // inyección: pierde el wrapping de zona y desestabiliza change detection.
  // Acá pasa siempre, porque las escrituras salen de effects y de promesas
  // resueltas, no del constructor. `runInInjectionContext` se lo devuelve.
  //
  // Envuelve la llamada entera, `doc()` incluido, y de forma síncrona: el
  // contexto vale mientras corre el callback, así que lo que tiene que nacer
  // adentro es la promesa, no su resolución.
  private enContexto<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  // El alias lo pasa quien llama y no se lee de `MealService`: al revés habría
  // ciclo, porque es `MealService` el que dispara el espejo.
  async publicar(meal: Meal, alias: string): Promise<string> {
    const uid = this.uidOrThrow();
    const id = await this.idLibre();
    await this.enContexto(() =>
      setDoc(
        doc(this.firestore, COLECCION, id),
        aRecetaPublica(meal, alias || undefined, uid, id, Date.now())
      )
    );
    return id;
  }

  async sincronizar(meal: Meal, alias: string): Promise<void> {
    if (!meal.publicId) {
      return;
    }
    const uid = this.uidOrThrow();
    const publicId = meal.publicId;
    await this.enContexto(() =>
      setDoc(
        doc(this.firestore, COLECCION, publicId),
        aRecetaPublica(meal, alias || undefined, uid, publicId, Date.now())
      )
    );
  }

  async despublicar(publicId: string): Promise<void> {
    await this.enContexto(() =>
      deleteDoc(doc(this.firestore, COLECCION, publicId))
    );
  }

  async leer(id: string): Promise<RecetaPublica | null> {
    const snap = await this.enContexto(() =>
      getDoc(doc(this.firestore, COLECCION, id))
    );
    return snap.exists() ? (snap.data() as RecetaPublica) : null;
  }

  private uidOrThrow(): string {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('Hay que iniciar sesión para compartir una receta.');
    }
    return user.uid;
  }

  // Ocho caracteres al azar chocan una vez cada nunca, pero el choque
  // silencioso pisaría la receta de otro: una lectura por publicación es
  // barata al lado de eso.
  private async idLibre(): Promise<string> {
    for (let intento = 0; intento < 5; intento++) {
      const id = generarIdPublico();
      const snap = await this.enContexto(() =>
        getDoc(doc(this.firestore, COLECCION, id))
      );
      if (!snap.exists()) {
        return id;
      }
    }
    throw new Error('No se pudo generar un id libre.');
  }
}
