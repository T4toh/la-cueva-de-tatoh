# Completar recetas con Flash

Fecha: 2026-11-06
Estado: diseño

## Qué resuelve

Hay recetas que tienen de todo un poco pero no llegan a ser una comida. El
ejemplo que lo disparó: un okonomiyaki con media cebolla, 30 g de queso, 2
huevos y una taza de repollo. No es que salga feo, es que se queda corto. Le
falta algo, adentro del plato (una zanahoria rallada en la mezcla) o arriba (½
palta).

La app sola no puede detectarlo. Las verduras del catálogo no tienen porción
de referencia, así que no sabe que una taza de repollo es poco. El huevo tiene
porción 1, así que 2 huevos cuentan como proteína *de más*. Y "le falta un
grupo" no sirve como señal: casi ninguna receta lista aceite, y los desayunos
no llevan verdura. Por eso el criterio lo pone Gemini Flash.

Es también la primera feature con Flash en comidas. Deja armada la conexión
(Firebase AI Logic + App Check) que después usa el armador de semanas
(próximo spec; decisiones en la memoria del proyecto, no en este doc).

Es para cualquier usuario, no para un plan de salud en particular.

## Flujo

1. **Revisar recetario.** Un botón en el recetario (`/meals`). La primera vez
   manda todas las recetas; después, sólo las que están *sin revisar* (nuevas,
   importadas o editadas desde la última revisión). Si no hay ninguna sin
   revisar, el botón no hace nada útil y lo dice.
2. **Un solo pedido a Flash** con un resumen compacto de esas recetas. Flash
   devuelve, por receta, si queda corta y, si es así, sus sugerencias. Todo se
   guarda con la receta. No se vuelve a preguntar por una receta ya revisada.
3. **La marca.** Las recetas cortas aparecen marcadas en la lista del
   recetario.
4. **Las sugerencias** se ven al abrir la receta (`/meals/:id`). Cada una es un
   ingrediente con cantidad y una línea de por qué: "1 zanahoria rallada — en
   la mezcla, le da cuerpo", "½ palta — arriba, al servir".
5. **Decide el usuario.** Cada sugerencia tiene un botón que la suma a los
   ingredientes de la receta tal cual vino. Hay además un "No, gracias" para
   todas.

## Reglas

- **Sumar una sugerencia** agrega el ingrediente (`name`, `quantity`, `unit`)
  a `Meal.ingredients` y la saca de la lista de sugerencias. Las otras quedan:
  el usuario puede querer la zanahoria *y* la palta. No deja la receta sin
  revisar: la firma se recalcula con el ingrediente ya sumado.
- **Cuando la lista queda vacía**, ya sea porque se sumaron todas o porque
  dijo "No, gracias", la marca se va. Una receta descartada no vuelve a
  marcarse hasta que se edite. *(Mi decisión: el usuario no contestó si la
  marca debía irse al rechazar. Elegí no insistir.)*
- **Editar la receta a mano** en el editor (nombre, tags o ingredientes)
  la deja *sin revisar*. Las sugerencias guardadas se descartan porque
  hablaban de otra receta. Se detecta comparando una firma del contenido
  que se le mandó a Flash contra el contenido actual. Entran en la firma el
  nombre, los tags y los ingredientes (`name`, `quantity`, `unit`; no
  `checked`). Los tags entran porque Flash los usa para saber si algo es un
  postre: si una receta salió marcada por error y se le pone el tag "postre",
  tiene que volver a revisarse. No la invalidan la foto, "sumar a compras" ni
  los cambios del catálogo propio. *(Mi decisión: el catálogo es un dato
  secundario del pedido y re-revisar todo por editar una entrada es caro.)*
- **No toda receta es una comida principal.** Flash recibe nombre, tags e
  ingredientes y juzga en ese marco: un postre o una salsa no "quedan cortos"
  por no ser un almuerzo. Sólo marca lo que se come como plato.
- **Las cantidades de una receta son por una porción** (las compras las
  multiplican por `Dish.portions`). El pedido lo dice explícitamente. Las
  sugerencias también van por porción.
- **Tope de 3 sugerencias por receta.** Completar, no reescribir: no se
  cambia el estilo del plato ni se reemplazan ingredientes.
- **Sugerencias "al lado"** (una ensaladita) también se expresan como
  ingredientes a sumar, con el "al costado" en la línea de por qué. No se crea
  un plato aparte en el calendario.

## Qué ve Flash

- Por receta: id, nombre, tags e ingredientes con cantidad y unidad. Además,
  lo que la app ya sabe, para que Flash no arranque de cero: los grupos del
  plato (`resumenPlato`) y la porción de referencia del catálogo cuando la
  hay. No se mandan los pasos (gastan tokens y no cambian el juicio). Tampoco
  la foto ni `publicId`.
- Las restricciones del usuario, si existen: la lista "No como" la define el
  spec del armador. Si este se implementa primero, no se manda nada y queda
  un TODO.
- `responseSchema` con los ids de las recetas enviadas como `enum`. La
  respuesta se valida antes de guardar: un id que no se mandó, una receta
  sin entrada o una sugerencia sin cantidad se descartan. Una receta sin
  respuesta válida queda *sin revisar*, así la próxima pasada la vuelve a
  incluir.
- Modelo: `gemini-flash-lite-latest`, Gemini Developer API (plan Spark). El spec
  pedía `gemini-flash-latest`, pero el 2026-11-06 estaba saturado en el free tier.

## Infraestructura

- **Firebase AI Logic** desde `firebase/ai`, que ya viene en `firebase`
  12.18. No se agrega ninguna dependencia nueva.
- **App Check** con `ReCaptchaEnterpriseProvider` (ya registrado con dominio
  tatoh.ar, todavía sin enforce) y debug token en localhost. La API key está
  restringida por referer, y para probar local hay que servir en el 4200.
- **Sólo con sesión iniciada.** Comidas funciona entera como invitado
  (localStorage, sin guards), pero la cuota del plan Spark es una sola para
  todo el proyecto. Sin sesión, el botón no se oculta: queda deshabilitado
  con "Iniciá sesión para revisar tu recetario". No frena a nadie que llame
  directo a la API. Eso lo hace el enforce.
- **Enforce de App Check: postergado (2026-11-06).** La app ya manda tokens
  de App Check, pero el enforce no está activo: el usuario prefirió no entrar
  a la consola de Firebase ahora. Hasta activarlo, la única barrera para
  usar AI Logic con la API key pública es la restricción por referer. Para
  activarlo: registrar el debug token de localhost (App Check → Apps →
  Manage debug tokens) y después App Check → APIs → *Firebase AI Logic API*
  → Enforce. **Nunca** Firestore ni Authentication sin antes verificar en
  las métricas que el tráfico de producción ya viene verificado.
- **Aviso en la UI**: en el free tier, Google puede usar los pedidos para
  entrenar. Es un texto informativo que está siempre junto al botón, visible y
  no en letra chica. No es un consentimiento con estado guardado: el
  consentimiento es tocar el botón, que es lo único que manda algo. *(Mi
  decisión.)*
- **Errores.** Sin red, sin cuota o con una respuesta que no se puede parsear,
  se avisa y no se guarda nada. Las recetas siguen *sin revisar*. No hay
  reintento automático.
- **Tamaño.** Un recetario grande puede exceder lo cómodo para un pedido.
  Partirlo en tandas queda a criterio del builder, siempre que siga siendo
  "un botón, la menor cantidad de pedidos posible".

## Datos

Un campo opcional nuevo en `Meal`, por ejemplo:

```ts
revision?: {
  firma: string;          // del contenido que se mandó a Flash
  corta: boolean;
  sugerencias: { name: string; quantity: string; unit?: string; motivo: string }[];
};
```

Sin `revision` o con una firma que no coincide, la receta está *sin revisar*.
Si `corta` es `false`, o es `true` con `sugerencias` vacío, no hay marca.

- Viaja con la receta: localStorage, Firestore (`users/{uid}`), backup y
  export. No hace falta ninguna regla nueva de Firestore, porque vive en el
  mismo documento.
- **No se publica:** `recetasPublicas` no debe copiar `revision`.
- Una receta importada trae o no su `revision`. Si la firma no coincide, queda
  sin revisar, y eso está bien.

## Pruebas

Funciones puras con Vitest, como en `catalogo/` y `guia/chequeos.ts`: firma,
armado del resumen que se manda, validación de la respuesta, sumar una
sugerencia, estado (sin revisar / corta / ok). La llamada a Flash se mockea. Se
prueba a mano una vez contra el modelo real, en el 4200.

## Fuera de alcance

- La pasada automática al guardar una receta. Siempre la dispara el usuario.
- Reescribir recetas, cambiar pasos o reemplazar ingredientes.
- Agregar porciones de verdura al catálogo. Es otra vía posible, pero no esta.
- El armador de semanas y la lista "No como" (próximo spec).
- **TODO: comidas y acompañamientos por separado.** Hoy una sugerencia "al
  costado" se desarma en ingredientes que se suman a la receta. Lo que el
  usuario quiere a futuro es que Flash pueda crear el acompañamiento como plato
  propio y usarlo, pero eso necesita que el modelo distinga platos de
  acompañamientos, algo que todavía no existe.

## Queda al builder

- Dónde va exactamente el botón y la marca en `meal-list`, y cómo se ven las
  sugerencias en `receta-view`. Hay que seguir los tokens de tema y los
  botones existentes de la app.
- El algoritmo de la firma y el texto exacto del prompt.
- Si hace falta partir en tandas y de qué tamaño.
