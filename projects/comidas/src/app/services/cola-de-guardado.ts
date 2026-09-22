// Dueña de qué pasa con una escritura que cae mientras corre una
// sincronización con Firestore.
//
// Antes era un `boolean isSyncing` y un `if (!isSyncing) guardar()`. Eso
// perdía datos de dos maneras a la vez: la escritura no llegaba nunca a
// Firestore —no había pendiente ni reintento—, y la bajada, al terminar,
// pisaba la edición en memoria con el estado remoto. El efecto de persistencia
// escribía esa versión pisada en localStorage, así que la edición desaparecía
// de los dos lados sin un solo error en consola.
//
// La regla acá es: dentro de la ventana gana lo local. La clave tocada se
// anota, no se baja encima, y se manda cuando la sincronización termina.
export class ColaDeGuardado {
  private sincronizando = false;
  // Set y no array: la misma clave puede tocarse muchas veces en una ventana y
  // sólo hay que mandarla una. Set conserva el orden de inserción, que es el
  // orden en que se tocaron.
  private readonly claves = new Set<string>();
  // Claves cuyo efecto de persistencia ya corrió al menos una vez. La primera
  // corrida de cada efecto es la carga desde localStorage, no una edición: si
  // Firebase Auth restauró la sesión antes de la primera detección de cambios
  // (pasa seguido en el celular), esa corrida caía dentro de la ventana de
  // sync y anotaba las doce claves como tocadas. La bajada las salteaba todas
  // y el drenaje subía el estado viejo del dispositivo encima de la nube: las
  // comidas cargadas en el otro dispositivo desaparecían sin error.
  private readonly arrancadas = new Set<string>();

  iniciarSync(): void {
    this.sincronizando = true;
  }

  // Cierra la ventana y devuelve las claves a mandar. Idempotente a propósito:
  // `syncFromFirestore` tiene varias salidas tempranas y una llamada de más no
  // tiene que romper nada, mientras que una de menos dejaría la cola trabada
  // anotando para siempre.
  terminarSync(): string[] {
    this.sincronizando = false;
    const pendientes = [...this.claves];
    this.claves.clear();
    return pendientes;
  }

  // `true` = mandalo ahora. `false` = quedó anotado para el drenaje, o era
  // la corrida de arranque y no hay nada que mandar.
  debeGuardarAhora(clave: string): boolean {
    if (!this.arrancadas.has(clave)) {
      this.arrancadas.add(clave);
      return false;
    }
    if (!this.sincronizando) {
      return true;
    }
    this.claves.add(clave);
    return false;
  }

  // Copia de lo anotado, sin cerrar la ventana. La bajada la toma antes de
  // aplicar nada: después de los `set`, los efectos de la propia bajada se
  // anotan solos y ya no se distinguen de lo que escribió el usuario.
  pendientes(): string[] {
    return [...this.claves];
  }

  // Lo consulta la bajada antes de aplicar cada campo del documento remoto:
  // una clave que el usuario tocó durante la ventana no se pisa.
  fueTocado(clave: string): boolean {
    return this.claves.has(clave);
  }
}
