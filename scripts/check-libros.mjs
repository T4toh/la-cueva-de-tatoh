// Verifica que el prerender haya dejado los og tags donde tienen que estar:
// uno por libro con la portada real, y uno por cada ruta prerenderizada con su
// og:url propio. Sin esto, un link pegado en WhatsApp sale sin preview y no hay
// forma de darse cuenta hasta que alguien lo comparte.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

const root = 'dist/perfil-personal/browser';
const base = `${root}/libros`;
const sitio = 'https://tatoh.ar';
const requeridos = ['og:image', 'og:title', 'og:url', 'og:description'];

// Agnóstico al orden de atributos: Angular los emite en el orden en que se
// setean, y no es el mismo para los `name=` que para los `property=`.
const contenidoDe = (html, prop) => {
  const atributo = prop.startsWith('og:') ? 'property' : 'name';
  const tag = html.match(new RegExp(`<meta[^>]*\\b${atributo}="${prop}"[^>]*>`))?.[0];
  return tag?.match(/content="([^"]*)"/)?.[1];
};

const slugs = readdirSync(base).filter((f) =>
  existsSync(`${base}/${f}/index.html`),
);

if (slugs.length === 0) {
  throw new Error(`No se prerenderizó ningún libro en ${base}/`);
}

for (const slug of slugs) {
  const html = readFileSync(`${base}/${slug}/index.html`, 'utf8');

  for (const tag of requeridos) {
    if (!contenidoDe(html, tag)) {
      throw new Error(`${slug}: falta el meta ${tag}`);
    }
  }

  const imagen = contenidoDe(html, 'og:image');
  if (!imagen.startsWith('https://')) {
    throw new Error(
      `${slug}: og:image tiene que ser absoluta, es "${imagen}". ` +
        'Los crawlers no resuelven rutas relativas.',
    );
  }

  // Si la portada la servimos nosotros, tiene que estar en el build.
  const propia = imagen.replace(/^https:\/\/[^/]+/, '');
  if (propia !== imagen && !existsSync(`${root}${propia}`)) {
    throw new Error(`${slug}: og:image apunta a ${propia}, que no está en el build`);
  }
}

// Toda ruta prerenderizada tiene que publicar su propio og:url. Chequear que
// los tags existan no alcanza: index.html trae un juego por defecto, así que
// una ruta que se olvidó de llamar al servicio Seo igual pasaría. El og:url
// apuntando a la ruta misma es lo que prueba que el componente los escribió.
const paginas = [];
const recorrer = (dir, ruta) => {
  if (existsSync(`${dir}/index.html`)) {
    paginas.push({ ruta, archivo: `${dir}/index.html` });
  }
  for (const entrada of readdirSync(dir)) {
    const hijo = `${dir}/${entrada}`;
    if (statSync(hijo).isDirectory()) {
      recorrer(hijo, `${ruta}/${entrada}`);
    }
  }
};
recorrer(root, '');

for (const { ruta, archivo } of paginas) {
  for (const tag of requeridos) {
    if (!contenidoDe(readFileSync(archivo, 'utf8'), tag)) {
      throw new Error(`${ruta || '/'}: falta el meta ${tag} en ${archivo}`);
    }
  }

  const url = contenidoDe(readFileSync(archivo, 'utf8'), 'og:url');
  const esperada = `${sitio}${ruta}`;
  if (url !== esperada) {
    throw new Error(
      `${ruta || '/'}: og:url es "${url}" y tendría que ser "${esperada}". ` +
        'La ruta no publicó sus meta tags: le falta el inject(Seo).publicar().',
    );
  }
}

// Un redirect en la ruta '' hace que el prerender emita un meta-refresh como
// index.html: el visitante ve una pantalla "Redirecting" antes de rebotar.
const home = readFileSync(`${root}/index.html`, 'utf8');
if (/http-equiv="refresh"/.test(home)) {
  throw new Error(
    'index.html es un stub de redirect, no el home prerenderizado. ' +
      "La ruta '' tiene que cargar un componente, no usar redirectTo.",
  );
}

// El landing tiene que salir servido desde el HTML: si las tarjetas se
// dibujaran recién en el browser, un crawler vería una página vacía.
const tarjetas = home.match(/class="proyecto-card"/g)?.length ?? 0;
if (tarjetas < 4) {
  throw new Error(
    `El landing prerenderizado trae ${tarjetas} tarjetas de proyecto, ` +
      'esperaba al menos 4. Revisá el render de PROYECTOS/APKS.',
  );
}

console.log(`og tags OK en ${slugs.length} libro(s): ${slugs.join(', ')}`);
console.log(`og:url propio OK en ${paginas.length} ruta(s) prerenderizada(s)`);
console.log(`landing OK: sin meta-refresh y ${tarjetas} proyectos en el HTML`);
