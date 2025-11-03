import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Apk, APKS } from '../../../../variables';

@Component({
  selector: 'app-lista-apks',
  imports: [CommonModule],
  templateUrl: './lista-apks.html',
  styleUrl: './lista-apks.scss',
})
export class ListaApks {
  readonly apks = signal<Apk[]>(APKS);
}
