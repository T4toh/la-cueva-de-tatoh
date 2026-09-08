# Hosting de imágenes — app de recetas

Notas de decisión y plan de implementación.
Precios verificados a septiembre 2026. **Rechequear antes de contratar.**

Estado: investigación, sin implementar. Corresponde a la fase 4 (*Fotos*) del
recetario en [TODO.md](../TODO.md), hoy bloqueada.

---

## Decisión

**Firebase para auth + Firestore. Cloudflare R2 para los archivos.**

No mezclar: no conviene poner las imágenes privadas en Firebase Storage y las públicas en R2. Duplica SDKs, duplica modelos mentales y te obliga a Blaze sin necesidad.

### Por qué no Firebase Storage

1. **Desde el 3 de febrero de 2026, Cloud Storage for Firebase requiere el plan Blaze.** Los proyectos en Spark perdieron acceso a todos los buckets, incluido el default. Las llamadas a la API devuelven 402 o 403. Tarjeta obligatoria aunque uses 200 MB.
2. **Con imágenes el costo está en servir, no en guardar.** Firebase cobra ~$0.026/GB almacenado y ~$0.12/GB descargado. El almacenamiento es ruido; el ancho de banda es la factura.
3. **Blaze no tiene tope duro.** Un hotlink o un scraper y la factura corre sin frenarse. Se pueden poner alertas de presupuesto, pero no cortan el servicio automáticamente.

### Por qué R2

- **Egress $0, siempre, en cualquier volumen.**
- Free tier **mensual recurrente** (no un trial de 12 meses): 10 GB de storage, 1M operaciones Class A (escrituras/listados), 10M Class B (lecturas).
- Pasado eso: $0.015/GB-mes Standard. Class A $4.50/millón, Class B $0.36/millón.
- S3-compatible → cualquier SDK de S3 sirve.
- Ojo: Cloudflare **redondea hacia arriba** cada métrica. 1.1 GB-mes se factura como 2 GB-mes; 1.000.001 operaciones como 2 millones.

**Bonus:** si los archivos van todos a R2, Firestore y Auth te alcanzan con **Spark**. Cero tarjeta en Google, cero riesgo de factura sorpresa del lado de Firebase.

---

## Arquitectura

Un solo bucket de R2, dos prefijos.

```
mi-bucket/
├── pub/{recetaId}/{imgId}.webp      → dominio propio, cache en el edge, sin auth
└── draft/{uid}/{recetaId}/{imgId}.webp → detrás de un Worker que valida el token
```

### Los dos caminos de lectura

| | Ruta | Auth | Volumen |
|---|---|---|---|
| **Público** | Dominio propio → R2 directo | ninguna | ~99% del tráfico |
| **Privado** | Dominio propio → Worker → R2 | ID token de Firebase | borradores del autor |

La clave: **el camino caliente no toca un Worker ni una vez.** Al Worker solo le pegan los borradores del propio autor, que son cuatro requests por sesión. El free tier de Workers (100k requests/día) sobra de lejos.

### Flujo de publicación

1. El usuario sube la imagen → va a `draft/{uid}/...`
2. Al publicar la receta: **copia server-side dentro de R2** de `draft/` a `pub/`.
   - No sale de Cloudflare. Es una operación Class A. **No se paga transferencia.**
3. Borrar el objeto en `draft/`.
4. Actualizar la key en el documento de Firestore.

### Validar el ID token de Firebase en el Worker

El ID token es un JWT RS256. Para verificarlo:

- JWKS: `https://www.googleapis.com/service_accounts/v1/jwks/securetoken@system.gserviceaccount.com`
- Chequear `aud` == tu project id
- Chequear `iss` == `https://securetoken.google.com/{projectId}`
- Chequear `exp`
- **Cachear el JWKS** (usar Cache API o KV, no lo pidas en cada request)

`jose` corre en Workers sin drama. Son unas 30 líneas.

**Alternativa si no querés escribir el Worker:** tu backend valida el token con el Admin SDK y devuelve una **presigned URL de R2** de vida corta (5-15 min). Menos infra nueva, pero un round trip extra por imagen privada.

### Firestore como fuente de verdad

Guardar en el documento de la receta:

```js
{
  visibility: 'draft' | 'public' | 'link',
  images: [{ key: 'pub/abc123/1.webp', width, height, alt }]
}
```

**No deducir el permiso del path.** Si el permiso vive en el prefijo, el día que quieras agregar "visible por link" o "visible para seguidores" tenés que mover archivos en vez de cambiar un campo. El Worker consulta Firestore (o un KV cacheado) para decidir.

---

## Optimización de imágenes

Esto define la factura más que la elección de proveedor. Una grilla de tarjetas de recetas cargando fotos de 4 MB sacadas del celular es donde se muere el ancho de banda.

### Redimensionar en el cliente antes de subir

`createImageBitmap` → canvas → export a WebP, tope ~1600px de lado mayor.

- Gratis.
- Baja storage y transferencia de entrada.
- **Saca el EXIF automáticamente al re-encodear.** Importante: las fotos de celular traen GPS embebido. Si esas imágenes van a ser públicas, estás publicando las coordenadas de la cocina de tus usuarios. Verificar que efectivamente se limpia.

### Variantes responsive: Cloudflare Image Transformations

Funcionan directo sobre imágenes en R2, sin guardar una segunda copia.

- **Plan Free: 5.000 transformaciones únicas por mes.**
- Se factura por combinación única de imagen + opciones, **una vez al mes, no por vista**. Una foto en 3 tamaños = 3 transformaciones, la vean mil veces o un millón.
- Con 3 tamaños por receta → margen para ~1.600 recetas gratis.
- Si te pasás del free: las nuevas devuelven error `9422`, las cacheadas siguen andando, **y no te cobran**. El error es el control de costo.
- Plan Paid: $0.50 por cada 1.000 transformaciones únicas adicionales.
- Guardar los originales en Cloudflare Images ($5/100k almacenadas + $1/100k entregadas) **no hace falta** si ya están en R2. Se paga solo la transformación.
- Detalle: hay que habilitar el dominio de origen en la configuración de transformaciones, si no Cloudflare se niega a buscar la imagen.

---

## Qué necesito para arrancar en Cloudflare

- [ ] **Cuenta de Cloudflare** — gratis, sin tarjeta para registrarse.
- [ ] **Habilitar R2** — acá sí piden método de pago (tarjeta o PayPal), **aunque uses solo el free tier**. El botón dice "Purchase R2 Plan" o similar; es confuso pero el free tier es realmente gratis. Ojo con los reportes de un cargo inicial de USD 5 al activar: chequear qué es antes de confirmar.
- [ ] **Crear el bucket** — nombre en minúsculas, sin espacios, guiones para separar. Location: Automatic.
- [ ] **API Token** con permiso **Object Read & Write** (no Admin).
- [ ] **Dominio propio** para servir — opcional al principio, se puede arrancar con las URLs por defecto de R2 (`r2.dev`) y agregarlo después. Recomendado antes de producción: `r2.dev` tiene rate limiting y no es para tráfico real.
- [ ] **Workers** — plan free, 100k requests/día. Alcanza de sobra para el path privado.
- [ ] **Images / Transformations** — plan free para 5.000 transformaciones, no requiere Pro.

### Salvaguardas

- [ ] Configurar alertas de uso en R2.
- [ ] Si al final se mantiene algo en Firebase Blaze: budget alerts en Google Cloud (avisan, no cortan).
- [ ] Verificar la política de CORS del bucket.
- [ ] Confirmar que el token de API no queda expuesto en el cliente.
- [ ] Todo se paga en dólares con tarjeta. Chequear qué percepciones e impuestos aplican en el momento de contratar.

---

## Referencia de precios

| Servicio | Free tier | Pasado el free |
|---|---|---|
| R2 Standard storage | 10 GB-mes | $0.015/GB-mes |
| R2 egress | ilimitado | **$0** |
| R2 Class A (escrituras) | 1M/mes | $4.50/millón |
| R2 Class B (lecturas) | 10M/mes | $0.36/millón |
| Workers | 100k req/día | plan pago |
| Image Transformations | 5.000 únicas/mes | $0.50/1.000 |
| Firebase Storage (comparación) | requiere Blaze | $0.026/GB + $0.12/GB egress |
