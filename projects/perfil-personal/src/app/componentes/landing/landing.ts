import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, type IconName } from 'componentes';
import { GaleriaLibros } from '../galeria-libros/galeria-libros';
import { PostCard } from '../post-card/post-card';
import { ProyectoCard } from '../proyecto-card/proyecto-card';
import { Seo } from '../../seo';
import {
  APKS,
  LIBROS,
  POSTS,
  PROYECTOS,
  TITULO_SITIO,
} from '../../../variables';

type Tarjeta = {
  nombre: string;
  descripcion: string;
  url: string;
  icono: IconName;
  color: string;
  etiqueta: string;
};

const ETIQUETA_PROYECTO = { repo: 'Repo', web: 'Web' } as const;

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Icon, GaleriaLibros, PostCard, ProyectoCard],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  constructor() {
    inject(Seo).publicar({ ruta: '' });
  }

  readonly titulo = TITULO_SITIO;
  readonly libros = LIBROS;

  // La vidriera junta los repos y sitios de PROYECTOS con las descargas que
  // ya viven en APKS: una sola fuente de verdad por proyecto, sin copiarlos.
  readonly tarjetas: Tarjeta[] = [
    ...PROYECTOS.map((p) => ({ ...p, etiqueta: ETIQUETA_PROYECTO[p.tipo] })),
    ...APKS.map((a) => ({
      nombre: a.nombre,
      descripcion: a.descripcion,
      url: a.url,
      icono: a.icono ?? 'package',
      color: a.color,
      etiqueta: a.tipo === 'desktop' ? 'App' : 'APK',
    })),
  ];

  // Los tres últimos posts, con el índice que POSTS les da: es el mismo que
  // usa la ruta /blog/:id.
  readonly ultimosPosts = POSTS.map((post, indice) => ({ post, indice }))
    .slice(-3)
    .reverse();
}
