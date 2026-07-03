// Spotify pool loader + iframe controller integration (Vanilla JS)
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_IFRAME_SRC = 'https://open.spotify.com/embed/iframe-api/v1';

function base64Encode(str) {
  if (typeof btoa !== 'undefined') return btoa(str);
  return Buffer.from(str).toString('base64');
}

export async function fetchSpotifyToken(clientId, clientSecret) {
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const auth = `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`;
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  return res.json();
}

async function fetchPlaylistTracks(playlistId, token) {
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=US&fields=items(track(id,uri,name,artists(name)))&limit=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map(i => i.track).filter(Boolean);
}

async function fetchArtistTopTracks(artistId, token) {
  const url = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.tracks || []).map(t => ({ id: t.id, uri: t.uri, name: t.name, artists: t.artists.map(a => a.name) }));
}

function fisherYates(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ensureSpotifyIframe() {
  return new Promise(resolve => {
    if (window.onSpotifyIframeApiReady && window.Spotify) return resolve(window.Spotify);
    const existing = document.querySelector(`script[src="${SPOTIFY_IFRAME_SRC}"]`);
    if (!existing) {
      const s = document.createElement('script');
      s.src = SPOTIFY_IFRAME_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = function(IFrameAPI) {
      if (typeof prev === 'function') try { prev(IFrameAPI); } catch (e) {}
      resolve(IFrameAPI);
    };
  });
}

export async function resolveTrackPoolFromSeeds(seeds, token) {
  const tracks = [];
  for (const seed of seeds) {
    try {
      if (seed.startsWith('artist:')) {
        const artistId = seed.split(':')[1];
        const t = await fetchArtistTopTracks(artistId, token);
        tracks.push(...t);
      } else {
        const playlistId = seed.replace(/^playlist:/, '');
        const t = await fetchPlaylistTracks(playlistId, token);
        tracks.push(...t);
      }
    } catch (e) {
      console.debug('seed fetch failed', seed, e);
    }
  }
  // Normalize to objects with uri and id
  const normalized = tracks.map(t => ({ id: t.id, uri: t.uri || `spotify:track:${t.id}`, name: t.name, artists: t.artists || [] }));
  const shuffled = fisherYates(normalized);
  // ensure uniqueness
  const seen = new Set();
  const unique = [];
  for (const t of shuffled) {
    if (!t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    unique.push(t);
    if (unique.length >= 5) break;
  }
  return unique;
}

export function mountSpotifyPool(containerId, config) {
  let controller = null;
  let listeners = [];
  let tokenInfo = null;
  let canceled = false;
  const container = document.getElementById(containerId);
  if (!container) return () => {};
  container.innerHTML = `<div class="spotify-loading">Cargando...</div>`;

  const playBtn = document.getElementById('spotify-play');
  const pauseBtn = document.getElementById('spotify-pause');

  (async function init() {
    try {
      // 1. Get token
      tokenInfo = await fetchSpotifyToken(config.clientId, config.clientSecret);
      const token = tokenInfo.access_token;
      if (!token) throw new Error('no token');
      // 2. Resolve track pool
      const seeds = config.seeds || [];
      const pool = await resolveTrackPoolFromSeeds(seeds, token);
      if (canceled) return;
      if (!pool.length) {
        container.innerHTML = '<div class="spotify-loading">No tracks disponibles</div>';
        return;
      }
      // ensure iframe api loaded
      const IFrameAPI = await ensureSpotifyIframe();
      if (canceled) return;
      // Create controller with first track
      const uris = pool.map(t => t.uri);
      container.innerHTML = '';
      IFrameAPI.createController(container, { width: '100%', height: String(config.embedHeight || 352), uri: uris[0] }, (ctrl) => {
        controller = ctrl;
        let playing = false;
        let index = 0;
        try { ctrl.addListener && ctrl.addListener('playback_update', payload => {
          // auto-advance when close to end
          if (!payload || !payload.duration || !payload.position) return;
          const remain = payload.duration - payload.position;
          if (remain < 800 && playing) {
            // next
            if (index < uris.length - 1) {
              index += 1;
              try { ctrl.play && ctrl.play({ uri: uris[index] }); } catch (e) { console.debug('play next failed', e); }
            }
          }
        }); } catch (e) {}
        try { ctrl.addListener && ctrl.addListener('playback_started', () => { playing = true; }); } catch (e) {}
        try { ctrl.addListener && ctrl.addListener('ready', () => { const l = container.querySelector('.spotify-loading'); if (l) l.style.display = 'none'; }); } catch (e) {}

        if (playBtn) {
          const ph = () => { try { controller?.play && controller.play(); } catch (e) {} };
          playBtn.addEventListener('click', ph);
          listeners.push(() => playBtn.removeEventListener('click', ph));
        }
        if (pauseBtn) {
          const pah = () => { try { controller?.pause && controller.pause(); } catch (e) {} };
          pauseBtn.addEventListener('click', pah);
          listeners.push(() => pauseBtn.removeEventListener('click', pah));
        }
      });
    } catch (e) {
      console.error('spotify pool init failed', e);
      container.innerHTML = '<div class="spotify-loading">Error al cargar</div>';
    }
  })();

  return () => {
    canceled = true;
    listeners.forEach(fn => fn());
    if (controller) {
      try { controller.disconnect && controller.disconnect(); } catch (e) {}
      try { controller.destroy && controller.destroy(); } catch (e) {}
      controller = null;
    }
    if (container) container.innerHTML = '';
  };
}
