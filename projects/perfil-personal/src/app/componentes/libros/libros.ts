import { Component, inject } from '@angular/core';

import { GaleriaLibros } from '../galeria-libros/galeria-libros';
import { Seo } from '../../seo';
import { type Libro, LIBROS } from '../../../variables';

type Saga = {
  nombre: string;
  libros: Libro[];
};

@Component({
  selector: 'app-libros',
  imports: [GaleriaLibros],
  templateUrl: './libros.html',
  styleUrl: './libros.scss',
})
export class Libros {
  constructor() {
    inject(Seo).publicar({
      titulo: 'Libros',
      descripcion:
        'Las novelas publicadas de Ignacio Martín Arano, con sinopsis y ' +
        'links de compra.',
      ruta: '/libros',
      // La primera portada como preview del listado: es la que ya está en el
      // build y evita que el índice caiga en la imagen genérica del sitio.
      imagen: LIBROS[0]?.imagen,
    });
  }

  readonly sagas = agruparPorSaga(LIBROS);
}

// El orden de las sagas es el de su primera aparición en LIBROS; el de los
// libros dentro de cada una, su `numero`. Un Map alcanza porque conserva el
// orden de inserción.
function agruparPorSaga(libros: Libro[]): Saga[] {
  const sagas = new Map<string, Libro[]>();
  for (const libro of libros) {
    const grupo = sagas.get(libro.saga);
    if (grupo) {
      grupo.push(libro);
    } else {
      sagas.set(libro.saga, [libro]);
    }
  }
  return [...sagas].map(([nombre, propios]) => ({
    nombre,
    libros: propios.sort((a, b) => a.numero - b.numero),
  }));
}
