// Corre sólo en /r/* (ver `run_worker_first` en wrangler.jsonc). Lee la receta
// pública por REST y reescribe los meta del index.html, porque el crawler de
// WhatsApp no corre JS y comidas no se prerenderiza.
const PROYECTO = 'la-cueva-comidas';
const DOCUMENTOS =
  `https://firestore.googleapis.com/v1/projects/${PROYECTO}` +
  '/databases/(default)/documents/recetasPublicas';
const IMAGEN = 'https://comidas.tatoh.ar/icon.png';
const ID_VALIDO = /^[a-z0-9]{8}$/;

const CAMPOS = {
  'og:title': 'titulo',
  'og:description': 'descripcion',
  'og:image': 'imagen',
  'og:url': 'url',
  'twitter:title': 'titulo',
  'twitter:description': 'descripcion',
  'twitter:image': 'imagen',
};

const texto = (campo) => (campo && campo.stringValue) || '';
const largo = (campo) =>
  ((campo && campo.arrayValue && campo.arrayValue.values) || []).length;

async function leerReceta(id) {
  const respuesta = await fetch(`${DOCUMENTOS}/${id}`);
  if (!respuesta.ok) {
    return null;
  }
  const { fields } = await respuesta.json();
  if (!fields) {
    return null;
  }
  return {
    nombre: texto(fields.nombre) || 'Receta',
    descripcion: texto(fields.descripcion),
    alias: texto(fields.alias),
    ruta: texto(fields.ruta) || '/',
    ingredientes: largo(fields.ingredientes),
    pasos: largo(fields.pasos),
  };
}

function describir(receta) {
  if (receta.descripcion) {
    return receta.descripcion;
  }
  const partes = [`${receta.ingredientes} ingredientes`];
  if (receta.pasos) {
    partes.push(`${receta.pasos} pasos`);
  }
  const cuerpo = partes.join(', ');
  return receta.alias ? `Receta de ${receta.alias} · ${cuerpo}` : cuerpo;
}

// ponytail: sin test automático — no hay runner de Workers y agregarlo es una
// dependencia nueva. Se verifica a mano con `wrangler dev` y un curl con
// user-agent de crawler. Salida: vitest-pool-workers si esto crece.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
      imagen: IMAGEN,
      url: new URL(receta.ruta, url.origin).toString(),
    };

    const shell = await env.ASSETS.fetch(
      new Request(new URL('/index.html', url.origin), request)
    );

    const transformado = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(meta.titulo);
        },
      })
      .on('meta', {
        element(el) {
          const clave = el.getAttribute('property') || el.getAttribute('name');
          const campo = CAMPOS[clave];
          if (campo) {
            // setAttribute escapa. Nunca concatenar: el nombre de la receta lo
            // escribe un usuario y termina adentro de un atributo HTML.
            el.setAttribute('content', meta[campo]);
          }
        },
      })
      .transform(shell);

    const respuesta = new Response(transformado.body, transformado);
    respuesta.headers.set('cache-control', 'public, s-maxage=60');
    return respuesta;
  },
};
