import { Component, computed, signal } from '@angular/core';
import { PostCard } from '../post-card/post-card';
import { Post, POSTS } from 'projects/perfil-personal/src/variables';

// Temas disponibles de Prism.js (cambiar en angular.json > styles):
// - prism-okaidia.css (tema oscuro actual)
// - prism-tomorrow.css (tema claro/oscuro suave)
// - prism-twilight.css (tema oscuro púrpura)
// - prism-dark.css (tema oscuro simple)
// - prism-funky.css (tema oscuro con colores vibrantes)
// - prism-coy.css (tema claro minimalista)
// - prism-solarizedlight.css (tema claro solarized)

// estructura --> estilo de bloque para estructuras de oraciones
// traduccion --> estilo de bloque para traducciones

type SortBy = 'date' | 'name' | 'none';
type SortOrder = 'asc' | 'desc';

@Component({
  selector: 'app-blog',
  imports: [PostCard],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
})
export class Blog {
  readonly posts = signal(POSTS);
  readonly sortBy = signal<SortBy>('date');
  readonly sortOrder = signal<SortOrder>('desc');
  readonly selectedTag = signal<string | null>(null);

  // Computed signal que aplica ordenamiento y filtrado
  readonly sortedPosts = computed(() => {
    let result = [...this.posts()];

    // Filtrar por tag si hay uno seleccionado
    const tag = this.selectedTag();
    if (tag) {
      result = result.filter((post) => post.tags?.includes(tag));
    }

    // Ordenar según el criterio seleccionado
    const sortCriteria = this.sortBy();
    const order = this.sortOrder();

    if (sortCriteria === 'date') {
      result.sort((a, b) => {
        const dateA = this.parseDate(a.fecha);
        const dateB = this.parseDate(b.fecha);
        return order === 'desc'
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime();
      });
    } else if (sortCriteria === 'name') {
      result.sort((a, b) => {
        const comparison = a.title.localeCompare(b.title);
        return order === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  });

  // Obtener todos los tags únicos
  readonly allTags = computed(() => {
    const tags = new Set<string>();
    this.posts().forEach((post) => {
      post.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  });

  // Parsear fecha en formato DD/MM/YY a Date
  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('/').map(Number);
    // Asumiendo que años 00-99 son 2000-2099
    const fullYear = year < 100 ? 2000 + year : year;
    return new Date(fullYear, month - 1, day);
  }

  sortByDate(): void {
    if (this.sortBy() === 'date') {
      // Toggle order si ya está ordenando por fecha
      this.sortOrder.set(this.sortOrder() === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortBy.set('date');
      this.sortOrder.set('desc'); // Por defecto: más reciente primero
    }
  }

  sortByName(): void {
    if (this.sortBy() === 'name') {
      // Toggle order si ya está ordenando por nombre
      this.sortOrder.set(this.sortOrder() === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortBy.set('name');
      this.sortOrder.set('asc'); // Por defecto: A-Z
    }
  }

  filterByTag(tag: string): void {
    if (this.selectedTag() === tag) {
      // Si ya está seleccionado, deseleccionar
      this.selectedTag.set(null);
    } else {
      this.selectedTag.set(tag);
    }
  }

  clearFilters(): void {
    this.sortBy.set('none');
    this.sortOrder.set('desc');
    this.selectedTag.set(null);
  }

  getOriginalIndex(post: Post): number {
    // Encuentra el índice del post en el array original POSTS
    return this.posts().findIndex((p) => p.src === post.src);
  }

  esUltimoPost(post: Post): boolean {
    // Encontrar el post más reciente por fecha
    const posts = this.posts();

    // Encontrar la fecha más reciente de todos los posts
    const mostRecentDate = posts.reduce((latest, p) => {
      const postDate = this.parseDate(p.fecha);
      return postDate > latest ? postDate : latest;
    }, this.parseDate(posts[0].fecha));

    // Verificar si el post actual tiene la fecha más reciente
    const currentDate = this.parseDate(post.fecha);
    return currentDate.getTime() === mostRecentDate.getTime();
  }
}
