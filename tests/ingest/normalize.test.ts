import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { normalizeDir, normalizeFile } from '../../tools/ingest/normalize.js';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'codex-normalize-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('normalizeFile', () => {
  it('injects a title derived from the first H1 when frontmatter is absent', async () => {
    const file = join(tmp, 'index.md');
    await writeFile(file, '# WhittakerTech::Midas\n\nBody.\n');
    expect(await normalizeFile(file)).toBe(true);
    const out = await readFile(file, 'utf-8');
    expect(out).toBe('---\ntitle: "WhittakerTech::Midas"\n---\n\nBody.\n');
  });

  it('strips the leading H1 so Starlight does not render it twice', async () => {
    const file = join(tmp, 'index.md');
    await writeFile(file, '# WhittakerTech::Midas\n\nBody.\n');
    await normalizeFile(file);
    const out = await readFile(file, 'utf-8');
    expect(out).not.toContain('# WhittakerTech::Midas');
  });

  it('strips a trailing HTML anchor tag from the extracted title (YARD self-link heading)', async () => {
    const file = join(tmp, 'Taxonomy.md');
    await writeFile(
      file,
      '# Class WhittakerTech::Oscar::Taxonomy <a id="class-WhittakerTech-Oscar-Taxonomy"></a>\n\nBody.\n'
    );
    await normalizeFile(file);
    const out = await readFile(file, 'utf-8');
    expect(out).toMatch(/^---\ntitle: "Class WhittakerTech::Oscar::Taxonomy"\n---/);
    expect(out).not.toContain('<a id=');
  });

  it('falls back to a title-cased filename when there is no H1', async () => {
    const file = join(tmp, 'getting-started.md');
    await writeFile(file, 'Just prose, no heading.\n');
    await normalizeFile(file);
    expect(await readFile(file, 'utf-8')).toMatch(/title: "Getting Started"/);
  });

  it('leaves files that already declare a title untouched (idempotent)', async () => {
    const file = join(tmp, 'usage.md');
    const content = '---\ntitle: "Custom"\n---\n\n# Usage\n';
    await writeFile(file, content);
    expect(await normalizeFile(file)).toBe(false);
    expect(await readFile(file, 'utf-8')).toBe(content);
  });

  it('adds a title into existing frontmatter that lacks one', async () => {
    const file = join(tmp, 'x.md');
    await writeFile(file, '---\nsidebar_label: X\n---\n\n# X Page\n');
    await normalizeFile(file);
    expect(await readFile(file, 'utf-8')).toMatch(/^---\ntitle: "X Page"\nsidebar_label: X\n---/);
  });

  it('is a no-op when run twice', async () => {
    const file = join(tmp, 'index.md');
    await writeFile(file, '# Title Here\n');
    await normalizeFile(file);
    const once = await readFile(file, 'utf-8');
    expect(await normalizeFile(file)).toBe(false);
    expect(await readFile(file, 'utf-8')).toBe(once);
  });
});

describe('normalizeDir', () => {
  it('normalizes .md/.mdx recursively and skips non-doc files', async () => {
    await mkdir(join(tmp, 'api'), { recursive: true });
    await writeFile(join(tmp, 'index.md'), '# Home\n');
    await writeFile(join(tmp, 'api', 'ref.mdx'), '# Ref\n');
    await writeFile(join(tmp, 'CNAME'), 'midas.whittakertech.com\n');
    const changed = await normalizeDir(tmp);
    expect(changed).toHaveLength(2);
    // a non-doc file is left exactly as-is
    expect(await readFile(join(tmp, 'CNAME'), 'utf-8')).toBe('midas.whittakertech.com\n');
  });
});
