function escapeTemplate(value, title) {
  return value.replaceAll('{title}', title);
}

export function renderMusicCatalog({ container, releases, images, dictionary, limit = Infinity }) {
  let activeFilter = 'all';
  const filters = ['all', 'single', 'ep', 'album'];

  const draw = () => {
    const visible = (activeFilter === 'all' ? releases : releases.filter(item => item.type === activeFilter)).slice(0, limit);
    container.innerHTML = `
      ${limit === Infinity ? `<div class="filters" role="group">${filters.map(filter => `<button class="filter ${filter === activeFilter ? 'is-active' : ''}" data-filter="${filter}">${dictionary.music.filters[filter]}</button>`).join('')}</div>` : ''}
      <div class="grid release-grid">
        ${visible.map(release => `
          <a class="card release-card" href="${release.url}" target="_blank" rel="noopener noreferrer">
            <div class="release-cover"><img src="${images.covers[release.id] || images.fallbacks.cover}" alt="${escapeTemplate(dictionary.media.coverAlt, release.title)}" loading="lazy" decoding="async"></div>
            <div class="release-body">
              <h3>${release.title}</h3>
              <div class="release-meta"><span>${release.type.toUpperCase()} · ${release.year}</span><span>${release.tracks} ${dictionary.music.tracks}</span></div>
            </div>
          </a>`).join('')}
      </div>`;
    container.querySelectorAll('[data-filter]').forEach(button => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.filter;
        draw();
      });
    });
  };
  draw();
}
