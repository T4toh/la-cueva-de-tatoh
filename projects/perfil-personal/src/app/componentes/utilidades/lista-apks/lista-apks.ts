import { Component, signal } from '@angular/core';

import { type Apk, APKS } from '../../../../variables';

@Component({
  selector: 'app-lista-apks',
  imports: [],
  templateUrl: './lista-apks.html',
  styleUrl: './lista-apks.scss',
})
export class ListaApks {
  readonly apks = signal<Apk[]>(APKS);
}
