import { Component, signal } from '@angular/core';
import { Avatar, Panel, SkillBar } from 'componentes';
import { SKILLS } from 'projects/perfil-personal/src/variables';

@Component({
  selector: 'app-sidebar',
  imports: [Avatar, Panel, SkillBar],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  skills = signal(SKILLS);
}
