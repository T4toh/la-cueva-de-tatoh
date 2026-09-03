import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import {
  DESCRIPCION_SITIO,
  IMAGEN_SITIO,
  SITIO_URL,
  TITULO_SITIO,
} from '../variables';

export type DatosSeo = {
  titulo?: string;
  descripcion?: string;
  // Ruta desde la raíz, sin barra final: '' para el home, '/blog' para el
  // listado. Se convierte en el og:url absoluto.
  ruta?: string;
  imagen?: string;
  tipo?: string;
};

// Un solo lugar que escribe los meta tags de todas las rutas. Las rutas
// prerenderizadas los hornean en su HTML, que es lo único que leen los
// crawlers de WhatsApp/Twitter: no ejecutan JS, así que lo que el componente
// haga después de cargar no cuenta.
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  publicar(datos: DatosSeo = {}): void {
    const {
      titulo,
      descripcion = DESCRIPCION_SITIO,
      ruta = '',
      imagen = IMAGEN_SITIO,
      tipo = 'website',
    } = datos;

    const url = `${SITIO_URL}${ruta}`;
    // og:image y og:url tienen que ser absolutas: los crawlers no las
    // resuelven contra el dominio.
    const imagenAbsoluta = imagen.startsWith('http')
      ? imagen
      : `${SITIO_URL}${imagen}`;

    this.title.setTitle(titulo ? `${titulo} | ${TITULO_SITIO}` : TITULO_SITIO);
    this.meta.updateTag({ content: descripcion, name: 'description' });
    this.meta.updateTag({
      content: titulo ?? TITULO_SITIO,
      property: 'og:title',
    });
    this.meta.updateTag({ content: descripcion, property: 'og:description' });
    this.meta.updateTag({ content: imagenAbsoluta, property: 'og:image' });
    this.meta.updateTag({ content: url, property: 'og:url' });
    this.meta.updateTag({ content: tipo, property: 'og:type' });
    this.meta.updateTag({ content: TITULO_SITIO, property: 'og:site_name' });
    this.meta.updateTag({
      content: 'summary_large_image',
      name: 'twitter:card',
    });
    this.meta.updateTag({
      content: titulo ?? TITULO_SITIO,
      name: 'twitter:title',
    });
    this.meta.updateTag({ content: descripcion, name: 'twitter:description' });
    this.meta.updateTag({ content: imagenAbsoluta, name: 'twitter:image' });
  }
}
