import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { fetchBrand } from '../../tools/brand/fetch.js';

describe('fetchBrand (local source)', () => {
  let tmp: string;
  let source: string;
  let cwd: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'codex-brand-'));
    source = join(tmp, 'brand-dist');
    cwd = join(tmp, 'codex');

    await mkdir(join(source, 'css'), { recursive: true });
    await writeFile(join(source, 'css', 'tokens.css'), ':root { --wt-color-brand: #3b5bdb; }\n');

    await mkdir(join(source, 'assets', 'v', '0.1.0', 'logo', 'midas'), { recursive: true });
    await writeFile(join(source, 'assets', 'v', '0.1.0', 'logo', 'wordmark.svg'), '<svg>global-logo</svg>');
    await writeFile(join(source, 'assets', 'v', '0.1.0', 'logo', 'mark.svg'), '<svg>global-mark</svg>');
    await writeFile(
      join(source, 'assets', 'v', '0.1.0', 'logo', 'midas', 'wordmark.svg'),
      '<svg>midas-logo</svg>'
    );

    await writeFile(
      join(source, 'manifest.json'),
      JSON.stringify({
        version: '0.1.0',
        global: { logo: 'v/0.1.0/logo/wordmark.svg', 'logo-mark': 'v/0.1.0/logo/mark.svg' },
        products: { midas: { logo: 'v/0.1.0/logo/midas/wordmark.svg' } },
      })
    );
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('resolves a product-specific logo but falls back to the global logo-mark', async () => {
    const result = await fetchBrand({ product: 'midas', source }, cwd);

    expect(result).toEqual({ version: '0.1.0', logoSource: 'midas', logoMarkSource: 'global' });
    expect(await readFile(join(cwd, 'astro', 'src', 'assets', '_brand', 'wordmark.svg'), 'utf-8')).toBe(
      '<svg>midas-logo</svg>'
    );
    expect(await readFile(join(cwd, 'astro', 'src', 'assets', '_brand', 'mark.svg'), 'utf-8')).toBe(
      '<svg>global-mark</svg>'
    );
    expect(await readFile(join(cwd, 'astro', 'src', 'styles', '_brand', 'tokens.css'), 'utf-8')).toContain(
      '--wt-color-brand'
    );
  });

  it('falls back to the global logo for a product with no dedicated entry', async () => {
    const result = await fetchBrand({ product: 'unknown-product', source }, cwd);

    expect(result.logoSource).toBe('global');
    expect(await readFile(join(cwd, 'astro', 'src', 'assets', '_brand', 'wordmark.svg'), 'utf-8')).toBe(
      '<svg>global-logo</svg>'
    );
  });
});
