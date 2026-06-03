import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const DOC_EXTENSIONS = new Set(['.md', '.mdx']);

/**
 * Ensure every Markdown doc under `dir` carries Starlight frontmatter with a
 * `title` (Starlight's `docsSchema` requires one, and engine docs are typically
 * plain Markdown). Files that already declare a `title` are left untouched;
 * non-Markdown files (e.g. `CNAME`) are skipped. Idempotent.
 *
 * @returns the paths that were modified.
 */
export async function normalizeDir(dir: string): Promise<string[]> {
  const changed: string[] = [];
  for (const file of await listDocs(dir)) {
    if (await normalizeFile(file)) {
      changed.push(file);
    }
  }
  return changed;
}

/** Normalize a single doc in place; returns true if it was modified. */
export async function normalizeFile(path: string): Promise<boolean> {
  const original = await readFile(path, 'utf-8');
  if (hasFrontmatterTitle(original)) {
    return false;
  }
  const normalized = injectTitle(original, deriveTitle(original, path));
  await writeFile(path, normalized, 'utf-8');
  return true;
}

async function listDocs(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listDocs(full)));
    } else if (DOC_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function hasFrontmatterTitle(content: string): boolean {
  if (!content.startsWith('---')) {
    return false;
  }
  const end = content.indexOf('\n---', 3);
  if (end === -1) {
    return false;
  }
  return /^\s*title\s*:/m.test(content.slice(3, end));
}

function deriveTitle(content: string, path: string): string {
  const heading = stripFrontmatter(content).match(/^\s*#\s+(.+?)\s*$/m);
  if (heading?.[1]) {
    return heading[1].trim();
  }
  return titleCase(basename(path).replace(/\.(md|mdx)$/i, ''));
}

function injectTitle(content: string, title: string): string {
  const escaped = title.replace(/"/g, '\\"');
  if (/^---\r?\n/.test(content)) {
    // Existing frontmatter without a title: insert it as the first key.
    return content.replace(/^---\r?\n/, `---\ntitle: "${escaped}"\n`);
  }
  return `---\ntitle: "${escaped}"\n---\n\n${content}`;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) {
    return content;
  }
  const end = content.indexOf('\n---', 3);
  return end === -1 ? content : content.slice(end + 4);
}

function titleCase(name: string): string {
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// CLI: node dist/tools/ingest/normalize.js <ingest-dir>
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: normalize <ingest-dir>');
    process.exit(1);
  }
  normalizeDir(dir)
    .then((changed) => {
      console.log(`[codex] normalized ${changed.length} file(s)`);
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
