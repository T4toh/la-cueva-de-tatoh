// Verifica el manifest del service worker de cada app buildeada. Dos cosas se
// rompen en silencio: que el `index` del manifest no esté cacheado —el SW
// registra igual, pero no puede servir ninguna navegación, así que la app no
// anda offline y parece que el SW "no existe"— y que un archivo del hashTable
// no esté en el build o tenga otro hash, que hace fallar la instalación.
//
// El caso concreto: con `outputMode: "static"` el builder apunta el `index`
// del manifest a /index.csr.html (el shell de CSR), no al /index.html
// prerenderizado. Si el ngsw-config.json no lista /index.csr.html, el índice
// queda afuera del cache.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const apps = readdirSync('dist', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `dist/${d.name}/browser`)
  .filter((raiz) => existsSync(`${raiz}/ngsw.json`));

if (apps.length === 0) {
  throw new Error('No hay ningún ngsw.json en dist/*/browser: ¿corrió el build de producción?');
}

for (const raiz of apps) {
  const manifest = JSON.parse(readFileSync(`${raiz}/ngsw.json`, 'utf8'));
  const hashTable = manifest.hashTable;

  if (!hashTable[manifest.index]) {
    throw new Error(
      `${raiz}: el index del manifest (${manifest.index}) no está en el hashTable, ` +
        'así que ningún assetGroup lo cachea y el SW no puede servir una navegación. ' +
        `Agregalo a los files del grupo "app" en el ngsw-config.json de la app.`,
    );
  }

  for (const [url, hash] of Object.entries(hashTable)) {
    const archivo = `${raiz}${url}`;
    if (!existsSync(archivo)) {
      throw new Error(`${raiz}: el hashTable lista ${url}, que no está en el build`);
    }
    const real = createHash('sha1').update(readFileSync(archivo)).digest('hex');
    if (real !== hash) {
      throw new Error(
        `${raiz}: ${url} tiene hash ${real} y el manifest dice ${hash}. ` +
          'La instalación del SW falla con un solo hash que no coincide.',
      );
    }
  }

  console.log(
    `${raiz}: index ${manifest.index} cacheado, ${Object.keys(hashTable).length} archivos OK`,
  );
}
