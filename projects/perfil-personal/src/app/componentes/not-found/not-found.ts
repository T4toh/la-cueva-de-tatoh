import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Boton } from 'componentes';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, Boton],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {}
