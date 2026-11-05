# Lista de compras por día

Fecha: 2026-11-05
Estado: diseño

## Qué resuelve

La lista de compras suma la semana entera en un renglón por ingrediente y no
dice para qué día es cada cosa. Cuando se compra en dos veces —lo de lunes a
miércoles ahora, el resto el jueves—, la única forma era destildar comidas en
el plan para que la lista saliera "por la mitad", y después volver a tildarlas.

Lo que hace falta no es cortar la lista sino **saber de qué día es cada cosa y
poder tildar por día**: la cebolla del lunes al miércoles comprada, la del
viernes pendiente. Importa sobre todo con lo que no aguanta (verdura de hoja:
no se compra el lunes para el jueves). Con esto la lista está siempre completa
y no hay que tocar el plan.

## Qué cambia, en una línea cada uno

1. Cada parte de la lista sabe de qué día viene.
2. Dos vistas: **Por góndola** (la de hoy, con los días de cada renglón) y
   **Por día** (cada día con sus platos e ingredientes).
3. El tilde es por ingrediente **y por día**.
4. "Copiar" sale según la vista, con el día de cada cosa.

Lo que no cambia: la lista arranca en hoy (los días pasados no cuentan, como
ahora), `excluded` sigue sacando un plato de la lista, los ítems manuales no
tienen día.

## 1. Cálculo: partes por día

Hoy `shoppingListGrouped` recorre los días, empuja un `ShoppingItem` por
ingrediente y después suma por `claveCompra`. Pasa a conservar, por renglón,
**las partes por día** antes de sumarlas:

- Cada parte: `{ fecha, clave, cantidad, unidad, platos }`, donde `fecha` es
  `formatDateKey` del día y `platos` los nombres de las comidas de donde sale
  (para la vista por día).
- Dentro de un mismo día, el mismo ingrediente de dos platos se suma en una
  sola parte (misma regla de unidades que hoy: `sumarAlRenglon` / `unirPartes`).
- Los ítems manuales (`extraItems`) son partes **sin fecha**.

Recomendación: sacar el armado de partes a una función pura (como
`chequearSemana` o `plantasDeLaSemana`) que reciba semana, comidas, día de hoy
e índice del catálogo, para testearla con Vitest sin el servicio. Dónde vive
queda a criterio del builder.

### Despensa: se reparte en orden cronológico

Hoy la despensa se resta una vez del total del renglón (`restarDespensa`).
Pasa a restarse **día por día, del más cercano al más lejano**, sobre todas
las partes **sin registro de compra** —tildadas o no—:

- Disponible = cantidad en despensa.
- Para cada parte sin registro, en orden de fecha (las sin fecha al final): si
  el disponible cubre la parte, queda **cubierta** (tildada sola, sin
  registro, como hoy) y se descuenta; si no, la parte queda con lo que falta y
  el disponible en 0.
- Sólo las partes con registro no restan despensa (igual que hoy: su sobra ya
  está ahí).

Por qué también las tildadas sin registro: es la regla de hoy
(`ajustarRenglon` sólo se salta la despensa con registro), y si una parte
cubierta por la despensa dejara de consumirla al guardarse el tilde, esa
misma despensa pasaría a cubrir el día siguiente y la lista diría que no falta
nada. Los casos en que hoy un tilde sin registro puede tomar despensa dos
veces (después de "Restar de la despensa") quedan como están: no los
introduce este cambio. *(Decisión del diseño, tras la revisión.)*

Esto es lo que hace que comprar por día no compre de más: lunes necesita ½
cebolla, se compra 1 (redondeo de `aComprar`), sobra ½ y va a la despensa; el
martes necesita ½, la despensa lo cubre y se tilda solo.

### Redondeo

`aComprar` se aplica a **lo que se tilda junto** (ver §3), no a cada parte por
separado al mostrar:

- Vista por góndola: el renglón muestra la suma de sus partes pendientes, ya
  descontada la despensa, redondeada — igual que hoy pero sólo sobre lo
  pendiente.
- Vista por día: cada parte muestra su faltante redondeado por sí sola.

Que la suma de los redondeos por día sea mayor que el redondeo del total es
esperado y lo corrige la despensa en cuanto se tilda (ejemplo de arriba).

## 2. Vistas

Un selector arriba de la lista: **Por góndola / Por día**. La elección se
recuerda por dispositivo en `localStorage` (try/catch, como el resto) y por
defecto es Por góndola. *(Decisión del diseño, no del usuario.)*

### Por góndola

La de hoy, agrupada por tag, con dos agregados:

- Junto al nombre, los días **pendientes** del renglón como chips cortos
  (`Lun` `Mar` `Mié`).
- Si algunos días ya están tildados, el renglón muestra sólo lo pendiente y una
  línea de detalle: "ya compraste lun–mié". El renglón figura tildado cuando
  todos sus días lo están.

Los controles que existen hoy en el renglón (cantidad editable, tag, botones de
despensa) siguen acá y sólo acá.

### Por día

Una sección por día desde hoy, en orden:

- Encabezado: día y fecha ("Lunes 9") y debajo los platos de ese día que
  aportan a la lista.
- Los ingredientes de ese día con su cantidad y su checkbox. Orden dentro del
  día: por tag, en el mismo orden que la vista por góndola, para que siga
  siendo usable en el súper.
- Al final, "Sin día" con los ítems manuales.
- Sólo lectura salvo el checkbox: sin edición de cantidad, tag ni botones de
  despensa. *(Decisión del diseño: esos controles operan sobre el renglón
  entero y en la vista por día no tienen un significado claro.)*

Días sin nada que comprar no aparecen.

### Imprimir

`window.print()` imprime la vista que esté en pantalla. Sin cambios.

## 3. Tildar por día

### Claves

Hoy `checkedItems[weekKey]` es una lista de claves de renglón
(`claveCompra`) y `compras[weekKey]` un mapa clave → `{ compra, sobra }`.
**La forma de los dos se mantiene**; cambia la clave:

- Parte con día: `` `${clave}@${fecha}` `` (ej. `cebolla@2026-11-09`).
- Parte sin día (ítem manual): `` `${clave}@manual` ``. No puede ser `clave`
  pelada: un ítem manual "Cebolla" cae en el mismo renglón que la cebolla de
  las recetas, y la clave pelada es la de compatibilidad (abajo), que
  significa "todo el renglón".

Así no cambia la persistencia: ni Firestore, ni localStorage, ni la sección
`compras` de `services/backup.ts`, ni la restauración.

**Compatibilidad:** una clave sin `@` en `checkedItems` de la semana en curso
—tilde guardado antes de este cambio— cuenta como tildadas **todas** las
partes de ese renglón, manuales incluidas. Lo mismo un registro sin `@` en
`compras`. Así no se pierde ningún tilde al actualizar y no hace falta
migración. Destildar una parte de un renglón así reemplaza la clave pelada
por las claves de las partes que siguen tildadas. Desde este cambio no se
escriben claves sin `@`.

### Qué se tilda en cada vista

- **Por día:** el checkbox tilda esa parte sola.
- **Por góndola:** el checkbox tilda **todas las partes pendientes** del
  renglón de una vez ("compré las dos cebollas de una"). Destildar un renglón
  tildado destilda todas sus partes.

### Registro de compra

Lo que se tilda junto es **una** compra: un solo registro en
`compras[weekKey]`, con `compra` y `sobra` calculados sobre el conjunto
(suma de lo pendiente, menos despensa, redondeado), y la sobra se suma a la
despensa una vez, como hoy (`registrarCompra`, `cabeEnDespensa`, el aviso de 3 s).

El registro se guarda bajo la clave de la **primera** parte (por fecha) y
`CompraRegistrada` suma un campo opcional con las demás:

```ts
// Las otras partes que entraron en la misma compra, cuando se tildaron juntas
// desde la vista por góndola. Destildar cualquiera deshace la compra entera.
dias?: string[];
```

Las demás partes se marcan en `checkedItems` sin registro propio.

**Deshacer:** destildar cualquier parte que pertenezca a una compra deshace la
compra entera —resta la sobra de la despensa una vez (`deshacerCompra`) y
destilda todas sus partes—. *(Decisión del diseño: la alternativa, partir una
compra ya hecha, obliga a recalcular una sobra que ya se movió.)*

Invariante a testear: tildar y destildar cualquier combinación de partes, en
cualquier vista y orden, deja la despensa como estaba.

### Callers que también tildan

Hoy `toggleItemCheck` lo llaman la lista, la despensa cuando cubre un ítem
(`autoCheckIfCovered`) y el botón "Restar de la despensa" del renglón
(`subtractFromPantry` del componente). Los tres pasan a operar sobre partes:

- `autoCheckIfCovered`: marca las partes que la despensa cubre (según el
  reparto cronológico), sin registro, como hoy.
- "Restar de la despensa" y "Mandar a despensa" del renglón: operan sobre el
  renglón de la vista por góndola (sus partes pendientes).
- `applyCartToPantry` / `getCartPantryDiff`: sobre el total pendiente del
  renglón, como hoy.

El plan tiene que revisar cada caller para que ninguno sume una sobra
calculada con la despensa a medio restar (la misma advertencia del spec de
compras redondeadas).

### Cantidad editada a mano (`quantityOverrides`)

Sigue siendo por renglón y semana (`${weekKey}_${clave}`): reemplaza lo
pendiente del renglón en la vista por góndola, y al tildar ese renglón se usa
como `compra` sin redondeo ni sobra (como hoy). En la vista por día no se
aplica: cada parte muestra lo de sus recetas. *(Decisión del diseño;
alcanza para el caso de uso y evita overrides por día.)*

**Se borra cuando cambia lo que cubre:** tildar o destildar cualquier parte
del renglón borra su override, porque era una cantidad para un conjunto de
días que ya no es el mismo. Que pase un día no lo borra (es lo que pasa hoy).
El override que guarda solo el botón "Restar de la despensa" del componente
sigue igual, con la misma regla. *(Decisión del diseño, tras la revisión.)*

### "Limpiar" (`clearOverrides`)

Sin cambio de comportamiento: deshace todas las sobras de la semana y borra
registros, tildes y overrides. Funciona igual con las claves nuevas porque
recorre lo que hay en `compras[weekKey]`.

## 4. Copiar

Sigue saliendo sólo lo pendiente, con el formato de WhatsApp actual
(`*negrita*`, `•`, pie `_Generado por…_`). Cambia según la vista:

**Por góndola** — los días pendientes entre paréntesis:

```
🛒 *Lista de Compras* (lun 9 al dom 15)

*VERDULERÍA*
• Cebolla: 3 u (lun, mar, mié)
• Brócoli: 1 u (lun)

*ALMACÉN*
• Fideos: 250 g (lun)
• Jabón: 1
```

(Los ítems manuales no llevan paréntesis.)

**Por día** — una sección por día, con los platos en cursiva:

```
🛒 *Lista de Compras* (lun 9 al dom 15)

*LUNES 9* _Fideos con brócoli · Ensalada de lentejas_
• Brócoli: 1 u
• Fideos: 250 g

*MARTES 10* _Pollo al horno con papas_
• Pollo: 1 kg

*SIN DÍA*
• Jabón: 1
```

Días abreviados en minúscula y en español (`lun`, `mar`, `mié`, `jue`, `vie`,
`sáb`, `dom`).

## Fuera de alcance

- Cortar la lista en un día ("comprar hasta el miércoles"): con la lista por
  día deja de hacer falta.
- Overrides de cantidad por día.
- Controles de despensa en la vista por día.
- Partir una compra ya registrada.

## Pruebas

Vitest, en los specs que ya existen (`meal.service.spec.ts`) y en uno nuevo si
el armado de partes sale a función pura:

- Partes por día: mismo ingrediente en dos platos del mismo día se suma; en
  dos días quedan dos partes; `excluded` y días pasados no aportan; manuales
  sin fecha.
- Reparto de despensa cronológico: cubre el primer día y no el segundo; cubre
  parcial; las partes tildadas con registro no restan.
- Tildar en vista por día: registro bajo `clave@fecha`, sobra a despensa; el
  día siguiente queda cubierto por esa sobra.
- Tildar en vista por góndola: un solo registro con `dias`, sobra sumada una
  vez; destildar cualquier parte deshace todo.
- Invariante de despensa (tildar/destildar en cualquier orden vuelve al
  estado inicial).
- Una parte cubierta por la despensa y tildada a mano (sin registro) sigue
  consumiendo despensa: el día siguiente no queda cubierto por lo mismo.
- Compatibilidad: clave sin `@` en `checkedItems` y `compras` cuenta como
  todas las partes tildadas; destildar una parte la reemplaza por las claves
  de las que siguen tildadas.
- Ítem manual con el mismo nombre que un ingrediente: tildarlo (`@manual`) no
  tilda los días de las recetas.
- Tildar o destildar una parte borra el override del renglón.
- Copiar: los dos formatos, sólo pendientes.
