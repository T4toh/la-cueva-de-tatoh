# tWriter — Escribir novelas como un gordo

## Preámbulo

Vengo escribiendo novelas hace un rato y el flujo siempre es el mismo cuatreto:

1. Escribir en LibreOffice.
2. Pasar los diálogos del estilo inglés (`"..."`) al estilo RAE (con guion largo).
3. Chequear gramática en alguna herramienta aparte.
4. Exportar a EPUB y meterle mano fina en Reedsy.

Cuatro herramientas, cero conexión entre ellas. Si toco un capítulo tengo que rehacer la mitad del pipeline. Eso cansa, sobre todo cuando lo único que querés es escribir.

## tWriter

Para meter toda la cadena en un mismo lugar armé **tWriter**: editor + conversor RAE + (próximamente) chequeo gramatical + export EPUB. Una sola app, un solo flujo.

El stack: **Tauri 2** (Rust + WebView nativo) con frontend en **Angular 21 + TipTap**. Resultado: una app desktop chiquita, multiplataforma y nativa, sin Electron arrastrando 300 MB de Chromium.

Las novelas viven en un **repo aparte** (HTML por capítulo + JSON con metadata). tWriter es solo el editor que manipula ese repo. Eso me deja versionar todo con git, hacer diffs entre versiones y revertir cuando me arrepiento de matar a un personaje sin querer.

## Qué hace hoy

- Editor rich-text con TipTap.
- Conversor de diálogos al estilo RAE (los `"..."` pasan a `—...—` siguiendo las reglas D1-D5 que mantengo en otro repo más viejo: [dialogos_a_esp](https://github.com/T4toh/dialogos_a_esp)).
- Export a EPUB con tapa, contratapa, fuentes custom y temas reutilizables.
- Soporte de **sagas**: agrupás varios libros bajo una misma serie con metadata compartida.
- Extras (manuscritos viejos, mapas, glosarios) y fuentes per-libro o per-saga sin contaminar el export del EPUB.

## Qué viene

- Empaquetado para **AUR** (probablemente `twriter-bin`). En cuanto tenga el primer release estable.
- Chequeo de gramática integrado, sin salir de la app.
- Notas de research (worldbuilding, personajes, líneas de tiempo) versionadas junto al libro.

## Repo

Está acá: [github.com/T4toh/tWriter](https://github.com/T4toh/tWriter).

Sigue en alpha — lo uso a diario para mi propia escritura pero todavía falta para que sea cómodo para alguien más. Si te interesa el desarrollo, ⭐ y esperá el release. Si te entusiasma demasiado, abrí issue.

---

Tags: #linux #rust #angular #tauri #escritura
