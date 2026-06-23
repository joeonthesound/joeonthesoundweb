export function applyTheme(theme, mode = '', season = '') {
  const root = document.documentElement.style;
  Object.entries({
    '--bg-main': theme.bgMain,
    '--bg-elevated': theme.bgElevated,
    '--panel': theme.panel,
    '--violet': theme.violet,
    '--fuchsia': theme.fuchsia,
    '--cyan': theme.cyan,
    '--yellow': theme.yellow,
    '--red': theme.red,
    '--paypal': theme.paypal,
    '--paypal-hover': theme.paypalHover,
    '--text-primary': theme.textPrimary,
    '--text-muted': theme.textMuted,
    '--border': theme.border
  }).forEach(([property, value]) => root.setProperty(property, value));
  root.setProperty('--rgb-violet', theme.violet);
  root.setProperty('--rgb-fuchsia', theme.fuchsia);
  root.setProperty('--rgb-cyan', theme.cyan);
  if (mode) document.documentElement.dataset.theme = mode;
  if (season) document.documentElement.dataset.season = season;
}

export function mountAmbientLayer(container) {
  container.innerHTML = '<span class="ambient-band"></span><span class="ambient-orb"></span><span class="ambient-orb"></span><span class="ambient-grid"></span>';
}

export function mountScrollReveal(scope = document) {
  const selector = '.reveal, .rv';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scope.querySelectorAll(selector).forEach(node => node.classList.add('is-visible'));
    return () => {};
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -7% 0px' });
  scope.querySelectorAll(selector).forEach(node => observer.observe(node));
  return () => observer.disconnect();
}

export function loadExternalStylesheet(url) {
  if (!url || document.querySelector(`link[data-dynamic-font="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.dynamicFont = url;
  document.head.append(link);
}

export function createMobileMenu({ button, menu }) {
  const setOpen = open => {
    button.classList.toggle('is-open', open);
    menu.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  };
  button.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  return () => setOpen(false);
}

export function afterFirstPaint(task) {
  requestAnimationFrame(() => requestAnimationFrame(() => Promise.resolve().then(task).catch(console.error)));
}

let instagramScriptPromise = null;

export function mountInstagramEmbeds(scriptUrl) {
  const processEmbeds = () => window.instgrm?.Embeds?.process?.();
  if (window.instgrm?.Embeds) {
    processEmbeds();
    return Promise.resolve();
  }
  if (!instagramScriptPromise) {
    instagramScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-instagram-embed]');
      if (existing) {
        existing.addEventListener('load', () => {
          processEmbeds();
          resolve();
        }, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.dataset.instagramEmbed = 'true';
      script.addEventListener('load', () => {
        processEmbeds();
        resolve();
      }, { once: true });
      script.addEventListener('error', error => {
        instagramScriptPromise = null;
        reject(error);
      }, { once: true });
      document.head.append(script);
    });
  } else {
    instagramScriptPromise.then(processEmbeds);
  }
  return instagramScriptPromise;
}

let tiktokScriptPromise = null;

export function mountTikTokEmbeds(scriptUrl) {
  if (window.tiktokEmbed?.lib?.render) {
    window.tiktokEmbed.lib.render();
    return Promise.resolve();
  }
  if (!tiktokScriptPromise) {
    tiktokScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tiktok-embed]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.dataset.tiktokEmbed = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', error => {
        tiktokScriptPromise = null;
        reject(error);
      }, { once: true });
      document.head.append(script);
    });
  }
  return tiktokScriptPromise;
}
