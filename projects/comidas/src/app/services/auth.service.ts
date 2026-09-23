import { inject, Injectable, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  user,
  User,
} from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth: Auth = inject(Auth);
  user$: Observable<User | null> = user(this.auth);
  // `undefined` hasta la primera emisión de `user()`: al abrir la app, Firebase
  // valida la sesión contra la red antes de emitir, y ese rato no es lo mismo
  // que no tener sesión. `MealService` retiene lo que se carga mientras tanto.
  readonly currentUser = signal<User | null | undefined>(undefined);

  constructor() {
    this.user$.subscribe((u) => this.currentUser.set(u));
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provider);
    } catch (error) {
      console.error('Error logging in with Google', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Error logging out', error);
      throw error;
    }
  }
}
