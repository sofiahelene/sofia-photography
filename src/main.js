import '@fontsource-variable/inter';
import gsap from 'gsap';
import { pages, LANDING_FONT } from './pages.js';
import { mountGlyphPortal } from './glyph-portal.js';
import { projects } from './projects.js';

const projectSlugs = new Set(projects.map(p => p.slug));

// The logo (etoileblanche.png) is already in the correct colour — no
// pixel-replace needed. colorizeImg is kept as a no-op stub so existing call
// sites don't break.
function colorizeImg(img) { /* logo already white — no recolour needed */ }

// ── Language ──────────────────────────────────────────────────────────────────
// The site is French only. Text in the code is written as t(french, english)
// so an English version could be added back later; t() always returns French.
window.LANG = 'fr';
window.t = (fr) => fr;

// ── Touch device detection ──────────────────────────────────────────────────────
// Used to skip the mouse-driven home hero (never designed for touch) and to
// suppress the custom mouse-cursor overlay, which otherwise sticks on screen
// after a tap since touch devices never fire the mousemove events it relies on.
const IS_TOUCH_DEVICE = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
if (IS_TOUCH_DEVICE) document.documentElement.classList.add('is-touch');

// ── Session restore ───────────────────────────────────────────────────────────
// sessionStorage survives normal refresh (F5) but clears on hard refresh
// (Ctrl+Shift+R / Cmd+Shift+R) and new sessions — exactly the signal we need.
const _savedPage = sessionStorage.getItem('pf-page');
// Consume any path saved by 404.html redirect
const _redirectPath = sessionStorage.getItem('pf-redirect-path');
if (_redirectPath) { sessionStorage.removeItem('pf-redirect-path'); history.replaceState(null, '', _redirectPath); }

// ── Router ────────────────────────────────────────────────────────────────────
const pfPage        = document.getElementById('pf-page');
let currentPage     = 'home';
let landingCleanup  = null;
let landingScroll   = 0;   // where the visitor was on the landing page

// toGrid: open the landing page straight on the photo grid (at the same
// scroll position as last time) instead of on the SOFIA LUCAS opening.
function navigateTo(pageId, { toGrid = false } = {}) {
  if (!pages[pageId]) return;
  if (currentPage === 'home') landingScroll = pfPage.querySelector('.page-landing')?.scrollTop ?? 0;
  if (window._lbCleanup) { window._lbCleanup(); window._lbCleanup = null; }
  if (landingCleanup)    { landingCleanup();    landingCleanup    = null; }
  setLandingLight(false);
  setTitleRise(null);
  currentPage = pageId;
  sessionStorage.setItem('pf-page', pageId);
  const urlPath = pageId === 'home' ? '/' : '/' + pageId;
  if (window.location.pathname !== urlPath) history.pushState({ pageId }, '', urlPath);

  const outgoing = pfPage.firstElementChild;

  const doRender = () => {
    pfPage.innerHTML = pages[pageId]();
    pfPage.className = 'page-scrollable';
    document.querySelectorAll('.nav-link').forEach(l =>
      l.classList.toggle('active', l.dataset.page === pageId)
    );
    // PROJECTS is highlighted while any project is open
    document.getElementById('nav-projets')?.classList.toggle('active', projectSlugs.has(pageId));
    closeProjectsMenu();

    const incoming = pfPage.firstElementChild;
    updateHeaderBar();
    if (!incoming) return;
    incoming.querySelectorAll('.proj-logo-anim').forEach(colorizeImg);

    // Clear residual transform after page-in animation — an identity transform
    // still creates a stacking context that can clip overflowing child content.
    incoming.addEventListener('animationend', () => {
      incoming.style.transform = '';
      incoming.style.opacity = '';
    }, { once: true });

    if (pageId === 'home') {
      // Grid photos are plain links, handled by the global [data-page] click
      // handler. The opening word is a glyph portal into the grid.
      initLanding(incoming, toGrid);
    } else {
      gsap.fromTo(incoming,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'transform,opacity' }
      );
      incoming.querySelectorAll('.proj-back[data-page]').forEach(btn => {
        initLetterSwap(btn);
      });
      initPortraitPhotos(incoming);
      const contactForm = incoming.querySelector('#contact-form');
      if (contactForm) initContactForm(contactForm);
    }
  };

  // Pages whose default tab auto-plays unmuted video need vid.play() in the same
  // synchronous call stack as the originating user gesture. Delaying via GSAP's
  // onComplete breaks user-activation propagation in Safari and some Chrome builds.
  const syncRenderPages = [];

  if (outgoing && !syncRenderPages.includes(pageId)) {
    gsap.to(outgoing, {
      opacity: 0, y: -10, duration: 0.22, ease: 'power2.in',
      onComplete: doRender,
    });
    // Fallback: if GSAP onComplete doesn't fire (animation killed), render anyway
    setTimeout(() => {
      if (currentPage === pageId && pfPage.firstElementChild === outgoing) doRender();
    }, 350);
  } else {
    doRender();
  }
}

// ── Portrait photos ─────────────────────────────────────────────────────────
// All photos share one width (see .photo-stack img in style.css), so portrait
// photos end up taller than the screen — clicking one opens it on its own in
// a pop-up so it can be seen whole.
function initPortraitPhotos(page) {
  page.querySelectorAll('.photo-stack img').forEach(img => {
    const check = () => {
      // Side-by-side photos share the row in proportion to their shape, so
      // they all end up the same height without cropping
      if (img.parentElement.classList.contains('photo-row')) {
        img.style.flexGrow = img.naturalWidth / img.naturalHeight;
      }
      // Fitted photos are already fully visible, so they don't need the pop-up
      if (img.naturalHeight <= img.naturalWidth || img.classList.contains('photo-fit')) return;
      img.classList.add('is-portrait');
      img.addEventListener('click', () => openPhotoPopup(img.src));
    };
    if (img.complete && img.naturalWidth) check();
    else img.addEventListener('load', check, { once: true });
  });
}

// ── Landing: SOFIA LUCAS glyph portal ───────────────────────────────────────
// During the opening (white paper, then the black letter filling the screen)
// the header and cursor invert against what's behind them, so they read as
// black on white and white on black. Once the grid appears they're normal.
function setLandingLight(on) {
  document.getElementById('pf-app').classList.toggle('landing-light', on);
  document.documentElement.classList.toggle('landing-light', on);
}

// The header's SOFIA LUCAS title is hidden on the opening screen (which shows
// the name) and slides down from above the screen as the grid rises into the
// letter, in step with it. null = normal (other pages).
function setTitleRise(rise) {
  // landing-paper: the plain white name screen, before any photos show
  document.getElementById('pf-app').classList.toggle('landing-paper', rise === 0);
  const title = document.querySelector('.pf-title');
  if (!title) return;
  if (rise === null) { title.style.visibility = ''; title.style.removeProperty('--title-rise'); return; }
  title.style.visibility = rise > 0 ? '' : 'hidden';
  title.style.setProperty('--title-rise', rise);
}

function initLanding(page, toGrid = false) {
  const section = page.querySelector('.gp');
  if (!section) return;
  // Going straight to the grid: keep the page hidden until it's scrolled there
  if (toGrid) page.style.visibility = 'hidden';
  else { setLandingLight(true); setTitleRise(0); }
  let cleanup = null;
  let cancelled = false;
  // The portal measures the letters, so the font must be loaded first
  document.fonts.load(`900 100px ${LANDING_FONT}`, 'SOFIA LUCAS')
    .catch(() => {})
    .then(() => {
      if (cancelled) return;
      cleanup = mountGlyphPortal(section, {
        // White paper is visible until the camera has filled the screen (78%)
        onProgress: (p, { rise }) => { setLandingLight(p < 0.78); setTitleRise(rise); },
      });
      if (toGrid) jumpToGrid(page, section);
    });
  const stopHover = initGridHover(page);
  const stopLayout = initGridLayout(page);
  landingCleanup = () => { cancelled = true; cleanup?.(); stopHover(); stopLayout(); };
}

// Lays the grid out in columns. 3 columns: each photo goes in the column set
// in gridColumns (projects.js). 2 columns (narrow screens): photos are dealt
// in reading order, each into the currently shorter column. Then every column
// is evened out to the same height by making the photos in shorter columns a
// touch taller (their images are cropped to fit, a few percent at most), so
// the grid has no ragged bottom. The copy seen through the letter and the real
// grid get the same layout, so they stay identical.
const GRID_TWO_COLUMNS = window.matchMedia('(max-width: 768px)');
const GRID_GAP = 8; // px, matches .landing-grid gap and .landing-item margin
const photoRatio = item => {
  const img = item.querySelector('img');
  return img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.75;
};
function layoutGrid(grid) {
  const count = GRID_TWO_COLUMNS.matches ? 2 : 3;
  let items = [...grid.querySelectorAll('.landing-item')];
  if (grid.dataset.columns !== String(count)) {
    // Reading order is the order the items were rendered in
    items.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
    const columns = Array.from({ length: count }, () => {
      const col = document.createElement('div');
      col.className = 'landing-col';
      return col;
    });
    const heights = new Array(count).fill(0);
    items.forEach(item => {
      let c;
      if (count === 3) c = Number(item.dataset.col);
      else c = heights[0] <= heights[1] ? 0 : 1;
      columns[c].appendChild(item);
      heights[c] += photoRatio(item) + 0.02;
    });
    grid.replaceChildren(...columns);
    grid.dataset.columns = String(count);
  }
  // Even out the column heights
  const columns = [...grid.children];
  const width = columns[0]?.clientWidth || 0;
  if (!width) return;
  const natural = columns.map(col => [...col.children].map(item => photoRatio(item) * width));
  const totals = natural.map(hs => hs.reduce((a, b) => a + b, 0) + GRID_GAP * Math.max(0, hs.length - 1));
  const target = Math.max(...totals);
  columns.forEach((col, c) => {
    const photos = natural[c].reduce((a, b) => a + b, 0);
    const scale = photos ? (target - GRID_GAP * Math.max(0, natural[c].length - 1)) / photos : 1;
    [...col.children].forEach((item, i) => { item.style.height = `${natural[c][i] * scale}px`; });
  });
}
function initGridLayout(page) {
  const grids = [...page.querySelectorAll('.landing-grid')];
  grids.forEach(grid => grid.querySelectorAll('.landing-item').forEach((item, i) => { item.dataset.order = i; }));
  let raf = 0;
  const apply = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => grids.forEach(grid => {
      // Re-deal on narrow screens once the photos' real shapes are known
      if (GRID_TWO_COLUMNS.matches && grid.dataset.shapesKnown !== 'true' &&
          [...grid.querySelectorAll('img')].every(img => img.naturalWidth)) {
        grid.dataset.shapesKnown = 'true';
        delete grid.dataset.columns;
      }
      layoutGrid(grid);
    }));
  };
  grids.forEach(layoutGrid);
  page.querySelectorAll('.landing-grid img').forEach(img => img.addEventListener('load', apply));
  const resize = new ResizeObserver(apply);
  grids.forEach(grid => resize.observe(grid));
  GRID_TWO_COLUMNS.addEventListener('change', apply);
  return () => {
    cancelAnimationFrame(raf);
    resize.disconnect();
    GRID_TWO_COLUMNS.removeEventListener('change', apply);
  };
}

// Grid hover, worked out from the mouse position rather than CSS :hover so it
// stays correct while scrolling (Safari doesn't update :hover on scroll until
// the mouse moves). Mouse only — on touch, a tap simply opens the project.
function initGridHover(page) {
  let x = -1, y = -1, current = null;
  const update = () => {
    const el = x < 0 ? null : document.elementFromPoint(x, y);
    const item = el?.closest('[data-gp-content] .landing-item') ?? null;
    if (item === current) return;
    current?.classList.remove('is-hover');
    item?.classList.add('is-hover');
    current = item;
  };
  const onMove = e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY; update();
  };
  const onLeave = () => { x = y = -1; update(); };
  page.addEventListener('pointermove', onMove);
  page.addEventListener('pointerleave', onLeave);
  page.addEventListener('scroll', update, { passive: true });
  return () => {
    page.removeEventListener('pointermove', onMove);
    page.removeEventListener('pointerleave', onLeave);
    page.removeEventListener('scroll', update);
  };
}

// Scrolls the landing page to the grid (or further, if the visitor had
// scrolled down it before), once the portal has laid itself out.
function jumpToGrid(page, section) {
  let frames = 0;
  const step = () => {
    // The portal switches its scroll layout on after its first frame
    if (section.dataset.gpMotion !== 'on' && frames++ < 10) { requestAnimationFrame(step); return; }
    const gridTop = section.querySelector('[data-gp-content]').offsetTop;
    page.scrollTop = Math.max(landingScroll, gridTop);
    requestAnimationFrame(() => { page.style.visibility = ''; });
  };
  requestAnimationFrame(step);
}

function initContactForm(form) {
  const btn     = form.querySelector('#contact-submit');
  const success = form.querySelector('#contact-success');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (btn) { btn.disabled = true; btn.textContent = window.t('Envoi…', 'Sending…'); }

    try {
      // FormSubmit only sends CORS headers (required for fetch/XHR) from its
      // /ajax/ endpoint, and that endpoint expects a JSON body rather than
      // multipart FormData.
      const formObj = Object.fromEntries(new FormData(form).entries());
      const ajaxAction = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
      const res  = await fetch(ajaxAction, {
        method:  'POST',
        body:    JSON.stringify(formObj),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });

      if (res.ok) {
        form.reset();
        if (btn)     { btn.style.display = 'none'; }
        if (success) { success.style.display = ''; }
      } else {
        throw new Error('server error');
      }
    } catch {
      if (btn) { btn.disabled = false; btn.textContent = window.t('Envoyer', 'Send'); }
      alert(window.t('Une erreur est survenue, veuillez réessayer.', 'An error occurred, please try again.'));
    }
  });
}

// ── Mobile video full screen (landscape) ────────────────────────────────────────
// Custom overlay rather than the Fullscreen/orientation-lock APIs: iOS Safari
// doesn't support screen.orientation.lock() at all, so the only cross-browser
// approach is to ask the visitor to physically rotate their phone and react to
// the resulting viewport change.
function openVideoFullscreen(video) {
  const originalParent = video.parentElement;
  const originalNext   = video.nextSibling;

  const overlay = document.createElement('div');
  overlay.className = 'video-fs-overlay';
  overlay.innerHTML = `
    <button class="video-fs-close" aria-label="Close">✕</button>
    <div class="video-fs-rotate-hint">
      <span class="video-fs-rotate-icon">⟳</span>
      <span>${window.t('Faites pivoter votre téléphone', 'Rotate your phone')}</span>
    </div>
    <div class="video-fs-video-wrap"></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.video-fs-video-wrap').appendChild(video);

  const wasPaused = video.paused;
  video.play().catch(() => {});

  document.body.style.overflow = 'hidden';
  screen.orientation?.lock?.('landscape').catch(() => {});

  const syncOrientation = () => {
    overlay.classList.toggle('is-landscape', window.innerWidth > window.innerHeight);
  };
  syncOrientation();
  window.addEventListener('resize', syncOrientation);

  function close() {
    window.removeEventListener('resize', syncOrientation);
    screen.orientation?.unlock?.();
    document.body.style.overflow = '';
    if (originalNext) originalParent.insertBefore(video, originalNext);
    else originalParent.appendChild(video);
    if (wasPaused) video.pause();
    overlay.remove();
  }
  overlay.querySelector('.video-fs-close').addEventListener('click', close);
}

function wireFullscreenBtn(panel) {
  const btn = panel.querySelector('.motion-fullscreen-btn');
  const video = panel.querySelector('video');
  if (!btn || !video) return;
  btn.onclick = () => openVideoFullscreen(video);
}

// ── Photo pop-up ──────────────────────────────────────────────────────────────
// Shows one photo on its own over a dark backdrop. Closes on click, ✕ or Esc.
function openPhotoPopup(src) {
  const overlay = document.createElement('div');
  overlay.className = 'lb-overlay lb-active';
  overlay.innerHTML = `<button class="lb-close" aria-label="Close">✕</button><img class="lb-img" alt="">`;
  overlay.querySelector('.lb-img').src = src;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    window._lbCleanup = null;
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  window._lbCleanup = close;
}

// ── Nav letter-swap hover ─────────────────────────────────────────────────────
function initLetterSwap(el, { staggerDuration = 0.03, duration = 0.7 } = {}) {
  const label = el.textContent.trim();

  el.innerHTML =
    `<span class="sr-only">${label}</span>` +
    label.split('').map((ch, i) =>
      `<span class="ls-char">` +
        `<span class="ls-primary ls-p-${i}">${ch}</span>` +
        `<span class="ls-secondary ls-s-${i}" aria-hidden="true">${ch}</span>` +
      `</span>`
    ).join('');

  const shuffled = [...Array(label.length).keys()].sort(() => Math.random() - 0.5);
  let blocked = false;

  el.addEventListener('mouseenter', () => {
    if (blocked) return;
    blocked = true;
    shuffled.forEach((ri, i) => {
      const delay     = i * staggerDuration;
      const primary   = el.querySelector(`.ls-p-${ri}`);
      const secondary = el.querySelector(`.ls-s-${ri}`);
      if (!primary || !secondary) return;
      gsap.to(primary,   { y: '100%', duration, ease: 'power3.inOut', delay })
          .then(() => gsap.set(primary, { y: 0 }));
      gsap.to(secondary, { top: '0%', duration, ease: 'power3.inOut', delay })
          .then(() => {
            gsap.set(secondary, { top: '-100%' });
            if (i === label.length - 1) blocked = false;
          });
    });
  });
}

document.querySelectorAll('.nav-link').forEach(link => initLetterSwap(link));

// ── Click handler ─────────────────────────────────────────────────────────────
document.getElementById('pf-app').addEventListener('click', e => {
  const link = e.target.closest('[data-page]');
  if (!link) return;
  e.preventDefault();
  // data-to-grid links (the Back button) open the landing page on its grid
  navigateTo(link.dataset.page, { toGrid: link.hasAttribute('data-to-grid') });
});

// ── Header bar when scrolled ────────────────────────────────────────────────
// The header gets a black bar once the page is scrolled. On the landing page
// that's only once the photo grid itself is being scrolled, not during the
// SOFIA LUCAS opening.
function updateHeaderBar() {
  const scroller = pfPage.querySelector('.page-inner');
  let solid = false;
  if (scroller) {
    const grid = scroller.querySelector('.gp [data-gp-content]');
    const start = grid ? grid.offsetTop : 0;
    solid = scroller.scrollTop > start + 1;
  }
  document.getElementById('pf-app').classList.toggle('header-solid', solid);
}
pfPage.addEventListener('scroll', updateHeaderBar, { capture: true, passive: true });

// ── Projects drop-down (from the PROJECTS button in the header) ─────────────
// Opens on hover on desktop and on click/tap everywhere. Items are plain
// [data-page] links handled by the global click handler.
const navDropdown = document.getElementById('nav-dropdown');
const navDropdownMenu = document.getElementById('nav-dropdown-menu');
const navDropdownToggle = document.getElementById('nav-projets');

function renderProjectsMenu() {
  navDropdownMenu.innerHTML = projects.map(p =>
    `<a class="nav-dropdown-item" href="#${p.slug}" data-page="${p.slug}">${window.t(p.title[0], p.title[1])}</a>`
  ).join('');
}
function closeProjectsMenu() {
  navDropdown.classList.remove('is-open');
  navDropdownToggle.setAttribute('aria-expanded', 'false');
}
const CAN_HOVER = window.matchMedia('(hover: hover)');
navDropdownToggle.addEventListener('click', e => {
  // With a mouse the menu just follows the hover; clicking does nothing extra
  // (keyboard presses have detail 0 and still toggle it)
  if (CAN_HOVER.matches && e.detail !== 0) return;
  const open = navDropdown.classList.toggle('is-open');
  navDropdownToggle.setAttribute('aria-expanded', String(open));
});
// Closes once the mouse leaves, whatever opened it
navDropdown.addEventListener('mouseleave', closeProjectsMenu);
document.addEventListener('click', e => { if (!navDropdown.contains(e.target)) closeProjectsMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProjectsMenu(); });
renderProjectsMenu();

// Handle browser back/forward
window.addEventListener('popstate', e => {
  const pageId = e.state?.pageId || pageFromPath(window.location.pathname);
  if (pageId) navigateTo(pageId, { toGrid: pageId === 'home' && currentPage !== 'home' });
});

function pageFromPath(path) {
  const id = path.replace(/^\//, '') || 'home';
  return pages[id] ? id : null;
}

const _urlPage = pageFromPath(window.location.pathname);

if (_urlPage && _urlPage !== 'home') {
  // Direct link to a specific page
  navigateTo(_urlPage);
} else if (_savedPage && pages[_savedPage]) {
  // Normal refresh — restore the page the visitor was on
  navigateTo(_savedPage);
} else {
  navigateTo('home');
}

// ── Custom cursor ─────────────────────────────────────────────────────────────
(function initCustomCursor() {
  // Touch devices never fire mousemove, so the dot would just appear at the
  // last tap position and stay there forever. Skip the whole overlay.
  if (IS_TOUCH_DEVICE) return;
  const COLOR = '#ffffff';
  const RADIUS = 6;
  const TAIL_MAX = 46;
  const FADE_DELAY = 120;
  const FADE_DURATION = 200;

  // The dot is a CSS element positioned directly in mousemove — no rAF dependency,
  // so it can never disappear due to loop interruption or canvas issues.
  const dot = document.createElement('div');
  dot.id = 'pf-cursor-dot';
  dot.style.cssText = `position:fixed;width:${RADIUS*2}px;height:${RADIUS*2}px;border-radius:50%;pointer-events:none;z-index:10000;transform:translate(-50%,-50%);top:0;left:0;display:none;background:${COLOR};`;
  document.body.appendChild(dot);

  // Canvas is used only for the trailing tail line
  const canvas = document.createElement('canvas');
  canvas.id = 'pf-cursor-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let mx = -999, my = -999;
  let px = -999, py = -999;
  let tailOpacity = 0;
  let fadeTimer = null;
  let fadeStart = null;
  let moving = false;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Hide when mouse leaves the browser window (relatedTarget null = left to OS/chrome)
  document.documentElement.addEventListener('mouseleave', e => {
    if (e.relatedTarget === null) {
      mx = -999; my = -999;
      dot.style.display = 'none';
    }
  });

  window.addEventListener('mousemove', e => {
    px = mx; py = my;
    mx = e.clientX; my = e.clientY;

    // Position the dot immediately — no frame delay
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
    dot.style.display = 'block';

    tailOpacity = 1;
    moving = true;
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; fadeStart = null; }
    fadeTimer = setTimeout(() => {
      moving = false;
      fadeStart = performance.now();
    }, FADE_DELAY);
  });

  function draw(now) {
    requestAnimationFrame(draw);

    const color = COLOR;

    // Canvas handles only the tail
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mx < 0) return;

    if (!moving && fadeStart !== null) {
      const elapsed = now - fadeStart;
      tailOpacity = Math.max(0, 1 - elapsed / FADE_DURATION);
    }

    if (tailOpacity > 0 && px > -999) {
      const dx = px - mx, dy = py - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const len = Math.min(dist, TAIL_MAX);
        const tx = mx + (dx / dist) * len;
        const ty = my + (dy / dist) * len;
        ctx.save();
        ctx.globalAlpha = tailOpacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  requestAnimationFrame(draw);
})();
