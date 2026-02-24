import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeOverlayState } from '../../state/writer.js';

const ENGINE = { owner: 'test', repo: 'repo', ref: 'abc123' };

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'codex-writer-'));
  process.env.CODEX_STATE_DIR = tmp;
});

afterEach(async () => {
  delete process.env.CODEX_STATE_DIR;
  await rm(tmp, { recursive: true, force: true });
});

describe('writeOverlayState', () => {
  it('creates the state/ directory if it does not exist', async () => {
    const state = { lock: {}, manifest: {} };
    await writeOverlayState(ENGINE, 'virgil', state);
    expect(existsSync(join(tmp, 'state'))).toBe(true);
  });

  it('writes lock and manifest files with correct content', async () => {
    const state = { lock: { 'page-a': 'hash1' }, manifest: { 'page-a': 'page-a.og.png' } };
    await writeOverlayState(ENGINE, 'virgil', state);

    const lockRaw     = await readFile(join(tmp, 'state', 'virgil.lock.json'),     'utf-8');
    const manifestRaw = await readFile(join(tmp, 'state', 'virgil.manifest.json'), 'utf-8');

    expect(JSON.parse(lockRaw)).toEqual(state.lock);
    expect(JSON.parse(manifestRaw)).toEqual(state.manifest);
  });

  it('overwrites existing state files on a second write', async () => {
    const first  = { lock: { 'page-a': 'hash1' }, manifest: { 'page-a': 'v1.png' } };
    const second = { lock: { 'page-a': 'hash2' }, manifest: { 'page-a': 'v2.png' } };

    await writeOverlayState(ENGINE, 'virgil', first);
    await writeOverlayState(ENGINE, 'virgil', second);

    const lockRaw = await readFile(join(tmp, 'state', 'virgil.lock.json'), 'utf-8');
    expect(JSON.parse(lockRaw)).toEqual(second.lock);
  });

  it('namespaces files by tool name so different tools coexist', async () => {
    const virgilState  = { lock: { a: '1' }, manifest: { a: 'a.png' } };
    const loreleiState = { lock: { b: '2' }, manifest: { b: 'b.svg' } };

    await writeOverlayState(ENGINE, 'virgil',  virgilState);
    await writeOverlayState(ENGINE, 'lorelei', loreleiState);

    const virgilLock  = JSON.parse(await readFile(join(tmp, 'state', 'virgil.lock.json'),  'utf-8'));
    const loreleiLock = JSON.parse(await readFile(join(tmp, 'state', 'lorelei.lock.json'), 'utf-8'));

    expect(virgilLock).toEqual(virgilState.lock);
    expect(loreleiLock).toEqual(loreleiState.lock);
  });
});
