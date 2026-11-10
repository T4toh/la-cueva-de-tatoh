// De @angular/fire y no de 'firebase/ai': la app corre sobre el SDK que trae
// @angular/fire (11.x); mezclar con el 12 deja dos registros de Firebase.
import { getAI, getGenerativeModel, GoogleAIBackend, ObjectSchema } from '@angular/fire/ai';
import { FirebaseApp } from '@angular/fire/app';

import { esErrorTransitorio } from '../revision/pedido';

// En este orden. Lite primero y no `gemini-flash-latest`: el 2026-11-06 el
// Flash completo del plan gratuito contestaba 500 "high demand" / 503 o no
// contestaba, y lite respondía en 2 s con buen criterio una vez que el prompt
// da la vara del plato. El completo queda de reserva si lite está saturado.
export const MODELOS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
// ponytail: el SDK espera 180 s por defecto y, con el modelo saturado, Google
// tarda eso para terminar fallando. 60 s por intento: con dos modelos, el peor
// caso son 2 minutos; subirlo si una tanda sana empieza a cortarse.
export const ESPERA_MS = 60_000;

export type PedirJson = (esquema: ObjectSchema, prompt: string) => Promise<unknown>;

// Prueba los modelos en orden; pasa al siguiente sólo si el error es de los
// que otro modelo podría no tener (cuota, saturación, tiempo). Si todos
// fallan, el error es el del último.
export async function conReserva<T>(modelos: string[], intento: (modelo: string) => Promise<T>): Promise<T> {
  let ultimo: unknown = new Error('Sin modelos');
  for (const modelo of modelos) {
    try {
      return await intento(modelo);
    } catch (error) {
      if (!esErrorTransitorio(error)) {
        throw error;
      }
      ultimo = error;
    }
  }
  throw ultimo;
}

// Un pedido a Flash que vuelve JSON con la forma de `esquema`. Lo comparten la
// revisión de recetas y el armador de la semana.
export function pedirJsonDe(app: FirebaseApp): PedirJson {
  return (esquema, prompt) =>
    conReserva(MODELOS, async (model) => {
      const modelo = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
        model,
        generationConfig: { responseMimeType: 'application/json', responseSchema: esquema },
      }, { timeout: ESPERA_MS });
      const respuesta = await modelo.generateContent(prompt);
      return JSON.parse(respuesta.response.text()) as unknown;
    });
}
