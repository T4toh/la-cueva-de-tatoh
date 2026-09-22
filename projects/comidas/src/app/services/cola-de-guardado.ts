// Dueña de qué cambios locales todavía no están confirmados en Firestore.
//
// Una clave entra acá cuando su efecto de persistencia decide mandarla y sale
// cuando el `setDoc` resuelve. Mientras está adentro, es lo local lo que vale:
// una bajada del remoto no la pisa, y al arrancar se reenvía. Eso cubre la
// escritura que falló, la que quedó colgada porque no había red y la pestaña
// se cerró, y la edición hecha mientras una bajada estaba en curso.
//
// Antes esto era un `boolean isSyncing` más una comparación de `Date.now()`
// entre dispositivos para decidir quién pisaba a quién. Dos relojes distintos
// no dicen quién tiene datos sin subir; la cola sí.
//
// Se persiste en localStorage para sobrevivir al reinicio. Un solo set y no
// dos (en vuelo / falladas): para la bajada y para el reenvío son lo mismo.
const CLAVE = 'comidas_pendientes';

export class ColaDeGuardado {
  private sincronizando = false;
  // Set y no array: la misma clave puede tocarse muchas veces y sólo hay que
  // mandarla una. Conserva el orden de inserción.
  private readonly claves: Set<string>;
  // Claves cuyo efecto de persistencia ya corrió al menos una vez. La primera
  // corrida de cada efecto es la carga desde localStorage, no una edición: si
  // Firebase Auth restauró la sesión antes de la primera detección de cambios
  // (pasa seguido en el celular), esa corrida caía dentro de la ventana de
  // sync y anotaba las doce claves como tocadas. La bajada las salteaba todas
  // y el drenaje subía el estado viejo del dispositivo encima de la nube: las
  // comidas cargadas en el otro dispositivo desaparecían sin error.
  private readonly arrancadas = new Set<string>();

  constructor() {
    this.claves = new Set(leerPendientes());
  }

  iniciarSync(): void {
    this.sincronizando = true;
  }

  // Cierra la ventana. `conservar` es la foto de pendientes tomada antes de
  // aplicar la bajada: los `set` de la bajada disparan efectos que se anotan
  // solos y no se distinguen de una edición, así que el set vuelve a la foto.
  // Idempotente a propósito: una llamada de más no rompe, una de menos
  // dejaría la ventana abierta para siempre.
  terminarSync(conservar: string[]): void {
    this.sincronizando = false;
    this.claves.clear();
    for (const clave of conservar) {
      this.claves.add(clave);
    }
    this.persistir();
  }

  // `true` = mandalo ahora. `false` = era la corrida de arranque, o cayó
  // dentro de una ventana y queda anotada para el reenvío. En los dos casos
  // que anotan, la clave sigue pendiente hasta `confirmada`.
  debeGuardarAhora(clave: string): boolean {
    if (!this.arrancadas.has(clave)) {
      this.arrancadas.add(clave);
      return false;
    }
    this.claves.add(clave);
    this.persistir();
    return !this.sincronizando;
  }

  // La escritura salió. Si mientras tanto hubo otra edición de la misma clave,
  // su propio `setDoc` la vuelve a confirmar o a marcar; no hay que contarlas.
  confirmada(clave: string): void {
    this.claves.delete(clave);
    this.persistir();
  }

  // El upload entero salió: todo lo pendiente viajó ahí.
  confirmadas(): void {
    this.claves.clear();
    this.persistir();
  }

  // La escritura falló: vuelve a la cola para el próximo reenvío.
  pendiente(clave: string): void {
    this.claves.add(clave);
    this.persistir();
  }

  // Copia, sin cerrar la ventana. La bajada la toma antes de aplicar nada.
  pendientes(): string[] {
    return [...this.claves];
  }

  // Lo consulta la bajada antes de aplicar cada campo del documento remoto:
  // una clave pendiente no se pisa.
  fueTocado(clave: string): boolean {
    return this.claves.has(clave);
  }

  private persistir(): void {
    localStorage.setItem(CLAVE, JSON.stringify([...this.claves]));
  }
}

function leerPendientes(): string[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as unknown;
    return Array.isArray(guardado)
      ? guardado.filter((c) => typeof c === 'string')
      : [];
  } catch {
    return [];
  }
}
