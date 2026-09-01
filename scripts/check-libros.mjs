// Verifica que el prerender haya dejado un HTML por libro con los og tags
// completos. Sin esto, un link pegado en WhatsApp sale sin portada y no hay
// forma de darse cuenta hasta que alguien lo comparte.
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const base = 'dist/perfil-personal/browser/libros';
const requeridos = ['og:image', 'og:title', 'og:url', 'og:description'];

const slugs = readdirSync(base).filter((f) =>
  existsSync(`${base}/${f}/index.html`),
);

if (slugs.length === 0) {
  throw new Error(`No se prerenderizó ningún libro en ${base}/`);
}

for (const slug of slugs) {
  const html = readFileSync(`${base}/${slug}/index.html`, 'utf8');
  for (const tag of requeridos) {
    if (!html.includes(`property="${tag}"`)) {
      throw new Error(`${slug}: falta el meta ${tag}`);
    }
  }
}

console.log(`og tags OK en ${slugs.length} libro(s): ${slugs.join(', ')}`);
