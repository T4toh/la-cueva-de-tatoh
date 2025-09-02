import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'lib-avatar',
  imports: [CommonModule],
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
})
export class AvatarComponent {
  @Input() nombre = 'Tatoh';
  @Input() imagen = 'https://i.pravatar.cc/300';
  @Input() placeHolderText = 'No Image';
}
