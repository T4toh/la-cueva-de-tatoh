import { Component } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { Boton } from 'componentes';
import { CommonModule } from '@angular/common';

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

type Post = {
  title: string;
  src: string;
  fecha: string;
  isExpanded: boolean;
};

@Component({
  selector: 'app-blog',
  imports: [MarkdownComponent, Boton, CommonModule],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
})
export class Blog {
  posts: Post[] = [
    {
      title: 'Aprendiendo Japonés con un Gordo Barbudo #1',
      src: 'posts/japones-1.md',
      fecha: '3/11/25',
      isExpanded: false,
    },
    {
      title: 'Installar Warp en Fedora',
      src: 'posts/instalar-warp-fedora.md',
      fecha: '4/11/25',
      isExpanded: false,
    },
    {
      title: 'Aprendiendo Japonés con un Gordo Barbudo #2',
      src: 'posts/japones-2.md',
      fecha: '5/11/25',
      isExpanded: true,
    },

    // { title: 'Template Post', src: 'posts/template-post.md', fecha: '3/9/25', isExpanded: false },
  ];

  togglePost(post: Post): void {
    post.isExpanded = !post.isExpanded;
  }
}
