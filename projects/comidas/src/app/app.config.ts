import {
  ApplicationConfig,
  importProvidersFrom,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { MarkdownModule } from 'ngx-markdown';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { getApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { initializeAppCheck, provideAppCheck, ReCaptchaEnterpriseProvider } from '@angular/fire/app-check';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { initializeFirestore, provideFirestore } from '@angular/fire/firestore';

import { APP_CHECK_DEBUG_TOKEN } from './app-check-debug';

const firebaseConfig = {
  apiKey: 'AIzaSyAcnGibMP9J5tdak-XsFcdZAXDSXKZN3tM',
  authDomain: 'la-cueva-comidas.firebaseapp.com',
  projectId: 'la-cueva-comidas',
  storageBucket: 'la-cueva-comidas.firebasestorage.app',
  messagingSenderId: '903793481064',
  appId: '1:903793481064:web:8a994b1ac1d609a9ca72dd',
  measurementId: 'G-QBFY1KY9Q3',
};

// App Check con reCAPTCHA Enterprise (dominio tatoh.ar), que es lo que protege
// la cuota de Flash: la restricción de la API key por referer se falsifica.
// Público como la API key: va en el bundle.
const RECAPTCHA_SITE_KEY = '6Ld_fxEuAAAAADwBHM3MPQzbu-AsGO-7k5nPjIrv';

// En localhost reCAPTCHA no valida: va un debug token (ver app-check-debug.ts).
if (isDevMode()) {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | true }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    APP_CHECK_DEBUG_TOKEN;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withXhr()),
    importProvidersFrom(MarkdownModule.forRoot()),
    // Registramos el SW custom (ngsw-custom.js) que hace bypass de Firestore
    // antes de importar el ngsw-worker.js generado por el CLI.
    provideServiceWorker('ngsw-custom.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAppCheck(() =>
      initializeAppCheck(getApp(), {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      })
    ),
    provideAuth(() => getAuth()),
    provideFirestore(() =>
      initializeFirestore(getApp(), {
        // Forzar long-polling (XHR) en lugar de fetch streams.
        // Angular Service Worker intercepta fetch event y rompe el streaming
        // del Listen/channel de Firestore; XHR no sufre ese problema.
        experimentalForceLongPolling: true,
      })
    ),
  ],
};
