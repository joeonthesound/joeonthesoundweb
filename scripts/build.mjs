import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Inicialización de rutas
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'dist');
const templatePath = resolve(root, 'index.template.html');

// Validación de secretos obligatorios en Cloudflare
const requiredVariables = [
  'APIVIDEO',
  'AppPagoJoeontheSoundWebClientID'
];

const missingVariables = requiredVariables.filter(name => !process.env[name]?.trim());
if (missingVariables.length) {
  throw new Error(`Missing required build variables: ${missingVariables.join(', ')}`);
}

const escapeHtmlAttribute = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

// Procesar plantilla HTML
let html = await readFile(templatePath, 'utf8');
html = html
  .replaceAll('APIVIDEO_PLACEHOLDER', JSON.stringify(process.env.APIVIDEO.trim()).slice(1, -1))
  .replaceAll('CLIENT_ID_PLACEHOLDER', JSON.stringify(process.env.AppPagoJoeontheSoundWebClientID.trim()).slice(1, -1))
  .replaceAll('logo.png', escapeHtmlAttribute(process.env.logo?.trim() || 'logo.png'));

// Validaciones de sanidad
const unresolvedTokens = ['APIVIDEO_PLACEHOLDER', 'CLIENT_ID_PLACEHOLDER']
  .filter(token => html.includes(token));
if (unresolvedTokens.length) {
  throw new Error(`Unresolved index template tokens: ${unresolvedTokens.join(', ')}`);
}
if (!html.includes('<!doctype html>') || !html.includes('<script type="module" src="/js/app.js"></script>')) {
  throw new Error('Generated index.html failed structural validation.');
}

// Preparar directorio de salida limpio
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

// Copiar directorios lógicos del frontend
for (const directory of ['config', 'css', 'js', 'locales']) {
  await cp(resolve(root, directory), resolve(output, directory), { recursive: true });
}

// Copiar archivos sueltos de la raíz (Quitamos _redirects para evitar el bucle de Cloudflare)
for (const file of ['logo.png', 'robots.txt']) {
  await cp(resolve(root, file), resolve(output, file));
}

// Escribir los archivos de entrada requeridos
await writeFile(resolve(output, 'index.html'), html, 'utf8');
await writeFile(resolve(output, '404.html'), html, 'utf8'); // Mantener para redundancia estática estándar

console.log('Build complete: dist/index.html and assets ready for Wrangler.');