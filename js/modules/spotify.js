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
    try {
      const res = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Spotify Auth Error: token request failed', res.status, text);
        return null;
      }
      const data = await res.json();
      console.debug('Spotify Auth: token acquired, expires_in=', data.expires_in);
      return data;
    } catch (error) {
      console.error('Spotify Auth Error:', error);
      return null;
    }
}

async function fetchPlaylistTracks(playlistId, token) {
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=US&fields=items(track(id,uri,name,artists(name)))&limit=100`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn('Spotify API: playlist tracks fetch failed', playlistId, res.status, txt);
      return [];
    }
    const data = await res.json();
    const items = data.items || [];
    console.debug('Spotify API: playlist', playlistId, 'returned items:', items.length);
    return (items).map(i => i.track).filter(Boolean);
  } catch (e) {
    console.error('Spotify API playlist fetch error:', e);
    return [];
  }
}

async function fetchArtistTopTracks(artistId, token) {
  // Restrict to the official artist ID and market PA as requested
  const targetArtist = artistId || '0WolrewBAIYhWwzN5Z5Csg';
  const url = `https://api.spotify.com/v1/artists/${targetArtist}/top-tracks?market=PA`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn('Spotify API: artist top tracks fetch failed', artistId, res.status, txt);
      return [];
    }
    const data = await res.json();
    const items = data.tracks || [];
    console.debug('Spotify API: artist', artistId, 'returned tracks:', items.length);
    return (items).map(t => ({ id: t.id, uri: t.uri, name: t.name, artists: t.artists.map(a => a.name) }));
  } catch (e) {
    console.error('Spotify API artist fetch error:', e);
    return [];
  }
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
  // Ignore external playlists: always query the artist's top-tracks for JoeOnTheSound
  const ARTIST_ID = '0WolrewBAIYhWwzN5Z5Csg';
  console.debug('Resolving track pool for artist', ARTIST_ID);
  const tracks = await fetchArtistTopTracks(ARTIST_ID, token);
  // Normalize (should already be normalized) and shuffle
  const normalized = tracks.map(t => ({ id: t.id, uri: t.uri || `spotify:track:${t.id}`, name: t.name, artists: t.artists || [] }));
  const shuffled = fisherYates(normalized);
  // pick up to 5 unique tracks
  const seen = new Set();
  const unique = [];
  for (const t of shuffled) {
    if (!t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    unique.push(t);
    if (unique.length >= 5) break;
  }
  console.debug('Resolved track pool size (artist top-tracks):', unique.length);
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
      // 1. Get token (client credentials)
      tokenInfo = await fetchSpotifyToken(config.clientId, config.clientSecret);
      if (!tokenInfo || !tokenInfo.access_token) {
        console.warn('Spotify token not obtained; proceeding to fallback');
      }
      const token = tokenInfo && tokenInfo.access_token ? tokenInfo.access_token : null;

      // 2. Resolve track pool if token present
      const seeds = config.seeds || [];
      let pool = [];
      if (token) {
        pool = await resolveTrackPoolFromSeeds(seeds, token);
      }
      if (canceled) return;

      // Fallback URI if pool empty or token missing
      const fallbackUri = config.fallbackUri || 'spotify:artist:0WolrewBAIYhWwzN5Z5Csg';
      if (!pool || !pool.length) {
        console.warn('No tracks available from Spotify API; using fallback', fallbackUri);
      }

      // ensure iframe api loaded
      const IFrameAPI = await ensureSpotifyIframe();
      if (canceled) return;

      // Create controller with first track (pool[0] or fallback)
      const uris = (pool && pool.length) ? pool.map(t => t.uri) : [fallbackUri];
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
