// CLI: node dist/tools/index.js --owner=X --repo=Y --ref=Z
import type { EngineRef } from '../state/schema.js';

export function parseArgs(argv: string[]): EngineRef {
  const parsed: Record<string, string> = {};

  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      parsed[match[1]] = match[2];
    }
  }

  const { owner, repo, ref } = parsed;
  if (!owner || !repo || !ref) {
    throw new Error('Usage: node dist/tools/index.js --owner=X --repo=Y --ref=Z');
  }

  return { owner, repo, ref };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const engine = parseArgs(process.argv.slice(2));
    console.log(`[codex] Orchestrating tools for ${engine.owner}/${engine.repo} @ ${engine.ref}`);
    // When tools are added, each runs here in sequence and writes state via writer.ts.
    console.log('[codex] Tool orchestration complete (stub — no tools registered yet)');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
