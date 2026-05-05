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
  { id: 'action',   title: '🔥 Action & Adventure',  queries: ['mission impossible', 'john wick', 'fast furious', 'mad max'] },
  { id: 'scifi',    title: '🚀 Sci-Fi & Fantasy',     queries: ['inception', 'dune', 'interstellar', 'avatar', 'matrix'] },
  { id: 'tvseries', title: '📺 Top TV Series',        queries: ['breaking bad', 'stranger things', 'game of thrones', 'the bear', 'succession'] },
  { id: 'thriller', title: '🎭 Drama & Thriller',     queries: ['parasite', 'oppenheimer', 'gone girl', 'zodiac', 'prestige'] },
  { id: 'marvel',   title: '⚡ Marvel & DC',          queries: ['avengers endgame', 'batman dark knight', 'spider-man', 'guardians of the galaxy'] },
  { id: 'comedy',   title: '😂 Comedy & Feel-Good',   queries: ['ted lasso', 'the office', 'bridesmaids', 'superbad', 'knives out'] },
  { id: 'horror',   title: '👻 Horror & Suspense',    queries: ['hereditary', 'midsommar', 'get out', 'quiet place', 'us 2019'] },
  { id: 'classics', title: '🏆 All-Time Classics',    queries: ['godfather', 'pulp fiction', 'schindler list', 'shawshank', 'casablanca'] },
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
  } catch(e) {
    return null;
  }
}

function cacheItem(item) {
  if (item && item.id) allItems[`${item.type}-${item.id}`] = item;
}

function getCached(type, id) {
  return allItems[`${type}-${id}`] || null;
}

function showToast(msg, dur=2500) {
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
  if (item.poster) {
    return `<img src="${item.poster}" alt="${escHtml(item.title)}" loading="lazy" onerror="this.parentNode.innerHTML=noImgHTML('${escHtml(item.title)}')" >`;
  }
  return noImgHTML(item.title);
}
function noImgHTML(title) {
  return `<div class="card-no-img">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
    <span>${escHtml(title||'')}</span>
  </div>`;
}
function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
  const genresHTML = (item.genres||[]).map(g=>`<span class="hero-genre">${escHtml(g)}</span>`).join('');

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
    `<div class="hero-dot ${i===idx?'active':''}" onclick="renderHero(${i})"></div>`
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

function skeletonCards(n=8) {
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
          ${Array.from({length:10},(_,i)=>`<option value="${i+1}">Season ${i+1}</option>`).join('')}
        </select>
      </div>
      <div class="ep-row">
        <span class="ep-label">Episode</span>
        <select class="ep-select" id="modal-episode" onchange="updateEpisode()">
          ${Array.from({length:30},(_,i)=>`<option value="${i+1}">Episode ${i+1}</option>`).join('')}
        </select>
      </div>
    </div>
  ` : '';

  const genresHTML = (item.genres||[]).map(g=>`<span class="modal-genre">${escHtml(g)}</span>`).join('');

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
}

async function loadModalRecs(item) {
  const section = document.getElementById('modal-recs-section');
  if (!section) return;

  section.innerHTML = `<div class="modal-recs-title">More Like This</div>
    <div class="modal-recs">${Array(6).fill(0).map(()=>`
      <div class="skeleton" style="aspect-ratio:2/3;border-radius:6px"></div>
    `).join('')}</div>`;

  const recs = await apiFetch(`/recommend?type=${item.type}&id=${item.id}`);

  if (!recs || !recs.length) {
    section.innerHTML = '';
    return;
  }

  const recsHTML = recs.filter(r=>r&&r.title).map(r => {
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

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  currentItem = null;
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
  } catch(e) {}
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
  } catch(e) {}

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
        ${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${i+1===season?'selected':''}>S${i+1}</option>`).join('')}
      </select>
      <select class="ep-select" id="player-ep" onchange="playerChangedEp(${id},'${type}')">
        ${Array.from({length:30},(_,i)=>`<option value="${i+1}" ${i+1===episode?'selected':''}>E${i+1}</option>`).join('')}
      </select>
    `;
  } else {
    tvCtrl.style.display = 'none';
    tvCtrl.innerHTML = '';
  }

  // Store current state
  window._playState = { id, type, season, episode };

  document.getElementById('player-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
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

function closePlayer() {
  document.getElementById('player-overlay').classList.remove('open');
  document.getElementById('player-iframe').src = '';
  document.body.style.overflow = '';
  window._playState = null;
}

// ── SEARCH ────────────────────────────────────────────────────────────────
function openSearch() {
  document.getElementById('search-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('search-input').focus(), 100);
}

function closeSearch() {
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
      <div class="card-img-wrap" style="height:200px">
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
  } catch(e) {
    updateCastStatus("Failed to init Firebase", true);
    return false;
  }
}

function openCastModal() {
  document.getElementById('cast-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCastModal() {
  document.getElementById('cast-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleCastOverlayClick(e) {
  if (e.target === document.getElementById('cast-overlay')) closeCastModal();
}

function updateCastStatus(msg, isError=false) {
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
  setTimeout(closeCastModal, 1500);
}

async function connectAsTV() {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
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
      
      // Manually open the player with the received data
      document.getElementById('player-title').textContent = cmd.media.title;
      document.getElementById('player-ep-info').textContent = cmd.media.epInfo || '';
      
      currentSource = cmd.media.source || 'videasy';
      document.getElementById('src-videasy').classList.toggle('active', currentSource === 'videasy');
      document.getElementById('src-vidking').classList.toggle('active', currentSource === 'vidking');
      
      document.getElementById('player-iframe').src = cmd.media.url;
      
      window._playState = cmd.media.state || null;
      
      const tvCtrl = document.getElementById('player-tv-controls');
      tvCtrl.style.display = 'none'; // hide controls on TV to keep it clean
      
      document.getElementById('player-overlay').classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  });

  updateCastStatus(`This screen is now TV. Room Code: ${code}`);
  showToast("Ready to receive casts!");
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
playItem = async function(id, type, season, episode) {
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

// ── START ─────────────────────────────────────────────────────────────────
init();