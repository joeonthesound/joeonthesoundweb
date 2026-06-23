let videoCache = null;

async function fetchVideos(endpoint, signal) {
  if (videoCache) return videoCache;

  const apiToken = window.ENV?.APIVIDEO;

  if (
    !apiToken || 
    apiToken === 'APIVIDEO_PLACEHOLDER' || 
    apiToken === 'undefined' || 
    apiToken === 'null' || 
    apiToken.trim() === ''
  ) {
    console.error("❌ [YouTube Module] Deployment Initialization Error: 'APIVIDEO' token is undefined, null, or remains as a placeholder in window.ENV context. Fetch aborted to prevent API Bad Request.");
    return [];
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId: endpoint.channelId,
      key: apiToken,
      maxResults: String(endpoint.maxResults),
      order: 'date',
      type: 'video',
      videoDuration: 'medium' // 🔥 Filtra nativamente videos de entre 4 y 20 minutos
    });

    console.log('📡 [YouTube Module] Attempting network data fetch from Google API. Medium duration filter applied.');
    const response = await fetch(`${endpoint.url}?${params}`, { signal });

    if (!response.ok) {
      console.error(`🚨 [YouTube Module] API Connection dropped! HTTP Error Code: ${response.status}. Verify domain restrictions inside Google Cloud Console for 'joeonthesound.online' with key 'APIVIDEO'.`);
      throw new Error(`YouTube ${response.status}`);
    }

    const payload = await response.json();
    videoCache = (payload.items || []).filter(item => item.id?.videoId);
    return videoCache;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('[YouTube Module] Network request failed:', error);
    }
    throw error;
  }
}

function mediaText(template, title) {
  return template.replaceAll('{title}', title);
}

function openLightbox({ videoId, dictionary, modalRoot, embedUrl }) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="modal-panel">
      <button class="btn modal-close" type="button">${dictionary.videos.close}</button>
      <iframe class="modal-frame" src="${embedUrl}${videoId}?autoplay=1" title="${dictionary.videos.open}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
    </div>`;
  const close = () => {
    modal.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = event => { if (event.key === 'Escape') close(); };
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  document.keydownEventListener = onKey;
  document.addEventListener('keydown', onKey);
  modalRoot.replaceChildren(modal);
  modal.querySelector('.modal-close').focus();
}

export function renderVideoLibrary({ container, endpoint, dictionary, modalRoot, embedUrl, compact = false }) {
  const controller = new AbortController();
  container.innerHTML = `<div class="status">${dictionary.videos.loading}</div>`;

  const draw = (videos, query = '') => {
    try {
      const normalized = query.trim().toLocaleLowerCase();
      const filtered = videos.filter(item => item.snippet.title.toLocaleLowerCase().includes(normalized));
      const visible = compact ? filtered.slice(0, 3) : filtered;
      container.innerHTML = `
        ${compact ? '' : `<input class="search" type="search" placeholder="${dictionary.videos.search}" aria-label="${dictionary.videos.search}">`}
        <div class="grid video-grid">
          ${visible.map(item => `
            <article class="card video-card">
              <button type="button" data-video-id="${item.id.videoId}" aria-label="${dictionary.videos.open}: ${item.snippet.title}">
                <div class="video-thumb">
                  <img src="${item.snippet.thumbnails.medium.url}" alt="${mediaText(dictionary.media.videoAlt, item.snippet.title)}" loading="lazy" decoding="async">
                  <span class="play" aria-hidden="true">▶</span>
                </div>
                <div class="video-title">${item.snippet.title}</div>
              </button>
            </article>`).join('')}
        </div>
        ${visible.length ? '' : `<div class="status">${dictionary.videos.empty}</div>`}`;
      container.querySelectorAll('[data-video-id]').forEach(button => {
        button.addEventListener('click', () => openLightbox({ videoId: button.dataset.videoId, dictionary, modalRoot, embedUrl }));
      });
      container.querySelector('.search')?.addEventListener('input', event => draw(videos, event.target.value));
    } catch (error) {
      console.warn('⚠️ [YouTube Module] Payload received successfully, but DOM template injection crashed. Checking element nodes...', error);
      throw error;
    }
  };

  fetchVideos(endpoint, controller.signal)
    .then(videos => {
      if (container.isConnected) draw(videos);
    })
    .catch(error => {
      if (error.name === 'AbortError' || !container.isConnected) return;
      container.innerHTML = `<div class="status">${dictionary.videos.error}<br><button class="btn retry-video" type="button">${dictionary.videos.retry}</button></div>`;
      container.querySelector('.retry-video')?.addEventListener('click', () => renderVideoLibrary({ container, endpoint, dictionary, modalRoot, embedUrl, compact }));
    });

  return () => controller.abort();
}