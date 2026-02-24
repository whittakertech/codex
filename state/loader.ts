import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { EngineRef, ToolState } from './schema.js';

const STATE_DIR = process.env.CODEX_STATE_DIR ?? './state-overlay';

/**
 * Load prior tool state from the local state-overlay directory.
 * CI populates this directory from the overlay branch before calling this.
 * Returns null if no prior state exists (first run).
 */
export async function loadOverlayState(
  _engine: EngineRef,
  tool: string,
): Promise<ToolState | null> {
  const lockPath     = join(STATE_DIR, 'state', `${tool}.lock.json`);
  const manifestPath = join(STATE_DIR, 'state', `${tool}.manifest.json`);

  if (!existsSync(lockPath) || !existsSync(manifestPath)) {
    return null;
  }

  const [lockRaw, manifestRaw] = await Promise.all([
    readFile(lockPath, 'utf-8'),
    readFile(manifestPath, 'utf-8'),
  ]);

  return {
    lock:     JSON.parse(lockRaw)     as Record<string, string>,
    manifest: JSON.parse(manifestRaw) as Record<string, string>,
  };
}
