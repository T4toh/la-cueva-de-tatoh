# Guía: las reglas de comer bien, a la vista

Fecha: 2026-10-08
Estado: diseñado, sin implementar

## Qué resuelve

Las reglas que hacen que una semana de comidas esté bien armada están
repartidas en planes de nutricionista en PDF, en las GAPA y en un libro, o
en la memoria de cada uno. Sin tenerlas a mano se come "a ojo". La guía las
junta en una pestaña, cortas y con su fuente, y cada usuario la ajusta:
oculta las que no le sirven y agrega las suyas. Cada cuerpo es distinto.

Esta entrega es **sólo la guía**. Los chequeos contra el plan de la semana
("carbos dos veces el martes", "carne roja: 4 de 3") vienen después, uno
por uno, sobre el catálogo de ingredientes
([spec](2026-10-08-catalogo-ingredientes-design.md)).

## La decisión que manda

**Concisa y con fuente.** Una regla es una línea, más una explicación corta
opcional y un chip que dice de dónde sale. Sin párrafos, sin tono de libro de
autoayuda. Del libro entra sólo lo medible: es mayormente una defensa de la
fibra, y lo demás no suma a esta app.

## Modelo

```ts
// projects/comidas/src/app/guia/guia.ts
export type FuenteRegla = 'nutricionista' | 'gapa' | 'libro' | 'sugerida' | 'propia';

export type Regla = {
  id: string;        // estable: es lo que se guarda al ocultarla
  texto: string;     // la regla, una línea
  detalle?: string;  // por qué, o de dónde se infirió
  fuente: FuenteRegla;
};

export const REGLAS: readonly Regla[] = [ /* ... */ ];
```

Lo del usuario va en una clave nueva del documento `users/{uid}`:

```ts
export type GuiaPropia = {
  propias: Regla[];   // fuente: 'propia', id generado
  ocultas: string[];  // ids de REGLAS
};
```

`MealService` la persiste como `alias` o `catalogoPropio`: signal, espejo en
localStorage (`comidas_guia`), efecto con la `ColaDeGuardado`, aplicador de la
bajada, `estadoActual` y `prepararImport`. En `backup.ts` va en la sección
**Ajustes**. Sin reglas de Firestore nuevas.

## Contenido base

*De planes de nutricionista* (inferido de tres planes semanales, ago 2024 –
mar 2025):

1. Un solo plato con carbohidratos por día, mejor a la noche; al mediodía,
   proteína y verdura. — *20 de 21 días de los planes.*
2. Caldo o agua antes del almuerzo y la cena.
3. Aceite medido: una cucharada por comida.
4. Fruta de postre en almuerzo y cena.
5. Una comida libre por semana. — *El "extra" de los planes.*
6. Colación: una fruta, un yogur o un puñado de frutos secos.

*GAPA:*

7. Medio plato de verdura en almuerzo y cena.
8. Pescado 2 o más veces por semana, carne blanca 2, carne roja hasta 3.
9. Legumbre más cereal reemplaza a la carne.
10. La porción de carne es la palma de la mano.

*Libro* (Bulsiewicz, *Plant Powered Plus*):

11. Variedad: 30 plantas distintas por semana. — *El contador del plan.*
12. La fibra se sube de a poco.

*Sugeridas* (sin fuente externa):

13. Anotar lo que se come.
14. Un día vegetariano o vegano por semana.
15. Ayuno: sólo con indicación profesional.

Las reglas son de alcance general; no hay datos de salud de nadie en el
código. Lo inferido de un plan dice "de planes de nutricionista", no de
quién.

## Pantalla

Ruta `/guia`, pestaña **Guía** en `.main-nav` con el ícono `book-open`. En el
celular la barra ya funciona como carrusel, así que la sexta pestaña entra.

- Las reglas agrupadas por fuente, en el orden de arriba. Cada una: el texto,
  el detalle en tono tenue si hay, y el chip de la fuente.
- Cada regla base tiene **Ocultar**. Las ocultas no se borran: al pie,
  "N ocultas — mostrar", y desde ahí cada una tiene **Volver a mostrar**.
- Arriba, **Agregar regla**: un campo de texto y uno de detalle opcional. Las
  propias van primero, con chip "propia", y tienen **Borrar** en vez de
  Ocultar.
- Una regla propia vacía no se guarda.

## Tests

- Cada regla base tiene `id` único y `texto` no vacío.
- Persistencia de `guia`: agregar una propia, ocultar una base, volver a
  mostrarla; arranca desde localStorage; viaja en backup e `importData`; la
  sección Ajustes la incluye.
- Una propia con texto en blanco no se agrega.

## Fuera de alcance

- Chequeos contra el plan de la semana (van después, uno por regla).
- Editar el texto de una regla base (se oculta y se agrega la propia).
- Reordenar reglas.
