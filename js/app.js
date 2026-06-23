import { createRouter } from './router.js';
import { mountQuoter } from './modules/quoter.js';
import { renderVideoLibrary } from './modules/videos.js';
import { renderMusicCatalog } from './modules/music.js';
import { renderSobreJoe } from './modules/sobre-joe.js';
import {
  afterFirstPaint,
  applyTheme,
  createMobileMenu,
  loadExternalStylesheet,
  mountInstagramEmbeds,
  mountScrollReveal
} from './modules/uiEffects.js';

const JSON_FILES = ['/config/config.json', '/config/images.json', '/config/themes.json'];

async function loadJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function bootstrap() {
  const [config, images, themes] = await Promise.all(JSON_FILES.map(loadJson));
  const dictionaries = new Map();
  const app = document.querySelector('#app');
  const headerRoot = document.querySelector('#site-header');
  const footerRoot = document.querySelector('#site-footer');
  const dockRoot = document.querySelector('#mobile-dock');
  const ambientRoot = document.querySelector('#ambient-layer');
  const modalRoot = document.querySelector('#modal-root');
  let activeCleanup = [];
  let currentLanguage = config.site.defaultLanguage;
  const legacyTheme = localStorage.getItem('jots:theme');
  if ((legacyTheme === 'dark' || legacyTheme === 'light') && !localStorage.getItem('jots:mode')) {
    localStorage.setItem('jots:mode', legacyTheme);
    localStorage.removeItem('jots:theme');
  }
  const savedSeason = localStorage.getItem('jots:theme');
  let activeSeason = themes.seasons[savedSeason] ? savedSeason : themes.activeSeason;
  const savedMode = localStorage.getItem('jots:mode');
  let activeMode = savedMode === 'dark' || savedMode === 'light' ? savedMode : themes.activeMode;
  let router;

  const mergeDictionary = (base, extension) => {
    if (!extension || typeof extension !== 'object' || Array.isArray(extension)) return extension ?? base;
    return Object.keys({ ...base, ...extension }).reduce((result, key) => {
      result[key] = mergeDictionary(base?.[key], extension?.[key]);
      return result;
    }, {});
  };

  async function dictionary(language) {
    if (dictionaries.has(language)) return dictionaries.get(language);
    const raw = await loadJson(`/locales/${language}.json`);
    let value = raw;
    if (raw.fallback && raw.fallback !== language) {
      value = mergeDictionary(await dictionary(raw.fallback), raw);
    }
    dictionaries.set(language, value);
    return value;
  }

  await Promise.all(config.site.supportedLanguages.map(dictionary));
  const getDictionary = language => dictionaries.get(language) || dictionaries.get(config.site.defaultLanguage);

  loadExternalStylesheet(config.site.fontStylesheet);
  const applyActiveTheme = () => {
    const season = themes.seasons[activeSeason] || themes.seasons[themes.activeSeason];
    const theme = season[activeMode] || season[themes.activeMode];
    applyTheme(theme, activeMode, activeSeason);
    document.querySelector('meta[name="theme-color"]').content = theme.bgMain;
    localStorage.setItem('jots:theme', activeSeason);
    localStorage.setItem('jots:mode', activeMode);
  };
  applyActiveTheme();
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.href = images.brand.favicon;
  document.head.append(favicon);
  ambientRoot.replaceChildren();

  // Dynamic coordinate injection for the seasonal background radial warp.
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  const updatePointerCoordinates = () => {
    pointerFrame = 0;
    const { top, left, width, height } = document.body.getBoundingClientRect();
    document.body.style.setProperty('--posX', (pointerX - left - width / 2).toFixed(2));
    document.body.style.setProperty('--posY', (pointerY - top - height / 2).toFixed(2));
  };
  document.body.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointerCoordinates);
  }, { passive: true });

  const routeLink = (language, routeId) => router.routePath(language, routeId);
  const socialById = id => config.links.social.find(item => item.id === id);

  function cleanupPage() {
    activeCleanup.forEach(cleanup => cleanup?.());
    activeCleanup = [];
    modalRoot.replaceChildren();
  }

  function injectStructuredData() {
    document.querySelector('#site-schema')?.remove();
    const script = document.createElement('script');
    script.id = 'site-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': config.site.schemaContext,
      '@graph': [
        {
          '@type': 'MusicGroup',
          '@id': `${config.site.baseUrl}/#artist`,
          name: config.site.name,
          url: config.site.baseUrl,
          image: `${config.site.baseUrl}${images.brand.logo}`,
          genre: config.site.genres,
          foundingLocation: { '@type': 'Place', name: config.site.origin },
          sameAs: config.links.social.map(item => item.url)
        },
        {
          '@type': 'WebSite',
          '@id': `${config.site.baseUrl}/#website`,
          name: config.site.name,
          url: config.site.baseUrl,
          inLanguage: config.site.supportedLanguages,
          publisher: { '@id': `${config.site.baseUrl}/#artist` }
        }
      ]
    });
    document.head.append(script);
  }

  function renderChrome(match, words) {
    const navigation = ['home', 'project', 'about', 'music', 'videos', 'services', 'calculator', 'contact'];
    headerRoot.innerHTML = `
      <div class="site-header">
        <div class="header-inner">
          <a class="brand" data-route-link href="${routeLink(match.language, 'home')}">
            <img src="${images.brand.logo}" alt="${words.media.logoAlt}">
            <span class="brand-name">${config.site.legalName}</span>
          </a>
          <nav class="desktop-nav" aria-label="${words.nav.menu}">
            ${navigation.map(routeId => `<a data-route-link href="${routeLink(match.language, routeId)}" ${match.route === routeId ? 'aria-current="page"' : ''}>${words.nav[routeId]}</a>`).join('')}
          </nav>
          <div class="header-actions">
            <button class="theme-switch" type="button" aria-label="${activeMode === 'dark' ? words.nav.lightTheme : words.nav.darkTheme}" aria-pressed="${String(activeMode === 'light')}">
              <span class="theme-switch-track"><span class="theme-icon theme-icon--moon">◔</span><span class="theme-icon theme-icon--sun">☀</span><span class="theme-switch-knob"></span></span>
            </button>
            <label class="sr-only" for="language">${words.nav.language}</label>
            <select class="language-select" id="language">
              ${config.site.supportedLanguages.map(language => `<option value="${language}" ${language === match.language ? 'selected' : ''}>${getDictionary(language).languageName}</option>`).join('')}
            </select>
            <button class="menu-button" type="button" aria-label="${words.nav.menu}" aria-expanded="false"><span></span><span></span><span></span></button>
          </div>
        </div>
      </div>
      <nav class="mobile-menu" aria-label="${words.nav.menu}">
        ${navigation.map(routeId => `<a data-route-link href="${routeLink(match.language, routeId)}" ${match.route === routeId ? 'aria-current="page"' : ''}>${words.nav[routeId]}</a>`).join('')}
      </nav>
      <aside class="social-rail">
        ${config.links.social.map(item => `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.label}</a>`).join('')}
      </aside>`;
    const menuCleanup = createMobileMenu({
      button: headerRoot.querySelector('.menu-button'),
      menu: headerRoot.querySelector('.mobile-menu')
    });
    activeCleanup.push(menuCleanup);
    headerRoot.querySelector('.theme-switch').addEventListener('click', event => {
      activeMode = activeMode === 'dark' ? 'light' : 'dark';
      applyActiveTheme();
      const button = event.currentTarget;
      button.setAttribute('aria-pressed', String(activeMode === 'light'));
      button.setAttribute('aria-label', activeMode === 'dark' ? words.nav.lightTheme : words.nav.darkTheme);
    });
    headerRoot.querySelector('#language').addEventListener('change', event => {
      router.navigate(routeLink(event.target.value, match.valid ? match.route : 'home'));
    });

    const spotify = socialById('spotify');
    const apple = socialById('apple');
    const youtube = socialById('youtube');
    dockRoot.innerHTML = `
      <nav class="mobile-dock" aria-label="${words.nav.menu}">
        <a href="${spotify.url}" target="_blank" rel="noopener noreferrer">${spotify.label}</a>
        <a href="${apple.url}" target="_blank" rel="noopener noreferrer">${apple.label}</a>
        <a class="dock-primary" data-route-link href="${routeLink(match.language, 'calculator')}" ${match.route === 'calculator' ? 'aria-current="page"' : ''}>${words.dock.calculator}</a>
        <a href="${youtube.url}" target="_blank" rel="noopener noreferrer">${youtube.label}</a>
        <a data-route-link href="${routeLink(match.language, 'contact')}" ${match.route === 'contact' ? 'aria-current="page"' : ''}>${words.dock.contact}</a>
      </nav>`;

    footerRoot.innerHTML = `
      <div class="site-footer">
        <div class="shell footer-inner">
          <div>
            <strong>${config.site.legalName}</strong>
            <p class="footer-meta">${words.footer.statement}</p>
            <p class="footer-meta">© ${new Date().getFullYear()} · ${words.footer.rights}</p>
          </div>
          <div class="footer-links">
            ${config.links.social.map(item => `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.label}</a>`).join('')}
            <a href="${config.repositories.website}" target="_blank" rel="noopener noreferrer">${words.footer.repository}</a>
          </div>
        </div>
        <section class="sr-only" aria-label="${config.site.name}">
          <h2>${config.site.name}</h2>
          <p>${words.footer.statement}</p>
          <p>${config.site.origin}</p>
        </section>
      </div>`;
  }

  const sectionHead = (eyebrow, title, body, link = '') => `
    <header class="section-head reveal">
      <div><p class="eyebrow">${eyebrow}</p><h2 class="heading">${title}</h2></div>
      <p class="lead">${body}</p>${link}
    </header>`;

  function renderHome(words, match) {
    app.innerHTML = `
      <section class="hero">
        <div class="shell">
          <div class="hero-copy reveal">
            <p class="eyebrow">${words.hero.eyebrow}</p>
            <h1 class="display">${words.hero.title}</h1>
            <p class="lead">${words.hero.body}</p>
            <div class="hero-actions">
              <a class="btn btn--primary" data-route-link href="${routeLink(match.language, 'calculator')}">${words.hero.primary}</a>
              <a class="btn btn--ghost" data-route-link href="${routeLink(match.language, 'music')}">${words.hero.secondary}</a>
            </div>
          </div>
          <div class="ticker"><div class="ticker-track"><span>${words.hero.ticker}</span><span aria-hidden="true">${words.hero.ticker}</span></div></div>
        </div>
      </section>
      <section class="section"><div class="shell">
        ${sectionHead(words.home.musicEyebrow, words.home.musicTitle, words.home.musicBody, `<a class="section-link" data-route-link href="${routeLink(match.language, 'music')}">${words.home.viewAll} →</a>`)}
        <div id="home-music"></div>
      </div></section>
      <section class="section"><div class="shell">
        ${sectionHead(words.home.videosEyebrow, words.home.videosTitle, words.home.videosBody, `<a class="section-link" data-route-link href="${routeLink(match.language, 'videos')}">${words.home.viewAll} →</a>`)}
        <div id="home-videos"></div>
      </div></section>
      <section class="section"><div class="shell reveal">
        <h2 class="heading">${words.home.projectTitle}</h2><p class="lead">${words.home.projectBody}</p>
        <a class="btn" data-route-link href="${routeLink(match.language, 'project')}">${words.home.projectCta}</a>
      </div></section>`;
    renderMusicCatalog({
      container: app.querySelector('#home-music'),
      releases: config.music.releases,
      images,
      dictionary: words,
      limit: 3
    });
    afterFirstPaint(() => {
      const cleanup = renderVideoLibrary({
        container: app.querySelector('#home-videos'),
        endpoint: config.endpoints.youtube,
        dictionary: words,
        modalRoot,
        embedUrl: config.externalBases.youtubeEmbed,
        compact: true
      });
      activeCleanup.push(cleanup);
    });
  }

  function renderProject(words) {
    const project = words.proyecto;
    const narrative = [project.desc_p1, project.desc_p2, project.desc_ai];
    app.innerHTML = `<section class="page project-page"><div class="shell">
      <header class="project-hero rv">
        <p class="eyebrow">${project.eyebrow}</p>
        <h1 class="heading-primary">${project.title}</h1>
        <blockquote class="project-quote">${project.quote}</blockquote>
      </header>

      <div class="project-narrative">
        ${narrative.map((paragraph, index) => `
          <article class="project-story ${index % 2 ? 'project-story--reverse' : ''}">
            <div class="project-copy rv"><p>${paragraph}</p></div>
            <figure class="project-reel rv">
              <div class="instagram-frame">
                <blockquote class="instagram-media" data-instgrm-permalink="${images.instagram.reels[index]}" data-instgrm-version="14"></blockquote>
              </div>
              <figcaption>${project.reelLabels[index]}</figcaption>
            </figure>
          </article>`).join('')}
      </div>

      <section class="project-differentiators">
        <h2 class="heading-primary rv">${project.differentiatorsTitle}</h2>
        <div class="project-diff-grid">
          ${project.differentiators.map(item => `<article class="project-diff-card rv"><span>${item.number}</span><h3>${item.title}</h3><p>${item.body}</p></article>`).join('')}
        </div>
      </section>

      <section class="project-growth">
        <h2 class="heading-primary rv">${project.growthTitle}</h2>
        <div class="project-table-wrap rv">
          <table class="project-table">
            <thead><tr><th>${project.table.platform}</th><th>${project.table.current}</th><th>${project.table.projection}</th></tr></thead>
            <tbody>${config.projectMetrics.map(metric => `<tr><th scope="row">${metric.platform}</th><td>${project.metrics[metric.id].current}</td><td>${project.metrics[metric.id].projection}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="project-warnings rv">${project.warnings.map(item => `<p>${item}</p>`).join('')}</div>
      </section>
    </div></section>`;
    afterFirstPaint(() => mountInstagramEmbeds(images.instagram.embedScript));
  }

  function renderMusic(words) {
    app.innerHTML = `<section class="page"><div class="shell">
      ${sectionHead(words.music.eyebrow, words.music.title, words.music.body)}
      <div id="music-catalog"></div>
    </div></section>`;
    renderMusicCatalog({ container: app.querySelector('#music-catalog'), releases: config.music.releases, images, dictionary: words });
  }

  function renderAbout(words) {
    renderSobreJoe({ container: app, dictionary: words, assets: images });
  }

  function renderVideos(words) {
    app.innerHTML = `<section class="page"><div class="shell">
      ${sectionHead(words.videos.eyebrow, words.videos.title, words.videos.body)}
      <div id="video-library"></div>
    </div></section>`;
    afterFirstPaint(() => {
      const cleanup = renderVideoLibrary({
        container: app.querySelector('#video-library'),
        endpoint: config.endpoints.youtube,
        dictionary: words,
        modalRoot,
        embedUrl: config.externalBases.youtubeEmbed
      });
      activeCleanup.push(cleanup);
    });
  }

  function renderServices(words, match) {
    app.innerHTML = `<section class="page"><div class="shell">
      ${sectionHead(words.services.eyebrow, words.services.title, words.services.body)}
      <div class="grid service-grid">${words.services.items.map((item, index) => `<article class="card service-card reveal"><span class="eyebrow">0${index + 1}</span><h2>${item.title}</h2><p>${item.body}</p><a class="btn" data-route-link href="${routeLink(match.language, 'calculator')}?service=${item.id}">${words.services.cta}</a></article>`).join('')}</div>
    </div></section>`;
  }

  function renderCalculator(words) {
    app.innerHTML = `<section class="page"><div class="shell quoter">
      ${sectionHead(words.quoter.eyebrow, words.quoter.title, words.quoter.body)}
      <div id="quoter"></div>
    </div></section>`;
    mountQuoter({
      container: app.querySelector('#quoter'),
      config: {
        ...config.quoter,
        whatsapp: config.contact.whatsapp,
        whatsappBase: config.externalBases.whatsapp,
        paypalUrl: config.payments.paypal,
        paypalSdkUrl: config.payments.paypalSdk
      },
      dictionary: words.quoter,
      preselectedService: new URLSearchParams(location.search).get('service')
    });
  }

  function renderContact(words) {
    app.innerHTML = `<section class="page"><div class="shell">
      <p class="eyebrow">${words.contact.eyebrow}</p><h1 class="display">${words.contact.title}</h1><p class="lead">${words.contact.body}</p>
      <div class="contact-actions">
        <a class="btn btn--primary" href="${config.externalBases.whatsapp}${config.contact.whatsapp}" target="_blank" rel="noopener noreferrer">${words.contact.whatsapp}</a>
        <a class="btn" href="mailto:${config.contact.email}">${words.contact.email}</a>
      </div>
    </div></section>`;
  }

  function renderNotFound(words, match) {
    app.innerHTML = `<section class="page"><div class="shell">
      <p class="eyebrow">${words.notFound.eyebrow}</p><div class="not-found-code">404</div>
      <h1 class="heading">${words.notFound.title}</h1><p class="lead">${words.notFound.body}</p>
      <a class="btn btn--primary" data-route-link href="${routeLink(match.language, 'home')}">${words.notFound.home}</a>
      <h2 class="eyebrow" style="margin-top:54px">${words.notFound.listen}</h2>
      <div class="stream-grid">${config.links.social.map(item => `<a href="${item.url}" target="_blank" rel="noopener noreferrer"><span>${item.label}</span><span>↗</span></a>`).join('')}</div>
    </div></section>`;
  }

  injectStructuredData();
  router = createRouter({
    config,
    getDictionary,
    onRoute: async match => {
      cleanupPage();
      currentLanguage = match.language;
      const words = getDictionary(currentLanguage);
      renderChrome(match, words);
      const renderers = {
        home: renderHome,
        project: renderProject,
        about: renderAbout,
        music: renderMusic,
        videos: renderVideos,
        services: renderServices,
        calculator: renderCalculator,
        contact: renderContact
      };
      (match.valid ? renderers[match.route] : renderNotFound)(words, match);
      activeCleanup.push(mountScrollReveal(app));
      app.focus({ preventScroll: true });
      scrollTo({ top: 0, behavior: 'auto' });
    }
  });
  await router.start();
}

bootstrap().catch(error => {
  console.error(error);
  document.body.dataset.bootstrapError = 'true';
});
