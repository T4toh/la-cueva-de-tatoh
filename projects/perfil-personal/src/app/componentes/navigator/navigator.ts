import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from 'componentes';

import { LogoTienda } from '../logo-tienda/logo-tienda';

@Component({
  selector: 'app-navigator',
  imports: [Icon, LogoTienda, RouterLink, RouterLinkActive],
  templateUrl: './navigator.html',
  styleUrl: './navigator.scss',
})
export class Navigator {
  readonly sidebarAbierto = input.required<boolean>();
  readonly alternarSidebar = output<void>();

  readonly AMAZON_URL = `https://www.amazon.com/s?i=digital-text&rh=p_27%3AIgnacio%2BMart%25C3%25ADn%2BArano&s=relevancerank&text=Ignacio%20Mart%C3%ADn%20Arano`;
}
