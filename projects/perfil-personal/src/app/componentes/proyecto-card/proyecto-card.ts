import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { Icon, type IconName } from 'componentes';

@Component({
  selector: 'app-proyecto-card',
  imports: [Icon, NgOptimizedImage],
  templateUrl: './proyecto-card.html',
  styleUrl: './proyecto-card.scss',
})
export class ProyectoCard {
  readonly nombre = input.required<string>();
  readonly descripcion = input.required<string>();
  readonly url = input.required<string>();
  readonly icono = input.required<IconName>();
  // Ícono propio de la app; si está, gana sobre `icono`.
  readonly imagen = input<string>();
  readonly color = input.required<string>();
  // Qué te llevás al hacer click: REPO, WEB, APK o APP.
  readonly etiqueta = input.required<string>();
}
