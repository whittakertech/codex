import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EngineRef, ToolState } from './schema.js';

const STATE_DIR = process.env.CODEX_STATE_DIR ?? './state-overlay';

/**
 * Write updated tool state to the local state-overlay directory.
 * CI commits this directory back to the overlay branch after the run.
 */
export async function writeOverlayState(
  _engine: EngineRef,
  tool: string,
  state: ToolState,
): Promise<void> {
  const stateDir = join(STATE_DIR, 'state');
  await mkdir(stateDir, { recursive: true });

  await Promise.all([
    writeFile(
      join(stateDir, `${tool}.lock.json`),
      JSON.stringify(state.lock, null, 2),
      'utf-8',
    ),
    writeFile(
      join(stateDir, `${tool}.manifest.json`),
      JSON.stringify(state.manifest, null, 2),
      'utf-8',
    ),
  ]);
}
