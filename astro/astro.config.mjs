import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INGEST_DIR = join(__dirname, 'src', '_ingest');
const DOC_EXTS = new Set(['.md', '.mdx']);

/**
 * Build the sidebar from the engine docs mounted under _ingest/ at build time.
 *
 * Starlight's own `autogenerate` is hard-wired to walk `src/content/docs/`
 * (utils/navigation.ts strips that path from entry IDs), so it produces empty
 * groups for our custom glob loader rooted at _ingest/. We therefore enumerate
 * the mounted files ourselves and emit explicit `{ label, link }` items — links
 * match the routes Starlight generates from the `docs` collection (entry id
 * `{engine}/page` → `/{engine}/page/`, with `index` collapsing to the dir root).
 *
 * Returns an empty array if _ingest/ is absent (e.g. local dev without content).
 */
function buildSidebar() {
  if (!existsSync(INGEST_DIR)) return [];

  return readdirSync(INGEST_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((engine) => ({
      label: titleCase(engine),
      items: sidebarItemsFor(engine),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Reading-order tiers: overview, then onboarding, then topic/how-to guides
 * (the bulk of most engines' docs, alphabetical among themselves since we
 * can't know their names up front), then deep reference, then changelog
 * last. Keyed by the doc's top-level path segment (its filename, or its
 * parent directory name for nested files like `api/foo.md`).
 */
const SIDEBAR_TIERS = {
  index: 0,
  installation: 1,
  'getting-started': 1,
  quickstart: 1,
  setup: 1,
  architecture: 3,
  api: 4,
  changelog: 5,
};
const DEFAULT_TIER = 2;

function tierFor(rel) {
  const stem = rel.split('/')[0].toLowerCase();
  return SIDEBAR_TIERS[stem] ?? DEFAULT_TIER;
}

/** Build sorted `{ label, link }` items for one engine directory. */
function sidebarItemsFor(engine) {
  const root = join(INGEST_DIR, engine);
  return listDocs(root)
    .map((file) => {
      const rel = relative(root, file).replace(/\.(md|mdx)$/i, '');
      const isIndex = rel === 'index' || rel.endsWith('/index');
      const path = isIndex ? rel.replace(/\/?index$/, '') : rel;
      const link = `/${engine}${path ? `/${path}` : ''}/`;
      return { label: docTitle(file), link, tier: tierFor(rel) };
    })
    .sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label))
    .map(({ label, link }) => ({ label, link }));
}

/** Recursively list .md/.mdx docs, skipping underscore-prefixed (private) names. */
function listDocs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listDocs(full));
    else if (DOC_EXTS.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

/** Read the frontmatter `title` (the normalizer guarantees one); fall back to the filename. */
function docTitle(file) {
  const src = readFileSync(file, 'utf-8');
  if (src.startsWith('---')) {
    const end = src.indexOf('\n---', 3);
    if (end !== -1) {
      const m = src.slice(3, end).match(/^\s*title\s*:\s*"?(.+?)"?\s*$/m);
      if (m) return m[1];
    }
  }
  return titleCase(file.replace(/.*\//, '').replace(/\.(md|mdx)$/i, ''));
}

function titleCase(name) {
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// CODEX_ENGINE_NAME is the product's display name (e.g. "Midas"), set per engine
// in CI/the preview harness alongside CODEX_SITE_URL. "Engine | Brand" per-site
// title (product leads so tabs stay distinguishable across engines when
// truncated) — falls back to the bare brand name when building without an
// engine mounted (e.g. local `astro dev`).
const engineName = process.env.CODEX_ENGINE_NAME;
const siteTitle = engineName ? `${engineName} | WhittakerTech` : 'WhittakerTech Docs';

// Brand theme + logo: tools/brand/fetch.ts (run by the preview harness / CI
// before `astro build`) writes the live brand tokens + product logo into
// src/styles/_brand/ and src/assets/_brand/. Fall back to the committed
// snapshots when nothing has been fetched yet, so `astro dev`/`astro build`
// never breaks on a missing file.
const brandTokensPath = existsSync(join(__dirname, 'src', 'styles', '_brand', 'tokens.css'))
  ? './src/styles/_brand/tokens.css'
  : './src/styles/brand-fallback.css';
const brandLogoPath = existsSync(join(__dirname, 'src', 'assets', '_brand', 'wordmark.svg'))
  ? './src/assets/_brand/wordmark.svg'
  : './src/assets/brand-fallback-logo.svg';

export default defineConfig({
  // CODEX_SITE_URL is set per engine in CI (e.g. https://whittakertech.github.io/midas)
  site: process.env.CODEX_SITE_URL ?? 'http://localhost:4321',
  integrations: [
    starlight({
      title: siteTitle,
      logo: { src: brandLogoPath },
      customCss: [brandTokensPath, './src/styles/theme.css'],
      sidebar: buildSidebar(),
    }),
  ],
});
