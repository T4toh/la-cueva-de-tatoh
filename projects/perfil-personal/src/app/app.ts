import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './componentes/sidebar/sidebar';
import { Navigator } from './componentes/navigator/navigator';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, Navigator],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {}
