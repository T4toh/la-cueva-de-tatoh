# Dokusho Renshuu - El pescador de kanjis se mudó

![Dokusho Renshuu](../posts/img/dokusho.png)

## Preámbulo

Hace un tiempo hice **Kanji no Ryoushi**, el pescador de kanjis: una app de Flutter con una burbuja flotante que quedaba sobre las demás apps, le marcabas un pedazo de pantalla y te devolvía el texto japonés reconocido. La hice porque todo lo que encontré para copiar texto de una imagen usaba modelos gratuitos para cobrarte por el resultado. El código era basura, lo decía el README, pero funcionaba.

En paralelo venía armando **Dokusho Renshuu** (読書練習, "práctica de lectura"): un lector de japonés donde tocás la palabra que no entendés, ves la definición con oraciones de ejemplo, y lo que tocaste queda guardado para exportarlo a Anki. Diccionario y todo adentro, sin internet.

En algún momento me di cuenta de que estaba manteniendo dos apps que hacían la mitad de lo mismo. El pescador reconocía texto pero no sabía qué decía. Dokusho sabía qué decía pero sólo lo que le pegabas a mano. Y la burbuja sobre otras apps es una cosa de Android por diseño del sistema, así que el "multiplataforma" de Flutter no me estaba dando nada.

## La mudanza

La captura de pantalla y el OCR pasaron a vivir dentro de Dokusho, que es Android nativo en **Kotlin + Compose**. El repo de Kanji no Ryoushi quedó archivado como referencia; el APK viejo sigue en la sección de utilidades marcado como deprecado, pero no recibe más cambios.

Lo que ganó la captura al mudarse es todo lo que Dokusho ya tenía:

- El texto reconocido cae en una nota con **furigana** y **diccionario al toque**, no en un cuadro de texto pelado.
- Las capturas son su propio tipo de contenido: viven en la pestaña `Notes`, con la imagen guardada, y no ensucian la biblioteca de cuentos.
- Tienen su **mazo de Anki** aparte (`Dokusho — Scans`), además de los de kanji y de historias.
- El **permiso de captura** se pide una vez por sesión de la burbuja, no una vez por captura.
- Si el OCR salió torcido, abrís la nota, tocás `Rescan area` sobre la imagen guardada, marcás un recuadro y el texto nuevo cae en el editor sin pisar lo que había.
- Para cerrar la burbuja sin entrar a la app la mantenés apretada, se convierte en una ✕, y un segundo toque la apaga.

## Qué es Dokusho hoy

Tres formas de leer:

- **Cuentos clásicos**. Diez obras de dominio público de Aozora Bunko (Momotarō, Urashima Tarō, Kintarō y otras) con furigana sobre los kanji y traducción literal al inglés por oración.
- **Tus textos**. Pegás o abrís un `.txt` en japonés y la app le genera la furigana y lo corta en oraciones.
- **Cualquier cosa en pantalla**. La burbuja: manga, tweets, juegos, capturas.

Y en cualquiera de las tres: tocás una palabra y aparece la definición con ejemplos; mantenés apretado para seleccionar; tocás un kanji para ver su detalle y marcarlo fácil, medio o difícil. Todo lo que tocaste se exporta a Anki cuando querés.

Todo **offline**. El diccionario (armado desde Jitendex, KANJIDIC2 y Tatoeba) y el modelo de OCR viajan dentro del APK. Por eso pesa 83 MB y por eso anda sin Google Play Services.

## Detalles antes de instalar

- Android 8 o superior. La captura de pantalla pide Android 10 o superior.
- El APK está firmado con clave de debug, así que Android avisa al instalar. Es esperable.
- Si venís de una beta anterior, instalás encima y quedan tus historias y tu progreso.
- Todavía no se actualiza sola. Hay que volver a las releases cuando salga una nueva; está en la lista.

## Repo y APK

El repo está acá: [github.com/T4toh/dokusho-renshuu](https://github.com/T4toh/dokusho-renshuu). El APK se baja desde [utilidades](/utilidades) o de las [releases](https://github.com/T4toh/dokusho-renshuu/releases/latest). Sigue en beta: lo uso todos los días pero el nombre lo dice, es práctica.

---

Tags: #android #kotlin #japones #ocr
