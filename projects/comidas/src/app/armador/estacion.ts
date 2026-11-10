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

// Ciudades/regiones del timezone IANA → país. Los timezones de América son 'America/<ciudad>'.
const TZ_PAIS: readonly (readonly [string, string])[] = [
  ['America/Argentina/', 'ar'], ['America/Buenos_Aires', 'ar'], ['America/Cordoba', 'ar'],
  ['America/Mendoza', 'ar'], ['America/La_Paz', 'bo'], ['America/Sao_Paulo', 'br'],
  ['America/Bahia', 'br'], ['America/Fortaleza', 'br'], ['America/Manaus', 'br'],
  ['America/Recife', 'br'], ['America/Belem', 'br'], ['America/Toronto', 'ca'],
  ['America/Vancouver', 'ca'], ['America/Edmonton', 'ca'], ['America/Winnipeg', 'ca'],
  ['America/Halifax', 'ca'], ['America/Santiago', 'cl'], ['America/Punta_Arenas', 'cl'],
  ['America/Bogota', 'co'], ['America/Costa_Rica', 'cr'], ['America/Havana', 'cu'],
  ['America/Santo_Domingo', 'do'], ['America/Guayaquil', 'ec'], ['America/Guatemala', 'gt'],
  ['America/Tegucigalpa', 'hn'], ['America/Mexico_City', 'mx'], ['America/Monterrey', 'mx'],
  ['America/Cancun', 'mx'], ['America/Tijuana', 'mx'], ['America/Merida', 'mx'],
  ['America/Managua', 'ni'], ['America/Panama', 'pa'], ['America/Lima', 'pe'],
  ['America/Asuncion', 'py'], ['America/El_Salvador', 'sv'], ['America/New_York', 'us'],
  ['America/Chicago', 'us'], ['America/Denver', 'us'], ['America/Los_Angeles', 'us'],
  ['America/Phoenix', 'us'], ['America/Anchorage', 'us'], ['Pacific/Honolulu', 'us'],
  ['America/Montevideo', 'uy'], ['America/Caracas', 've'],
];

const SUR_FUERA_DE_AMERICA = ['Australia/', 'Pacific/Auckland', 'Africa/Johannesburg', 'Antarctica/'];

export function paisDeTimezone(tz: string): string {
  const hit = TZ_PAIS.find(([prefijo]) => tz.startsWith(prefijo));
  if (hit) {
    return hit[1];
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
