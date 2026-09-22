# tWriter, cuatro meses después - De alpha a herramienta de trabajo

## Preámbulo

En mayo [conté](/blog/12) que había armado tWriter para juntar en una sola app las cuatro herramientas que usaba para escribir: editor, conversor de diálogos al estilo RAE, gramática y export a EPUB. Estaba en alpha, lo usaba yo y nadie más, y el post terminaba con "todavía falta para que sea cómodo para alguien más".

Desde entonces: 799 commits, 20 releases (v0.7 a v0.19), y [La Ciudad de Las Luces](/blog/15), 90 capítulos, salió entera de acá. Ya no es un experimento. Es con lo que trabajo.

## Lo que cambió

**Se instala como una app normal.** Está en AUR como `twriter-bin`, y hay `.deb`, `.dmg` para Intel y Apple Silicon, y `.exe`. Se actualiza sola con el updater de Tauri: firma verificada, avisa cuando hay versión nueva, un click.

**Busca de verdad.** Índice de texto completo con tantivy, en Rust. Multi-palabra es AND, hay operadores, alcance por capítulo, libro, saga o repo entero, y la forma exacta gana: buscar `¡Duendes!` no te trae cualquier `duendes`, y `—dijo` trae sólo los capítulos con la raya pegada al verbo. Reindexa al guardar. Y reemplaza en lote con el mismo selector de alcance, que para renombrar un personaje a mitad de saga es la diferencia entre una tarde y un click.

**Revisa como un editor pesado.** Además del validador RAE y la gramática con LanguageTool:

- Un **detector de repeticiones cercanas**, en español e inglés. El prototipo tiraba 6.000 avisos en un capítulo de 59 KB; calibrado contra prosa real con seis capas de exclusión quedó en algo que se puede leer. Corre en 1 ms, en TypeScript, porque medí y no valía la pena cruzar a Rust.
- Un **tesauro offline**, 14 MB por idioma que sí viven en Rust. No lematiza a propósito: sugerir `existir` por `eres` rompe la oración.
- **Revisión por libro**: una pantalla que corre todo sobre todos los capítulos y te deja aplicar los arreglos automáticos sin comerse el HTML.
- El **diccionario propio** de cada saga ahora sugiere, genera las formas derivadas al agregar una palabra (`teletransportar` silencia `teletransportó`), y entiende términos compuestos como `Amalut de las Arenas`.
- Los falsos positivos de LanguageTool se **nombran y se matan** por saga, no se ignoran hasta la próxima corrida.

**Y LanguageTool también mejoró, porque le mandé los arreglos.** Escribir en rioplatense contra un corrector pensado para tuteo es una pelea. En vez de silenciar reglas, forkeé LanguageTool y mandé los cambios: cinco PRs mergeados upstream, entre ellos una regla nueva que detecta la mezcla de tuteo y voseo en una misma oración, otra que marca `tú` con un verbo voseante, y el "más seguido" adverbial que el corrector insistía en leer como adjetivo. Cualquiera que escriba en voseo con LanguageTool ya lo tiene.

**Notas, extras y estructura.** Las notas en Markdown se leen en un panel al costado sin sacarte del capítulo. Hay split view para escribir con dos capítulos abiertos. Un importer trae `.docx` y `.odt` por Pandoc, y también exportaciones de Joplin. Los extras (manuscritos viejos, mapas, glosarios) tienen su árbol y no ensucian el EPUB.

**El EPUB salió de la etapa "funciona".** Back matter completo: sobre el autor, otros libros, agradecimientos. Imágenes reescaladas al embeber, que la tapa iba a resolución de imprenta adentro del archivo. XHTML estricto porque Apple Books aborta en el primer `<br>` sin cerrar. Fuentes en un pool del repo con italic y bold sintetizados desde la regular, tema editorial aparte para las páginas que no son prosa, y el título del capítulo donde vos quieras, con el fallback para que Kindle también lo centre.

**Y detalles que sólo importan cuando escribís todos los días.** El corrector del sistema operativo apagado dentro del editor, porque macOS me reescribía el voseo. Restaurar sesión con el cursor en la posición exacta. Un badge con "hace 5 min" al lado de cada capítulo. Auto-commit a git cada cinco minutos como red de seguridad, o modo nube si el repo vive en Dropbox, o local si no querés nada.

## Qué aprendí

Medir antes de mover a Rust. Dos veces el instinto dijo "esto va en Rust" y una vez tuvo razón (el tesauro, por el tamaño) y una vez no (las repeticiones, 1 ms en TypeScript). El bridge entre el webview y Rust tiene un costo, y serializar un capítulo de ida y vuelta puede ser más caro que el cálculo.

Y que una herramienta para escribir se prueba escribiendo. Casi todo lo de arriba nació de una molestia concreta a mitad de un capítulo, no de una lista de features.

## Repo

Sigue acá: [github.com/T4toh/tWriter](https://github.com/T4toh/tWriter). Las releases, en [utilidades](/utilidades). El README tiene todo con más detalle del que nadie pidió.

---

Tags: #linux #rust #angular #tauri #escritura
