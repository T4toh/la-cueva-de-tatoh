import { Component, signal } from '@angular/core';
import { Avatar, Panel, Redes, SkillBar, Tag } from 'componentes';
import { INTERESES, REDES, SKILLS } from 'projects/perfil-personal/src/variables';

@Component({
  selector: 'app-sidebar',
  imports: [Avatar, Panel, SkillBar, Tag, Redes],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  skills = signal(SKILLS);
  intereses = signal(INTERESES);
  redes = signal(REDES);

  descripcion = signal(
    `Desarrollador Full Stack con experiencia en Angular, Node.js y bases de datos NoSQL. Apasionado por crear soluciones eficientes y escalables. Siempre en busca de aprender nuevas tecnologías y mejorar mis habilidades.`,
  );
}
