import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Boton } from 'componentes';

@Component({
  selector: 'app-not-found',
  imports: [Boton],
  templateUrl: './not-found.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './not-found.scss',
})
export class NotFound {
  private router = inject(Router);

  volverAlInicio(): void {
    this.router.navigate(['/']);
  }
}
