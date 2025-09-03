import { Component } from '@angular/core';
import { Avatar, Panel } from 'componentes';

@Component({
  selector: 'app-sidebar',
  imports: [Avatar, Panel],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {}
