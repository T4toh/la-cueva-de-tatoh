import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAcnGibMP9J5tdak-XsFcdZAXDSXKZN3tM",
  authDomain: "la-cueva-comidas.firebaseapp.com",
  projectId: "la-cueva-comidas",
  storageBucket: "la-cueva-comidas.firebasestorage.app",
  messagingSenderId: "903793481064",
  appId: "1:903793481064:web:8a994b1ac1d609a9ca72dd",
  measurementId: "G-QBFY1KY9Q3"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ]
};