import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Avatar } from 'componentes';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Avatar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
