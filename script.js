const API = 'https://movieswatch.samtesting67.workers.dev';

// ── State ──────────────────────────────────────────────────────────────────
let currentSection = 'home';
let heroItems = [];
let heroIdx = 0;
let heroTimer = null;
let currentItem = null;
let currentSource = 'videasy';
let currentSeason = 1;
let currentEpisode = 1;
let searchTimer = null;
let allItems = {}; // id→item cache

// ── Categories ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'action', title: '🔥 Action & Adventure', queries: ['mission impossible', 'john wick', 'fast furious', 'mad max'] },
  { id: 'scifi', title: '🚀 Sci-Fi & Fantasy', queries: ['inception', 'dune', 'interstellar', 'avatar', 'matrix'] },
  { id: 'tvseries', title: '📺 Top TV Series', queries: ['breaking bad', 'stranger things', 'game of thrones', 'the bear', 'succession'] },
  { id: 'thriller', title: '🎭 Drama & Thriller', queries: ['parasite', 'oppenheimer', 'gone girl', 'zodiac', 'prestige'] },
  { id: 'marvel', title: '⚡ Marvel & DC', queries: ['avengers endgame', 'batman dark knight', 'spider-man', 'guardians of the galaxy'] },
  { id: 'comedy', title: '😂 Comedy & Feel-Good', queries: ['ted lasso', 'the office', 'bridesmaids', 'superbad', 'knives out'] },
  { id: 'horror', title: '👻 Horror & Suspense', queries: ['hereditary', 'midsommar', 'get out', 'quiet place', 'us 2019'] },
  { id: 'classics', title: '🏆 All-Time Classics', queries: ['godfather', 'pulp fiction', 'schindler list', 'shawshank', 'casablanca'] },
];

const ANIME_CATEGORIES = [
  { id: 'anime-trending', title: '🔥 Trending Anime', anilist: { sort: ['TRENDING_DESC'] } },
  { id: 'anime-top', title: '⭐ Top Rated Anime', anilist: { sort: ['SCORE_DESC'] } },
  { id: 'anime-movies', title: '🎬 Popular Anime Movies', anilist: { format_in: ['MOVIE', 'MOVIE_OVA'], sort: ['POPULARITY_DESC'] } },
  { id: 'anime-ongoing', title: '📺 Ongoing Series', anilist: { status: 'RELEASING', sort: ['POPULARITY_DESC'] } },
  { id: 'anime-romance', title: '❤️ Romance Anime', anilist: { genres: ['Romance'], sort: ['POPULARITY_DESC'] } },
  { id: 'anime-action', title: '⚔️ Action Anime', anilist: { genres: ['Action'], sort: ['POPULARITY_DESC'] } },
  { id: 'anime-dark', title: '👻 Dark / Psychological Anime', anilist: { genres: ['Psychological'], sort: ['POPULARITY_DESC'] } }
];

// ── Helpers ─────────────────────────────────────────────────────────────────
async function anilistFetch(variables) {
  const query = `
    query ($sort: [MediaSort], $genres: [String], $format: MediaFormat, $format_in: [MediaFormat], $status: MediaStatus) {
      Page (page: 1, perPage: 12) {
        media (type: ANIME, sort: $sort, genre_in: $genres, format: $format, format_in: $format_in, status: $status) {
          id title { english romaji } coverImage { large extraLarge } bannerImage description seasonYear averageScore genres format
        }
      }
    }
  `;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const json = await res.json();
    return json.data.Page.media.map(m => ({
      id: m.id, type: 'anime', isMovie: m.format === 'MOVIE' || m.format === 'MOVIE_OVA',
      title: m.title.english || m.title.romaji,
      poster: m.coverImage.extraLarge || m.coverImage.large,
      backdrop: m.bannerImage || m.coverImage.extraLarge || m.coverImage.large,
      desc: m.description ? m.description.replace(/<[^>]*>?/gm, '') : '',
      year: m.seasonYear, rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      genres: (m.genres || []).slice(0, 3)
    }));
  } catch (e) { return []; }
}

async function apiFetch(path) {
  try {
    const r = await fetch(API + path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    return null;
  }
}

function cacheItem(item) {
  if (item && item.id) allItems[`${item.type}-${item.id}`] = item;
}

function getCached(type, id) {
  return allItems[`${type}-${id}`] || null;
}

function showToast(msg, dur = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

function setLoaderProgress(p) {
  document.getElementById('loader-fill').style.width = p + '%';
}

// ── Image helpers ───────────────────────────────────────────────────────────
function cardImgHTML(item) {
  const src = item.backdrop || item.poster;
  if (src) {
    return `<img src="${src}" alt="${escHtml(item.title)}" loading="lazy" onerror="this.parentNode.innerHTML=noImgHTML('${escHtml(item.title)}')" >`;
  }
  return noImgHTML(item.title);
}
function noImgHTML(title) {
  return `<div class="card-no-img">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
    <span>${escHtml(title || '')}</span>
  </div>`;
}
function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Hero ────────────────────────────────────────────────────────────────────
function renderHero(idx) {
  const item = heroItems[idx];
  if (!item) return;
  heroIdx = idx;

  const bg = document.getElementById('hero-bg');
  const content = document.getElementById('hero-content');

  // Background — use wide backdrop image for crisp quality, fall back to poster
  const bgImg = item.backdrop || item.poster;
  if (bgImg) {
    bg.style.backgroundImage = `url(${bgImg})`;
    bg.style.filter = 'blur(0)';
  }

  // Genres
  const genresHTML = (item.genres || []).map(g => `<span class="hero-genre">${escHtml(g)}</span>`).join('');

  content.innerHTML = `
    <div class="hero-badge">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5"/></svg>
      ${item.type === 'tv' ? 'TV Series' : 'Movie'}
    </div>
    <h1 class="hero-title">${escHtml(item.title)}</h1>
    <div class="hero-meta">
      ${item.rating ? `<div class="hero-rating">
        <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        ${item.rating}
      </div>` : ''}
      ${item.year ? `<span class="hero-year">${item.year}</span>` : ''}
      <span class="hero-type">${item.type === 'tv' ? 'Series' : 'Film'}</span>
    </div>
    ${genresHTML ? `<div class="hero-genres">${genresHTML}</div>` : ''}
    ${item.desc ? `<p class="hero-desc">${escHtml(item.desc)}</p>` : ''}
    <div class="hero-btns">
      <button class="btn-play" onclick="playItem(${item.id},'${item.type}')">
        <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
        Play Now
      </button>
      <button class="btn-info" onclick="openModal(${item.id},'${item.type}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        More Info
      </button>
    </div>
  `;

  // Dots
  const dots = document.getElementById('hero-dots');
  dots.innerHTML = heroItems.map((_, i) =>
    `<div class="hero-dot ${i === idx ? 'active' : ''}" onclick="renderHero(${i})"></div>`
  ).join('');
}

function startHeroRotation() {
  if (heroTimer) clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    renderHero((heroIdx + 1) % heroItems.length);
  }, 8000);
}

// ── Card HTML ──────────────────────────────────────────────────────────────
function createCard(item) {
  cacheItem(item);
  return `
    <div class="card" onclick="openModal(${item.id},'${item.type}')">
      <div class="card-img-wrap">
        ${cardImgHTML(item)}
        <div class="card-overlay">
          <div class="card-play-btn">
            <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
          </div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${escHtml(item.title)}</div>
        <div class="card-sub">
          ${item.rating ? `<span class="card-rating">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#f5c518"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            ${item.rating}
          </span>` : ''}
          ${item.year ? `<span>${item.year}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function skeletonCards(n = 8) {
  return Array(n).fill(0).map(() => `
    <div class="card-skeleton">
      <div class="skeleton img"></div>
      <div class="skeleton title"></div>
      <div class="skeleton sub"></div>
    </div>
  `).join('');
}

// ── Category Row ──────────────────────────────────────────────────────────
function createRowEl(cat) {
  const div = document.createElement('div');
  div.className = 'row';
  div.id = `row-${cat.id}`;
  div.innerHTML = `
    <div class="row-header">
      <h2 class="row-title">${cat.title}</h2>
    </div>
    <div class="row-scroller" id="scroller-${cat.id}">${skeletonCards()}</div>
  `;
  return div;
}

async function loadCategory(cat) {
  const scroller = document.getElementById(`scroller-${cat.id}`);
  if (!scroller) return;

  const items = [];
  const seen = new Set();

  if (cat.anilist) {
    const data = await anilistFetch(cat.anilist);
    if (data && Array.isArray(data)) {
      for (const item of data) {
        const key = `${item.type}-${item.id}`;
        if (!seen.has(key) && item.title && item.poster) {
          seen.add(key);
          items.push(item);
          cacheItem(item);
        }
      }
    }
  } else if (cat.path) {
    const data = await apiFetch(cat.path);
    if (data && Array.isArray(data)) {
      for (const item of data) {
        const key = `${item.type}-${item.id}`;
        if (!seen.has(key) && item.title && item.poster) {
          seen.add(key);
          items.push(item);
          cacheItem(item);
        }
      }
    }
  } else if (cat.queries) {
    for (const q of cat.queries) {
      const data = await apiFetch(`/find?q=${encodeURIComponent(q)}`);
      if (!data || !Array.isArray(data)) continue;
      for (const item of data) {
        const key = `${item.type}-${item.id}`;
        if (!seen.has(key) && item.title && item.poster) {
          seen.add(key);
          items.push(item);
          cacheItem(item);
        }
      }
      if (items.length >= 12) break;
    }
  }

  if (items.length === 0) {
    scroller.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:20px 0">No results</div>';
    return;
  }

  scroller.innerHTML = items.map(createCard).join('');
}

// ── NAVIGATION & INIT ─────────────────────────────────────────────────────
async function showSection(section) {
  const content = document.getElementById('content');
  if (currentSection === section && content.innerHTML !== '') return;
  currentSection = section;

  // Update nav UI
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(a => a.classList.remove('active'));
  if (section === 'home') navLinks[0].classList.add('active');
  else if (section === 'anime') navLinks[3].classList.add('active');

  content.innerHTML = '';

  if (heroTimer) clearInterval(heroTimer);
  heroItems = [];
  heroIdx = 0;
  document.getElementById('hero-bg').style.backgroundImage = 'none';
  document.getElementById('hero-content').innerHTML = '';
  document.getElementById('hero-dots').innerHTML = '';

  const cats = section === 'anime' ? ANIME_CATEGORIES : CATEGORIES;
  cats.forEach(cat => content.appendChild(createRowEl(cat)));

  if (section === 'home') {
    const data = await apiFetch('/trending?window=week');
    if (data && Array.isArray(data)) {
      const seen = new Set();
      for (const item of data) {
        const key = `${item.type}-${item.id}`;
        if (!seen.has(key) && item.poster && item.title) {
          seen.add(key);
          heroItems.push(item);
          cacheItem(item);
        }
        if (heroItems.length >= 5) break;
      }
    }
  } else if (section === 'anime') {
    const data = await anilistFetch(ANIME_CATEGORIES[0].anilist);
    if (data && Array.isArray(data)) {
      heroItems = data.slice(0, 5);
      heroItems.forEach(cacheItem);
    }
  }

  if (heroItems.length > 0) {
    renderHero(0);
    if (heroItems.length > 1) startHeroRotation();
  }

  const batch1 = cats.slice(0, 4);
  const batch2 = cats.slice(4);

  // Load categories in background so we don't block the UI
  Promise.all(batch1.map(cat => loadCategory(cat))).then(() => {
    Promise.all(batch2.map(cat => loadCategory(cat)));
  });
}

async function init() {
  setLoaderProgress(10);

  await showSection('home');

  setLoaderProgress(80);

  const ls = document.getElementById('loading-screen');
  ls.classList.add('hidden');
  setTimeout(() => ls.style.display = 'none', 600);

  setLoaderProgress(100);
}

// ── MODAL ─────────────────────────────────────────────────────────────────
async function openModal(id, type) {
  pushOverlayState();
  const overlay = document.getElementById('modal-overlay');
  const inner = document.getElementById('modal-inner');

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Show loading state
  inner.innerHTML = `
    <div class="modal-hero" style="background:var(--bg3);display:flex;align-items:center;justify-content:center">
      <div style="color:var(--text-dim);font-size:13px">Loading…</div>
    </div>
    <div class="modal-body" style="padding-top:20px">
      <div class="skeleton" style="height:14px;width:60px;border-radius:4px;margin-bottom:12px"></div>
      <div class="skeleton" style="height:32px;width:80%;border-radius:4px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:60px;border-radius:4px"></div>
    </div>
  `;

  // Try cache first
  let item = getCached(type, id);

  // If not cached, fetch (anime items should always be cached from list)
  if (!item && type !== 'anime') {
    item = await apiFetch(`/meta?type=${type}&id=${id}`);
    if (item) cacheItem(item);
  }

  if (!item) {
    inner.innerHTML = `<div class="modal-body" style="padding:40px;text-align:center;color:var(--text-dim)">Failed to load details.</div>`;
    return;
  }

  currentItem = item;
  currentSeason = 1;
  currentEpisode = 1;

  // TV/Anime episode selector
  const isShow = item.type === 'tv' || (item.type === 'anime' && !item.isMovie);
  const tvHTML = isShow ? `
    <div class="ep-selector">
      <div class="ep-selector-title">Choose Episode</div>
      <div class="ep-row">
        <span class="ep-label">Season</span>
        <select class="ep-select" id="modal-season" onchange="updateEpisode()">
          ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">Season ${i + 1}</option>`).join('')}
        </select>
      </div>
      <div class="ep-row">
        <span class="ep-label">Episode</span>
        <select class="ep-select" id="modal-episode" onchange="updateEpisode()">
          ${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">Episode ${i + 1}</option>`).join('')}
        </select>
      </div>
    </div>
  ` : '';

  const genresHTML = (item.genres || []).map(g => `<span class="modal-genre">${escHtml(g)}</span>`).join('');

  inner.innerHTML = `
    <div class="modal-hero">
      ${item.poster
      ? `<img src="${item.poster}" alt="${escHtml(item.title)}" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="width:100%;height:100%;background:var(--bg3);display:flex;align-items:center;justify-content:center;color:var(--text-dim)">No Image</div>`
    }
    </div>
    <div class="modal-body">
      <div class="modal-meta">
        <span class="modal-type-badge">${item.type === 'tv' ? 'TV Series' : 'Movie'}</span>
        ${item.year ? `<span class="modal-year">${item.year}</span>` : ''}
        ${item.rating ? `<div class="modal-rating-wrap">
          <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          ${item.rating}
        </div>` : ''}
      </div>
      <div class="modal-title">${escHtml(item.title)}</div>
      ${genresHTML ? `<div class="modal-genres">${genresHTML}</div>` : ''}
      ${item.desc ? `<p class="modal-desc">${escHtml(item.desc)}</p>` : ''}
      ${tvHTML}
      <div class="modal-actions">
        <button class="modal-play" id="modal-play-btn" onclick="playFromModal()">
          <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
          Play Now
        </button>
      </div>
      <div id="modal-recs-section"></div>
    </div>
  `;

  // Load recommendations async
  loadModalRecs(item);
  // Auto-focus Play button on TV
  if (currentCastMode === 'tv') setTimeout(tvSyncFocus, 100);
}

async function loadModalRecs(item) {
  const section = document.getElementById('modal-recs-section');
  if (!section) return;

  section.innerHTML = `<div class="modal-recs-title">More Like This</div>
    <div class="modal-recs">${Array(6).fill(0).map(() => `
      <div class="skeleton" style="aspect-ratio:2/3;border-radius:6px"></div>
    `).join('')}</div>`;

  const recs = await apiFetch(`/recommend?type=${item.type}&id=${item.id}`);

  if (!recs || !recs.length) {
    section.innerHTML = '';
    return;
  }

  const recsHTML = recs.filter(r => r && r.title).map(r => {
    cacheItem(r);
    const imgContent = r.poster
      ? `<img src="${r.poster}" alt="${escHtml(r.title)}" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="rec-card-no-img">${escHtml(r.title)}</div>`;
    return `
      <div class="rec-card" onclick="closeModal();setTimeout(()=>openModal(${r.id},'${r.type}'),200)">
        ${imgContent}
        <div class="rec-card-info">
          <div class="rec-card-title">${escHtml(r.title)}</div>
          ${r.year ? `<div class="rec-card-year">${r.year}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  section.innerHTML = `<div class="modal-recs-title">More Like This</div><div class="modal-recs">${recsHTML}</div>`;
}

function updateEpisode() {
  currentSeason = parseInt(document.getElementById('modal-season')?.value || 1);
  currentEpisode = parseInt(document.getElementById('modal-episode')?.value || 1);
}

function playFromModal() {
  if (!currentItem) return;
  updateEpisode();
  const id = currentItem.id;
  const type = currentItem.type;
  closeModal();
  setTimeout(() => playItem(id, type), 300);
}

function closeModal(fromPopState = false) {
  if (!fromPopState && history.state && history.state.isOverlay) { history.back(); return; }
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  currentItem = null;
  if (currentCastMode === 'tv') setTimeout(tvSyncFocus, 100); // restore home focus
}

function handleModalOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// ── PLAYER ────────────────────────────────────────────────────────────────

window.addEventListener("message", function (event) {
  try {
    const data = JSON.parse(event.data);
    if (data.progress !== undefined && data.id) {
      const key = `videasy_progress_${data.type}_${data.id}`;
      localStorage.setItem(key, JSON.stringify({
        progress: data.progress,
        timestamp: data.timestamp,
        season: data.season,
        episode: data.episode
      }));
    }
  } catch (e) { }
});

function getPlayerURL(id, type, source, season, episode) {
  let resumeParam = '';
  try {
    const key = `videasy_progress_${type}_${id}`;
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && saved.timestamp > 10) {
      if (type !== 'tv' || (saved.season == season && saved.episode == episode)) {
        resumeParam = `&progress=${Math.floor(saved.timestamp)}`;
      }
    }
  } catch (e) { }

  if (source === 'vidking') {
    if (type === 'tv') return `https://www.vidking.net/embed/tv/${id}/${season}/${episode}`;
    return `https://www.vidking.net/embed/movie/${id}`;
  }
  // videasy default
  // Add cool features: custom accent color, next episode button, overlay, auto-play, and resume functionality
  if (type === 'anime') {
    const isMovie = getCached(type, id)?.isMovie;
    if (isMovie) return `https://player.videasy.net/anime/${id}?color=e8365d&overlay=true${resumeParam}`;
    return `https://player.videasy.net/anime/${id}/${episode}?color=e8365d&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true&overlay=true${resumeParam}`;
  }
  if (type === 'tv') {
    return `https://player.videasy.net/tv/${id}/${season}/${episode}?color=e8365d&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true&overlay=true${resumeParam}`;
  }
  return `https://player.videasy.net/movie/${id}?color=e8365d&overlay=true${resumeParam}`;
}

function playItem(id, type, season, episode) {
  season = season || currentSeason || 1;
  episode = episode || currentEpisode || 1;

  const item = getCached(type, id);
  const title = item ? item.title : 'Playing…';

  document.getElementById('player-title').textContent = title;

  if (type === 'tv' || (type === 'anime' && !item?.isMovie)) {
    document.getElementById('player-ep-info').textContent = `Season ${season}, Episode ${episode}`;
  } else {
    document.getElementById('player-ep-info').textContent = '';
  }

  currentSource = 'videasy';
  document.getElementById('src-videasy').classList.add('active');
  document.getElementById('src-vidking').classList.remove('active');

  const url = getPlayerURL(id, type, 'videasy', season, episode);
  document.getElementById('player-iframe').src = url;

  // TV controls
  const tvCtrl = document.getElementById('player-tv-controls');
  if (type === 'tv' || (type === 'anime' && !item?.isMovie)) {
    tvCtrl.style.display = 'flex';
    tvCtrl.innerHTML = `
      <span class="player-source-label">Episode:</span>
      <select class="ep-select" id="player-season" onchange="playerChangedEp(${id},'${type}')">
        ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${i + 1 === season ? 'selected' : ''}>S${i + 1}</option>`).join('')}
      </select>
      <select class="ep-select" id="player-ep" onchange="playerChangedEp(${id},'${type}')">
        ${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${i + 1 === episode ? 'selected' : ''}>E${i + 1}</option>`).join('')}
      </select>
    `;
  } else {
    tvCtrl.style.display = 'none';
    tvCtrl.innerHTML = '';
  }

  // Restore UI elements in case they were hidden by a TV Cast
  document.getElementById('player-source-bar').style.display = 'flex';
  const topbar = document.querySelector('.player-topbar');
  if (topbar) topbar.style.display = 'flex';

  // Store current state
  window._playState = { id, type, season, episode };

  pushOverlayState();
  document.getElementById('player-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (currentCastMode === 'tv') setTimeout(tvSyncFocus, 150); // auto-focus player controls
}

function playerChangedEp(id, type) {
  const s = parseInt(document.getElementById('player-season')?.value || 1);
  const e = parseInt(document.getElementById('player-ep')?.value || 1);
  document.getElementById('player-ep-info').textContent = `Season ${s}, Episode ${e}`;
  const url = getPlayerURL(id, type, currentSource, s, e);
  document.getElementById('player-iframe').src = url;
  window._playState = { id, type, season: s, episode: e };
}

function switchSource(source) {
  currentSource = source;
  document.getElementById('src-videasy').classList.toggle('active', source === 'videasy');
  document.getElementById('src-vidking').classList.toggle('active', source === 'vidking');

  const state = window._playState;
  if (!state) return;

  const url = getPlayerURL(state.id, state.type, source, state.season, state.episode);
  document.getElementById('player-iframe').src = url;
}

function closePlayer(fromPopState = false) {
  if (!fromPopState && history.state && history.state.isOverlay) { history.back(); return; }
  const overlay = document.getElementById('player-overlay');
  overlay.classList.remove('open');
  overlay.classList.remove('tv-mode');
  
  const exitBtn = document.getElementById('tv-exit-btn');
  if (exitBtn) exitBtn.style.display = 'none';

  document.getElementById('player-iframe').src = '';
  document.body.style.overflow = '';
  window._playState = null;
  if (currentCastMode === 'tv') setTimeout(tvSyncFocus, 100); // restore modal or home focus
}

function exitTVMode() {
  closePlayer();
  
  // Exit full screen browser mode
  try {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  } catch(e) {}
  
  // Clean up firebase room if we were the TV
  if (currentCastMode === 'tv' && currentRoomCode && firebaseDb) {
    firebaseDb.ref(`rooms/${currentRoomCode}`).remove();
  }
  
  currentCastMode = null;
  currentRoomCode = null;
  showToast("Exited TV Mode");
}

// ── SEARCH ────────────────────────────────────────────────────────────────
function openSearch() {
  pushOverlayState();
  document.getElementById('search-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('search-input').focus(), 100);
}

function closeSearch(fromPopState = false) {
  if (!fromPopState && history.state && history.state.isOverlay) { history.back(); return; }
  document.getElementById('search-overlay').classList.remove('open');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  document.body.style.overflow = '';
}

async function doSearch(q) {
  const results = document.getElementById('search-results');
  if (!q.trim()) { results.innerHTML = ''; return; }

  results.innerHTML = skeletonCards(8);

  const data = await apiFetch(`/find?q=${encodeURIComponent(q)}`);

  if (!data || !data.length) {
    results.innerHTML = `<div class="search-empty">No results for "<strong>${escHtml(q)}</strong>"</div>`;
    return;
  }

  const filtered = data.filter(item => item.poster);
  if (!filtered.length) {
    results.innerHTML = `<div class="search-empty">No results for "<strong>${escHtml(q)}</strong>"</div>`;
    return;
  }
  filtered.forEach(cacheItem);
  results.innerHTML = filtered.map(item => `
    <div class="card" onclick="closeSearch();openModal(${item.id},'${item.type}')" style="width:100%">
      <div class="card-img-wrap" style="aspect-ratio:16/9;height:auto">
        ${cardImgHTML(item)}
        <div class="card-overlay">
          <div class="card-play-btn">
            <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
          </div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${escHtml(item.title)}</div>
        <div class="card-sub">
          ${item.rating ? `<span class="card-rating">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#f5c518"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            ${item.rating}
          </span>` : ''}
          ${item.year ? `<span>${item.year}</span>` : ''}
          <span>${item.type === 'tv' ? 'TV' : 'Movie'}</span>
        </div>
      </div>
    </div>
  `).join('');
}

document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(e.target.value), 500);
});

document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSearch();
});

// ── NAVBAR SCROLL ─────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── KEYBOARD ──────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('player-overlay').classList.contains('open')) closePlayer();
    else if (document.getElementById('modal-overlay').classList.contains('open')) closeModal();
    else if (document.getElementById('search-overlay').classList.contains('open')) closeSearch();
  }
});

// ── CAST TO TV (FIREBASE) ─────────────────────────────────────────────────
let firebaseDb = null;
let currentCastMode = null; // 'remote' or 'tv'
let currentRoomCode = null;
let lastCommandId = null;

async function initFirebase() {
  if (firebaseDb) return true;
  if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
    updateCastStatus("Firebase config missing!", true);
    return false;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    firebaseDb = firebase.database();
    return true;
  } catch (e) {
    updateCastStatus("Failed to init Firebase", true);
    return false;
  }
}

function openCastModal() {
  pushOverlayState();
  document.getElementById('cast-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCastModal(fromPopState = false) {
  if (!fromPopState && history.state && history.state.isOverlay) { history.back(); return; }
  document.getElementById('cast-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleCastOverlayClick(e) {
  if (e.target === document.getElementById('cast-overlay')) closeCastModal();
}

function updateCastStatus(msg, isError = false) {
  const el = document.getElementById('cast-status');
  el.textContent = msg;
  el.style.color = isError ? '#ef4444' : '#22c55e';
  el.style.display = 'block';
}

async function connectAsRemote() {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code) { updateCastStatus("Please enter a room code", true); return; }

  updateCastStatus("Connecting to Firebase...");
  const ok = await initFirebase();
  if (!ok) return;

  currentRoomCode = code;
  currentCastMode = 'remote';

  // Write a presence ping
  firebaseDb.ref(`rooms/${code}/presence/remote`).set({ connected: true, at: Date.now() });

  updateCastStatus(`Connected as Remote to room: ${code}`);
  showToast(`Linked to TV (${code})!`);
  
  document.getElementById('virtual-remote-fab').style.display = 'flex';
  
  setTimeout(closeCastModal, 1500);
}

async function connectAsTV() {
  // Attempt Auto-Fullscreen immediately on user click to bypass browser security
  try {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    }
  } catch(e) {
    console.warn("Fullscreen request failed", e);
  }

  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  document.getElementById('room-code-input').value = code;

  updateCastStatus("Connecting to Firebase...");
  const ok = await initFirebase();
  if (!ok) return;

  currentRoomCode = code;
  currentCastMode = 'tv';

  // Listen for commands
  firebaseDb.ref(`rooms/${code}/command`).on('value', (snap) => {
    const cmd = snap.val();
    if (!cmd || !cmd.action) return;
    if (cmd.id === lastCommandId) return;
    lastCommandId = cmd.id;

    if (cmd.action === 'play' && cmd.media) {
      showToast(`Received cast: ${cmd.media.title}`);

      document.getElementById('player-title').textContent = cmd.media.title;
      document.getElementById('player-ep-info').textContent = cmd.media.epInfo || '';

      currentSource = cmd.media.source || 'videasy';
      document.getElementById('src-videasy').classList.toggle('active', currentSource === 'videasy');
      document.getElementById('src-vidking').classList.toggle('active', currentSource === 'vidking');

      let finalUrl = cmd.media.url;
      finalUrl = finalUrl.replace('overlay=true', 'autoplay=true');
      if (!finalUrl.includes('autoplay=')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'autoplay=true';
      }
      document.getElementById('player-iframe').src = finalUrl;

      window._playState = cmd.media.state || null;

      document.getElementById('player-tv-controls').style.display = 'none';
      document.getElementById('player-source-bar').style.display = 'none';
      const topbar = document.querySelector('.player-topbar');
      if (topbar) topbar.style.display = 'none';

      const exitBtn = document.getElementById('tv-exit-btn');
      if (exitBtn) exitBtn.style.display = 'flex';

      const overlay = document.getElementById('player-overlay');
      overlay.classList.add('open');
      overlay.classList.add('tv-mode');
      document.body.style.overflow = 'hidden';
    }

    if (cmd.action === 'remote_key') {
      tvSpatialNavigate(cmd.key);
    }
  });

  // Listen for remote presence to auto-close modal
  firebaseDb.ref(`rooms/${code}/presence/remote`).on('value', (snap) => {
    if (snap.val() && snap.val().connected) {
      showToast("Remote connected! Ready to receive casts.");
      closeCastModal();
    }
  });

  updateCastStatus(`This screen is now TV. Room Code: ${code}`);
  showToast("Waiting for remote to connect...");
}

async function sendCastCommand(media) {
  if (!firebaseDb || !currentRoomCode) return false;

  const cmd = {
    action: "play",
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sentAt: Date.now(),
    media: media
  };

  await firebaseDb.ref(`rooms/${currentRoomCode}/command`).set(cmd);
  showToast("Casted to TV!");
  return true;
}

// ── OVERRIDE PLAY ITEM TO INTERCEPT CASTS ─────────────────────────────────
const originalPlayItem = playItem;
playItem = async function (id, type, season, episode) {
  // If we are connected as a remote, we cast instead of playing locally!
  if (currentCastMode === 'remote' && currentRoomCode) {
    const item = getCached(type, id);
    const title = item ? item.title : 'Playing…';

    season = season || currentSeason || 1;
    episode = episode || currentEpisode || 1;

    let epInfo = '';
    if (type === 'tv' || (type === 'anime' && !item?.isMovie)) {
      epInfo = `Season ${season}, Episode ${episode}`;
    }

    const url = getPlayerURL(id, type, 'videasy', season, episode);

    await sendCastCommand({
      title: title,
      epInfo: epInfo,
      url: url,
      source: 'videasy',
      state: { id, type, season, episode }
    });
    return; // Stop here, don't open local player!
  }

  // Otherwise, play normally on this device
  originalPlayItem(id, type, season, episode);
};

// ── HISTORY STATE MANAGEMENT (HARDWARE BACK BUTTON) ───────────────────────
function pushOverlayState() {
  history.pushState({ isOverlay: true }, '', '');
}

window.addEventListener('popstate', () => {
  // Always close topmost overlay when pressing hardware Back
  if (document.getElementById('virtual-remote-overlay').classList.contains('open')) closeVirtualRemote(true);
  else if (document.getElementById('player-overlay').classList.contains('open')) closePlayer(true);
  else if (document.getElementById('cast-overlay').classList.contains('open')) closeCastModal(true);
  else if (document.getElementById('search-overlay').classList.contains('open')) closeSearch(true);
  else if (document.getElementById('modal-overlay').classList.contains('open')) closeModal(true);
});

// ── VIRTUAL REMOTE ────────────────────────────────────────────────────────
function openVirtualRemote() {
  pushOverlayState();
  document.getElementById('virtual-remote-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeVirtualRemote(fromPopState = false) {
  if (!fromPopState && history.state && history.state.isOverlay) { history.back(); return; }
  document.getElementById('virtual-remote-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleVirtualRemoteOverlayClick(e) {
  if (e.target === document.getElementById('virtual-remote-overlay')) closeVirtualRemote();
}

function sendRemoteKey(key) {
  if (!firebaseDb || !currentRoomCode) return;
  const cmd = {
    action: "remote_key",
    key: key,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sentAt: Date.now()
  };
  firebaseDb.ref(`rooms/${currentRoomCode}/command`).set(cmd);
  if (navigator.vibrate) navigator.vibrate(50);
}

// ── PWA INSTALL ───────────────────────────────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) {
    btn.style.display = 'flex';
    btn.onclick = async () => {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        btn.style.display = 'none';
      }
      deferredPrompt = null;
    };
  }
});

// ── TV SPATIAL NAVIGATION v3 ──────────────────────────────────────────────
let tvFocusedEl        = null;
let tvFocusBeforeModal = null; // remember card that opened modal

// Context-specific selector sets — navigation is LOCKED to the active context
const TV_CONTEXTS = {
  player: [
    '#player-overlay .source-btn',
    '#player-overlay .player-close',
    '#tv-exit-btn'
  ],
  modal: [
    '#modal-overlay .modal-play',
    '#modal-overlay .modal-close',
    '#modal-overlay .btn-info',
    '#modal-overlay .ep-select',
    '#modal-overlay .rec-card'
  ],
  home: [
    '.nav-links a',
    '.nav-search-btn',
    '.btn-play',
    '.btn-info',
    '.card'
  ]
};

function tvGetContext() {
  if (document.getElementById('player-overlay').classList.contains('open')) return 'player';
  if (document.getElementById('modal-overlay').classList.contains('open'))  return 'modal';
  return 'home';
}

function tvIsVisible(el) {
  let node = el;
  while (node && node !== document.body) {
    const s = window.getComputedStyle(node);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    node = node.parentElement;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function tvGetFocusables() {
  const ctx      = tvGetContext();
  const selector = TV_CONTEXTS[ctx].join(',');
  return Array.from(document.querySelectorAll(selector)).filter(tvIsVisible);
}

function tvSetFocus(el) {
  if (tvFocusedEl) tvFocusedEl.classList.remove('tv-focused');
  tvFocusedEl = el;
  if (!el) return;
  el.classList.add('tv-focused');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

// Call this whenever context changes (modal open/close, player open/close)
function tvSyncFocus() {
  const ctx       = tvGetContext();
  const focusables = tvGetFocusables();
  if (!focusables.length) return;

  if (ctx === 'modal') {
    // Save where we were on the home screen
    tvFocusBeforeModal = tvFocusedEl;
    // Auto-land on the Play button
    const play = document.querySelector('#modal-overlay .modal-play');
    tvSetFocus(play && tvIsVisible(play) ? play : focusables[0]);

  } else if (ctx === 'player') {
    const tvMode = document.getElementById('player-overlay').classList.contains('tv-mode');
    if (tvMode) {
      // Full-screen TV cast: only exit button matters
      const exit = document.getElementById('tv-exit-btn');
      tvSetFocus(exit && tvIsVisible(exit) ? exit : focusables[0]);
    } else {
      // Normal player: land on close button
      const close = document.querySelector('#player-overlay .player-close');
      tvSetFocus(close && tvIsVisible(close) ? close : focusables[0]);
    }

  } else {
    // Back to home — restore focus to the card that opened the modal
    if (tvFocusBeforeModal && document.body.contains(tvFocusBeforeModal)) {
      tvSetFocus(tvFocusBeforeModal);
    } else {
      // Default: first card
      const firstCard = document.querySelector('.card');
      tvSetFocus(firstCard && tvIsVisible(firstCard) ? firstCard : focusables[0]);
    }
    tvFocusBeforeModal = null;
  }
}

function tvSpatialNavigate(key) {
  if (key === 'enter') { if (tvFocusedEl) tvFocusedEl.click(); return; }
  if (key === 'back')  { history.back(); return; }

  const all = tvGetFocusables();
  if (!all.length) return;

  // If nothing focused (or focused el left context), sync first
  if (!tvFocusedEl || !all.includes(tvFocusedEl)) {
    tvSyncFocus();
    return;
  }

  const cur = tvFocusedEl.getBoundingClientRect();
  const cx  = cur.left + cur.width  / 2;
  const cy  = cur.top  + cur.height / 2;

  // Document-relative Y for current element (unaffected by scroll)
  const curPageY = cur.top + window.scrollY;

  // Row-lock tolerance for Left/Right
  const rowTolerance = Math.max(cur.height * 0.75, 50);

  let best      = null;
  let bestScore = Infinity;
  let bestFixed = null;         // fallback candidate (fixed navbar)
  let bestFixedScore = Infinity;

  for (const el of all) {
    if (el === tvFocusedEl) continue;
    const r  = el.getBoundingClientRect();
    const ex = r.left + r.width  / 2;
    const ey = r.top  + r.height / 2;

    const isFixed = (function(node) {
      while (node && node !== document.body) {
        if (window.getComputedStyle(node).position === 'fixed') return true;
        node = node.parentElement;
      }
      return false;
    })(el);

    const dx     = ex - cx;
    const viewDy = ey  - cy;
    const pageDy = (ey + window.scrollY) - curPageY;

    let primary, secondary;

    if (key === 'right') {
      if (dx <= 0 || Math.abs(viewDy) > rowTolerance) continue;
      primary = dx; secondary = Math.abs(viewDy);
    } else if (key === 'left') {
      if (dx >= 0 || Math.abs(viewDy) > rowTolerance) continue;
      primary = -dx; secondary = Math.abs(viewDy);
    } else if (key === 'down') {
      if (pageDy <= 0) continue;
      primary = pageDy; secondary = Math.abs(dx);
    } else if (key === 'up') {
      if (pageDy >= 0) continue;
      primary = -pageDy; secondary = Math.abs(dx);
    }
    if (primary === undefined) continue;

    const score = primary + secondary * 2.5;

    if (isFixed && (key === 'up' || key === 'down')) {
      // Fixed nav: only keep as fallback — non-fixed cards always win
      if (score < bestFixedScore) { bestFixedScore = score; bestFixed = el; }
    } else {
      if (score < bestScore) { bestScore = score; best = el; }
    }
  }

  // Use non-fixed winner; fall back to fixed (navbar) only if nothing else found
  if (best) tvSetFocus(best);
  else if (bestFixed) tvSetFocus(bestFixed);
  // else: clamp (stay put)
}

// ── START ─────────────────────────────────────────────────────────────────
init();