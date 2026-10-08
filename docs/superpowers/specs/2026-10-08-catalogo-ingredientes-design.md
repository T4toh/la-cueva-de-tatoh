# Catálogo de ingredientes, porciones y plantas por semana

Fecha: 2026-10-08
Estado: diseñado, sin implementar

## Qué resuelve

Que comidas ayude a comer mejor —y a bajar de peso controlando cantidades— con
información que ya está estudiada, sin inventar nada. Tres cosas que hoy no
existen:

1. **Normalización.** Hoy el autocompletado de ingredientes sale sólo de las
   comidas propias (`allIngredientNames`) y los tags son texto libre: la misma
   cosa aparece como "Pollo", "pechuga" y "pechuga de pollo".
2. **Porción por persona.** El modelo ya trata los ingredientes de un `Meal`
   como **una porción**: la lista de compras los multiplica por
   `Dish.portions` (`meal.service.ts`, `multiplyQuantity`). Pero nada lo dice
   en pantalla, y nada sugiere cuánto es una porción razonable.
3. **Variedad.** Ninguna señal de cuántos vegetales distintos entran en la
   semana.

La app es para cualquier usuario: las restricciones o planes particulares
(hipograso, etapas de una nutricionista) no son reglas fijas.

## La decisión que manda

**Un catálogo base que viaja con la app, y encima el catálogo propio de cada
usuario.** Mismo modelo que un corrector ortográfico: un diccionario de
referencia y tus palabras. El catálogo **sugiere, no obliga**: se puede
escribir cualquier ingrediente; lo que no se reconoce queda *sin clasificar* y
se clasifica una sola vez.

Las tres funciones (normalizar, sugerir porción, contar plantas) leen del mismo
catálogo. No hay tres tablas.

## Modelo de datos

```ts
// projects/comidas/src/app/catalogo/catalogo.ts
export type Grupo =
  | 'hortalizas'
  | 'frutas'
  | 'feculentos'       // legumbres, cereales, papa, batata, choclo, pastas
  | 'pan'
  | 'lacteos'
  | 'carnesHuevos'
  | 'aceitesSemillas'  // aceites, semillas, frutas secas
  | 'condimentos';     // sal, especias, hierbas: sin porción

export type EntradaCatalogo = {
  nombre: string;          // canónico, en minúsculas: 'pechuga de pollo'
  sinonimos?: string[];    // ['pechuga', 'pollo (pechuga)']
  grupo: Grupo;
  unidad: string;          // la que sugiere el editor: 'g', 'unidad', 'cda'
  porcion?: number;        // por persona, en `unidad`. Ausente = no sugiere
  estimada?: boolean;      // la porción no sale literal de la fuente
  planta?: boolean;        // sólo cuando contradice al grupo
  legumbre?: boolean;      // dentro de `feculentos`: porotos, lentejas, garbanzos…
};

export const CATALOGO: readonly EntradaCatalogo[] = [ /* ... */ ];
export const TAGS_BASE: readonly string[] = [ /* ... */ ];
```

`Meal` e `Ingredient` **no cambian**. No hay migración.

### Catálogo propio

Clave nueva `catalogoPropio: EntradaCatalogo[]` en el documento
`users/{uid}`, con su espejo en localStorage (`comidas_catalogo_propio`) y su
efecto de persistencia por la `ColaDeGuardado`, como cualquier otra clave.
Entra en `CLAVES_BACKUP`, en el export y en los handlers de `importData`.
Las reglas de Firestore no cambian: es un campo más del documento del usuario.

Una entrada propia con el mismo nombre normalizado que una del base **la
reemplaza**. Así se corrige el base sin tocarlo.

### Qué es planta

Por defecto lo decide el grupo: `hortalizas`, `frutas`, `feculentos`, `pan` y
`aceitesSemillas` son planta; `carnesHuevos`, `lacteos` y `condimentos` no.
`planta` en la entrada sólo existe para las excepciones: el aceite de oliva
(`aceitesSemillas`, pero no es una planta entera) es `false`; el perejil o la
albahaca frescos (`condimentos`) son `true`.

## Búsqueda

Una función pura `clasificar(nombre, catalogo): EntradaCatalogo | null`, sobre
un `Map` de nombre normalizado → entrada construido una vez por catálogo
efectivo (base + propio).

1. Normalizar con la misma regla que ya usa el importador para duplicados
   (minúsculas, sin acentos, sin espacios sobrantes). Hoy es el método privado
   `normalizeName` de `MealService`: sale a una función exportada y la usan los
   dos.
2. Buscar por nombre canónico y por sinónimos.
3. Si no hay, reintentar sin plural (`tomates` → `tomate`, `limones` → `limon`).
4. Si tampoco, `null`: *sin clasificar*.

Sin coincidencias parciales: "zanahoria rallada" no se deduce sola de
"zanahoria"; va como sinónimo en el catálogo. Una coincidencia parcial
clasificaría "salsa de tomate" como hortaliza.

## Editor

Todo pasa en `meal-editor`.

- **Por persona.** El título pasa a *Ingredientes · para 1 persona*, con una
  línea tenue: *Las cantidades son de una porción; la lista de compras y el ×N
  de la receta las multiplican.* Una vez, arriba.
- **Autocompletado.** `filteredSuggestions` busca primero en el catálogo
  efectivo (nombre y sinónimos) y después en los nombres propios que no están
  en él. Cada sugerencia del catálogo lleva un chip con el grupo. Al elegir
  una, el nombre queda canónico y, **sólo si cantidad y unidad están vacías**,
  se precargan con la porción de referencia. Nunca pisa lo escrito.
- **Referencia por fila.** Debajo de cada fila clasificada, en texto tenue:
  `ref. 150 g por persona`. Si la unidad coincide y la cantidad supera **1,5×**
  la referencia, pasa a tono de aviso. Con unidad distinta no compara, sólo
  muestra. No bloquea nada.
- **Sin clasificar.** La fila muestra un chip `sin clasificar`; tocarlo abre un
  mini formulario —grupo (select), unidad, porción opcional— que guarda en
  `catalogoPropio`. El chip de grupo de una fila ya clasificada abre el mismo
  formulario: así se corrige una entrada del base.
- **Tags.** El autocompletado de tags ofrece `TAGS_BASE` primero y después los
  propios (`tagsUnicos`). Se sigue pudiendo escribir cualquiera.

No hay pantalla de "mi catálogo" en esta versión: todo se crea y corrige desde
la fila que lo necesita.

## Porciones y plato

Referencias por persona y por comida, de adulto, del *Manual para la aplicación
de las Guías Alimentarias para la Población Argentina* (GAPA):

| Grupo | GAPA | En el catálogo |
|---|---|---|
| Hortalizas | ½ plato playo | sin gramos; lo cubre el resumen del plato |
| Frutas | 1 mediana o 1 taza | `1 unidad` |
| Feculentos | 125 g cocido (½ taza); 1 papa mediana; ½ choclo | arroz y pastas: **50 g crudos** (`estimada`: 125 g cocidos ÷ rendimiento de cocción) |
| Pan | 60 g (1 mignón) | `60 g` |
| Lácteos | 1 taza de leche (200–250 cc); 1 vaso de yogur (200 g); 3 fetas de queso de máquina; 3 cdas de queso de rallar | por entrada |
| Carnes y huevos | palma de la mano; o 1 huevo | carnes **150 g** (`estimada`: las GAPA no dan gramos); huevo `1 unidad` |
| Aceites y semillas | 1 cda sopera de aceite o semillas; 1 puñado de frutas secas | `1 cda` / `1 puñado` |

El umbral de 1,5× es una elección de diseño, no de las GAPA.

### Resumen del plato

Al pie de los ingredientes, chips de **presencia** por grupo, siguiendo la
distribución de almuerzo y cena del manual:

`Verdura ✓ · Proteína ✓ · Feculento — · Aceite ✓`

- *Proteína* se cumple con `carnesHuevos`, o con una entrada `legumbre` más
  otra de `feculentos` que no lo sea (legumbre + cereal: el reemplazo de la
  carne que dan las GAPA).
- No se calculan proporciones: con unidades mezcladas (g, unidad, cda) no son
  comparables.
- No se exige ningún grupo — un desayuno o una ensalada no son un almuerzo
  completo. Lo único que se resalta es la **falta de verdura**, la regla que las
  GAPA ponen en almuerzo y cena.

## Plantas por semana

*(Sección a confirmar en la revisión del spec.)*

Inspirado en *Plant Powered Plus* (Bulsiewicz), cuyo protocolo cierra cada
semana con un total de plantas distintas. Meta por defecto: **30 por semana**,
el umbral del American Gut Project (McDonald et al., *mSystems*, 2018).

- **Qué cuenta.** Las entradas canónicas con `planta` de todos los `Dish` no
  excluidos de la semana visible (desayuno, almuerzo, cena). "Zanahoria" y
  "zanahoria rallada" son una. Los campos de texto libre (postres, colación) y
  los ingredientes sin clasificar no cuentan; los sin clasificar se informan
  aparte ("+3 sin clasificar") para que se vea qué falta normalizar.
- **Dónde.** En el `dashboard`, bajo `weekRangeDisplay()`: `23 de 30 plantas`.
- **Al tocarlo.** Un panel con las plantas contadas y hasta tres comidas
  propias que más plantas **nuevas** sumarían a la semana.
- La meta es una constante, no un ajuste. Configurable cuando alguien la quiera
  distinta.

## Contenido del catálogo inicial

Unas 300 entradas de ingredientes comunes en Argentina, con sinónimos, armadas
a mano a partir de las comidas cargadas, los planes de alimentación de
referencia y los grupos de las GAPA. Va en un archivo de datos, separado de la
lógica. `TAGS_BASE`: tipo de comida (desayuno, almuerzo, cena, colación,
postre), forma (ensalada, guarnición, sopa, tarta, guiso), y atributos
(vegetariano, rápido, al horno).

## Tests

- `clasificar`: canónico, sinónimo, plural, acentos, sin clasificar, entrada
  propia que reemplaza a la del base, sin coincidencia parcial.
- `esPlanta`: por grupo y por excepción.
- Resumen del plato: proteína por carne, por legumbre + cereal, falta de
  verdura.
- Conteo semanal: dedupe por entrada canónica, `excluded` no cuenta, sin
  clasificar aparte.
- Persistencia de `catalogoPropio`: viaja en backup e `importData`.
- Datos: ninguna entrada con nombre o sinónimo repetido entre entradas.

## Fuera de alcance

- **Calorías.** Se suman como un campo más de `EntradaCatalogo` (kcal/100 g,
  tabla de composición argentina) cuando se decida.
- **Frecuencias semanales GAPA**: pescado ≥2, carnes blancas 2, carnes rojas
  ≤3 por semana. Mismo cálculo semanal que las plantas; va después.
- Restricciones por usuario (hipograso, vegetariano) que marquen platos.
- Armar la semana automáticamente.
- Pantalla para administrar el catálogo propio.

## Fuentes

- [Manual para la aplicación de las GAPA](https://www.rehueong.com.ar/sites/default/files/2023-07/Manual%20para%20la%20aplicaci%C3%B3n%20de%20las%20Gu%C3%ADas%20Alimentarias.pdf) — grupos, porciones, distribución por comida.
- [GAPA, resumen ejecutivo](https://iah.msal.gov.ar/doc/Documento110.pdf) — porción de carne (palma de la mano), frecuencias.
- [Resolución 693/2019](https://www.boletinoficial.gob.ar/detalleAviso/primera/206272/20190425) — las GAPA como estándar nacional.
- Bulsiewicz, *Plant Powered Plus* (2026), cap. 9 — total semanal de plantas distintas.
- McDonald et al., "American Gut: an Open Platform for Citizen Science Microbiome Research", *mSystems* 3(3), 2018 — 30+ plantas por semana.
