import {
  Component,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar, Footer, Redes, SkillBar, Tag } from 'componentes';
import {
  fechaDePost,
  INTERESES,
  POSTS,
  REDES,
  SKILLS,
} from '../../../variables';

@Component({
  selector: 'app-sidebar',
  imports: [Avatar, SkillBar, Tag, Redes, Footer, RouterLink],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly skills = signal(SKILLS);
  readonly intereses = signal(INTERESES);
  readonly redes = signal(REDES);
  readonly posts = signal(POSTS);

  readonly descripcion = signal(
    `Desarrollador Full Stack con experiencia en Angular, Node.js 
    y bases de datos NoSQL. Apasionado por crear soluciones eficientes y escalables. 
    Siempre buscando aprender nuevas tecnologías y mejorar mis habilidades.`
  );

  // Por fecha y no por posición en el array: un post que se escribe tarde
  // sobre algo viejo va al final del array (las rutas son por índice) pero no
  // es reciente.
  readonly recentPosts = computed(() =>
    [...this.posts()]
      .sort((a, b) => fechaDePost(b).getTime() - fechaDePost(a).getTime())
      .slice(0, 3)
  );

  getPostIndex(postTitle: string): number {
    return this.posts().findIndex((p) => p.title === postTitle);
  }
}
