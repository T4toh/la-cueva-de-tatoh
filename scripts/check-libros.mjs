// Verifica que el prerender haya dejado un HTML por libro con los og tags
// completos, que og:image sea absoluta y que la portada exista de verdad en el
// build. Sin esto, un link pegado en WhatsApp sale sin portada y no hay forma
// de darse cuenta hasta que alguien lo comparte.
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = 'dist/perfil-personal/browser';
const base = `${root}/libros`;
const requeridos = ['og:image', 'og:title', 'og:url', 'og:description'];

const contenidoDe = (html, prop) =>
  html.match(new RegExp(`<meta content="([^"]*)" property="${prop}">`))?.[1];

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
console.log(`landing OK: sin meta-refresh y ${tarjetas} proyectos en el HTML`);
