/**
 * Glyph Portal © 2026 Christian Katzmann. MIT.
 * Origin: UsefulPortal.astro on https://ktzm.dk → UsefulPortal.tsx → ClarityPortal.tsx.
 * A scroll-driven camera through live type. Keep this notice with copies.
 *
 * Plain-JS port of glyph-portal.tsx for this (non-React) site. A big word sits
 * on paper; `field` is seen through its letters. Scrolling flies the camera
 * into the letter with the most ink until the field fills the screen, then
 * hands over to `content`.
 *
 * Differences from the original: no letter picker, caption or annotations;
 * the camera move ends at 78% of the scroll and the content takes over right
 * then (no dead scroll); the field isn't zoomed; the letters start as solid ink and the field's
 * contents rise into the letter from the bottom partway through the zoom,
 * landing in place as the letter fills the screen; and the content appears instantly at the exact
 * moment it lines up with the field (no fade), so a field that is a copy of
 * the content's first screen makes the hand-over seamless.
 */

const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const smooth = (a, b, n) => {
  const t = clamp((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const DEFAULT_FONT = '"Arial Black", "Arial", sans-serif';
// Point in the camera move (0–1) where the field starts rising into the letter
const FIELD_RISE_START = 0.53;
let uidCounter = 0;

/** Largest opaque square, in linear time. Unlike a stem guess, it works in O, S and Ø. */
function interior(context, char, font) {
  const canvas = context.canvas;
  context.font = font;
  const m = context.measureText(char);
  const pad = 8;
  const left = Math.ceil(m.actualBoundingBoxLeft);
  const ascent = Math.ceil(m.actualBoundingBoxAscent);
  canvas.width = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2);
  canvas.height = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2);
  context.font = font;
  context.fontKerning = 'none';
  context.fillText(char, pad + left, pad + ascent);
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  const rows = new Uint16Array(width + 1);
  let size = 0, bx = 0, by = 0;
  for (let y = 0; y < height; y++) {
    let diagonal = 0;
    for (let x = 0; x < width; x++) {
      const above = rows[x + 1];
      rows[x + 1] = pixels[(y * width + x) * 4 + 3] > 245
        ? Math.min(above, rows[x], diagonal) + 1 : 0;
      diagonal = above;
      if (rows[x + 1] > size) { size = rows[x + 1]; bx = x; by = y; }
    }
  }
  if (size < 3) return null;
  // Scan at 3× SVG size. Inscribe a disk in the square, with room for raster disagreement.
  return { x: (bx + 1 - size / 2 - pad - left) / 3,
    y: (by + 1 - size / 2 - pad - ascent) / 3, radius: (size / 2 - 1) / 3 };
}

function scrollParent(element) {
  for (let p = element.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY) && p !== document.body && p !== document.documentElement) return p;
  }
  return null;
}

/** Markup for the portal. Pass the returned HTML into the page, then call mountGlyphPortal(). */
export function glyphPortalHTML({ word, field, content, label = word, scrollLength = 2.4, fontFamily = DEFAULT_FONT, fontWeight = 900 }) {
  const uid = `gp-${++uidCounter}`;
  const length = clamp(scrollLength, 1, 8);
  return `
    <section class="gp" id="${uid}" aria-label="${label}" style="--gp-length:${length}"
      data-gp-length="${length}" data-gp-font="${fontFamily.replace(/"/g, '&quot;')}" data-gp-weight="${fontWeight}">
      <div data-gp-viewport aria-hidden="true"></div>
      <div data-gp-pin>
        <div data-gp-field aria-hidden="true" inert>${field}</div>
        <svg data-gp-art aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="${uid}-clip" clipPathUnits="userSpaceOnUse">
              <text data-gp-glyph x="0" y="0" style="font-weight:${fontWeight};font-size:100px;font-kerning:none;font-variant-ligatures:none;letter-spacing:0">${word}</text>
            </clipPath>
          </defs>
        </svg>
      </div>
      <div data-gp-content>${content}</div>
    </section>`;
}

/** Starts the scroll camera. Returns a cleanup function. */
export function mountGlyphPortal(section, { onProgress } = {}) {
  const pin = section.querySelector('[data-gp-pin]');
  const field = section.querySelector('[data-gp-field]');
  const fieldInner = field.firstElementChild;
  const art = section.querySelector('[data-gp-art]');
  const clipId = `${section.id}-clip`;
  const clip = section.querySelector(`#${clipId}`);
  const glyph = section.querySelector('[data-gp-glyph]');
  const text = glyph.textContent.trim().normalize('NFC');
  const length = Number(section.dataset.gpLength);
  const fontFamily = section.dataset.gpFont;
  const weight = Number(section.dataset.gpWeight);
  const root = scrollParent(section);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let disposed = false, raf = 0, dirty = true, active = true, ready = false;
  const mountedAt = performance.now();
  let browserFrameSeen = false, stalled = false;
  let W = 1, H = 1, travel = 1, startScale = 1, endScale = 1;
  let center = { x: 0, y: 0 }, target = null;
  let lastProgress = -1, lastRise = -1;
  let bounds = { x: 0, y: 0, width: 1, height: 1 };
  let fontDirty = true;
  let fieldLead = 0;

  // Freeze an available face for this mount. Late font swaps move the ink under the camera.
  // Preload custom faces before mounting; pending/failed faces use the supplied fallback stack.
  glyph.style.fontFamily = fontFamily;
  const computedFamily = getComputedStyle(glyph).fontFamily;
  const families = computedFamily.match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const available = families.filter((family) => {
    try { return document.fonts.check(`${weight} 100px ${family.trim()}`, text); }
    catch { return false; }
  });
  glyph.style.fontFamily = [...available, DEFAULT_FONT].join(',');
  stalled = available.length < families.length;

  const readInk = () => {
    if (!context) return false;
    const font = getComputedStyle(glyph);
    const scanFont = `${font.fontWeight} 300px ${font.fontFamily}`;
    context.font = `${font.fontWeight} 100px ${font.fontFamily}`;
    context.fontKerning = 'none';
    const metrics = context.measureText(text);
    const advances = Array.from({ length: text.length }, (_, i) => context.measureText(text.slice(0, i)).width);
    bounds = { x: -metrics.actualBoundingBoxLeft, y: -metrics.actualBoundingBoxAscent,
      width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
      height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent };
    if (!bounds.width || !bounds.height) return false;
    center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const candidates = [];
    let offset = 0;
    for (const char of Array.from(text)) {
      const found = char.trim() ? interior(context, char, scanFont) : null;
      if (found) candidates.push({ ...found, x: found.x + advances[offset], index: offset });
      offset += char.length;
    }
    target = [...candidates].sort((a, b) => b.radius - a.radius || Math.abs(a.x - center.x) - Math.abs(b.x - center.x))[0] ?? null;
    return true;
  };

  const position = () => {
    const origin = root ? root.getBoundingClientRect().top + root.clientTop : 0;
    return clamp((origin - section.getBoundingClientRect().top) / travel);
  };

  const paint = (progress) => {
    const isStatic = motion.matches || !browserFrameSeen || stalled || !target;
    const p = isStatic ? 0 : progress;
    const t = clamp(p / 0.78);
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    const scale = Math.exp(Math.log(startScale) + Math.log(endScale / startScale) * eased);
    const blend = endScale === startScale ? 0 : (1 / scale - 1 / startScale) / (1 / endScale - 1 / startScale);
    const cx = center.x + ((target?.x ?? center.x) - center.x) * blend;
    const cy = center.y + ((target?.y ?? center.y) - center.y) * blend;
    const roll = -4 * smooth(0.06, 0.5, t) * (1 - smooth(0.62, 0.92, t));
    // Keep scale on the clip to avoid text paint limits.
    const radians = roll * Math.PI / 180;
    const dx = W / 2 / scale, dy = (H * .46 + H * .04 * eased) / scale;
    clip.setAttribute('transform', `scale(${scale}) rotate(${roll})`);
    glyph.setAttribute('transform', `translate(${Math.cos(radians) * dx + Math.sin(radians) * dy - cx} ${-Math.sin(radians) * dx + Math.cos(radians) * dy - cy})`);
    // Drop the clip only after the camera has already filled the viewport with ink.
    field.style.clipPath = t >= 1 ? 'none' : `url(#${clipId})`;
    // The letters start as solid ink. Partway in (FIELD_RISE_START of the
    // camera move), the field's contents rise into the letter from the
    // bottom of the screen, arriving in place just as the letter fills it.
    // Starts moving at once and eases into place (ease-out); the first photo
    // begins right at the bottom edge rather than below it.
    const x = clamp((t - FIELD_RISE_START) / (1 - FIELD_RISE_START));
    const rise = 1 - (1 - x) ** 3;
    field.toggleAttribute('data-gp-open', t >= FIELD_RISE_START);
    if (fieldInner) fieldInner.style.transform = rise < 1 ? `translateY(${(1 - rise) * (H - fieldLead)}px)` : '';
    // Hand over to the real content the moment the camera move ends — the
    // content's margin (see style.css) puts it exactly over the field then.
    section.dataset.gpEntered = String(isStatic || t >= 0.999);
    // rise: 0 → 1 as the field's contents rise into place (1 when static)
    const reportedRise = isStatic ? 1 : rise;
    if (p !== lastProgress || reportedRise !== lastRise) {
      lastProgress = p; lastRise = reportedRise;
      onProgress?.(p, { rise: reportedRise });
    }
  };

  const layout = () => {
    if (!section.clientWidth) return;
    W = pin.clientWidth;
    // A 100svh probe keeps browser chrome from continually changing the scroll distance.
    const smallViewport = section.querySelector('[data-gp-viewport]').offsetHeight;
    H = Math.max(1, Math.min(root?.clientHeight ?? smallViewport, smallViewport));
    section.style.setProperty('--gp-height', `${H}px`);
    travel = H * length;
    art.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (fontDirty) { ready = readInk(); fontDirty = false; }
    if (!ready) return;
    startScale = Math.min(W * 0.84 / bounds.width, H * .38 / bounds.height);
    // The whole viewport fits inside measured ink, even with the small camera bank.
    endScale = target ? Math.max(startScale, Math.hypot(W, H) / (target.radius * 1.35)) : startScale;
    // Distance from the top of the field's contents to its first image, so
    // the rise starts with that image at the bottom edge of the screen
    const firstImage = fieldInner?.querySelector('img');
    fieldLead = firstImage ? Math.min(H - 1, firstImage.getBoundingClientRect().top - fieldInner.getBoundingClientRect().top) : 0;
    section.dataset.gpReady = 'true';
    section.dataset.gpMotion = !motion.matches && browserFrameSeen && !stalled && target ? 'on' : 'off';
  };

  const frame = (time) => {
    raf = 0;
    if (disposed) return;
    if (time !== undefined && !browserFrameSeen) {
      browserFrameSeen = true; stalled ||= performance.now() - mountedAt > 2500; dirty = true;
    }
    if (dirty) { dirty = false; layout(); }
    if (ready) paint(position());
  };
  const schedule = () => { if (!raf && active) raf = requestAnimationFrame(frame); };
  const resize = () => { cancelAnimationFrame(raf); dirty = true; frame(); };
  const scroll = () => schedule();

  const observer = new ResizeObserver(resize);
  observer.observe(section);
  if (root) observer.observe(root);
  const visibility = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) { dirty = true; schedule(); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { root, rootMargin: '100% 0px' });
  visibility.observe(section);
  (root ?? window).addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  motion.addEventListener('change', resize);
  frame();
  // WebKit can withhold frames behind an initial hung font. Enable motion only
  // when the browser starts rendering promptly.
  schedule();

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    visibility.disconnect();
    (root ?? window).removeEventListener('scroll', scroll);
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
    motion.removeEventListener('change', resize);
  };
}
