import { Component } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { Boton } from 'componentes';

type Post = {
  title: string;
  src: string;
  fecha: string;
  isExpanded: boolean;
};

@Component({
  selector: 'app-blog',
  imports: [MarkdownComponent, Boton],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
})
export class Blog {
  posts: Post[] = [
    { title: 'Post Inicial', src: '/posts/post-inicial.md', fecha: '4/9/25', isExpanded: true },
    { title: 'Template Post', src: '/posts/template-post.md', fecha: '3/9/25', isExpanded: false },
  ];

  togglePost(post: Post): void {
    post.isExpanded = !post.isExpanded;
  }
}
