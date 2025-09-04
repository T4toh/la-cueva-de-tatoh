import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navigator',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navigator.html',
  styleUrl: './navigator.scss',
})
export class Navigator {}
