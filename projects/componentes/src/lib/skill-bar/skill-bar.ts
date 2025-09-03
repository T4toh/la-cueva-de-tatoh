import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-skill-bar',
  imports: [],
  templateUrl: './skill-bar.html',
  styleUrl: './skill-bar.scss',
})
export class SkillBar {
  skill = input<string>();
  nivel = input<number>(0);
  color = input<string>('blue');
  textColor = input<string>('#333');
}
