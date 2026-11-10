// De @angular/fire y no de 'firebase/ai': la app corre sobre el SDK que trae
// @angular/fire (11.x); mezclar con el 12 deja dos registros de Firebase.
import { getAI, getGenerativeModel, GoogleAIBackend, ObjectSchema } from '@angular/fire/ai';
import { FirebaseApp } from '@angular/fire/app';

// Lite y no `gemini-flash-latest`: el 2026-11-06 el Flash completo del plan
// gratuito contestaba 500 "high demand" / 503 o no contestaba, y lite
// respondía en 2 s con buen criterio una vez que el prompt da la vara del plato.
export const MODELO = 'gemini-flash-lite-latest';
// ponytail: el SDK espera 180 s por defecto y, con el modelo saturado, Google
// tarda eso para terminar fallando. 90 s por tanda alcanza para 40 recetas;
// subirlo si una tanda sana empieza a cortarse.
export const ESPERA_MS = 90_000;

export type PedirJson = (esquema: ObjectSchema, prompt: string) => Promise<unknown>;

// Un pedido a Flash que vuelve JSON con la forma de `esquema`. Lo comparten la
// revisión de recetas y el armador de la semana.
export function pedirJsonDe(app: FirebaseApp): PedirJson {
  return async (esquema, prompt) => {
    const modelo = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
      model: MODELO,
      generationConfig: { responseMimeType: 'application/json', responseSchema: esquema },
    }, { timeout: ESPERA_MS });
    const respuesta = await modelo.generateContent(prompt);
    return JSON.parse(respuesta.response.text()) as unknown;
  };
}
