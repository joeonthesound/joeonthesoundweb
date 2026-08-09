# Cloudflare Deployment Guide

Guía de autoconfiguración para desplegar **joeonthesoundweb** en Cloudflare Pages.

## Archivos de Configuración

- **`wrangler.toml`** - Configuración de Wrangler para Cloudflare Workers/Pages
- **`cloudflare.json`** - Configuración de autodespliegue con variables y rutas

## Pasos de Configuración en Cloudflare

### 1. Crear el Proyecto en Cloudflare Pages

```bash
# Opción A: Desde terminal local
wrangler pages deploy

# Opción B: Desde Cloudflare Dashboard
# > Workers & Pages > Create > Pages > Connect to Git
```

### 2. Configurar Build & Deploy Settings

En **Cloudflare Dashboard > Pages > Settings > Builds & Deployments**:

| Campo | Valor |
|-------|-------|
| **Framework preset** | None |
| **Build command** | `node scripts/build.mjs` |
| **Build output directory** | `dist` |
| **Node version** | `24` |

### 3. Configurar Environment Variables

En **Cloudflare Dashboard > Pages > Settings > Environment Variables**:

Agregar para **Production** y **Preview**:

```
APIVIDEO = your_api_video_token_here
AppPagoJoeontheSoundWebClientID = your_client_id_here
logo = logo.png (opcional)
```

### 4. Configurar Ramas

En **Cloudflare Dashboard > Pages > Settings > Deployments**:

- **Production branch**: `main`
- **Preview branches**: `develop`, `staging`

### 5. Configurar Dominio

En **Cloudflare Dashboard > Pages > Custom Domains**:

- Agregar `joeonthesoundweb.com` como dominio principal
- (Opcional) Agregar `preview.joeonthesoundweb.com` para previews

## Workflow de Despliegue

### Despliegue Manual

```bash
# Production
wrangler deploy --env production

# Preview
wrangler deploy --env preview
```

### Despliegue Automático (Git)

1. Push a `main` → Deployment automático a producción
2. Push a `develop` → Deployment automático a preview
3. Pull Request → Vista previa en URL temporal

## Verificar Despliegue

```bash
# Ver estado del deployment
wrangler pages deployments list

# Abrir sitio live
# https://joeonthesoundweb.com
```

## Troubleshooting

**Error: Missing required build variables**
- ✅ Verificar que `APIVIDEO` y `AppPagoJoeontheSoundWebClientID` estén en Environment Variables

**Build fallando**
- ✅ Confirmar Node version 24+
- ✅ Revisar logs en Cloudflare Dashboard > Pages > Deployments

**Infinite redirect loop en `_redirects`**
- ✅ Configurar correctamente en `cloudflare.json` (no incluido en build)

## Referencias

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration/)
