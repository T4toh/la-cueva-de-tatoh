# Entrenar: la hora de moverse, guiada y por niveles

Fecha: 2026-11-19
Estado: aprobado

## Qué resuelve

Tatoh dedica una hora al día a moverse y hoy la usa caminando, porque es lo
fácil. Quiere bajar de peso y para eso hace falta un poco de todo: caminata o
trote, fuerza y movilidad. La sección **Entrenar** le arma esa hora y lo guía
en el momento, ejercicio por ejercicio, solo con el cuerpo y en cualquier
lugar. Además lo hace subir de nivel de a poco, para que caminar sea el piso y
no el techo.

Vive adentro de Comidas porque comparte usuario, sincronización y la PWA que
ya está instalada. Si la sección crece, la app puede renombrarse (por ejemplo,
a "Salud"), pero eso queda fuera de esta entrega.

## Objetivos

- Elegir los minutos disponibles (la hora es el tope) y recibir la sesión del
  día ajustada a ese tiempo.
- Al arrancar, ver qué hace falta: "un escalón o banco", "2 m² de piso", "un
  tramo donde puedas trotar". Nada más que eso.
- Seguir una guía en vivo: qué ejercicio viene, el tiempo o las repeticiones,
  y un aviso en cada cambio. Pausar, saltear y terminar antes de tiempo.
- Niveles: se arranca en el 1 (caminar, que ya hace) y la app propone subir
  cuando el nivel actual queda fácil.
- Al terminar, una respuesta de tres botones (fácil, bien, me mató) que ajusta
  la dosis de la próxima sesión.
- Historial corto: qué hizo, cuándo y cuánto.

## No objetivos (v1)

- Peso corporal, calorías y cruce con el plan de comidas. Es el paso natural
  siguiente, pero va en otra entrega.
- GPS, distancia, pasos, Health Connect o Google Fit. La sincronización con
  Google queda anotada para más adelante, cuando el resto ande.
- Equipo de gimnasio, pesas o bandas.
- Renombrar la app.
- Videos de los ejercicios. Las imágenes son monigotes SVG generados por
  `scripts/figuras-entrenar.mjs` (en `public/figuras`, cacheados por la PWA).

## Anti-objetivos

- Una sesión que pida algo que no se pueda hacer en la calle, en una plaza o en
  el living sin equipo.
- Subir tan rápido que lastime. La progresión es lenta y siempre se puede bajar.
- Que la caminata desaparezca. Es la base de todos los niveles y lo que cambia
  es cuánto de esa caminata se vuelve trote o intervalos.
- Dependencias nuevas o telemetría (ver la higiene de dependencias del repo).

## Enfoque

| Opción | Qué es | Contra |
|---|---|---|
| **A. Rutinas fijas guiadas** ✅ | Plantillas escritas en código, rotan por día y se escalan a los minutos disponibles; guía en vivo y feedback de tres botones | Puede volverse repetitiva hasta que se agreguen plantillas |
| B. Generador | Catálogo más un armador con puntaje que compone cada sesión | Mucha lógica de equilibrio; si los pesos están mal, salen sesiones raras difíciles de detectar |
| C. Plan para leer | Plan semanal con casillas | No guía en el momento, que es el punto |

Tatoh eligió **A**. El catálogo de ejercicios que pide A es el mismo que
usaría B, así que el generador puede sumarse encima si las plantillas aburren.

## Diseño

### Contenido: ejercicios, plantillas y niveles

Todo es estático y vive en código (`projects/comidas/src/app/entrenar/`), igual
que `catalogo-datos.ts` y la guía.

```ts
type Ejercicio = {
  id: string;            // 'sentadilla-banco'
  nombre: string;
  como: string;          // una o dos líneas
  necesita?: Necesidad;  // 'banco' | 'piso' | 'tramo-trote' | 'pared'
  medida: 'reps' | 'segundos';
};

type Bloque =
  | { tipo: 'caminata'; tramos: Tramo[] }               // Tramo: { ritmo: 'comodo' | 'rapido' | 'trote'; segundos }
  | { tipo: 'circuito'; ejercicios: { id; dosis }[]; vueltas: number; descanso: number }
  | { tipo: 'movilidad'; ejercicios: { id; segundos }[] };

type Plantilla = {
  id: string;
  nivel: number;
  dia: 'A' | 'B';        // A: caminata + fuerza; B: caminata larga/intervalos + movilidad
  bloques: Bloque[];
};
```

Niveles propuestos (decisión del agente; Tatoh los corrige al revisar):

| Nivel | Caminata | Fuerza |
|---|---|---|
| 1 | Paso cómodo | Movilidad y 1 vuelta facilitada (sentadilla a banco, flexión en pared, puente de glúteo) |
| 2 | Cómodo con tramos rápidos | 2 vueltas facilitadas, plancha corta |
| 3 | Más tramos rápidos | 2 vueltas: flexión en banco, zancada atrás |
| 4 | Caminar/trotar alternado | 3 vueltas estándar: sentadilla libre, flexión inclinada baja |
| 5 | Trote más largo, caminata de recuperación | 3 vueltas con variantes más duras |
| 6 | Trote continuo | Circuito por tiempo |

Los días A y B se alternan según la última sesión hecha, no por día de la
semana: si un día no entrenás, no se pierde nada.

### Ajuste a los minutos

La caminata es lo elástico: calentamiento, circuito y movilidad tienen
duración fija por plantilla, y el bloque de caminata se estira o se achica para
llenar los minutos elegidos. El día B no tiene circuito: es caminata más
movilidad. Si los minutos no alcanzan, primero se acorta la movilidad y
después la caminata, hasta un piso de 10 minutos de caminata. El circuito del
día A no se recorta nunca, porque es justamente lo que se quiere sumar a la
caminata. El mínimo es 20 minutos y el máximo, 60. *(Decisión del agente.)*

### Dosis y niveles

- Cada sesión tiene una **dosis** de -2 a +2 sobre la plantilla, que suma o
  resta repeticiones, segundos o tramos rápidos.
- "Fácil" sube la dosis 1, "bien" la deja igual y "me mató" la baja 1.
- Con la dosis en +2 y dos "fácil" seguidos, la app **propone** subir de nivel
  (con dosis 0). Tatoh acepta o no.
- Dos "me mató" seguidos con la dosis en -2 hacen que la app proponga bajar.
- El nivel también se cambia a mano en cualquier momento.
- Una sesión cortada antes de llegar a la mitad de los minutos planeados
  (`completa: false`) se guarda y cuenta para alternar A y B, pero su
  respuesta no mueve la dosis ni cuenta para proponer un cambio de nivel. Así,
  un "fácil" a los 8 minutos no acelera la progresión. *(Decisión del agente.)*

### Sesión en vivo

- Pantalla de previa: minutos, "vas a necesitar: …", el botón Arrancar y la
  lista completa de pasos por bloque, con dibujo, cómo se hace y un "Ojo:".
  Cada bloque tiene "Empezar acá"; si se arranca en el medio, `completa` se
  mide contra el tiempo que quedaba desde ese bloque.
- `/entrenar/ejercicios`: para leer antes, cómo es una sesión, los ritmos y
  una ficha por ejercicio.
- Al arrancar se pide Wake Lock de pantalla, con el mismo patrón que
  `receta-detalle.component.ts` (se re-pide en `visibilitychange`). Se avisa
  que la pantalla queda prendida. Sin Wake Lock, los timers con la pantalla
  apagada no son confiables en una PWA de Android.
- Un paso a la vez: nombre, cómo hacerlo y la cuenta regresiva (segundos) o el
  botón "listo" (repeticiones).
- En cada cambio de paso: `navigator.vibrate` y un beep corto generado con
  Web Audio, sin archivos de audio.
- El tiempo se calcula contra `Date.now()` y no sumando ticks, para que no se
  atrase si el navegador frena el intervalo.
- Pausa, saltear paso, saltear bloque y terminar. Terminar antes igual pide la respuesta de
  tres botones y guarda lo hecho.

### Datos

Se guardan en el mismo documento `users/{uid}`, por el mismo camino que las
demás claves (`ColaDeGuardado` y localStorage para invitados):

```ts
type EstadoEntrenar = {
  nivel: number;
  dosis: number;
  ultimoDia: 'A' | 'B' | null;
  historial: {
    fecha: string;          // ISO
    plantilla: string;
    minutos: number;        // reales
    completa: boolean;
    respuesta: 'facil' | 'bien' | 'mato';
  }[];
};
```

Es una sola clave, `entrenar`, como `guia`: Tatoh entrena solo desde el
teléfono. Si entrenara desde dos dispositivos sin sincronizar entre medio, una
sesión pisaría a la otra, y para ese caso habría que guardar cada sesión por
separado. Queda fuera de v1.

El historial se recorta a las últimas 120 sesiones para no inflar el
documento, que ya guarda todo lo demás.

### Navegación

Pestaña nueva **Entrenar** en `app.html`, con un ícono de `lib-icon` (por
ejemplo `footprints` o `dumbbell`). Rutas: `/entrenar` (hoy, nivel e
historial) y `/entrenar/sesion` (en vivo).

### Aviso

Una línea fija en la previa: "Si algo duele (no cansa, duele), cortá."

## Queda para quien construya

- Textos finales de cada ejercicio y las dosis exactas por nivel (borrador del
  agente, revisión de Tatoh).
- El ícono definitivo.
- Tests: la lógica pura (escalado a minutos, dosis y propuestas de nivel)
  lleva specs; el player, lo mínimo.
