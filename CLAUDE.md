# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What Codex Is

Codex is the **centralized documentation compiler and publisher** for the WhittakerTech ecosystem. It is not a documentation generator, site theme, or build helper.

It accepts structured content from engine repositories, orchestrates publishing tools, compiles a static site via Astro, persists minimal state to overlay branches, and deploys to engine `gh-pages` branches.

---

## Architecture

### Four-Layer Pipeline

| Layer | Owner | Responsibility |
|---|---|---|
| **Source** | Engine repos (Midas, Poly, Argus…) | Code, handwritten docs, API doc generation |
| **Compilation** | Codex (`astro/`, `tools/`, `state/`) | Tool orchestration, Astro build |
| **State** | Overlay branches (`source/{owner}/{repo}`) | Minimal publishing state per engine |
| **Deployment** | Engine `gh-pages` branches | Fully-built static HTML |

### Repository Structure

```
codex/
├─ astro/                   # Astro static site (Starlight theme)
│  └─ src/
│     └─ content/_ingest/   # ephemeral — never committed
├─ tools/
│  ├─ virgil/               # publishing tool
│  ├─ lorelei/              # publishing tool
│  └─ index.ts              # tool orchestration entrypoint
├─ state/
│  ├─ loader.ts
│  ├─ writer.ts
│  └─ schema.ts
├─ .codex_artifacts         # inverse .gitignore — defines allowed overlay content
└─ .github/workflows/publish_docs.yml
```

### Ephemeral Directories (never committed)

- `astro/src/content/_ingest/` — engine content mounted at build time
- `astro/public/_generated/` — tool-emitted assets
- `astro/dist/` — Astro build output

### Overlay Branches

Each engine gets an orphan branch: `source/{owner}/{repo}` (e.g., `source/whittakertech/midas`). These are machine-managed and contain only paths declared in `.codex_artifacts`. Tool state lives at `state/{tool_name}.json` within these branches.

### Tool Contract

Every tool in `tools/` must:
- Be **deterministic** given the same inputs
- Accept prior state (loaded from overlay)
- Produce new state (written back to overlay)
- Persist only minimal data — no large derived binaries

---

## Build Commands

> **Note:** The implementation has not started. Commands below reflect the planned setup; add actual commands here as modules are scaffolded.

Expected once `astro/package.json` exists:

```bash
# Install dependencies
npm install --prefix astro

# Development server
npm run dev --prefix astro

# Production build
npm run build --prefix astro

# Lint / type-check (TypeScript tools)
npm run lint --prefix .
npx tsc --noEmit
```

---

## Implementation Status

The repository currently contains only `ARCH.md` and `.gitignore`. No source code has been written. When beginning implementation:

1. Scaffold `astro/` first (Astro + Starlight) — establishes the compilation layer.
2. Scaffold `state/` — schema and loader/writer before any tool uses state.
3. Implement tools under `tools/virgil/` and `tools/lorelei/` against the tool contract above.
4. Add `.codex_artifacts` declaring `state/` (and any other overlay-allowed paths).
5. Wire the GitHub Actions workflow in `.github/workflows/publish_docs.yml`.