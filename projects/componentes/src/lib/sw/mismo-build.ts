type Manifiesto = { hashTable: Record<string, string> };

// El service worker decide "versión nueva" por el hash del ngsw.json, y ese
// hash incluye el `timestamp` del build. O sea: todo deploy es una versión
// nueva aunque los bundles sean byte a byte los mismos — que es lo que pasa
// en cada merge a main que sólo tocó la otra app. Y con
// navigationRequestStrategy "freshness" pasa siempre en la primera recarga
// tras un deploy: la página ya corre el build nuevo (vino de la red) pero el
// SW la tiene anotada en el viejo, así que avisa VERSION_READY de un build
// que ya está en pantalla.
//
// Los nombres de los archivos llevan content hash: si los que esta página
// tiene cargados siguen estando en el manifiesto nuevo, el código es el mismo
// y no hay nada que avisar.
//
// ponytail: compara sólo los subrecursos cargados; un cambio que toque
// únicamente el index.html (un meta, el title) pasa como "sin cambios". Si
// alguna vez importa, comparar además el hash de /index.html.
export function mismoCodigo(
  cargados: string[],
  hashTable: Record<string, string>
): boolean {
  const nuevos = Object.keys(hashTable);
  return cargados.length > 0 && cargados.every((ruta) => nuevos.includes(ruta));
}

// ngsw.json no está en ningún assetGroup, así que este fetch sale a la red
// (el bust es para los caches HTTP intermedios) y trae el manifiesto nuevo.
// Sólo tiene sentido en el browser, después de un VERSION_READY.
export async function mismoBuild(): Promise<boolean> {
  try {
    const respuesta = await fetch(`/ngsw.json?bust=${Date.now()}`, {
      cache: 'no-store',
    });
    const manifiesto = (await respuesta.json()) as Manifiesto;
    return mismoCodigo(rutasCargadas(), manifiesto.hashTable);
  } catch (err) {
    console.error('Failed to fetch ngsw.json:', err);
    return false;
  }
}

function rutasCargadas(): string[] {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[src]')
  ).map((el) => el.src);
  const hojas = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  ).map((el) => el.href);

  return [...scripts, ...hojas]
    .filter((url) => url.startsWith(location.origin))
    .map((url) => new URL(url).pathname);
}
