import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Tag } from 'componentes';

@Component({
  selector: 'app-post-card',
  imports: [CommonModule, RouterLink, Tag],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCard {
  readonly titulo = input.required<string>();
  readonly fecha = input.required<string>();
  readonly id = input.required<number>();
  readonly esReciente = input<boolean>(false);
  readonly tags = input<string[]>([]);
}
