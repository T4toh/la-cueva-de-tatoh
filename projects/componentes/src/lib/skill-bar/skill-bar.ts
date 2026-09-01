import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-skill-bar',
  imports: [],
  templateUrl: './skill-bar.html',
  styleUrl: './skill-bar.scss',
})
export class SkillBar {
  readonly skill = input<string>();
  readonly nivel = input<number>(0);
  readonly color = input<string>('blue');
  readonly textColor = input<string>('#333');
}
