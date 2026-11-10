import { describe, expect, it, vi } from 'vitest';

import { conReserva } from './flash';

describe('conReserva', () => {
  const modelos = ['lite', 'flash'];
  const saturado = new Error('[503 ] Deadline expired before operation could complete.');

  it('si el primero responde, no prueba el segundo', async () => {
    const intento = vi.fn(async (m: string) => m);
    await expect(conReserva(modelos, intento)).resolves.toBe('lite');
    expect(intento).toHaveBeenCalledTimes(1);
  });

  it('con el primero saturado prueba el segundo', async () => {
    const intento = vi.fn(async (m: string) => {
      if (m === 'lite') {
        throw saturado;
      }
      return m;
    });
    await expect(conReserva(modelos, intento)).resolves.toBe('flash');
    expect(intento.mock.calls.map(([m]) => m)).toEqual(['lite', 'flash']);
  });

  it('un error de esquema no reintenta', async () => {
    const esquema = new Error('[400 ] Invalid JSON payload');
    const intento = vi.fn(async (): Promise<string> => {
      throw esquema;
    });
    await expect(conReserva(modelos, intento)).rejects.toBe(esquema);
    expect(intento).toHaveBeenCalledTimes(1);
  });

  it('si todos fallan, propaga el error del último', async () => {
    const ultimo = new Error('[429 ] RESOURCE_EXHAUSTED');
    const intento = vi.fn(async (m: string): Promise<string> => {
      throw m === 'lite' ? saturado : ultimo;
    });
    await expect(conReserva(modelos, intento)).rejects.toBe(ultimo);
    expect(intento).toHaveBeenCalledTimes(2);
  });
});
