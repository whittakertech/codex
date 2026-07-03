import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { normalizeDir } from '../ingest/normalize.js';
import { fetchBrand } from '../brand/fetch.js';

/**
 * Local docs build driver — the dev-harness half of epic 0.2.0.
 *
 * Codifies the manual steps proven in #97 into one repeatable command: take an
 * engine slug + a LOCAL docs path, mount it into the ephemeral _ingest/ tree,
 * normalize the frontmatter, and run a clean `astro build`. Tool orchestration
 * (Virgil/Lorelei) is intentionally out of scope — docs-only, per epic 0.2.0.
 */
export interface PreviewArgs {
  /** Engine slug — also the _ingest/ subdir and the default hatchery subdomain. */
  engine: string;
  /** Local docs directory to mount (e.g. ~/apps/midas/docs). */
  src: string;
  /** Canonical site URL; defaults to the engine's hatchery host. */
  siteUrl?: string;
  /** Brand CDN root or a local `dist/` path; defaults to CODEX_BRAND_SOURCE or the CDN. */
  brandSource?: string;
}

const ENGINE_SLUG = /^[a-z0-9][a-z0-9_-]*$/i;
const DEFAULT_BRAND_SOURCE = 'https://brand.whittakertech.com';

/** Parse `--engine <slug> --src <path> [--site-url <url>] [--brand-source <url-or-path>]`. */
export function parseArgs(argv: string[]): PreviewArgs {
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const match = argv[i].match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) continue;
    opts[match[1]] = match[2] ?? argv[++i] ?? '';
  }
  if (!opts.engine) throw new Error('missing required --engine <slug>');
  if (!opts.src) throw new Error('missing required --src <path>');
  if (!ENGINE_SLUG.test(opts.engine)) {
    throw new Error(`invalid engine slug: ${opts.engine}`);
  }
  return {
    engine: opts.engine,
    src: opts.src,
    siteUrl: opts['site-url'],
    brandSource: opts['brand-source'],
  };
}

function titleCase(name: string): string {
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Clear and re-populate `<ingestRoot>/<engine>/` from `src`, then normalize.
 * Clearing first keeps the mount idempotent across re-runs. Returns the
 * destination and the list of files the normalizer touched.
 */
export async function mountDocs(opts: {
  engine: string;
  src: string;
  ingestRoot: string;
}): Promise<{ dest: string; normalized: string[] }> {
  const src = resolve(opts.src);
  if (!existsSync(src)) {
    throw new Error(`source docs path not found: ${src}`);
  }
  const dest = join(opts.ingestRoot, opts.engine);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true });
  const normalized = await normalizeDir(dest);
  return { dest, normalized };
}

/** Default canonical URL for an engine preview on the hatchery. */
export function defaultSiteUrl(engine: string): string {
  return `https://${engine}.hatchery.whittakertech.com`;
}

/** Mount + normalize the engine docs, then run `astro build` against them. */
export async function buildPreview(
  args: PreviewArgs,
  cwd: string = process.cwd()
): Promise<void> {
  const ingestRoot = join(cwd, 'astro', 'src', '_ingest');
  const { dest, normalized } = await mountDocs({
    engine: args.engine,
    src: args.src,
    ingestRoot,
  });
  console.log(`[codex] mounted ${args.engine} → ${dest} (normalized ${normalized.length} file(s))`);

  const brandSource = args.brandSource ?? process.env.CODEX_BRAND_SOURCE ?? DEFAULT_BRAND_SOURCE;
  try {
    const brand = await fetchBrand({ product: args.engine, source: brandSource }, cwd);
    console.log(
      `[codex] brand ${brand.version} (${brandSource}): logo=${brand.logoSource} logo-mark=${brand.logoMarkSource}`
    );
  } catch (err) {
    console.warn(
      `[codex] brand fetch skipped (${brandSource} unreachable) — using fallback theme: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const siteUrl = args.siteUrl ?? defaultSiteUrl(args.engine);
  const result = spawnSync('npm', ['run', 'build', '--prefix', 'astro'], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, CODEX_SITE_URL: siteUrl, CODEX_ENGINE_NAME: titleCase(args.engine) },
  });
  if (result.status !== 0) {
    throw new Error(`astro build failed (exit ${result.status ?? 'signal ' + result.signal})`);
  }
  console.log(`[codex] built ${args.engine} docs → astro/dist (site: ${siteUrl})`);
}

// CLI: node dist/tools/preview/build.js --engine <slug> --src <path> [--site-url <url>]
if (import.meta.url === `file://${process.argv[1]}`) {
  buildPreview(parseArgs(process.argv.slice(2))).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
