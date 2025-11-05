import { Component } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { Boton } from 'componentes';
import { CommonModule } from '@angular/common';

type Post = {
  title: string;
  src: string;
  fecha: string;
  isExpanded: boolean;
};

@Component({
  selector: 'app-blog',
  imports: [MarkdownComponent, Boton, CommonModule],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
})
export class Blog {
  posts: Post[] = [
    {
      title: 'Aprendiendo Japonés con un gordo barbudo #1',
      src: 'posts/japones-1.md',
      fecha: '3/11/25',
      isExpanded: false,
    },
    {
      title: 'Aprendiendo Japonés con un gordo barbudo #2',
      src: 'posts/japones-2.md',
      fecha: '5/11/25',
      isExpanded: true,
    },
    // { title: 'Template Post', src: 'posts/template-post.md', fecha: '3/9/25', isExpanded: false },
  ];

  togglePost(post: Post): void {
    post.isExpanded = !post.isExpanded;
  }
}
