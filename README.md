JOE on the Sound

Sitio modular de alto rendimiento construido con JavaScript ES6, CSS nativo y configuración JSON dinámica. No requiere frameworks, bundlers complejos, ni dependencias de ejecución de terceros.

🚀 Despliegue en Cloudflare (Entorno Unificado Workers & Pages)

El proyecto utiliza un pipeline de ensamblado ligero a través de Node.js que genera un artefacto estático seguro dentro de una carpeta intermedia dist, la cual es inmediatamente desplegada por Wrangler bajo el modelo unificado de activos estáticos de Cloudflare.

Configuración del Panel de Control

Al conectar el repositorio en la interfaz unificada de Cloudflare, se deben utilizar los siguientes parámetros exactos:

Campo

Valor

Production branch

main

Framework preset

None

Build command

node scripts/build.mjs

Deploy command

npx wrangler deploy

Root directory

/

No es necesario ejecutar npm install en producción para compilar activos estáticos. El script nativo genera una estructura limpia a partir de index.template.html.

Inyección de Variables Públicas y Sanidad del Build

El script de compilación requiere la declaración de las siguientes variables en Settings → Environment variables:

logo (Opcional, con fallback automático a logo.png)

APIVIDEO (Obligatorio, inyecta la API Key de Google Cloud)

AppPagoJoeontheSoundWebClientID (Obligatorio, inyecta el Client ID público de PayPal)

⚠️ REGLA DE ORO DE SEGURIDAD (Joe Codex): Nunca declares, sustituyas ni expongas AppPagoJoeontheSoundWebSecret_key_1 (el Secret Key privado de PayPal) en archivos que viajen al cliente frontend (HTML, JS, JSON o repositorios Git públicos). Las operaciones que requieran este secreto deben delegarse exclusivamente a un entorno seguro del lado del servidor (como un Cloudflare Worker con secretos cifrados).

🌐 Comportamiento del Sistema de Rutas y Fallback SPA NATIVO

La navegación del sitio se controla por completo en el cliente mediante la History API y expone rutas virtuales limpias y localizadas:

/es/
/es/proyecto/
/en/calculator/


Configuración Correcta del Servidor (Evitando el Bucle Infinito)

Para que el servidor devuelva un estado HTTP 200 OK limpio en lugar de un error 404 duro del navegador cuando un usuario hace un hard refresh (F5) o ingresa desde un link externo compartido:

Sin archivos de redirección conflictivos: NO se debe generar ni incluir un archivo _redirects en la carpeta de salida dist. En la infraestructura moderna de Cloudflare Workers Assets, una regla genérica como /* /index.html 200 gatilla un bucle infinito a nivel de API (Error Code: 100324) bloqueando el deploy.

Control por Wrangler: El comportamiento de Single Page Application se delega por completo a la especificación nativa del archivo wrangler.toml en la raíz del proyecto:

#:schema node_modules/wrangler/config-schema.json
name = "joeonthesoundweb"
compatibility_date = "2026-06-23"

[assets]
directory = "dist"
not_found_handling = "single-page-application"


Al omitir _redirects y activar not_found_handling = "single-page-application", Cloudflare intercepta de forma nativa las llamadas a rutas virtuales inexistentes en el disco y sirve el shell de index.html con un código de respuesta correcto, permitiendo que js/router.js despierte, procese el segmento (/es/, /en/) y pinte los componentes dinámicamente.

Caché y Cabeceras

Los archivos JavaScript y CSS no usan nombres con hash. No deben configurarse como immutable desde el panel. Si tras una publicación importante el navegador sigue recibiendo una versión anterior:

Abre Cloudflare Dashboard → Caching → Configuration.

Ejecuta Purge Everything.

🛠️ Archivo de Compilación: scripts/build.mjs

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ETAPA 1: Inicialización de Contexto y Rutas Absolutas
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'dist');
const templatePath = resolve(root, 'index.template.html');

// ETAPA 2: Validación de Variables Críticas de Entorno
const requiredVariables = [
  'APIVIDEO',
  'AppPagoJoeontheSoundWebClientID'
];

const missingVariables = requiredVariables.filter(name => !process.env[name]?.trim());
if (missingVariables.length) {
  throw new Error(`[BUILD FATAL] Faltan variables de entorno requeridas: ${missingVariables.join(', ')}`);
}

const escapeHtmlAttribute = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

// ETAPA 3: Procesamiento e Inyección de la Plantilla
let html = await readFile(templatePath, 'utf8');
html = html
  .replaceAll('APIVIDEO_PLACEHOLDER', JSON.stringify(process.env.APIVIDEO.trim()).slice(1, -1))
  .replaceAll('CLIENT_ID_PLACEHOLDER', JSON.stringify(process.env.AppPagoJoeontheSoundWebClientID.trim()).slice(1, -1))
  .replaceAll('logo.png', escapeHtmlAttribute(process.env.logo?.trim() || 'logo.png'));

// ETAPA 4: Pruebas de Sanidad e Integridad del HTML
const unresolvedTokens = ['APIVIDEO_PLACEHOLDER', 'CLIENT_ID_PLACEHOLDER']
  .filter(token => html.includes(token));
if (unresolvedTokens.length) {
  throw new Error(`[BUILD ERROR] Quedaron placeholders sin resolver: ${unresolvedTokens.join(', ')}`);
}
if (!html.includes('<!doctype html>') || !html.includes('<script type="module" src="/js/app.js"></script>')) {
  throw new Error('[BUILD ERROR] El HTML generado no superó la validación estructural básica.');
}

// ETAPA 5: Preparación de Directorio Limpio (dist/)
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

// ETAPA 6: Copia Modular de Activos del Frontend
for (const directory of ['config', 'css', 'js', 'locales']) {
  await cp(resolve(root, directory), resolve(output, directory), { recursive: true });
}

// Copiamos los archivos planos de configuración pública (Excluimos _redirects por diseño)
for (const file of ['logo.png', 'robots.txt']) {
  await cp(resolve(root, file), resolve(output, file));
}

// ETAPA 7: Generación del Shell de Entrada y Redundancia
await writeFile(resolve(output, 'index.html'), html, 'utf8');
await writeFile(resolve(output, '404.html'), html, 'utf8'); // Fallback estático de seguridad

console.log('Build complete: dist/index.html and assets ready for Wrangler.');


Variables y secretos

El sitio es público y estático. Todo valor dentro de config/*.json puede ser leído por el navegador.

El Client ID público de PayPal puede utilizarse en el frontend.

Nunca almacenes el Secret de PayPal en el repositorio.

Las claves privadas, webhooks y creación autoritativa de órdenes deben vivir en un Cloudflare Worker usando secretos cifrados.

Las claves públicas de APIs deben restringirse por dominio y cuota desde sus consolas.

Verificación posterior al despliegue

[ ] /es/ carga sin redirecciones inesperadas.

[ ] Una recarga directa en /en/calculator/ devuelve la aplicación.

[ ] CSS, módulos, locales y configuraciones responden con su MIME correcto.

[ ] /robots.txt responde y permite indexación pública del sitio.

[ ] El selector estacional conserva jots:theme y jots:mode.

[ ] El tema claro mantiene contraste suficiente.

[ ] Los siete perfiles musicales abren correctamente.

[ ] YouTube, TikTok e Instagram son responsivos.

[ ] PayPal Sandbox solo se utiliza mientras el entorno siga en pruebas.

[ ] No hay secretos privados en el código publicado.

🌐 Live Production Deployment Guide for PayPal SDK (v6)

To transition the interactive quoter from the Sandbox environment to live production payments, follow estas explicit instructions step-by-step:

1. Obtaining Production Client ID Credentials

Log into the PayPal Developer Dashboard using your live business account credentials.

Navigate to the Apps & Credentials tab.

Toggle the workspace switch from Sandbox to Live at the top header bar.

Click Create App, assign a name (e.g., JOE on the Sound - Live Quoter), and generate the credentials.

Copy the long Live Client ID string. Do not copy or expose the Secret Key; the frontend only requires the public Client ID to render the SDK.

2. Production Client ID injection

Cloudflare replaces CLIENT_ID_PLACEHOLDER during deployment. The calculator reads the resulting public value and constructs the SDK URL dynamically:

const livePayPalClientId = window.ENV.AppPagoJoeontheSoundWebClientID;


Never place a PayPal Secret Key, access token, webhook signing secret, private certificate, API password, or refresh token in config/config.json, Git, GitHub Pages, browser storage, or frontend JavaScript.

3. Switching from Sandbox to Live

Before deploying:

Store the Live Client ID in Cloudflare as AppPagoJoeontheSoundWebClientID.

Keep currency synchronized with the currency used by createOrder.

Purge Cloudflare and browser caches so an earlier SDK URL is not reused.

Confirm that the loaded PayPal script contains the Live Client ID.

Perform a small real transaction using a buyer account different from the receiving business account.

The calculator must continue reading the amount at the exact moment createOrder runs:

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


Do not cache, hardcode, or read the amount from visible DOM text. calculateQuoterTotal() is the authoritative client-side value.

4. Production Security Requirements

The current static implementation can create and capture orders through the browser SDK, but a high-security production deployment should move authoritative order creation and capture to a trusted backend or Cloudflare Worker.

Recommended production flow:

The browser sends the selected quote IDs and quantities to a server endpoint.

The server recalculates the price from trusted pricing rules.

The server obtains a PayPal OAuth access token using the Live Client ID and Secret.

The server creates the PayPal order and returns only its order ID.

After buyer approval, the server captures the order.

The server verifies currency, amount, status, merchant account and order uniqueness.

Only then should the project be marked as paid.

This prevents a visitor from modifying JavaScript or request values to pay an altered amount.

5. Cloudflare Worker Secrets

When using a Cloudflare Worker, store confidential credentials as encrypted secrets:

wrangler secret put PAYPAL_CLIENT_SECRET
wrangler secret put PAYPAL_WEBHOOK_ID


The public Live Client ID may remain in configuration, but the Secret must only be available to the server runtime. Restrict CORS to the official site origin and reject requests from unknown origins.

6. Webhooks and Payment Reconciliation

Create a webhook in the PayPal Developer Dashboard for the production app. At minimum, monitor:

PAYMENT.CAPTURE.COMPLETED

PAYMENT.CAPTURE.DENIED

PAYMENT.CAPTURE.REFUNDED

CHECKOUT.ORDER.APPROVED

Verify every webhook signature server-side using PayPal's verification API and the configured webhook ID. Webhook bodies must never be trusted solely because they reached the endpoint.

Persist:

PayPal order ID.

Capture ID.

Gross amount and currency.

Payer identifier.

Payment status.

Quote/brief identifier.

Creation and capture timestamps.

Make order and capture processing idempotent to prevent duplicate fulfillment when PayPal retries a webhook.

7. Terms Interlock and UX Verification

The PayPal wrapper must remain inaccessible until the terms checkbox is accepted:

#paypal-button-wrapper {
  opacity: 0.4;
  pointer-events: none;
}

#paypal-button-wrapper.is-enabled {
  opacity: 1;
  pointer-events: auto;
}


Before launch, verify:

WhatsApp, clipboard and PayPal are disabled before accepting terms.

All three actions activate immediately after acceptance.

The PayPal amount matches the sticky total.

Changing tiers, duration, vocals or add-ons changes the order amount.

Failed SDK loads and captures show a localized error.

A successful capture shows the localized success toast.

Double-clicking or reloading cannot create duplicate fulfillment.

8. Production Launch Checklist

[ ] Business account is verified and able to receive the configured currency.

[ ] Live Client ID belongs to the intended merchant account.

[ ] No PayPal Secret is present in the repository or deployed frontend.

[ ] environment is set to production.

[ ] Sandbox Client ID is not loaded by the live page.

[ ] Server-side amount validation is enabled for authoritative payments.

[ ] Webhook signatures are verified.

[ ] Capture processing is idempotent.

[ ] HTTPS is active.

[ ] Cloudflare cache has been purged.

[ ] A low-value live transaction has been completed and reconciled.

[ ] Refund and denied-payment flows have been tested.

9. Rollback

If production payment behavior is incorrect:

Disable the payment endpoint or PayPal wrapper.

Set environment back to "sandbox".

Purge edge and browser caches.

Investigate order IDs, capture responses and webhook logs.

Do not fulfill work based only on a client-side success message.

The success toast is a user-interface acknowledgement, not authoritative accounting evidence. Production fulfillment must rely on a verified server-side capture or validated PayPal webhook.

Actualización de medios, perfiles musicales y temas

Video horizontal BBE

La sección Sobre Joe utiliza dos TikToks verticales y un video horizontal de YouTube. El video BBE se configura fuera del módulo en config/images.json:

{
  "aboutMedia": {
    "landscapeVideo": {
      "provider": "youtube",
      "embedUrl": "https://www.youtube.com/embed/uP7Af9T4i1o?si=7zAXtTnu7zzXnSVs",
      "title": "BBE — colaboración audiovisual"
    }
  }
}


js/modules/sobre-joe.js consume este objeto y genera un iframe con carga diferida y soporte de pantalla completa. Para reemplazar el video en el futuro, modifica únicamente embedUrl and title.

Política responsive para iframes

Todos los iframe tienen una regla global:

iframe {
  display: block;
  width: 100%;
  max-width: 100%;
  border: 0;
}


Los videos horizontales usan aspect-ratio: 16 / 9;. Los embeds verticales de TikTok e Instagram conservan wrappers específicos con límites de ancho para evitar desbordamientos en móviles.

Reglas al añadir nuevos embeds:

No incluir atributos width o height como fuente del layout.

Envolver cada iframe en .responsive-embed.

Utilizar aspect-ratio: 16 / 9 para horizontal o 9 / 16 para vertical.

Añadir loading="lazy" cuando el proveedor lo permita.

Mantener un title descriptivo.

Nunca permitir que el embed supere max-width: 100%.

Perfiles musicales oficiales

Los enlaces se administran exclusivamente desde config/config.json, dentro de links.social: Spotify, Apple Music, Amazon, Tidal, YouTube Music, KKBox y BoomPlay. Estos datos alimentan automáticamente la barra social lateral, el footer, la página 404, y los datos estructurados Schema.org mediante sameAs.

Para modificar un perfil, edita su objeto:

{
  "id": "spotify",
  "label": "Spotify",
  "url": "https://open.spotify.com/intl-es/artist/0WolrewBAIYhWwzN5Z5Csg"
}


Motor estacional de temas

Configuración

La matriz completa vive en config/themes.json. Cada temporada encapsula una versión oscura y una clara:

{
  "activeSeason": "default",
  "activeMode": "dark",
  "seasons": {
    "default": { "dark": {}, "light": {} },
    "future-signal": { "dark": {}, "light": {} }
  }
}


Temporadas disponibles: default, future-signal, digital-coral, cosmic-luxury.

Selección de temporada y modo

La temporada se persiste en localStorage.setItem('jots:theme', 'future-signal'); mientras que el modo claro/oscuro se guarda por separado en jots:mode. El switch alternará entre dark y light dentro de la temporada activa y actualizará el atributo data-theme en <html> junto con el meta[name="theme-color"].

Fondo ambiental animado

mountAmbientLayer() crea una banda horizontal azul–violeta, dos auras desenfocadas y una cuadrícula editorial. Las animaciones usan únicamente transform y opacity favoreciendo la composición por GPU. El sistema respeta de manera nativa la regla @media (prefers-reduced-motion: reduce).

Electric Border — SVG Displacement System

La plataforma utiliza un sistema centralizado de bordes eléctricos para estados interactivos y módulos editoriales.

Arquitectura

index.template.html contiene un banco SVG oculto con el filtro reutilizable #turbulent-displace. El filtro combina dos señales feTurbulence, desplazamientos animados mediante feOffset y un feDisplacementMap.

El filtro nunca se aplica directamente al nodo que contiene texto para evitar problemas de legibilidad. css/global.css genera dos capas visuales independientes:

::before: línea de plasma nítida deformada por el filtro SVG.

::after: halo ambiental desenfocado.

Rendimiento móvil

Para evitar microcortes durante el desplazamiento táctil:

En pantallas menores de 768 px o dispositivos sin hover se conserva el borde, pero se elimina la distorsión SVG continua de bloques editoriales y ticker.

Los botones solo activan el efecto interactivo cuando existe hover o foco.

prefers-reduced-motion: reduce desactiva la distorsión animada.