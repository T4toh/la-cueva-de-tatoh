import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Boton } from 'componentes';
import { CommonModule } from '@angular/common';
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

  readonly posts = signal(POSTS);
  readonly currentPost = signal<Post | null>(null);
  readonly postIndex = signal<number>(-1);

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = Number(params['id']);
      if (id >= 0 && id < this.posts().length) {
        this.currentPost.set(this.posts()[id]);
        this.postIndex.set(id);
      } else {
        this.router.navigate(['/blog']);
      }
    });
  }

  volverABlog(): void {
    this.router.navigate(['/blog']);
  }
}
