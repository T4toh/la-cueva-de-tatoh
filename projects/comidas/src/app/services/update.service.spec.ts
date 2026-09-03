import { describe, expect, it } from 'vitest';

import { mismoCodigo } from './update.service';

// hashTable de un ngsw.json: mismos bundles, otro timestamp de build.
const hashTable = {
  '/index.html': 'aaa',
  '/main-QMVERCWQ.js': 'bbb',
  '/styles-QN4GNH4P.css': 'ccc',
};

describe('mismoCodigo', () => {
  it('el deploy sin cambios reales no cuenta como versión nueva', () => {
    const cargados = ['/main-QMVERCWQ.js', '/styles-QN4GNH4P.css'];

    expect(mismoCodigo(cargados, hashTable)).toBe(true);
  });

  it('un bundle con hash nuevo sí cuenta como versión nueva', () => {
    const cargados = ['/main-VIEJO123.js', '/styles-QN4GNH4P.css'];

    expect(mismoCodigo(cargados, hashTable)).toBe(false);
  });

  it('sin archivos cargados avisa igual (no se come una actualización real)', () => {
    expect(mismoCodigo([], hashTable)).toBe(false);
  });
});
