import { Component } from '@angular/core';
import { AvatarComponent } from 'avatar';

@Component({
  selector: 'app-sidebar',
  imports: [AvatarComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {}
