import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Boton } from 'componentes';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { type Post, POSTS } from 'projects/perfil-personal/src/variables';

@Component({
  selector: 'app-post-view',
  imports: [MarkdownComponent, Boton, CommonModule],
  templateUrl: './post-view.html',
  styleUrl: './post-view.scss',
})
export class PostView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  readonly posts = signal(POSTS);
  readonly currentPost = signal<Post | null>(null);
  readonly postIndex = signal<number>(-1);
  readonly extractedTitle = signal<string>('');

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = Number(params['id']);
      if (id >= 0 && id < this.posts().length) {
        const post = this.posts()[id];
        this.currentPost.set(post);
        this.postIndex.set(id);
        this.extractTitleFromMarkdown(post.src);
      } else {
        this.router.navigate(['/blog']);
      }
    });
  }

  private extractTitleFromMarkdown(src: string): void {
    this.http.get(src, { responseType: 'text' }).subscribe({
      next: (markdownContent) => {
        // Buscar la primera línea que comience con #
        const lines = markdownContent.split('\n');
        const titleLine = lines.find((line) => line.trim().startsWith('# '));

        if (titleLine) {
          // Remover el # y espacios
          const title = titleLine.replace(/^#\s+/, '').trim();
          this.extractedTitle.set(title);
        } else {
          // Fallback al título hardcodeado si no se encuentra H1
          this.extractedTitle.set(this.currentPost()?.title || '');
        }
      },
      error: () => {
        // Fallback al título hardcodeado en caso de error
        this.extractedTitle.set(this.currentPost()?.title || '');
      },
    });
  }

  volverABlog(): void {
    this.router.navigate(['/blog']);
  }
}
