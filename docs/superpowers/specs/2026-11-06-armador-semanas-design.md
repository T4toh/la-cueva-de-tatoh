# Armador de semanas

Fecha: 2026-11-06
Estado: entrega 1 implementada

Las decisiones vienen del brainstorming del 2026-11-05. Lo que este documento
agrega por su cuenta está marcado *(mi decisión)*.

## Qué resuelve

Armar la semana es lo que ordena los mandados: la lista de compras sale del
plan. Hoy se arma a mano, slot por slot, desde el selector del día. El
recetario ya tiene más de cien comidas, y la app ya sabe cosas para elegir
bien entre ellas: las plantas de la semana, los chequeos de la guía, lo que
sobra en la despensa, lo que se comió las semanas anteriores. El armador usa
eso para llenar lo que falta de un toque.

Es para cualquier usuario, no para un plan de salud en particular.

## Objetivos

- Un botón que llena los **desayunos, almuerzos y cenas vacíos** de la semana
  que se está viendo. Postres y colación no: son texto libre.
- Respeta todo lo ya elegido, incluidas las salidas (un placeholder como
  "Comida afuera" o un asado ya ocupan el slot).
- Cada elección dice por qué la eligió.
- Una lista **No como** en Ajustes, que el armador nunca viola.

## No objetivos

- Reescribir o reordenar lo que el usuario ya puso.
- Llenar postres o colación.
- Planificar más de una semana a la vez.
- Calorías o fibra (dependen de un catálogo que todavía no las tiene).

## Anti-objetivos

Aunque funcione, esto es un fracaso si:

- sugiere algo que está en la lista No como;
- sugiere algo pesado para la estación (un guiso en enero en Buenos Aires);
- repite una comida en la misma semana.

## Dos entregas

Se construyen y se mergean por separado. La primera ya sirve sola.

1. **Algorítmica.** Funciones puras con Vitest, como en `catalogo/` y
   `guia/chequeos.ts`. Funciona como invitado y sin red.
2. **Flash encima.** Usa la conexión que dejó armada *completar recetas*
   (Firebase AI Logic + App Check con enforce). Elige entre los candidatos
   que ya filtró la entrega 1 y puede proponer recetas nuevas.

## Entrega 1: el armador algorítmico

### Qué slots llena

- De la semana que muestra el dashboard (`currentWeekStart`).
- Sólo los días de hoy en adelante, si es la semana actual. Los días pasados
  quedan como están, igual que en la lista de compras. *(mi decisión)*
- Sólo los tipos que el usuario tiene visibles en `visibleMeals`. Si oculta
  el desayuno, el armador no se lo llena. *(mi decisión)*
- Un slot está vacío si su arreglo de `Dish` está vacío. Un placeholder lo
  ocupa.
- Pone un solo plato por slot, con `portions: 1` y `excluded: false`, igual
  que `setMeal`. En modo familiar es lo mismo: se agregan platos a mano
  después.

### Candidatos

Para cada tipo de slot, la app arma la lista de comidas posibles. Hoy la
única pista del tipo son los tags, que están sueltos y desparejos. Por eso
*(mi decisión)*:

- Una comida es candidata a **desayuno** si tiene un tag que normalizado
  sea `desayuno`, o si alguna vez estuvo en un desayuno del historial de
  `schedules`.
- Para **almuerzo y cena** sirven las mismas comidas entre sí. Una comida es
  candidata si tiene un tag `almuerzo` o `cena`, o si alguna vez estuvo en un
  almuerzo o una cena. Si nada cumple esto (un usuario nuevo), son candidatas
  todas las que no sean de desayuno.
- **Nunca** son candidatas: los placeholders (`includeInShoppingList ===
  false`), lo que tiene un tag `postre`, `salsa` o `para probar`, ni lo que
  choca con la lista No como.

El dato limpio de plato principal / guarnición / desayuno queda para el ítem
*Comidas y acompañamientos por separado* del TODO. Cuando exista, reemplaza
esta heurística sin cambiar el resto.

### Filtro duro: No como

- La lista es de textos, en Ajustes (`/settings`): un input y chips para
  borrar. Se sincroniza con la clave `noComo` en `users/{uid}`, va al backup
  en la sección Ajustes y vive en localStorage para el invitado.
- Una entrada de la lista puede ser un ingrediente o una categoría que el
  catálogo ya conoce: un `grupo` o un tipo de `carne` ("pescado", "carne
  roja", "lácteos"). El input sugiere esas categorías y las entradas del
  catálogo, pero acepta texto libre. Lo que el catálogo no modela (gluten,
  picante) no se puede filtrar todavía: el input lo dice al escribirlo y sí
  se le pasa a Flash. *(mi decisión)*
- Una comida choca si alguno de sus ingredientes coincide con alguna
  entrada. Por ingrediente se compara, normalizado y por "contiene" en
  cualquiera de los dos sentidos, el texto escrito, el nombre de su entrada
  del catálogo y sus sinónimos. Así "cebolla" choca con "cebolla morada"
  aunque sean entradas distintas del catálogo. Por categoría se compara con
  el `grupo` y la `carne` de la entrada. *(mi decisión: el "contiene" acepta
  algún falso positivo; es mejor sacar de más que sugerir lo que no come)*
- La lista también se manda a Flash en *completar recetas*, que hoy tiene un
  `TODO` en `promptRevision` esperando esto.

### Estación

- Sale de la fecha del lunes de la semana y del hemisferio.
- El hemisferio sale del país, y el país por defecto se deduce del timezone
  del navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`). En
  Ajustes se puede cambiar el país. *(mi decisión: un select con los países
  de América y "otro hemisferio norte" / "otro hemisferio sur" alcanza;
  no hace falta una lista mundial)*
- Estaciones meteorológicas, por mes completo: en el sur, dic–feb verano,
  mar–may otoño, jun–ago invierno, sep–nov primavera. En el norte, al revés.
- Una comida con un tag de estación que no es la actual suma un castigo
  fuerte, pero no queda afuera. Se reconocen `verano`, `otoño`, `invierno`,
  `primavera` y los compuestos con guion (`otoño-invierno`). Sin tag de
  estación no hay castigo.

### Puntaje

Por cada slot vacío, en orden de día y dentro del día desayuno → almuerzo →
cena, se puntúa cada candidato contra la semana *como va quedando* (con las
elecciones anteriores ya puestas) y se elige uno. Es golozo a propósito: es
simple y se entiende. *(mi decisión)*

Suma:

- **Plantas nuevas** para la semana, mientras no se llegue a `META_PLANTAS`.
  Reusa la lógica de `comidasQueSuman` (`plantasDe` sale a export).
- **Usa lo que sobra en la despensa**: ingredientes de la comida que están
  en `pantry` con cantidad. Pesa menos que las plantas.

Resta:

- **Rompe un chequeo de la guía.** Pondría carbos en almuerzo y cena del
  mismo día, o la carne roja arriba de `MAX_CARNE_ROJA`. Se calcula con
  `chequearSemana` sobre la semana con el candidato puesto. Una regla oculta
  en `/guia` no se chequea, como en el dashboard.
- **Pescado**: mientras la semana tenga menos de `MIN_PESCADO`, el pescado
  suma en vez de restar.
- **Fuera de estación** (ver arriba).
- **Comida reciente**: estuvo en alguna de las dos semanas anteriores.

Reglas duras (el candidato queda afuera, no es un castigo):

- Ya está en la semana, puesto por el usuario o por el armador. Excepción:
  el desayuno, que rota con tope: el mismo desayuno hasta
  `MAX_DESAYUNO_REPETIDO = 3` veces en la semana. Si los candidatos no
  alcanzan para eso, se repite lo que haga falta antes de dejar un desayuno
  vacío. Un desayuno ya repetido resta, así que se prefiere rotar. *(del
  usuario: rota con tope 2-3; el 3 es mi decisión)*
- Choca con No como.

Para que no salga siempre la misma semana, se elige al azar entre los tres
mejores, con peso por puntaje. La función recibe el generador de números
como parámetro para que los tests sean deterministas.

Si un slot no tiene candidatos, queda vacío y se avisa cuántos quedaron.

### El porqué

Cada elección guarda un texto corto armado con lo que más pesó en su
puntaje: "suma 4 plantas nuevas", "usa el brócoli de la despensa", "pescado:
van 1 de 2". Se guarda en el `Dish` como `motivo?: string`, se ve debajo del
plato en el plan y se borra cuando el usuario cambia ese slot. Viaja con el
schedule (Firestore, backup). *(mi decisión: guardarlo y no recalcularlo,
porque el porqué de Flash no se puede recalcular)*

### En la pantalla

- Botón **Completar semana** en el dashboard, al lado de "Copiar semana
  anterior". Deshabilitado y con texto si no hay slots vacíos.
- Llena directo, sin pantalla de previsualización. Después aparece un aviso
  con **Deshacer**, que vuelve la semana a como estaba antes del toque.
  Dura hasta el próximo cambio del plan o hasta salir del dashboard.
  *(mi decisión: deshacer es más simple que una previsualización y deja ver
  el resultado en el mismo plan)*
- Los platos que puso el armador se distinguen hasta que el usuario los
  toque: el motivo debajo del plato, en el color de texto secundario.

## Entrega 2: Flash encima

### Elegir entre candidatos

- **Un botón aparte**, *Completar con Flash*, al lado de *Completar semana*,
  que sigue siendo algorítmico e instantáneo. *(del usuario)* Flash puede
  tardar hasta `ESPERA_MS` y gasta cuota: es una elección, no el camino por
  defecto. Muestra estado de carga mientras espera, y al terminar el mismo
  **Deshacer** que el algorítmico.
- Sólo con sesión iniciada, igual que *completar recetas*. Sin sesión, el
  botón queda deshabilitado con "Iniciá sesión para completar con Flash".
- Un pedido con el contexto preparado: la semana actual con lo ya puesto,
  los slots vacíos, los candidatos de cada slot con su resumen (el mismo
  `resumenParaFlash` de `revision/pedido.ts`) y su puntaje algorítmico, la
  estación, el país, la lista No como, las plantas de la semana y los
  chequeos.
- `responseSchema` con, por slot, un `mealId` como `enum` de los candidatos
  de ese slot y un `motivo`. Sin MCP ni function calling.
- La respuesta se valida con las mismas reglas duras de la entrega 1 (que el
  id exista y sea candidato, que no repita, que no choque con No como) y con
  `chequearSemana`. Un slot con respuesta inválida se llena con la elección
  algorítmica. Si el pedido falla entero (sin red, sin cuota, saturado), se
  llena todo con la entrega 1 y se avisa.
- Modelo: `gemini-flash-lite-latest`, como en *completar recetas*, por la
  misma razón (el Flash completo del free tier estaba saturado). Mismo
  `ESPERA_MS`. *(mi decisión)*

### Recetas nuevas

- Un **segundo pedido**, aparte. Sale solo únicamente cuando, después de
  *Completar con Flash*, quedan slots sin candidatos: una receta por slot
  vacío, tope de 3. Lo demás es a demanda, con un botón **Sugerime algo
  nuevo** que pide hasta 3 pensadas para sumar plantas a la semana. *(del
  usuario: el disparador "no llega a 30 plantas" saltaría casi siempre,
  porque pocas semanas llegan a 30)*
- Cada receta nueva trae nombre, tags e ingredientes con cantidades por una
  porción, en el mismo formato que `Ingredient`. Pasos opcionales. Se valida:
  sin ingredientes con cantidad, o con algo de No como, se descarta.
- Se muestran en un panel debajo del plan, con tres acciones:
  - **Usar**: se guarda en el recetario y se pone en el slot para el que se
    sugirió. Si vino de *Sugerime algo nuevo*, reemplaza al plato que puso el
    armador (con `motivo`) que menos plantas aporta a la semana, del mismo
    tipo de slot. Si no hay ninguno, va al primer slot vacío de ese tipo, y
    si tampoco hay, sólo se guarda en el recetario y se avisa. *(del
    usuario; el desempate por tipo de slot es mi decisión)*
  - **Guardar para después**: se guarda en el recetario con el tag
    `para probar`. No es candidata del armador mientras tenga ese tag.
  - **Descartar**: desaparece. No se recuerda. *(decisión del brainstorming)*
- Las sugerencias sin resolver no se guardan: al recargar se pierden.
  *(mi decisión)*

### Aviso

Igual que en *completar recetas*: junto al botón, visible, que en el free
tier Google puede usar los pedidos para entrenar. No es un consentimiento
guardado: el consentimiento es tocar el botón.

## Datos

- `Dish.motivo?: string`.
- Clave nueva `noComo: string[]` en el documento del usuario. No hace falta
  ninguna regla nueva de Firestore: vive en `users/{uid}`.
- País en `familySettings`, junto al modo familiar. Así se sincroniza y va
  al backup en la sección Ajustes, sin ninguna clave nueva. Sin valor, sale
  del timezone. *(mi decisión)*
- `recetasPublicas` no copia nada de esto: `aRecetaPublica` es lista blanca.

## Pruebas

Funciones puras con Vitest: estación por fecha y hemisferio, hemisferio por
timezone, candidatos por tipo, choque con No como, puntaje, armado de la
semana con un generador fijo (respeta lo puesto, no repite, no rompe
chequeos cuando hay alternativa, deja vacío lo que no tiene candidato), y el
porqué. En la entrega 2: armado del contexto, esquema, validación de la
respuesta y fallback. La llamada a Flash se mockea. Se prueba a mano una vez
contra el modelo real, en el 4200.

## Queda al builder

- Los pesos exactos del puntaje. Tienen que respetar el orden de este
  documento: las reglas duras nunca se compensan con puntaje, y fuera de
  estación pesa más que una planta.
- Dónde viven las funciones (sugiero `armador/`, como `guia/` y
  `revision/`).
- El texto exacto de los prompts y del porqué.
- El diseño del panel de recetas nuevas, con los tokens de tema y los
  botones que ya existen.
