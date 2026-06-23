const META_DESCRIPTION_SELECTOR = 'meta[name="description"]';

export function createRouter({ config, getDictionary, onRoute }) {
  const routeEntries = Object.entries(config.routes);
  const supported = config.site.supportedLanguages;
  const defaultLanguage = config.site.defaultLanguage;

  function routePath(language, routeId) {
    const slug = config.routes[routeId]?.[language] ?? '';
    return `/${language}/${slug ? `${slug}/` : ''}`;
  }

  function parse(pathname = location.pathname) {
    const segments = pathname.split('/').filter(Boolean);
    const language = supported.includes(segments[0]) ? segments[0] : defaultLanguage;
    const slug = segments[1] || '';
    const hasUnexpectedSegments = segments.length > (slug ? 2 : 1);
    const route = routeEntries.find(([, slugs]) => slugs[language] === slug)?.[0];
    return {
      language,
      route: route || 'notFound',
      valid: Boolean(route) && !hasUnexpectedSegments,
      pathname
    };
  }

  function injectMetadata(match) {
    const dictionary = getDictionary(match.language);
    const key = match.valid ? match.route : 'notFound';
    const metadata = dictionary.meta[key] || dictionary.meta.notFound;
    document.documentElement.lang = match.language;
    document.title = metadata.title;
    let description = document.querySelector(META_DESCRIPTION_SELECTOR);
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.append(description);
    }
    description.content = metadata.description;
    document.querySelector('link[rel="canonical"]')?.remove();
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = `${config.site.baseUrl}${match.valid ? routePath(match.language, match.route) : match.pathname}`;
    document.head.append(canonical);
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(node => node.remove());
    if (match.valid) {
      supported.forEach(language => {
        const alternate = document.createElement('link');
        alternate.rel = 'alternate';
        alternate.hreflang = language;
        alternate.href = `${config.site.baseUrl}${routePath(language, match.route)}`;
        document.head.append(alternate);
      });
    }
  }

  async function render() {
    const match = parse();
    injectMetadata(match);
    await onRoute(match);
  }

  function navigate(path, replace = false) {
    const target = new URL(path, location.origin);
    const pathname = target.pathname.endsWith('/') ? target.pathname : `${target.pathname}/`;
    history[replace ? 'replaceState' : 'pushState']({}, '', `${pathname}${target.search}${target.hash}`);
    return render();
  }

  function intercept(event) {
    const anchor = event.target.closest('a[data-route-link]');
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = new URL(anchor.href, location.origin);
    if (target.origin !== location.origin) return;
    event.preventDefault();
    navigate(`${target.pathname}${target.search}${target.hash}`);
  }

  function restoreStaticFallback() {
    const queryPath = new URLSearchParams(location.search).get('route');
    const storedPath = sessionStorage.getItem('jots:fallback-path');
    const restored = queryPath || storedPath;
    if (!restored) return;
    sessionStorage.removeItem('jots:fallback-path');
    history.replaceState({}, '', restored);
  }

  function start() {
    restoreStaticFallback();
    document.addEventListener('click', intercept);
    window.addEventListener('popstate', render);
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    if (location.pathname === '/' || !supported.includes(firstSegment)) {
      const browserLanguage = navigator.language?.slice(0, 2);
      const language = supported.includes(browserLanguage) ? browserLanguage : defaultLanguage;
      return navigate(routePath(language, 'home'), true);
    }
    return render();
  }

  return { start, render, navigate, parse, routePath };
}
