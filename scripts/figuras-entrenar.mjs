// Genera los dibujos de Entrenar: projects/comidas/public/figuras/<id>.svg.
// Correr con `node scripts/figuras-entrenar.mjs` después de tocar una pose.
//
// Cada figura es un monigote de perfil. Ángulos absolutos en grados: 0 apunta
// abajo, 90 a la derecha, 180 arriba y -90 a la izquierda. Una pierna o un
// brazo es [ángulo1, ángulo2, pie?] o, para apoyar en un punto exacto (piso,
// banco, pared), { a: [x, y], doblez: 1 | -1, pie? }. Van [cerca, lejos]: el
// de lejos sale gris. Los SVG son de un solo color con opacidades porque la
// app los usa como máscara y les pone el color del tema.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'projects/comidas/public/figuras';
const PISO = 92;
const SUELO = PISO - 1; // donde apoyan pies, manos y rodillas
const PANEL = 105;
const L = { torso: 28, cuello: 4, cabeza: 7, muslo: 22, pierna: 22, pie: 7, brazo: 15, antebrazo: 14 };

const rad = (a) => (a * Math.PI) / 180;
const grados = (r) => (r * 180) / Math.PI;
const mas = ([x, y], largo, a) => [x + largo * Math.sin(rad(a)), y + largo * Math.cos(rad(a))];
const angulo = ([x0, y0], [x1, y1]) => grados(Math.atan2(x1 - x0, y1 - y0));
const f = (n) => Math.round(n * 10) / 10;

// Dos segmentos de base a destino; `doblez` elige para qué lado se dobla la articulación.
function ik(base, destino, l1, l2, doblez) {
  const d = Math.min(Math.hypot(destino[0] - base[0], destino[1] - base[1]), l1 + l2 - 0.01);
  const directo = angulo(base, destino);
  const abre = grados(Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const medio = mas(base, l1, directo + doblez * abre);
  return [medio, mas(medio, l2, angulo(medio, destino))];
}

function cadena(base, spec, l1, l2) {
  if (Array.isArray(spec)) {
    const medio = mas(base, l1, spec[0]);
    return { medio, punta: mas(medio, l2, spec[1]), extremo: spec[2] };
  }
  const [medio, punta] = ik(base, spec.a, l1, spec.d ?? l2, spec.doblez);
  return { medio, punta, extremo: spec.pie };
}

// La pose se ancla por la cadera o por el tobillo de la pierna de cerca (dada en ángulos).
function puntos(p) {
  let cadera = p.cadera;
  if (!cadera) {
    const [muslo, pierna] = p.piernas[0];
    cadera = mas(mas(p.pie, -L.pierna, pierna), -L.muslo, muslo);
  }
  const hombro = p.hombro ?? mas(cadera, L.torso, p.torso);
  const torso = angulo(cadera, hombro);
  const cuello = mas(hombro, L.cuello, p.cabeza ?? torso);
  const cabeza = mas(cuello, L.cabeza, p.cabeza ?? torso);
  const mitad = mas(mas(cadera, L.torso / 2, torso), p.curva ?? 0, torso + 90);
  const piernas = p.piernas.map((s) => cadena(cadera, s, L.muslo, L.pierna));
  const brazos = p.brazos.map((s) => cadena(hombro, s, L.brazo, L.antebrazo));
  return { cadera, hombro, cuello, cabeza, mitad, piernas, brazos };
}

function dibujar(pt, dx) {
  const m = ([x, y]) => `${f(x + dx)},${f(y)}`;
  const linea = (pts, op) => `<polyline points="${pts.map(m).join(' ')}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
  const pierna = (c, op) => {
    const pie = c.extremo === null ? [] : [mas(c.punta, L.pie, c.extremo ?? 90)];
    return linea([pt.cadera, c.medio, c.punta, ...pie], op);
  };
  const brazo = (c, op) => linea([pt.hombro, c.medio, c.punta], op);
  // Control de la curva cuadrática para que pase por `mitad`.
  const ctrl = [2 * pt.mitad[0] - (pt.cadera[0] + pt.hombro[0]) / 2, 2 * pt.mitad[1] - (pt.cadera[1] + pt.hombro[1]) / 2];
  const [cx, cy] = pt.cabeza;
  return [
    pierna(pt.piernas[1], 0.4),
    brazo(pt.brazos[1], 0.4),
    `<path d="M${m(pt.cadera)} Q${m(ctrl)} ${m(pt.hombro)} L${m(pt.cuello)}"/>`,
    `<circle cx="${f(cx + dx)}" cy="${f(cy)}" r="${L.cabeza}" fill="#000" stroke="none"/>`,
    pierna(pt.piernas[0], 1),
    brazo(pt.brazos[0], 1),
  ].join('');
}

// Utilería y marcas: { tipo, ... } en las mismas coordenadas que la pose.
function cosa(u, dx) {
  const x = (u.x ?? 0) + dx;
  switch (u.tipo) {
    case 'banco':
      return `<rect x="${f(x)}" y="${PISO - u.alto}" width="${u.ancho ?? 26}" height="${u.alto}" rx="2" opacity="0.3" fill="#000" stroke="none"/>`;
    case 'pared':
      return `<line x1="${f(x)}" y1="6" x2="${f(x)}" y2="${PISO}" opacity="0.3"/>`;
    case 'texto':
      return `<text x="${f(x)}" y="${u.y}" font-family="sans-serif" font-size="12" font-weight="700" fill="#000" stroke="none">${u.t}</text>`;
    case 'giro': {
      const r = u.r ?? 9;
      return (
        `<path d="M${f(x + r)},${u.y} A${r},${r} 0 1 1 ${f(x)},${u.y - r}" opacity="0.5" stroke-width="2.5"/>` +
        `<path d="M${f(x - 3)},${u.y - r - 4} L${f(x + 1)},${u.y - r} L${f(x - 3)},${u.y - r + 4}" opacity="0.5" stroke-width="2.5"/>`
      );
    }
    case 'viento':
      return [0, 8, 16]
        .map((d) => `<line x1="${f(x)}" y1="${u.y + d}" x2="${f(x + 10 - d / 2)}" y2="${u.y + d}" opacity="0.35" stroke-width="2.5"/>`)
        .join('');
    default:
      throw new Error(u.tipo);
  }
}

function anchoDe(u) {
  return u.tipo === 'banco' ? [u.x, u.x + (u.ancho ?? 26)] : u.tipo === 'giro' ? [u.x - 9, u.x + 9] : [u.x, u.x + 10];
}

function panel(p, i, n) {
  const pt = puntos(p);
  const xs = [pt.cadera, pt.hombro, pt.cabeza, ...[...pt.piernas, ...pt.brazos].flatMap((c) => [c.medio, c.punta])].map(
    ([x]) => x
  );
  const cosas = p.cosas ?? [];
  for (const u of cosas) {
    xs.push(...anchoDe(u));
  }
  const centro = (Math.min(...xs) + Math.max(...xs)) / 2;
  const medio = n === 1 ? 105 : 50 + i * 110;
  const dx = medio - centro;
  return cosas.map((u) => cosa(u, dx)).join('') + dibujar(pt, dx);
}

const svg = (poses) => {
  const flecha =
    poses.length === 2 ? '<path d="M99,48 L111,48 M106,43 L111,48 L106,53" opacity="0.5" stroke-width="3"/>' : '';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 100" fill="none" stroke="#000" ' +
    'stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
    `<line x1="4" y1="${PISO + 2}" x2="206" y2="${PISO + 2}" opacity="0.25" stroke-width="2"/>` +
    poses.map((p, i) => panel(p, i, poses.length)).join('') +
    flecha +
    '</svg>\n'
  );
};

// ---- Poses ----

const PARADO = { cadera: [50, SUELO - L.muslo - L.pierna], torso: 180, piernas: [[0, 0], [0, 0]], brazos: [[4, 4], [-4, -4]] };
const BRAZOS_ADELANTE = { ...PARADO, brazos: [[90, 90], [88, 88]] };
const SENTADILLA = { pie: [50, SUELO], torso: 145, piernas: [[86, -22], [84, -22]], brazos: [[88, 90], [86, 88]] };

// Flexión inclinada: pies en (0, SUELO), cuerpo recto a `incl` grados sobre el
// horizonte y manos apoyadas en `mano`. Arriba los brazos quedan casi
// estirados; abajo el codo se dobla hacia atrás.
const LARGO_CUERPO = L.muslo + L.pierna + L.torso;
function flexion(incl, mano) {
  const a = -(90 - incl);
  const cadera = mas([0, SUELO], L.muslo + L.pierna, 180 + a);
  const brazo = { a: mano, doblez: -1 };
  return { cadera, torso: 180 + a, cabeza: 180 + a, piernas: [[a, a, a - 70], [a, a, a - 70]], brazos: [brazo, brazo] };
}
// Altura de la mano con brazos perpendiculares y estirados.
function manoArriba(incl) {
  const hombro = mas([0, SUELO], LARGO_CUERPO, 90 + incl);
  return mas(hombro, L.brazo + L.antebrazo - 1, incl);
}

const BANCO_ALTO = manoArriba(40);
const BANCO_BAJO = manoArriba(30);

// Boca arriba: hombros en el piso a la izquierda, pies apoyados a la derecha.
const HOMBRO_PISO = [10, SUELO - 3];
const PIE_PUENTE = [64, SUELO];
const puente = (alto, lejos) => ({
  cadera: [40, SUELO - 4 - alto],
  hombro: HOMBRO_PISO,
  cabeza: -90,
  piernas: [{ a: PIE_PUENTE, doblez: 1 }, lejos ?? { a: [PIE_PUENTE[0] - 2, SUELO], doblez: 1 }],
  brazos: [[90, 90], [88, 88]],
});

// Cuatro apoyos: rodillas bajo la cadera y manos bajo el hombro.
const cuatro = (curva, cabeza) => ({
  cadera: [20, SUELO - 22],
  hombro: [48, SUELO - 24],
  curva,
  cabeza,
  piernas: [[0, -90, null], [0, -90, null]],
  brazos: [{ a: [50, SUELO], doblez: 1 }, { a: [48, SUELO], doblez: 1 }],
});

// Flexión en pared: el hombro queda a `distancia` de la pared, con el cuerpo recto.
const PARED = 50;
function flexionPared(distancia) {
  const incl = grados(Math.asin((PARED - distancia) / LARGO_CUERPO));
  const hombro = mas([0, SUELO], LARGO_CUERPO, 180 - incl);
  const mano = { a: [PARED - 3, hombro[1] + 2], doblez: -1 };
  return { ...flexion(90 - incl, mano), brazos: [mano, mano], cosas: [{ tipo: 'pared', x: PARED }] };
}

// La mano agarra el tobillo de la pierna doblada atrás.
const TOBILLO_CUADRICEPS = mas(mas(PARADO.cadera, L.muslo, -22), L.pierna, 196);

const ZANCADA = {
  cadera: [40, SUELO - 26],
  torso: 180,
  piernas: [{ a: [62, SUELO], doblez: -1 }, { a: [10, SUELO], doblez: 1, pie: 180 }],
  brazos: [[10, 20], [-10, -5]],
};

const FIGURAS = {
  'sentadilla-banco': [
    { ...PARADO, cosas: [{ tipo: 'banco', x: 14, alto: 28 }] },
    { ...SENTADILLA, piernas: [[80, -18], [78, -18]], cosas: [{ tipo: 'banco', x: 14, alto: 28 }] },
  ],
  'sentadilla-libre': [BRAZOS_ADELANTE, SENTADILLA],
  'sentadilla-pausa': [BRAZOS_ADELANTE, { ...SENTADILLA, cosas: [{ tipo: 'texto', x: 70, y: 18, t: '2 s' }] }],
  'silla-pared': [
    {
      cadera: [30, SUELO - 44 + 1],
      torso: 180,
      piernas: [[90, 0], [88, 0]],
      brazos: [[4, 4], [-4, -4]],
      cosas: [{ tipo: 'pared', x: 24 }],
    },
  ],
  'flexion-pared': [flexionPared(27), flexionPared(13)],
  'flexion-banco': [
    { ...flexion(40, BANCO_ALTO), cosas: [{ tipo: 'banco', x: BANCO_ALTO[0] - 5, alto: PISO - BANCO_ALTO[1] - 1 }] },
    { ...flexion(30, BANCO_ALTO), cosas: [{ tipo: 'banco', x: BANCO_ALTO[0] - 5, alto: PISO - BANCO_ALTO[1] - 1 }] },
  ],
  'flexion-inclinada-baja': [
    { ...flexion(30, BANCO_BAJO), cosas: [{ tipo: 'banco', x: BANCO_BAJO[0] - 5, alto: PISO - BANCO_BAJO[1] - 1 }] },
    { ...flexion(21, BANCO_BAJO), cosas: [{ tipo: 'banco', x: BANCO_BAJO[0] - 5, alto: PISO - BANCO_BAJO[1] - 1 }] },
  ],
  'puente-gluteo': [puente(0), puente(20)],
  'puente-una-pierna': [
    puente(0, [160, 160, 70]),
    puente(20, [125, 125, 35]),
  ],
  'zancada-atras': [{ ...PARADO, cadera: [40, SUELO - L.muslo - L.pierna] }, ZANCADA],
  'zancada-caminando': [
    { ...ZANCADA, cosas: [{ tipo: 'viento', x: -2, y: 30 }] },
    { ...ZANCADA, piernas: [{ a: [66, SUELO], doblez: -1 }, { a: [14, SUELO], doblez: 1, pie: 180 }] },
  ],
  'plancha-rodillas': [
    {
      cadera: [60, SUELO - 17],
      hombro: [34, SUELO - 15],
      cabeza: -80,
      piernas: [{ a: [82, SUELO], doblez: 1, pie: null, d: 22 }, { a: [80, SUELO], doblez: 1, pie: null }],
      brazos: [[0, -90], [0, -90]],
    },
  ],
  plancha: [
    {
      cadera: [60, SUELO - 20],
      hombro: [32, SUELO - 17],
      cabeza: -82,
      piernas: [[94, 94, 0], [94, 94, 0]],
      brazos: [[0, -90], [0, -90]],
    },
  ],
  'rodillas-altas': [
    { ...PARADO, piernas: [[0, 0], [90, 0]], brazos: [[-30, 60], [40, 130]] },
    { ...PARADO, piernas: [[90, 0], [0, 0]], brazos: [[40, 130], [-30, 60]] },
  ],
  'circulos-hombros': [{ ...PARADO, cosas: [{ tipo: 'giro', x: 54, y: 24, r: 10 }] }],
  'gato-vaca': [cuatro(10, 50), cuatro(-7, 150)],
  'rotacion-columna': [{ ...PARADO, brazos: [[60, 150], [55, 140]], cosas: [{ tipo: 'giro', x: 50, y: 40, r: 14 }] }],
  'estirada-cadera': [
    {
      cadera: [40, SUELO - 24],
      torso: 182,
      piernas: [{ a: [64, SUELO], doblez: -1 }, { a: [12, SUELO], doblez: 1, pie: 180 }],
      brazos: [[40, 20], [38, 18]],
    },
  ],
  'estirada-cuadriceps': [
    {
      ...PARADO,
      piernas: [[-22, 196, 180], [0, 0]],
      brazos: [{ a: TOBILLO_CUADRICEPS, doblez: 1 }, [100, 100]],
      cosas: [{ tipo: 'pared', x: 82 }],
    },
  ],
  'estirada-isquios': [
    {
      cadera: [40, SUELO - 39],
      torso: 128,
      piernas: [{ a: [74, SUELO - 13], doblez: 1, pie: 170 }, { a: [38, SUELO], doblez: 1 }],
      brazos: [{ a: [58, SUELO - 30], doblez: -1 }, { a: [56, SUELO - 30], doblez: -1 }],
      cosas: [{ tipo: 'banco', x: 66, alto: 13, ancho: 22 }],
    },
  ],
  'estirada-pantorrillas': [
    {
      cadera: [40, SUELO - 42],
      torso: 150,
      piernas: [{ a: [54, SUELO], doblez: -1 }, { a: [6, SUELO], doblez: -1, pie: 110 }],
      brazos: [{ a: [74, 30], doblez: -1 }, { a: [74, 32], doblez: -1 }],
      cosas: [{ tipo: 'pared', x: 76 }],
    },
  ],
  'apertura-pecho': [{ ...PARADO, torso: 176, cabeza: 190, brazos: [[-35, -35], [-37, -37]] }],
  // Pasos que no son un ejercicio del catálogo.
  caminar: [{ ...PARADO, piernas: [[22, 8], [-18, -18]], brazos: [[-18, -10], [18, 30]] }],
  'caminar-rapido': [
    { ...PARADO, torso: 175, piernas: [[32, 10], [-26, -26]], brazos: [[-35, 50], [35, 120]], cosas: [{ tipo: 'viento', x: 8, y: 34 }] },
  ],
  trotar: [
    { pie: [55, SUELO - 6], torso: 170, piernas: [[50, -20], [-30, -75]], brazos: [[-40, 60], [40, 130]], cosas: [{ tipo: 'viento', x: 8, y: 30 }] },
  ],
  descanso: [{ ...PARADO, brazos: [[-35, 40], [-37, 38]] }],
};

mkdirSync(OUT, { recursive: true });
for (const [id, poses] of Object.entries(FIGURAS)) {
  writeFileSync(`${OUT}/${id}.svg`, svg(poses));
}
console.log(`${Object.keys(FIGURAS).length} figuras en ${OUT}`);
