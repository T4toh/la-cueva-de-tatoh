import { Component, signal } from '@angular/core';
import { Icon } from 'componentes';

import { type Apk, APKS } from '../../../../variables';
import { conVersionDeGithub } from './versiones-github';

@Component({
  selector: 'app-lista-apks',
  imports: [Icon],
  templateUrl: './lista-apks.html',
  styleUrl: './lista-apks.scss',
})
export class ListaApks {
  // Arranca con lo hardcodeado (render inmediato) y lo pisa con la última
  // release de GitHub de cada repo cuando llega.
  readonly apks = signal<Apk[]>(APKS);

  constructor() {
    Promise.all(APKS.map((apk) => conVersionDeGithub(apk))).then((apks) => this.apks.set(apks));
  }
}
