import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ==========================================
// ETAPA 1: Inicialización de Rutas Base
// ==========================================
// Resolvemos las rutas absolutas dentro del entorno de Node para no depender de dónde se ejecute el script.
const root = resolve(fileURLToPath(new URL('..', import.meta.url))); // Raíz del proyecto
const output = resolve(root, 'dist');                             // Directorio final de salida (dist/)
const templatePath = resolve(root, 'index.template.html');        // Ubicación de la plantilla HTML limpia

// ==========================================
// ETAPA 2: Validación de Variables de Entorno
// ==========================================
// Definimos cuáles son las variables secretas/de entorno obligatorias que inyecta Cloudflare.
const requiredVariables = [
  'APIVIDEO',
  'AppPagoJoeontheSoundWebClientID'
];

// Filtramos y detectamos si alguna de las variables requeridas está vacía o no existe en el sistema.
const missingVariables = requiredVariables.filter(name => !process.env[name]?.trim());
if (missingVariables.length) {
  // Frenamos el build de inmediato si falta un secreto, evitando subir un sitio roto.
  throw new Error(`Missing required build variables: ${missingVariables.join(', ')}`);
}

// Función auxiliar para escapar caracteres especiales de HTML y evitar roturas de sintaxis en los atributos (ej: en el logo)
const escapeHtmlAttribute = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

// ==========================================
// ETAPA 3: Procesamiento de la Plantilla HTML
// ==========================================
// Leemos la plantilla HTML maestra
let html = await readFile(templatePath, 'utf8');

// Inyectamos las variables reales reemplazando los placeholders asignados por la otra IA.
// Usamos JSON.stringify y .slice(1, -1) para limpiar comillas accidentales y asegurar cadenas seguras.
html = html
  .replaceAll('APIVIDEO_PLACEHOLDER', JSON.stringify(process.env.APIVIDEO.trim()).slice(1, -1))
  .replaceAll('CLIENT_ID_PLACEHOLDER', JSON.stringify(process.env.AppPagoJoeontheSoundWebClientID.trim()).slice(1, -1))
  .replaceAll('logo.png', escapeHtmlAttribute(process.env.logo?.trim() || 'logo.png'));

// ==========================================
// ETAPA 4: Validación de Integridad Estructural
// ==========================================
// Verificamos si quedó algún placeholder sin reemplazar por error.
const unresolvedTokens = ['APIVIDEO_PLACEHOLDER', 'CLIENT_ID_PLACEHOLDER']
  .filter(token => html.includes(token));
if (unresolvedTokens.length) {
  throw new Error(`Unresolved index template tokens: ${unresolvedTokens.join(', ')}`);
}

// Validación de sanidad: Nos aseguramos de que el HTML resultante no haya perdido el doctype ni la importación del script principal.
if (!html.includes('<!doctype html>') || !html.includes('<script type="module" src="/js/app.js"></script>')) {
  throw new Error('Generated index.html failed structural validation.');
}

// ==========================================
// ETAPA 5: Limpieza y Preparación del Directorio "dist"
// ==========================================
// Eliminamos cualquier compilación vieja de 'dist' para evitar acumular archivos basura o corruptos.
await rm(output, { recursive: true, force: true });
// Volvemos a crear la carpeta 'dist/' completamente limpia y vacía.
await mkdir(output, { recursive: true });

// ==========================================
// ETAPA 6: Copia de Activos Estáticos y Recursos
// ==========================================
// Copiamos los directorios de estructura lógica del frontend hacia la carpeta de distribución.
for (const directory of ['config', 'css', 'js', 'locales']) {
  await cp(resolve(root, directory), resolve(output, directory), { recursive: true });
}

// Copiamos los archivos sueltos obligatorios de la raíz.
for (const file of ['logo.png', 'robots.txt', '_redirects']) {
  await cp(resolve(root, file), resolve(output, file));
}

// ==========================================
// ETAPA 7: Escritura de Archivos de Entrada Raíz
// ==========================================
// Guardamos el index.html procesado en la raíz de dist.
await writeFile(resolve(output, 'index.html'), html, 'utf8');
// Guardamos una copia idéntica como 404.html para servidores estáticos que usen este fallback estándar.
await writeFile(resolve(output, '404.html'), html, 'utf8');

// ==========================================
// ETAPA 8: Generación de Subdirectorios Físicos de Idioma (Fix Cloudflare Workers)
// ==========================================
// Para saltarnos las restricciones de enrutamiento del hosting antiguo/Workers, leemos el JSON de configuración real que acabamos de copiar.
const configRaw = await readFile(resolve(output, 'config/config.json'), 'utf8');
const config = JSON.parse(configRaw);

// Iteramos por cada idioma soportado en tu sitio web (ej: ["es", "en"]).
for (const lang of config.site.supportedLanguages) {
  const langDir = resolve(output, lang);
  // Creamos físicamente la carpeta dentro de dist/ (ej: dist/es/ o dist/en/)
  await mkdir(langDir, { recursive: true });
  
  // Guardamos una copia exacta del index.html dentro de cada carpeta de idioma.
  // Así, cuando Cloudflare busque físicamente "en/", encontrará este archivo (HTTP 200) y tu JS tomará el control.
  await writeFile(resolve(langDir, 'index.html'), html, 'utf8');
}

console.log('Build complete: Physical multi-language directories and index fallbacks generated successfully!');