import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INGEST_DIR = join(__dirname, 'src', '_ingest');
const DOC_EXTS = new Set(['.md', '.mdx']);

/**
 * Build the sidebar from the docs mounted under _ingest/ at build time.
 *
 * Starlight's own `autogenerate` is hard-wired to walk `src/content/docs/`
 * (utils/navigation.ts strips that path from entry IDs), so it produces empty
 * groups for our custom glob loader rooted at _ingest/. We therefore enumerate
 * the mounted files ourselves and emit explicit `{ label, link }` items.
 *
 * Two mount shapes exist, and this branches on which one is present:
 * - _ingest/{engine}/{page} -- the shared hatchery preview (bin/codex-preview),
 *   which can hold multiple engines in one build. One sidebar group per
 *   engine subdir.
 * - _ingest/{page} directly -- external single-engine deploys
 *   (publish_docs.yml mounts at the ingest root, no subdir, since there's
 *   only ever one engine in that build -- see that workflow's step 7).
 *   Flat sidebar, no engine-level grouping.
 * Detected by whether _ingest/ contains loose doc files directly (root
 * mount) vs. only subdirectories (per-engine mount).
 *
 * Links must match the actual routes Astro's content collection generates
 * from file paths, which are lowercased by Astro's default slug derivation
 * -- YARD's generated API docs preserve Ruby's CamelCase class namespacing
 * (e.g. `WhittakerTech/Oscar/Taxonomy.md`), so links built from the raw file
 * path without lowercasing 404 against the real (lowercased) route.
 *
 * Returns an empty array if _ingest/ is absent (e.g. local dev without content).
 */
function buildSidebar() {
  if (!existsSync(INGEST_DIR)) return [];

  const entries = readdirSync(INGEST_DIR, { withFileTypes: true });
  const isRootMount = entries.some((e) => e.isFile() && DOC_EXTS.has(extname(e.name).toLowerCase()));

  if (isRootMount) {
    return buildSidebarItems(INGEST_DIR, '/');
  }

  return entries
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((engine) => ({
      label: titleCase(engine),
      items: buildSidebarItems(join(INGEST_DIR, engine), `/${engine}/`),
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

/**
 * Build sorted `{ label, link }` items for every doc under `root`, with
 * links prefixed by `prefix` (e.g. `/midas/` for a per-engine mount, `/`
 * for a root mount). Lowercased to match Astro's own slug derivation.
 */
function buildSidebarItems(root, prefix) {
  return listDocs(root)
    .map((file) => {
      const rel = relative(root, file).replace(/\.(md|mdx)$/i, '');
      const isIndex = rel === 'index' || rel.endsWith('/index');
      const path = isIndex ? rel.replace(/\/?index$/, '') : rel;
      const link = `${prefix}${path ? `${path}/` : ''}`.toLowerCase();
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
