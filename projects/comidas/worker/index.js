// Corre sólo en /r/* (ver `run_worker_first` en wrangler.jsonc). Lee la receta
// pública por REST y reescribe los meta del index.html, porque el crawler de
// WhatsApp no corre JS y comidas no se prerenderiza.
const PROYECTO = 'la-cueva-comidas';
const DOCUMENTOS =
  `https://firestore.googleapis.com/v1/projects/${PROYECTO}` +
  '/databases/(default)/documents/recetasPublicas';
const IMAGEN = 'https://comidas.tatoh.ar/icon.png';
export const ID_VALIDO = /^[a-z0-9]{8}$/;

const CAMPOS = {
  'og:title': 'titulo',
  'og:description': 'descripcion',
  'og:image': 'imagen',
  'og:url': 'url',
};

const texto = (campo) => (campo && campo.stringValue) || '';
const largo = (campo) =>
  ((campo && campo.arrayValue && campo.arrayValue.values) || []).length;

// La forma REST de Firestore (`{ stringValue }`, `{ arrayValue: { values } }`)
// es un contrato externo: si cambia, sin esto se leería como una receta de
// cero ingredientes en vez de fallar.
export function normalizar(fields) {
  if (!fields) {
    return null;
  }
  return {
    nombre: texto(fields.nombre) || 'Receta',
    descripcion: texto(fields.descripcion),
    alias: texto(fields.alias),
    foto: texto(fields.foto),
    ingredientes: largo(fields.ingredientes),
    pasos: largo(fields.pasos),
  };
}

async function leerReceta(id) {
  const respuesta = await fetch(`${DOCUMENTOS}/${id}`);
  if (!respuesta.ok) {
    return null;
  }
  const { fields } = await respuesta.json();
  return normalizar(fields);
}

export function describir(receta) {
  // `descripcion` es texto sin confirmar de cualquier usuario autenticado
  // (firestore.rules valida quién escribe, no qué escribe), y documentos
  // publicados antes de este fix pueden traer sólo espacios en blanco.
  const descripcion = receta.descripcion.trim();
  if (descripcion) {
    return descripcion;
  }
  const partes = [`${receta.ingredientes} ingredientes`];
  if (receta.pasos) {
    partes.push(`${receta.pasos} pasos`);
  }
  const cuerpo = partes.join(', ');
  return receta.alias ? `Receta de ${receta.alias} · ${cuerpo}` : cuerpo;
}

// El Worker no revalida lo que el editor ya validó —`setAttribute` escapa, así
// que meter la URL tal cual no abre ninguna inyección—. Esto es un fallback: un
// `og:image` en http sobre una página https es contenido mixto y varios
// crawlers lo descartan, y sin foto hay que caer al ícono en vez de emitir el
// tag vacío.
export function imagenDe(receta) {
  return receta.foto && receta.foto.startsWith('https://')
    ? receta.foto
    : IMAGEN;
}

// ponytail: el `fetch` de acá abajo no tiene test — `HTMLRewriter` y el
// binding `ASSETS` no existen fuera del runtime de Workers, y traerlos es una
// dependencia nueva. La lógica pura (`ID_VALIDO`, `normalizar`, `describir`)
// sí está cubierta en `src/app/worker-og.spec.ts`; el rewrite se verifica a
// mano con `wrangler dev` y un curl con user-agent de crawler. Salida:
// vitest-pool-workers si esto crece.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/r/')) {
      // Nada fuera de /r/* necesita Firestore: es asset puro o un 404 de SPA.
      return env.ASSETS.fetch(request);
    }

    try {
      const segmentos = url.pathname.split('/').filter(Boolean);
      const id = segmentos[segmentos.length - 1] || '';

      const receta = ID_VALIDO.test(id) ? await leerReceta(id) : null;
      if (!receta) {
        // Sin receta, la SPA se encarga de decir que no existe.
        return env.ASSETS.fetch(request);
      }

      const meta = {
        titulo: receta.nombre,
        descripcion: describir(receta),
        imagen: imagenDe(receta),
        // La URL canónica es la que el crawler acaba de pedir, no `ruta`: ese
        // campo lo escribe el dueño del documento como texto libre y las
        // reglas de Firestore validan quién escribe, no qué escribe.
        url: url.origin + url.pathname,
      };

      // `/` y no `/index.html`: con el `html_handling` por defecto
      // (`auto-trailing-slash`) el binding contesta `/index.html` con un 307 a
      // `/`, y ese redirect se propagaría tal cual —sin body que reescribir— y
      // el crawler terminaría leyendo los meta genéricos de la home.
      // Sin el request como segundo argumento: si no, reenvía el
      // If-None-Match del cliente y un 304 sin cuerpo rompe el rewrite.
      const shell = await env.ASSETS.fetch(new URL('/', url.origin));

      const transformado = new HTMLRewriter()
        .on('title', {
          element(el) {
            el.setInnerContent(meta.titulo);
          },
        })
        .on('meta', {
          element(el) {
            const clave = el.getAttribute('property') || el.getAttribute('name');
            if (!Object.hasOwn(CAMPOS, clave)) {
              return;
            }
            // setAttribute escapa. Nunca concatenar: el nombre de la receta lo
            // escribe un usuario y termina adentro de un atributo HTML.
            el.setAttribute('content', meta[CAMPOS[clave]]);
          },
        })
        .transform(shell);

      const respuesta = new Response(transformado.body, transformado);
      respuesta.headers.set('cache-control', 'public, s-maxage=60');
      // El ETag es el del shell sin reescribir: dejarlo haría que todas las
      // recetas compartieran validador con cuerpos distintos.
      respuesta.headers.delete('etag');
      return respuesta;
    } catch {
      // Firestore inalcanzable, JSON roto, lo que sea: la SPA sabe arrancar
      // sola con los meta por defecto de index.html.
      return env.ASSETS.fetch(request);
    }
  },
};
