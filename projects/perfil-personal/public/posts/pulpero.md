# Pulpero - Un anotador para la mesa

![El pulpero lustrando el ancho de espadas](../posts/img/pulpero.png)

## Preámbulo

Esto empezó como **Contador de Truco**, nombre autodescriptivo y cero ambición: dos paneles, un número cada uno, tap para sumar. Lo hice porque en mi casa los fósforos se pierden, se mojan o terminan en el asado, y anotar en papel es garantía de discusión a los 12 puntos: "vos tenías 9". Un celular apoyado en la mesa no discute.

Después vino la Escoba del 15, porque en la misma mesa se juega a las dos cosas. Y después la Generala, que ya no es un contador sino una planilla. A esa altura el nombre quedaba chico y la app se llamó **Pulpero**: el que atiende la mesa y anota lo que se debe.

## Qué es

Una app de **Flutter** para Android, sin backend, sin cuentas y sin assets externos: el paño, la madera, los fósforos y los dados se dibujan con widgets y `CustomPainter`. Pensada para apoyar el celular en la mesa y tocar la pantalla mientras se juega, con la mano ocupada en las cartas.

Tres juegos:

- **Truco**. Partidas a 15 (a malas) o a 30 (a buenas), dos equipos. Al pasar los 15 el panel cambia de color y avisa que estás *en las buenas*. Los fósforos se agrupan de a tres por columna, como en el cuadradito de la caja de fósforos: una columna llena son las malas o las buenas.
- **Escoba del 15**. De 2 a 4 jugadores, partida a 15. Con cuatro, grilla 2x2 para que cada uno tenga su esquina.
- **Generala**. De 2 a 6 jugadores, planilla de 11 casillas con las caras de dado y E, F, P, G, G2 como en la de papel. Tocás una celda y la app te ofrece sólo los valores válidos: tachar, servida, etc. Puntaje según el reglamento de Ruibal, generala servida gana la partida.

Los controles son los mismos en todos lados: tap en el panel para sumar, `-` para restar, mantener apretado el nombre para renombrar. Restar nunca da negativo y sumar nunca pasa del tope, así que no hay forma de romper una partida a lo bruto.

## La Mesa

Lo que más tiempo me llevó no fue la lógica, que es sumar uno. Fue que se vea como una mesa: paño verde, paneles de madera, fósforos con volumen y una tipografía con serifa (Alegreya) empaquetada para que no dependa del teléfono.

Todo dibujado a mano en Flutter. Sin PNGs, sin sprites. Eso tiene un costo que me encontré probando en una tablet de gama baja: el paño se redibujaba entero en cada frame y tardaba unos 40 ms, que es una animación a tirones. Pasarlo a una textura chica repetida lo bajó a 6 ms. Moraleja de siempre: probar en el hardware flojo, no en el bueno.

## Actualizarse sin Play Store

No está en el Play Store y no pienso ponerla. Pero un APK que hay que ir a buscar a GitHub cada vez es un APK que nadie actualiza. Así que la app se actualiza sola: detecta una release nueva, la descarga, verifica el SHA-256 contra lo publicado y lanza el instalador. Un toque en Instalar y listo.

Y tiene Novedades: tocás la versión en el setup y ves el changelog. También se abre solo la primera vez que arranca una versión nueva, para que no te enteres por casualidad de que ahora hay Generala.

## Qué viene

Quizás **Papa** (el 10.000, con dados), pero sólo cuando tenga reglas en las que confíe: cada mesa juega distinto y no quiero una app que discuta con la casa. Mientras tanto, la alternativa es un anotador libre con teclado numérico y deshacer, para cualquier juego que no esté.

## Repo y APK

El repo está acá: [github.com/T4toh/pulpero](https://github.com/T4toh/pulpero). El APK se baja desde la sección de [utilidades](/utilidades) o directo de las [releases](https://github.com/T4toh/pulpero/releases/latest). Si ya tenías el Contador de Truco instalado, no hace falta que hagas nada: la actualización te llega solita.

---

Tags: #flutter #android #truco #juegos
