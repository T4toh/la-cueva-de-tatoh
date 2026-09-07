import { Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon, TemaService } from 'componentes';

import { LogoTienda } from '../logo-tienda/logo-tienda';
import { TIENDAS_AUTOR } from '../../../variables';

@Component({
  selector: 'app-navigator',
  imports: [Icon, LogoTienda, RouterLink, RouterLinkActive],
  templateUrl: './navigator.html',
  styleUrl: './navigator.scss',
})
export class Navigator {
  readonly tema = inject(TemaService);

  readonly sidebarAbierto = input.required<boolean>();
  readonly alternarSidebar = output<void>();

  readonly tiendas = TIENDAS_AUTOR;
}
