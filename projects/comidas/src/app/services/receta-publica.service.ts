import { inject, Injectable } from '@angular/core';
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

  // El alias lo pasa quien llama y no se lee de `MealService`: al revés habría
  // ciclo, porque es `MealService` el que dispara el espejo.
  async publicar(meal: Meal, alias: string): Promise<string> {
    const uid = this.uidOrThrow();
    const id = await this.idLibre();
    await setDoc(
      doc(this.firestore, COLECCION, id),
      aRecetaPublica(meal, alias || undefined, uid, id, Date.now())
    );
    return id;
  }

  async sincronizar(meal: Meal, alias: string): Promise<void> {
    if (!meal.publicId) {
      return;
    }
    const uid = this.uidOrThrow();
    await setDoc(
      doc(this.firestore, COLECCION, meal.publicId),
      aRecetaPublica(meal, alias || undefined, uid, meal.publicId, Date.now())
    );
  }

  async despublicar(publicId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, COLECCION, publicId));
  }

  async leer(id: string): Promise<RecetaPublica | null> {
    const snap = await getDoc(doc(this.firestore, COLECCION, id));
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
      const snap = await getDoc(doc(this.firestore, COLECCION, id));
      if (!snap.exists()) {
        return id;
      }
    }
    throw new Error('No se pudo generar un id libre.');
  }
}
