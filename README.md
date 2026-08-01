# Codex

The centralized documentation compiler and publisher for the WhittakerTech ecosystem.

Codex is not a documentation generator, site theme, or build helper.
It accepts structured content from engine repositories, orchestrates publishing tools, compiles a static site via Astro, and deploys to each engine's `gh-pages` branch.

---

## Pipeline

```
Engine repos  →  Codex compilation  →  Overlay state  →  gh-pages deployment
  (source)          (astro/ tools/)    (source/* branches)   (static HTML)
```

Each engine gets an orphan overlay branch (`source/{owner}/{repo}`) that persists minimal publishing state between runs.

---

## Repository Layout

```
codex/
├─ astro/              # Astro + Starlight static site
├─ tools/              # Publishing tool orchestration (TypeScript)
│  ├─ virgil/          # OG images, sitemap, robots.txt
│  ├─ lorelei/         # Mermaid graph rendering
│  └─ index.ts         # Tool entrypoint
├─ state/              # Overlay state schema, loader, writer
├─ tests/              # Vitest unit tests
├─ .codex_artifacts    # Declares paths allowed in overlay branches
└─ .github/workflows/publish_docs.yml
```

`astro/src/_ingest/` and `astro/dist/` are ephemeral — never committed.

---

## Commands

```bash
# Tools layer
npm install          # install dev dependencies
npm run build        # tsc compile
npm run lint         # ESLint (0 errors expected)
npm test             # Vitest

# Astro site
npm install --prefix astro
npm run dev --prefix astro
npm run build --prefix astro

# Build an engine's docs into astro/dist (local docs path → unified Starlight site)
npm run preview:build -- --engine midas --src ~/apps/midas/docs
```

---

## Hatchery preview

Codex unifies documentation **style** across the ecosystem (Ruby/YARD + Node/TypeDoc)
into one Starlight presentation. The hatchery preview renders engine docs through
that pipeline so the unified style can be validated before an engine cuts over —
it does not publish docs (engines already ship their own, e.g. midas.whittakertech.com).
It's named after Codex itself, not any one engine, since that's what it's actually
previewing.

One command builds and serves it:

```bash
bin/codex-preview <engine> <docs-path>
# e.g.
bin/codex-preview midas ~/apps/midas/docs
# → https://codex.hatchery.whittakertech.com
```

It mounts the local docs into `_ingest/`, normalizes frontmatter, runs `astro build`
(canonical URL defaults to `codex.hatchery.whittakertech.com`), then serves
`astro/dist` via nginx behind Traefik (`docker compose up -d`). The
`*.hatchery.whittakertech.com` wildcard already provides DNS + TLS + tunnel routing,
so only the Traefik router is added.

One build lives in `astro/dist` at a time. Re-run the command (with a different
`--engine`/docs path, or after docs change) to rebuild — the bind-mounted `dist`
needs no restart. Tear down with `docker compose down`.

---

## Architecture

Full design rationale: [`ARCH.md`](ARCH.md)
