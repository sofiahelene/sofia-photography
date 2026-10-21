import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { projects, gridColumns } from './src/projects.js';

// Everything in public/ is copied into the build, including full-size
// originals, the GRID duplicates and old unused folders. This removes from
// the build (never from public/) every file the site doesn't use, so the live
// site stays small. Files outside projects/ are kept only if listed here.
const KEEP_TOP_LEVEL = ['index.html', '404.html', 'CNAME', 'assets', 'projects',
  'DxBurst-Regular.otf', 'DxBurst-Smooth.otf', 'STAR-blue.png', 'images/etoileblanche.png'];
function pruneUnusedPlugin() {
  let outDir;
  return {
    name: 'prune-unused-public-files',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const used = new Set();
      const add = (folder, file) => used.add(path.normalize(`projects/${folder}/${file}`));
      for (const p of projects) {
        for (const photo of p.photos.flat()) add(p.folder, typeof photo === 'string' ? photo : photo.file);
      }
      for (const [slug, file] of gridColumns.flat()) add(projects.find(p => p.slug === slug).folder, file);

      const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : [full];
      });
      let removed = 0;
      for (const full of walk(outDir)) {
        const rel = path.relative(outDir, full);
        const keep = rel.startsWith(`projects${path.sep}`)
          ? used.has(path.normalize(rel))
          : KEEP_TOP_LEVEL.some(k => rel === k || rel.startsWith(k + path.sep));
        if (!keep) { fs.rmSync(full); removed++; }
      }
      // Tidy up folders left empty
      const prune = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) prune(path.join(dir, e.name));
        if (dir !== outDir && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
      };
      prune(outDir);
      const missing = [...used].filter(f => !fs.existsSync(path.join(outDir, f)));
      console.log(`prune: removed ${removed} unused files from ${outDir}`);
      if (missing.length) console.warn('prune: photos listed in projects.js but missing from public/:', missing);
    },
  };
}

function fontPreloadPlugin() {
  return {
    name: 'font-preload',
    transformIndexHtml: {
      enforce: 'post',
      transform(html, ctx) {
        if (!ctx.bundle) return html;
        const tags = Object.keys(ctx.bundle)
          .filter(f => f.endsWith('.woff2') && /inter-latin/.test(f))
          .map(f => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true, href: `/${f}` },
            injectTo: 'head',
          }));
        return { html, tags };
      },
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'docs',
  },
  plugins: [fontPreloadPlugin(), pruneUnusedPlugin()],
});
