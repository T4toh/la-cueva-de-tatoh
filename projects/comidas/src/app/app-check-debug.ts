// `true`: el SDK genera un debug token y lo imprime en la consola del
// navegador. En la config development, angular.json reemplaza este archivo por
// `app-check-debug.local.ts` (no versionado), con el token ya registrado en
// App Check: un debug token en el repo saltearía el enforce.
export const APP_CHECK_DEBUG_TOKEN: string | true = true;
