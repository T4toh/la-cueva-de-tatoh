import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar, Panel, Redes, SkillBar, Tag } from 'componentes';
import {
  INTERESES,
  POSTS,
  REDES,
  SKILLS,
} from 'projects/perfil-personal/src/variables';

@Component({
  selector: 'app-sidebar',
  imports: [Avatar, Panel, SkillBar, Tag, Redes, RouterLink],
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

  readonly recentPosts = computed(() => {
    const allPosts = this.posts();
    return allPosts.slice(-3).reverse();
  });

  getPostIndex(postTitle: string): number {
    return this.posts().findIndex((p) => p.title === postTitle);
  }
}
