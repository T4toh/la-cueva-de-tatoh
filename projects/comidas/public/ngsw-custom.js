/**
 * Service Worker custom para comidas.
 *
 * Problema: el Angular Service Worker (ngsw-worker.js) intercepta el `fetch`
 * de las requests cross-origin de Firestore (Listen/Write channel) y las
 * envuelve con `respondWith`, lo que rompe el long-polling con
 * "A ServiceWorker intercepted the request and encountered an unexpected error".
 *
 * `experimentalForceLongPolling` (en app.config) no alcanza: el SW intercepta
 * igual el XHR. `navigationUrls` tampoco, porque solo aplica a navegación.
 *
 * Solución: registrar un listener de `fetch` ANTES de importar el ngsw-worker
 * y, para las URLs de Firestore/RTDB, llamar a `stopImmediatePropagation()`.
 * Eso evita que el listener de ngsw reciba el evento; al no llamar a
 * `respondWith`, el navegador resuelve la request por la red normal.
 */
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebaseio.com')
  ) {
    event.stopImmediatePropagation();
  }
});

importScripts('./ngsw-worker.js');
