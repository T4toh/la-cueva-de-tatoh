import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NOMBRE_APP } from '../env';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal(NOMBRE_APP);
}
