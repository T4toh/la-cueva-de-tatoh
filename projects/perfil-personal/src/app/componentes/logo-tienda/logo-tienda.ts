import { Component, input } from '@angular/core';
import { Icon } from 'componentes';

import { type LogoTienda as NombreLogo } from '../../../variables';

// Los logos de Kobo, Apple y Google Play salen de simple-icons (CC0), normalizados
// a viewBox 24 y fill="currentColor". Nook no está en ese set y cae en el @default.
// El de Kobo es la R de Rakuten, no el wordmark "kobo": es el favicon que usa
// kobo.com y, como el resto acá se dibuja a 18-20px, una palabra no se lee.
@Component({
  selector: 'app-logo-tienda',
  imports: [Icon],
  templateUrl: './logo-tienda.html',
  styleUrl: './logo-tienda.scss',
})
export class LogoTienda {
  readonly tienda = input.required<NombreLogo>();
  readonly size = input<number>(24);
}
