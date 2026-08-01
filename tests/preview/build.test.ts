import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { defaultSiteUrl, mountDocs, parseArgs } from '../../tools/preview/build.js';

describe('parseArgs', () => {
  it('parses --engine/--src/--site-url in space form', () => {
    const a = parseArgs(['--engine', 'midas', '--src', '/docs', '--site-url', 'https://x.test']);
    expect(a).toEqual({ engine: 'midas', src: '/docs', siteUrl: 'https://x.test' });
  });

  it('parses --key=value form and leaves site-url undefined when omitted', () => {
    const a = parseArgs(['--engine=midas', '--src=/docs']);
    expect(a).toEqual({ engine: 'midas', src: '/docs', siteUrl: undefined });
  });

  it('throws on missing required flags', () => {
    expect(() => parseArgs(['--engine', 'midas'])).toThrow(/--src/);
    expect(() => parseArgs(['--src', '/docs'])).toThrow(/--engine/);
  });

  it('rejects an invalid engine slug', () => {
    expect(() => parseArgs(['--engine', 'bad/slug', '--src', '/docs'])).toThrow(/invalid engine slug/);
  });
});

describe('defaultSiteUrl', () => {
  it('targets the stable Codex hatchery preview host, regardless of engine', () => {
    expect(defaultSiteUrl('midas')).toBe('https://codex.hatchery.whittakertech.com');
    expect(defaultSiteUrl('oscar')).toBe('https://codex.hatchery.whittakertech.com');
  });
});

describe('mountDocs', () => {
  let tmp: string;
  let src: string;
  let ingestRoot: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'codex-preview-'));
    src = join(tmp, 'src-docs');
    ingestRoot = join(tmp, '_ingest');
    await mkdir(src, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('mounts docs into <ingestRoot>/<engine>/ and normalizes frontmatter', async () => {
    await writeFile(join(src, 'index.md'), '# Midas\n\nBody.\n');
    await writeFile(join(src, 'CNAME'), 'midas.whittakertech.com\n');
    const { dest, normalized } = await mountDocs({ engine: 'midas', src, ingestRoot });

    expect(dest).toBe(join(ingestRoot, 'midas'));
    expect(await readFile(join(dest, 'index.md'), 'utf-8')).toMatch(/^---\ntitle: "Midas"\n---/);
    // normalizer touches the .md, leaves the non-doc CNAME alone
    expect(normalized).toHaveLength(1);
    expect(await readFile(join(dest, 'CNAME'), 'utf-8')).toBe('midas.whittakertech.com\n');
  });

  it('clears stale content on re-mount (idempotent)', async () => {
    await writeFile(join(src, 'index.md'), '# Midas\n');
    await mountDocs({ engine: 'midas', src, ingestRoot });
    // a file that existed in a prior mount but not in src must not survive
    const dest = join(ingestRoot, 'midas');
    await writeFile(join(dest, 'stale.md'), '# Stale\n');
    await mountDocs({ engine: 'midas', src, ingestRoot });
    expect(existsSync(join(dest, 'stale.md'))).toBe(false);
  });

  it('clears a PRIOR engine entirely when mounting a different one', async () => {
    // Only one build lives in astro/dist at a time (matching production,
    // where each engine gets its own deployed site) -- a leftover engine
    // from an earlier run must not survive into the next one, since it'd
    // render under the new run's site-wide branding.
    await writeFile(join(src, 'index.md'), '# Midas\n');
    await mountDocs({ engine: 'midas', src, ingestRoot });
    expect(existsSync(join(ingestRoot, 'midas'))).toBe(true);

    const src2 = join(tmp, 'src-docs-2');
    await mkdir(src2, { recursive: true });
    await writeFile(join(src2, 'design.md'), '# Oscar\n');
    await mountDocs({ engine: 'oscar', src: src2, ingestRoot });

    expect(existsSync(join(ingestRoot, 'midas'))).toBe(false);
    expect(existsSync(join(ingestRoot, 'oscar'))).toBe(true);
  });

  it('promotes a lone doc file to index so the section root resolves', async () => {
    await writeFile(join(src, 'design.md'), '# Oscar Design\n\nBody.\n');
    const { dest } = await mountDocs({ engine: 'oscar', src, ingestRoot });

    expect(existsSync(join(dest, 'design.md'))).toBe(false);
    expect(await readFile(join(dest, 'index.md'), 'utf-8')).toMatch(/^---\ntitle: "Oscar Design"\n---/);
  });

  it('leaves multiple doc files alone (no promotion, no index required)', async () => {
    await writeFile(join(src, 'one.md'), '# One\n');
    await writeFile(join(src, 'two.md'), '# Two\n');
    const { dest } = await mountDocs({ engine: 'midas', src, ingestRoot });

    expect(existsSync(join(dest, 'one.md'))).toBe(true);
    expect(existsSync(join(dest, 'two.md'))).toBe(true);
    expect(existsSync(join(dest, 'index.md'))).toBe(false);
  });

  it('throws when the source path is missing', async () => {
    await expect(
      mountDocs({ engine: 'midas', src: join(tmp, 'nope'), ingestRoot })
    ).rejects.toThrow(/source docs path not found/);
  });
});
