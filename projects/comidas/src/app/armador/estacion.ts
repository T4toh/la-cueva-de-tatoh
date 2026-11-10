import { normalizar } from '../catalogo/catalogo';

export type Hemisferio = 'sur' | 'norte';
export type Estacion = 'verano' | 'otono' | 'invierno' | 'primavera';
export type Pais = { id: string; nombre: string; hemisferio: Hemisferio };

// Países de América (id = ISO-2 en minúscula) más dos comodines para el resto del mundo.
export const PAISES: readonly Pais[] = [
  { id: 'ar', nombre: 'Argentina', hemisferio: 'sur' },
  { id: 'bo', nombre: 'Bolivia', hemisferio: 'sur' },
  { id: 'br', nombre: 'Brasil', hemisferio: 'sur' },
  { id: 'ca', nombre: 'Canadá', hemisferio: 'norte' },
  { id: 'cl', nombre: 'Chile', hemisferio: 'sur' },
  { id: 'co', nombre: 'Colombia', hemisferio: 'norte' },
  { id: 'cr', nombre: 'Costa Rica', hemisferio: 'norte' },
  { id: 'cu', nombre: 'Cuba', hemisferio: 'norte' },
  { id: 'do', nombre: 'República Dominicana', hemisferio: 'norte' },
  { id: 'ec', nombre: 'Ecuador', hemisferio: 'sur' },
  { id: 'gt', nombre: 'Guatemala', hemisferio: 'norte' },
  { id: 'hn', nombre: 'Honduras', hemisferio: 'norte' },
  { id: 'mx', nombre: 'México', hemisferio: 'norte' },
  { id: 'ni', nombre: 'Nicaragua', hemisferio: 'norte' },
  { id: 'pa', nombre: 'Panamá', hemisferio: 'norte' },
  { id: 'pe', nombre: 'Perú', hemisferio: 'sur' },
  { id: 'py', nombre: 'Paraguay', hemisferio: 'sur' },
  { id: 'sv', nombre: 'El Salvador', hemisferio: 'norte' },
  { id: 'us', nombre: 'Estados Unidos', hemisferio: 'norte' },
  { id: 'uy', nombre: 'Uruguay', hemisferio: 'sur' },
  { id: 've', nombre: 'Venezuela', hemisferio: 'norte' },
  { id: 'otro-norte', nombre: 'Otro (hemisferio norte)', hemisferio: 'norte' },
  { id: 'otro-sur', nombre: 'Otro (hemisferio sur)', hemisferio: 'sur' },
];

// Prefijos de timezone IANA que cubren todo un país (el resto va por igualdad exacta, abajo).
const TZ_PREFIJOS: readonly (readonly [string, string])[] = [
  ['America/Argentina/', 'ar'], ['America/Indiana/', 'us'], ['America/Kentucky/', 'us'],
  ['America/North_Dakota/', 'us'],
];

// Timezone IANA exacto → país. Igualdad exacta: 'America/Bahia' no debe atrapar 'America/Bahia_Banderas'.
const TZ_PAIS: Readonly<Record<string, string>> = Object.fromEntries(
  ([
    ['ar', ['Buenos_Aires', 'Cordoba', 'Mendoza', 'Jujuy', 'Catamarca', 'Rosario']],
    ['bo', ['La_Paz']],
    ['br', ['Sao_Paulo', 'Bahia', 'Fortaleza', 'Manaus', 'Recife', 'Belem', 'Cuiaba', 'Campo_Grande',
      'Porto_Velho', 'Maceio', 'Rio_Branco', 'Araguaina', 'Santarem', 'Noronha', 'Boa_Vista', 'Eirunepe']],
    ['ca', ['Toronto', 'Vancouver', 'Edmonton', 'Winnipeg', 'Halifax', 'Montreal', 'Regina', 'St_Johns']],
    ['cl', ['Santiago', 'Punta_Arenas']],
    ['co', ['Bogota']],
    ['cr', ['Costa_Rica']],
    ['cu', ['Havana']],
    ['do', ['Santo_Domingo']],
    ['ec', ['Guayaquil']],
    ['gt', ['Guatemala']],
    ['hn', ['Tegucigalpa']],
    ['mx', ['Mexico_City', 'Monterrey', 'Cancun', 'Tijuana', 'Merida', 'Bahia_Banderas', 'Mazatlan',
      'Chihuahua', 'Hermosillo']],
    ['ni', ['Managua']],
    ['pa', ['Panama']],
    ['pe', ['Lima']],
    ['py', ['Asuncion']],
    ['sv', ['El_Salvador']],
    ['us', ['New_York', 'Chicago', 'Denver', 'Los_Angeles', 'Phoenix', 'Anchorage', 'Detroit', 'Juneau', 'Adak']],
    ['uy', ['Montevideo']],
    ['ve', ['Caracas']],
  ] as [string, string[]][]).flatMap(([pais, ciudades]) => ciudades.map((c) => [`America/${c}`, pais])).concat([
    ['Pacific/Easter', 'cl'], ['Pacific/Galapagos', 'ec'], ['Pacific/Honolulu', 'us'],
  ]),
);

const SUR_FUERA_DE_AMERICA = ['Australia/', 'Pacific/Auckland', 'Africa/Johannesburg', 'Antarctica/'];

export function paisDeTimezone(tz: string): string {
  const pais = TZ_PAIS[tz] ?? TZ_PREFIJOS.find(([prefijo]) => tz.startsWith(prefijo))?.[1];
  if (pais) {
    return pais;
  }
  return SUR_FUERA_DE_AMERICA.some((p) => tz.startsWith(p)) ? 'otro-sur' : 'otro-norte';
}

export function hemisferioDe(paisId: string): Hemisferio {
  return PAISES.find((p) => p.id === paisId)?.hemisferio ?? 'norte';
}

const ESTACIONES: readonly Estacion[] = ['verano', 'otono', 'invierno', 'primavera'];

// Estaciones por mes completo. Sur: dic–feb verano, mar–may otoño, jun–ago invierno, sep–nov primavera.
export function estacionDe(fecha: Date, hemisferio: Hemisferio): Estacion {
  const trimestre = Math.floor(((fecha.getMonth() + 1) % 12) / 3);
  return ESTACIONES[(trimestre + (hemisferio === 'sur' ? 0 : 2)) % 4];
}

// Un tag de estación es 'verano', 'otoño-invierno', etc.; comparado sin acentos. Sin tag de estación, nunca está fuera.
export function fueraDeEstacion(tags: readonly string[] | undefined, estacion: Estacion): boolean {
  const deEstacion = (tags ?? [])
    .map((t) => normalizar(t).split('-'))
    .filter((partes) => partes.every((p) => (ESTACIONES as readonly string[]).includes(p)));
  return deEstacion.length > 0 && !deEstacion.some((partes) => partes.includes(estacion));
}
