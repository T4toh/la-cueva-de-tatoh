import { describe, expect, it } from 'vitest';

import { armarLink } from './compartir.service';

describe('armarLink', () => {
  it('une el origen con la ruta pública', () => {
    expect(
      armarLink('https://comidas.tatoh.com.ar', 'Milanesa napolitana', 'Tatoh', 'k7m2xq9p')
    ).toBe('https://comidas.tatoh.com.ar/r/tatoh/milanesa-napolitana/k7m2xq9p');
  });

  it('omite el segmento del nick cuando no hay alias', () => {
    expect(
      armarLink('https://comidas.tatoh.com.ar', 'Milanesa napolitana', undefined, 'k7m2xq9p')
    ).toBe('https://comidas.tatoh.com.ar/r/milanesa-napolitana/k7m2xq9p');
  });
});
