import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from 'componentes';
import { Sidebar } from './componentes/sidebar/sidebar';
import { Navigator } from './componentes/navigator/navigator';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, Navigator, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
