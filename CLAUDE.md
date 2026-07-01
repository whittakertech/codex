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
├─ astro/                   # Astro static site (Astro 6 + Starlight 0.39)
│  └─ src/
│     ├─ content.config.ts  # `docs` collection (glob loader → _ingest)
│     └─ _ingest/           # ephemeral — never committed
├─ tools/
│  ├─ index.ts              # tool orchestration entrypoint
│  ├─ ingest/normalize.ts   # frontmatter normalization for Starlight
│  ├─ preview/build.ts      # local docs build driver (mount + normalize + astro build)
│  ├─ virgil/               # planned publishing tool — not yet built
│  └─ lorelei/              # planned publishing tool — not yet built
├─ state/
│  ├─ loader.ts
│  ├─ writer.ts
│  └─ schema.ts
├─ bin/codex-preview        # hatchery preview harness (build + docker compose up)
├─ deploy/                  # nginx.conf for preview serving
├─ docker-compose.yml       # Traefik-integrated hatchery preview stack
├─ tests/                   # Vitest suites (state + tools)
├─ .codex_artifacts         # inverse .gitignore — defines allowed overlay content
└─ .github/workflows/publish_docs.yml
```

### Ephemeral Directories (never committed)

- `astro/src/_ingest/` — engine content mounted at build time
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

Node is pinned to **24.16.0** via `.tool-versions` (asdf). The global default may be
`nodejs system`, so activate asdf before running anything (CI keys off `.tool-versions`):

```bash
export ASDF_DATA_DIR="$HOME/.asdf"
export PATH="$ASDF_DATA_DIR/bin:$ASDF_DATA_DIR/shims:$PATH"
```

```bash
# Tools layer (tsc / ESLint / Vitest)
npm install
npm run build          # tsc
npm run lint           # ESLint (0 errors expected)
npm test               # Vitest

# Astro site (Astro 6 + Starlight 0.39)
npm install --prefix astro
npm run build --prefix astro

# Hatchery preview — build + serve one engine's docs in one command
bin/codex-preview midas ~/apps/midas/docs
# → https://midas.hatchery.whittakertech.com  (docker compose down to tear down)
```

> Starlight owns docs-collection routing — do **not** add a custom `[...slug].astro`.
> The sidebar is built explicitly from `_ingest` in `astro.config.mjs` (Starlight's
> `autogenerate` only walks `src/content/docs`).

---

## Implementation Status

The core pipeline is built and in use (refs #96–#100). `npm run build` (tsc),
`npm run lint` (ESLint, 0 errors), and `npm test` (Vitest) all pass.

**Working:**
- **Compilation (Astro)** — Astro 6 + Starlight 0.39 configured; `content.config.ts`
  glob loader, sidebar built from `_ingest` in `astro.config.mjs`, landing page that
  lists mounted engines. Builds successfully.
- **Compilation (tools)** — `tools/index.ts` orchestration CLI (`--owner/--repo/--ref`),
  `tools/ingest/normalize.ts` (frontmatter normalization), and `tools/preview/build.ts`
  (mount + normalize + `astro build`) implemented.
- **State** — `state/loader.ts`, `state/writer.ts`, `state/schema.ts` implemented and
  tested; overlay branches created on first run.
- **Deployment** — `.github/workflows/publish_docs.yml` is a complete reusable workflow
  (checkout → Node from `.tool-versions` → clone engine → download artifact → restore
  overlay state → mount into `_ingest/` → orchestrate → Astro build → persist state →
  deploy to engine `gh-pages`).
- **Hatchery preview** — `bin/codex-preview <engine> <docs-path>` works end-to-end
  (build + `docker compose` up behind Traefik).

**Not yet built (planned enhancements, not blockers):**
- `tools/virgil/` and `tools/lorelei/` do not exist. `tools/index.ts` registers no tools
  yet ("stub — no tools registered yet"); docs publish fine without them. To add one:
  create `tools/{name}/` per the tool contract above, import + invoke it in
  `tools/index.ts` after state load, and extend the state schema union if needed.