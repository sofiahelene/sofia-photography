// ── Page templates for the SPA router ──────────────────────────────────────
import { projects, gridColumns, photoSrc } from './projects.js';
import { glyphPortalHTML } from './glyph-portal.js';

const t = (fr, en) => window.t(fr, en);
const tt = pair => t(pair[0], pair[1]);

// ── Landing grid: the chosen grid photos, in a random order ───────────────
// Every grid photo with its column (0–2) and its place in reading order
// (across the rows), which phones use when re-dealing into 2 columns
const gridEntries = () => {
  const rows = Math.max(...gridColumns.map(col => col.length));
  const out = [];
  for (let row = 0; row < rows; row++) {
    gridColumns.forEach((col, column) => {
      if (!col[row]) return;
      const [slug, file] = col[row];
      const project = projects.find(p => p.slug === slug);
      out.push({ project, folder: project.folder, file, column });
    });
  }
  return out;
};
export const LANDING_FONT = '"Inter Variable", Inter, sans-serif';

const photoImg = (folder, { file, fit }) =>
  `<img src="${photoSrc(folder, file)}" alt="" loading="lazy"${fit ? ' class="photo-fit"' : ''}>`;

const projectPage = (p) => () => `
    <div class="page page-inner proj-detail">
      <a class="proj-back" href="#home" data-page="home" data-to-grid>← ${t('Retour', 'Back')}</a>
      <div class="photo-stack">
        ${p.photos.map(photo => Array.isArray(photo)
          ? `<div class="photo-row">${photo.map(f => photoImg(p.folder, { file: f })).join('')}</div>`
          : photoImg(p.folder, typeof photo === 'string' ? { file: photo } : photo)
        ).join('')}
      </div>
    </div>`;

export const pages = {

  // ── HOME ─────────────────────────────────────────────────────────────────
  // Opens on SOFIA LUCAS in black on white. Scrolling flies into a letter
  // (glyph portal), through which the photo grid is seen, until the grid
  // fills the screen and takes over. The grid shows the photos listed in
  // gridColumns (projects.js); hovering a photo shows its
  // project's name and clicking opens that project.
  home: () => {
    const photos = gridEntries();
    const grid = (eager) => `
      <div class="landing-grid-wrap">
        <div class="landing-grid">
          ${photos.map(({ project, folder, file, column }) => `
          <a class="landing-item" href="#${project.slug}" data-page="${project.slug}" data-col="${column}">
            <img src="${photoSrc(folder, file)}" alt=""${eager ? '' : ' loading="lazy"'}>
            <span class="landing-caption">${tt(project.title)}</span>
          </a>`).join('')}
        </div>
      </div>`;
    return `
    <div class="page page-inner page-landing">
      ${glyphPortalHTML({
        word: 'SOFIA LUCAS',
        caption: 'Défiler pour découvrir',
        // The view through the letters is a copy of the grid's first screen,
        // so the hand-over to the real grid is seamless.
        field: grid(true),
        content: grid(true),
        fontFamily: LANDING_FONT,
        fontWeight: 900,
        scrollLength: 2.4,
      })}
    </div>`;
  },

  // ── PROJECT DETAIL PAGES (generated from projects.js) ────────────────────
  ...Object.fromEntries(projects.map(p => [p.slug, projectPage(p)])),

  // ── CONTACT ──────────────────────────────────────────────────────────────
  contact: () => `
    <div class="page page-inner page-contact">
      <div class="contact-split">
        <div class="contact-left">
          <h1 class="contact-heading">${t('Travaillons<br>ensemble', 'Let\'s work<br>together')}</h1>
          <p class="contact-intro">${t('Écrivez-moi un message et je vous répondrai.<br>Disponible pour du travail freelance en français et en anglais.', 'Send me a message and I\'ll get back to you.<br>Available for freelance work in French and English.')}</p>
          <div class="contact-details">
            <h3 class="contact-details-title">${t('Coordonnées', 'Contact details')}</h3>
            <ul class="contact-details-list">
              <li><span class="contact-detail-label">Email</span><a href="mailto:sofiahelenelucas@gmail.com" class="contact-detail-link">sofiahelenelucas@gmail.com</a></li>
              <li><span class="contact-detail-label">${t('Localisation', 'Location')}</span><span>Paris, France</span></li>
            </ul>
          </div>
          <div class="contact-socials">
            <a href="https://www.instagram.com/sofialucasdesign/" target="_blank" rel="noopener" class="contact-soc">INSTAGRAM</a>
            <a href="https://www.linkedin.com/in/sofiahelenelucas" target="_blank" rel="noopener" class="contact-soc">LINKEDIN</a>
          </div>
        </div>
        <div class="contact-right">
          <form class="contact-form" id="contact-form" action="https://formsubmit.co/sofiahelenelucas@gmail.com" method="POST">
            <input type="hidden" name="_subject" value="${t('Nouveau message — Sofia Lucas Photographie', 'New message — Sofia Lucas Photography')}">
            <input type="hidden" name="_captcha" value="false">
            <input type="hidden" name="_next" value="about:blank">
            <input type="hidden" name="_template" value="table">
            <div class="contact-form-row">
              <div class="contact-field">
                <label for="cf-prenom">${t('Prénom', 'First name')}</label>
                <input type="text" id="cf-prenom" name="prenom" placeholder="${t('Prénom', 'First name')}" required>
              </div>
              <div class="contact-field">
                <label for="cf-nom">${t('Nom', 'Last name')}</label>
                <input type="text" id="cf-nom" name="nom" placeholder="${t('Nom', 'Last name')}" required>
              </div>
            </div>
            <div class="contact-field">
              <label for="cf-email">Email</label>
              <input type="email" id="cf-email" name="email" placeholder="${t('votre@email.com', 'your@email.com')}" required>
            </div>
            <div class="contact-field">
              <label for="cf-sujet">${t('Sujet', 'Subject')}</label>
              <input type="text" id="cf-sujet" name="sujet" placeholder="${t('Sujet', 'Subject')}">
            </div>
            <div class="contact-field">
              <label for="cf-message">Message</label>
              <textarea id="cf-message" name="message" rows="5" placeholder="${t('Votre message…', 'Your message…')}" required></textarea>
            </div>
            <button type="submit" class="contact-submit" id="contact-submit">${t('Envoyer', 'Send')}</button>
            <p class="contact-success" id="contact-success" style="display:none;">${t('Message envoyé — merci !', 'Message sent — thank you!')}</p>
          </form>
        </div>
      </div>
    </div>
  `,
};
