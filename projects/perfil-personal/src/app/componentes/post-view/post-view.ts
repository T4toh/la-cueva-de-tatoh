import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Icon } from 'componentes';

import { HttpClient } from '@angular/common/http';
import { type Post, POSTS } from 'projects/perfil-personal/src/variables';

@Component({
  selector: 'app-post-view',
  imports: [MarkdownComponent, RouterLink, Icon],
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
        const lines = markdownContent.split('\n');
        const titleLine = lines.find((line) => line.trim().startsWith('# '));

        if (titleLine) {
          const title = titleLine.replace(/^#\s+/, '').trim();
          this.extractedTitle.set(title);
        } else {
          this.extractedTitle.set(this.currentPost()?.title || '');
        }
      },
      error: () => {
        this.extractedTitle.set(this.currentPost()?.title || '');
      },
    });
  }
}
