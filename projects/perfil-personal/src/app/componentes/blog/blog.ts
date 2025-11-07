import { Component, signal } from '@angular/core';
import { PostCard } from '../post-card/post-card';
import { POSTS } from 'projects/perfil-personal/src/variables';

// Temas disponibles de Prism.js (cambiar en angular.json > styles):
// - prism-okaidia.css (tema oscuro actual)
// - prism-tomorrow.css (tema claro/oscuro suave)
// - prism-twilight.css (tema oscuro púrpura)
// - prism-dark.css (tema oscuro simple)
// - prism-funky.css (tema oscuro con colores vibrantes)
// - prism-coy.css (tema claro minimalista)
// - prism-solarizedlight.css (tema claro solarized)

// estructura --> estilo de bloque para estructuras de oraciones
// traduccion --> estilo de bloque para traducciones

@Component({
  selector: 'app-blog',
  imports: [PostCard],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
})
export class Blog {
  readonly posts = signal(POSTS);

  esUltimoPost(index: number): boolean {
    return index === this.posts().length - 1;
  }
}
