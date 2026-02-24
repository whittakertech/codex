// CLI: node dist/tools/index.js --owner=X --repo=Y --ref=Z
import type { EngineRef } from '../state/schema.js';

function parseArgs(): EngineRef {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      parsed[match[1]] = match[2];
    }
  }

  const { owner, repo, ref } = parsed;
  if (!owner || !repo || !ref) {
    console.error('Usage: node dist/tools/index.js --owner=X --repo=Y --ref=Z');
    process.exit(1);
  }

  return { owner, repo, ref };
}

const engine = parseArgs();
console.log(`[codex] Orchestrating tools for ${engine.owner}/${engine.repo} @ ${engine.ref}`);
// When tools are added, each runs here in sequence and writes state via writer.ts.
console.log('[codex] Tool orchestration complete (stub — no tools registered yet)');
