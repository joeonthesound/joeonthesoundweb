# JOE on the Sound

Sitio modular construido con JavaScript ES6, CSS nativo y configuración JSON dinámica. No requiere frameworks, bundlers ni compilación.

## Despliegue en Cloudflare Pages

El proyecto está preparado como sitio estático sin proceso de compilación. Cloudflare Pages debe publicar directamente el contenido del repositorio.

### Configuración del proyecto

Utiliza estos valores al conectar el repositorio:

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Framework preset | `None` |
| Build command | vacío |
| Build output directory | `/` |
| Root directory | `/` |

No es necesario ejecutar `npm install`, `npm run build` ni generar una carpeta `dist`.

### Rutas localizadas y fallback SPA

La navegación utiliza History API y rutas reales:

```text
/es/
/es/proyecto/
/en/calculator/
/fr/a-propos-de-joe/
```

Cloudflare Pages necesita entregar `index.html` cuando una ruta virtual no corresponde a un archivo físico. El archivo raíz `_redirects` contiene:

```text
/* /index.html 200
```

Esto es una reescritura interna con estado HTTP 200. Los recursos físicos como `/js/app.js`, `/css/global.css`, `/config/themes.json`, imágenes y diccionarios continúan sirviéndose como archivos estáticos.

No elimines `_redirects` mientras el router use `pushState` y `popstate`. Sin ese fallback, recargar una URL interna puede devolver una página 404 antes de que JavaScript se ejecute.

### Caché y cabeceras

`_headers` define:

- Revalidación inmediata para `index.html`, `404.html` y `config/*.json`.
- Caché corta para diccionarios, CSS y módulos JavaScript.
- Caché de un día para el logotipo.
- Cabeceras defensivas que no interfieren con PayPal, YouTube, TikTok o Instagram.

Los archivos JavaScript y CSS no usan nombres con hash. Por esa razón no deben marcarse como `immutable`.

Después de una publicación importante:

1. Abre **Cloudflare Dashboard → Caching → Configuration**.
2. Ejecuta **Purge Everything** si el navegador sigue recibiendo una versión anterior.
3. Comprueba `/config/themes.json` directamente en producción.
4. Recarga una ruta interna para confirmar el fallback:

```text
https://joeonthesound.online/es/proyecto/
```

### Variables y secretos

El sitio es público y estático. Todo valor dentro de `config/*.json` puede ser leído por el navegador.

- El Client ID público de PayPal puede utilizarse en frontend.
- Nunca almacenes el Secret de PayPal en el repositorio.
- Las claves privadas, webhooks y creación autoritativa de órdenes deben vivir en un Cloudflare Worker usando secretos cifrados.
- Las claves públicas de APIs deben restringirse por dominio y cuota desde sus consolas.

### Verificación posterior al despliegue

- [ ] `/es/` carga sin redirecciones inesperadas.
- [ ] Una recarga directa en `/en/calculator/` devuelve la aplicación.
- [ ] CSS, módulos, locales y configuraciones responden con su MIME correcto.
- [ ] `/robots.txt` responde y permite indexación pública del sitio.
- [ ] El selector estacional conserva `jots:theme` y `jots:mode`.
- [ ] El tema claro mantiene contraste suficiente.
- [ ] Los siete perfiles musicales abren correctamente.
- [ ] YouTube, TikTok e Instagram son responsivos.
- [ ] PayPal Sandbox solo se utiliza mientras el entorno siga en pruebas.
- [ ] No hay secretos privados en el código publicado.

## 🌐 Live Production Deployment Guide for PayPal SDK (v6)

To transition the interactive quoter from the Sandbox environment to live production payments, follow these explicit instructions step-by-step:

### 1. Obtaining Production Client ID Credentials

1. Log into the [PayPal Developer Dashboard](https://developer.paypal.com/) using your live business account credentials.
2. Navigate to the **Apps & Credentials** tab.
3. Toggle the workspace switch from **Sandbox** to **Live** at the top header bar.
4. Click **Create App**, assign a name (e.g., `JOE on the Sound - Live Quoter`), and generate the credentials.
5. Copy the long **Live Client ID** string. Do **not** copy or expose the Secret Key; the frontend only requires the public Client ID to render the SDK.

### 2. Upgrading Configuration Scaffolding (`config/config.json`)

To maintain absolute decoupling of data from the logic inside `js/modules/quoter.js`, map the PayPal environment through configuration:

```json
{
  "paypal": {
    "environment": "production",
    "live_client_id": "PASTE_YOUR_LIVE_PRODUCTION_CLIENT_ID_HERE",
    "sandbox_client_id": "AUz8YKv6l5HESyshwUalEf_SH4dy5gXPbrJnFLXgJyV1iPMtj0Xc6-6XGxSAupru-18Pf7Y-3t-VfFLm",
    "currency": "USD"
  }
}
```

The application should select the appropriate public Client ID according to `environment` and construct the SDK URL dynamically:

```js
const clientId = paypal.environment === 'production'
  ? paypal.live_client_id
  : paypal.sandbox_client_id;

const sdkUrl =
  `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(paypal.currency)}`;
```

Never place a PayPal Secret Key, access token, webhook signing secret, private certificate, API password, or refresh token in `config/config.json`, Git, GitHub Pages, browser storage, or frontend JavaScript.

### 3. Switching from Sandbox to Live

Before deploying:

1. Replace `PASTE_YOUR_LIVE_PRODUCTION_CLIENT_ID_HERE` with the Live Client ID.
2. Set `environment` to `"production"`.
3. Keep `currency` synchronized with the currency used by `createOrder`.
4. Purge Cloudflare and browser caches so the previous Sandbox SDK URL is not reused.
5. Confirm that the loaded PayPal script contains the Live Client ID and not the Sandbox identifier.
6. Perform a small real transaction using a buyer account different from the receiving business account.

The calculator must continue reading the amount at the exact moment `createOrder` runs:

```js
createOrder(data, actions) {
  const finalAmount = calculateQuoterTotal().toFixed(2);

  return actions.order.create({
    purchase_units: [{
      amount: {
        currency_code: paypal.currency,
        value: finalAmount
      }
    }]
  });
}
```

Do not cache, hardcode, or read the amount from visible DOM text. `calculateQuoterTotal()` is the authoritative client-side value.

### 4. Production Security Requirements

The current static implementation can create and capture orders through the browser SDK, but a high-security production deployment should move authoritative order creation and capture to a trusted backend or Cloudflare Worker.

Recommended production flow:

1. The browser sends the selected quote IDs and quantities to a server endpoint.
2. The server recalculates the price from trusted pricing rules.
3. The server obtains a PayPal OAuth access token using the Live Client ID and Secret.
4. The server creates the PayPal order and returns only its order ID.
5. After buyer approval, the server captures the order.
6. The server verifies currency, amount, status, merchant account and order uniqueness.
7. Only then should the project be marked as paid.

This prevents a visitor from modifying JavaScript or request values to pay an altered amount.

### 5. Cloudflare Worker Secrets

When using a Cloudflare Worker, store confidential credentials as encrypted secrets:

```bash
wrangler secret put PAYPAL_CLIENT_SECRET
wrangler secret put PAYPAL_WEBHOOK_ID
```

The public Live Client ID may remain in configuration, but the Secret must only be available to the server runtime. Restrict CORS to the official site origin and reject requests from unknown origins.

### 6. Webhooks and Payment Reconciliation

Create a webhook in the PayPal Developer Dashboard for the production app. At minimum, monitor:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `CHECKOUT.ORDER.APPROVED`

Verify every webhook signature server-side using PayPal's verification API and the configured webhook ID. Webhook bodies must never be trusted solely because they reached the endpoint.

Persist:

- PayPal order ID.
- Capture ID.
- Gross amount and currency.
- Payer identifier.
- Payment status.
- Quote/brief identifier.
- Creation and capture timestamps.

Make order and capture processing idempotent to prevent duplicate fulfillment when PayPal retries a webhook.

### 7. Terms Interlock and UX Verification

The PayPal wrapper must remain inaccessible until the terms checkbox is accepted:

```css
#paypal-button-wrapper {
  opacity: 0.4;
  pointer-events: none;
}

#paypal-button-wrapper.is-enabled {
  opacity: 1;
  pointer-events: auto;
}
```

Before launch, verify:

- WhatsApp, clipboard and PayPal are disabled before accepting terms.
- All three actions activate immediately after acceptance.
- The PayPal amount matches the sticky total.
- Changing tiers, duration, vocals or add-ons changes the order amount.
- Failed SDK loads and captures show a localized error.
- A successful capture shows the localized success toast.
- Double-clicking or reloading cannot create duplicate fulfillment.

### 8. Production Launch Checklist

- [ ] Business account is verified and able to receive the configured currency.
- [ ] Live Client ID belongs to the intended merchant account.
- [ ] No PayPal Secret is present in the repository or deployed frontend.
- [ ] `environment` is set to `production`.
- [ ] Sandbox Client ID is not loaded by the live page.
- [ ] Server-side amount validation is enabled for authoritative payments.
- [ ] Webhook signatures are verified.
- [ ] Capture processing is idempotent.
- [ ] HTTPS is active.
- [ ] Cloudflare cache has been purged.
- [ ] A low-value live transaction has been completed and reconciled.
- [ ] Refund and denied-payment flows have been tested.

### 9. Rollback

If production payment behavior is incorrect:

1. Disable the payment endpoint or PayPal wrapper.
2. Set `environment` back to `"sandbox"`.
3. Purge edge and browser caches.
4. Investigate order IDs, capture responses and webhook logs.
5. Do not fulfill work based only on a client-side success message.

The success toast is a user-interface acknowledgement, not authoritative accounting evidence. Production fulfillment must rely on a verified server-side capture or validated PayPal webhook.

## Actualización de medios, perfiles musicales y temas

### Video horizontal BBE

La sección **Sobre Joe** utiliza dos TikToks verticales y un video horizontal de YouTube. El video BBE se configura fuera del módulo en:

```text
config/images.json
```

Configuración actual:

```json
{
  "aboutMedia": {
    "landscapeVideo": {
      "provider": "youtube",
      "embedUrl": "https://www.youtube.com/embed/uP7Af9T4i1o?si=7zAXtTnu7zzXnSVs",
      "title": "BBE — colaboración audiovisual"
    }
  }
}
```

`js/modules/sobre-joe.js` consume este objeto y genera un `iframe` con carga diferida, permisos explícitos, `referrerpolicy="strict-origin-when-cross-origin"` y soporte de pantalla completa.

Para reemplazar el video en el futuro, modifica únicamente `embedUrl` y `title`.

### Política responsive para iframes

Todos los `iframe` tienen una regla global:

```css
iframe {
  display: block;
  width: 100%;
  max-width: 100%;
  border: 0;
}
```

Los videos horizontales usan:

```css
.responsive-embed--landscape {
  aspect-ratio: 16 / 9;
}
```

El `iframe` se posiciona dentro del wrapper y ocupa exactamente su ancho y alto. Los embeds verticales de TikTok e Instagram conservan wrappers específicos con límites de ancho para evitar desbordamientos en móviles.

Reglas al añadir nuevos embeds:

1. No incluir atributos `width` o `height` como fuente del layout.
2. Envolver cada `iframe` en `.responsive-embed`.
3. Utilizar `aspect-ratio: 16 / 9` para horizontal o `9 / 16` para vertical.
4. Añadir `loading="lazy"` cuando el proveedor lo permita.
5. Mantener un `title` descriptivo.
6. Nunca permitir que el embed supere `max-width: 100%`.

### Perfiles musicales oficiales

Los enlaces se administran exclusivamente desde `config/config.json`, dentro de `links.social`:

- Spotify
- Apple Music
- Amazon
- Tidal
- YouTube Music
- KKBox
- BoomPlay

Estos datos alimentan automáticamente:

- Barra social lateral.
- Footer.
- Página 404.
- Datos estructurados Schema.org mediante `sameAs`.
- Accesos rápidos móviles seleccionados.

Para modificar un perfil, edita su objeto:

```json
{
  "id": "spotify",
  "label": "Spotify",
  "url": "https://open.spotify.com/intl-es/artist/0WolrewBAIYhWwzN5Z5Csg"
}
```

No deben duplicarse estas URLs dentro de los módulos JavaScript.

## Motor estacional de temas

### Configuración

La matriz completa vive en:

```text
config/themes.json
```

Cada temporada encapsula una versión oscura y una clara:

```json
{
  "activeSeason": "default",
  "activeMode": "dark",
  "seasons": {
    "default": {
      "dark": {},
      "light": {}
    },
    "future-signal": {
      "dark": {},
      "light": {}
    }
  }
}
```

Temporadas disponibles:

- `default`
- `future-signal`
- `digital-coral`
- `cosmic-luxury`

Cada variante contiene:

- Fondo principal.
- Fondo elevado.
- Panel translúcido.
- Violeta, fucsia y cian en formato RGB.
- Amarillo de acción.
- Colores de error y PayPal.
- Texto principal y secundario.
- Color de bordes.

### Selección de temporada

La temporada se guarda en:

```js
localStorage.setItem('jots:theme', 'future-signal');
```

La clave `jots:theme` representa exclusivamente una temporada, no el modo claro/oscuro.

Para activar otra temporada desde la consola:

```js
localStorage.setItem('jots:theme', 'digital-coral');
location.reload();
```

También puede modificarse el valor predeterminado:

```json
"activeSeason": "cosmic-luxury"
```

Si la temporada guardada no existe, el motor utiliza `activeSeason`.

### Selección de modo

El modo se guarda separadamente:

```js
localStorage.setItem('jots:mode', 'light');
```

Valores válidos:

- `dark`
- `light`

Si no existe un modo guardado, se utiliza `activeMode`.

### Switch de interfaz

El selector se genera dentro del header con:

```html
<button class="theme-switch" aria-pressed="false">
  ...
</button>
```

El botón claro/oscuro:

- Actualiza inmediatamente todas las variables CSS.
- Alterna únicamente entre `dark` y `light` dentro de la temporada activa.
- Cambia `data-theme` en `<html>` al modo seleccionado.
- Mantiene `data-season` con el nombre de la temporada.
- Actualiza `meta[name="theme-color"]`.
- Guarda el modo en `jots:mode`.
- Expone etiquetas accesibles localizadas en ES, EN y FR.

Los otros idiomas heredan las etiquetas inglesas mediante el sistema de fallback.

### Prioridad de resolución

El motor sigue este orden:

1. Lee `jots:theme` y valida que sea una temporada existente.
2. Si no es válida, utiliza `activeSeason`.
3. Lee `jots:mode` y acepta solo `dark` o `light`.
4. Si no es válido, utiliza `activeMode`.
5. Aplica `seasons[temporada][modo]`.

Las instalaciones antiguas que guardaban `dark` o `light` dentro de `jots:theme` se migran automáticamente a `jots:mode`.

### Variables CSS inyectadas

El motor mantiene las variables existentes para compatibilidad:

```css
--violet
--fuchsia
--cyan
```

Y también inyecta los aliases de la nueva arquitectura:

```css
--rgb-violet
--rgb-fuchsia
--rgb-cyan
```

Así, los componentes actuales, el fondo ambiental y Electric Border continúan funcionando durante la migración.

### Fondo ambiental animado

`mountAmbientLayer()` crea:

- Una banda horizontal azul–violeta.
- Dos auras desenfocadas.
- Una cuadrícula editorial.

Las animaciones usan únicamente `transform` y `opacity`, favoreciendo composición GPU. En el tema claro se reduce la intensidad para mantener legibilidad.

El sistema respeta:

```css
@media (prefers-reduced-motion: reduce)
```

por lo que desactiva las animaciones para usuarios que solicitan movimiento reducido.

## Archivos modificados por esta actualización

- `config/config.json`: perfiles musicales oficiales.
- `config/images.json`: video horizontal BBE y assets de embeds.
- `config/themes.json`: paletas clara y oscura.
- `locales/es.json`: etiquetas del tema y descripción BBE.
- `locales/en.json`: traducción inglesa.
- `locales/fr.json`: traducción francesa.
- `js/app.js`: persistencia y control del tema.
- `js/modules/uiEffects.js`: aplicación del tema y fondo ambiental.
- `js/modules/sobre-joe.js`: iframe horizontal responsive.
- `css/global.css`: switch, fondo animado y reglas universales para iframes.

## Pruebas recomendadas

Antes de publicar:

- [ ] Cambiar a tema claro y navegar entre varias rutas.
- [ ] Recargar y confirmar que el tema persiste.
- [ ] Verificar el video BBE en móvil, tableta y escritorio.
- [ ] Comprobar TikTok e Instagram sin desbordamiento horizontal.
- [ ] Revisar los siete enlaces musicales.
- [ ] Activar `prefers-reduced-motion` y comprobar que el fondo deja de moverse.
- [ ] Probar contraste de botones, formularios y tablas en ambos temas.
- [ ] Limpiar la caché de Cloudflare después de modificar JSON o CSS.

## Electric Border — SVG Displacement System

La plataforma utiliza un sistema centralizado de bordes eléctricos para estados interactivos y módulos editoriales.

### Arquitectura

`index.html` contiene un banco SVG oculto con el filtro reutilizable:

```text
#turbulent-displace
```

El filtro combina dos señales `feTurbulence`, desplazamientos animados mediante `feOffset` y un `feDisplacementMap`. Se declara una sola vez en el shell y no necesita duplicarse dentro de los módulos.

### Separación de capas

El filtro nunca se aplica al nodo que contiene texto. `css/global.css` genera dos capas visuales independientes:

- `::before`: línea de plasma nítida deformada por el filtro SVG.
- `::after`: halo ambiental desenfocado.
- Contenido real: permanece fuera del filtro, limpio y legible.

Los colores se sincronizan con el tema mediante:

```css
--primary: rgb(var(--fuchsia));
--accent: var(--yellow);
--electric-glow: var(--primary);
--electric-halo: var(--accent);
```

Cuando se alterna entre tema claro y oscuro, el borde y el halo adoptan inmediatamente las nuevas variables sin recargar la página.

### Elementos activos

El efecto está aplicado a:

- Botones durante `hover` y `focus-visible`.
- Bloques `.project-copy.rv.is-visible`.
- Cinta animada `.ticker-track`.

Los componentes usan `isolation: isolate`; las capas tienen `pointer-events: none` y el contenido editorial se mantiene en una capa superior.

### Rendimiento móvil

Para evitar microcortes durante el desplazamiento táctil:

- En pantallas menores de 768 px o dispositivos sin hover se conserva el borde, pero se elimina la distorsión SVG continua de bloques editoriales y ticker.
- Los botones solo activan el efecto interactivo cuando existe hover o foco.
- El halo se contiene dentro de wrappers con control de overflow.
- `prefers-reduced-motion: reduce` desactiva la distorsión animada.

### Contraste del tema claro

El tema claro incorpora reglas específicas para:

- Líneas del menú hamburguesa.
- Selector de idioma.
- Switch de tema.
- Iconos de luna y sol.
- Barra social y dock móvil.
- Botones circulares de reproducción.

Estas reglas usan bordes más oscuros, sombras y texto de mayor contraste sin modificar los assets ni los módulos JavaScript.

### Extensión segura

Para añadir Electric Border a otro componente:

1. El componente debe ser `position: relative` e `isolation: isolate`.
2. La línea eléctrica debe vivir en `::before`.
3. El halo debe vivir en `::after`.
4. Ambos pseudo-elementos deben usar `pointer-events: none`.
5. Nunca debe aplicarse `filter: url("#turbulent-displace")` al elemento de texto o a uno de sus padres directos.
