import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Pulls the WhittakerTech brand theme (tokens.css) + a product's logo out of
 * the Brand package (`@whittakertech/brand`, see its README → "CDN layout")
 * into Codex's ephemeral _brand/ trees, mirroring how _ingest/ is mounted at
 * build time. Never commit the output — it's regenerated per build.
 *
 * Brand's CDN (brand.whittakertech.com) isn't live yet (roadmap 0.3.0), so
 * `source` also accepts a local path to a checked-out brand repo (its `dist/`
 * after `npm run build`) for dev/hatchery use today.
 */
export interface BrandFetchArgs {
  /** Product slug to resolve a per-product logo for (e.g. "midas"). */
  product: string;
  /** Brand CDN root (e.g. https://brand.whittakertech.com) or a local `dist/` path. */
  source: string;
}

interface BrandManifest {
  version: string;
  global: Record<string, string>;
  products: Record<string, Record<string, string>>;
}

const isUrl = (source: string) => /^https?:\/\//.test(source);

async function readManifest(source: string): Promise<BrandManifest> {
  if (isUrl(source)) {
    const res = await fetch(`${source.replace(/\/$/, '')}/manifest.json`);
    if (!res.ok) throw new Error(`brand manifest fetch failed: ${res.status} ${res.statusText}`);
    return res.json();
  }
  return JSON.parse(await readFile(join(source, 'manifest.json'), 'utf-8'));
}

async function readAsset(source: string, css: boolean, relPath: string): Promise<Buffer> {
  if (isUrl(source)) {
    const base = css ? 'css' : 'assets';
    const res = await fetch(`${source.replace(/\/$/, '')}/${base}/${relPath}`);
    if (!res.ok) throw new Error(`brand asset fetch failed (${relPath}): ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const base = css ? 'css' : 'assets';
  return readFile(join(source, base, relPath));
}

async function writeAsset(dest: string, data: Buffer): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, data);
}

/**
 * Resolve the product's logo/logo-mark from the manifest, falling back to the
 * global asset when the product has no dedicated entry. Returns which key was
 * used for each, for logging.
 */
function resolveLogoPaths(manifest: BrandManifest, product: string) {
  const productAssets = manifest.products[product] ?? {};
  const logo = productAssets.logo ?? manifest.global.logo;
  const logoMark = productAssets['logo-mark'] ?? manifest.global['logo-mark'];
  return {
    logo: { path: logo, source: productAssets.logo ? product : 'global' },
    logoMark: { path: logoMark, source: productAssets['logo-mark'] ? product : 'global' },
  };
}

/**
 * Fetch tokens.css + the product's resolved logo/mark into
 * `<cwd>/astro/src/styles/_brand/tokens.css` and `<cwd>/astro/src/assets/_brand/*.svg`.
 */
export async function fetchBrand(
  args: BrandFetchArgs,
  cwd: string = process.cwd()
): Promise<{ version: string; logoSource: string; logoMarkSource: string }> {
  const manifest = await readManifest(args.source);
  const { logo, logoMark } = resolveLogoPaths(manifest, args.product);

  const stylesDir = join(cwd, 'astro', 'src', 'styles', '_brand');
  const assetsDir = join(cwd, 'astro', 'src', 'assets', '_brand');

  const tokensCss = await readAsset(args.source, true, 'tokens.css');
  await writeAsset(join(stylesDir, 'tokens.css'), tokensCss);

  const wordmark = await readAsset(args.source, false, logo.path);
  await writeAsset(join(assetsDir, 'wordmark.svg'), wordmark);

  const mark = await readAsset(args.source, false, logoMark.path);
  await writeAsset(join(assetsDir, 'mark.svg'), mark);

  return { version: manifest.version, logoSource: logo.source, logoMarkSource: logoMark.source };
}

// CLI: node dist/tools/brand/fetch.js --product <slug> --source <url-or-path>
if (import.meta.url === `file://${process.argv[1]}`) {
  const opts: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const match = argv[i].match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) continue;
    opts[match[1]] = match[2] ?? argv[++i] ?? '';
  }
  if (!opts.product || !opts.source) {
    console.error('usage: fetch --product <slug> --source <url-or-path>');
    process.exit(1);
  }
  fetchBrand({ product: opts.product, source: opts.source })
    .then(({ version, logoSource, logoMarkSource }) => {
      console.log(
        `[codex] brand ${version}: logo=${logoSource} logo-mark=${logoMarkSource}`
      );
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
