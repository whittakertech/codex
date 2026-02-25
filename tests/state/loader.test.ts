import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadOverlayState } from '../../state/loader.js';

const ENGINE = { owner: 'test', repo: 'repo', ref: 'abc123' };
const TOOL   = 'virgil';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'codex-loader-'));
  process.env.CODEX_STATE_DIR = tmp;
});

afterEach(async () => {
  delete process.env.CODEX_STATE_DIR;
  await rm(tmp, { recursive: true, force: true });
});

describe('loadOverlayState', () => {
  it('returns null when no files exist', async () => {
    const result = await loadOverlayState(ENGINE, TOOL);
    expect(result).toBeNull();
  });

  it('returns state when both lock and manifest exist', async () => {
    const stateDir = join(tmp, 'state');
    await mkdir(stateDir, { recursive: true });

    const lock     = { 'page-a': 'hash1' };
    const manifest = { 'page-a': 'page-a.og.png' };

    await writeFile(join(stateDir, `${TOOL}.lock.json`),     JSON.stringify(lock),     'utf-8');
    await writeFile(join(stateDir, `${TOOL}.manifest.json`), JSON.stringify(manifest), 'utf-8');

    const result = await loadOverlayState(ENGINE, TOOL);
    expect(result).toEqual({ lock, manifest });
  });

  it('returns null when only the lock file exists', async () => {
    const stateDir = join(tmp, 'state');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, `${TOOL}.lock.json`), JSON.stringify({}), 'utf-8');

    const result = await loadOverlayState(ENGINE, TOOL);
    expect(result).toBeNull();
  });

  it('returns null when only the manifest file exists', async () => {
    const stateDir = join(tmp, 'state');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, `${TOOL}.manifest.json`), JSON.stringify({}), 'utf-8');

    const result = await loadOverlayState(ENGINE, TOOL);
    expect(result).toBeNull();
  });
});
