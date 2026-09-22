import type { Apk } from '../../../../variables';

type Release = {
  tag_name: string;
  draft: boolean;
  assets: { name: string; browser_download_url: string }[];
};

/** Elige la última release publicada y arma el Apk con su versión y descarga.
 *  GitHub devuelve las releases de la más nueva a la más vieja, así que la
 *  primera que sirva es la última: no hace falta comparar versiones. Para un
 *  APK tiene que traer un asset `.apk` (Dokusho también publica `db-vN`, el
 *  diccionario, sin APK: se salta). Para desktop alcanza el tag; la URL sigue
 *  siendo el repo. Sin candidata, `null`. */
export function conUltimaRelease(apk: Apk, releases: Release[]): Apk | null {
  for (const release of releases) {
    if (release.draft) {continue;}
    if (apk.tipo === 'desktop') {return { ...apk, version: release.tag_name };}
    const asset = release.assets.find((a) => a.name.endsWith('.apk'));
    if (asset) {return { ...apk, version: release.tag_name, url: asset.browser_download_url };}
  }
  return null;
}

/** Pide las releases del repo del Apk. Cualquier falla (sin red, rate limit
 *  de 60/h sin token, JSON raro) devuelve el Apk como vino: la vidriera nunca
 *  se queda sin tarjeta. */
export async function conVersionDeGithub(apk: Apk, fetchFn: typeof fetch = fetch): Promise<Apk> {
  if (!apk.repo) {return apk;}
  try {
    const res = await fetchFn(`https://api.github.com/repos/${apk.repo}/releases?per_page=10`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {return apk;}
    return conUltimaRelease(apk, (await res.json()) as Release[]) ?? apk;
  } catch {
    return apk;
  }
}
