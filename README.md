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

`astro/src/content/_ingest/` and `astro/dist/` are ephemeral — never committed.

---

## Commands

```bash
# Tools layer
npm install          # install dev dependencies
npm run build        # tsc compile
npm run lint         # ESLint (0 errors expected)
npm test             # Vitest (12 tests)

# Astro site
npm install --prefix astro
npm run dev --prefix astro
npm run build --prefix astro
```

---

## Architecture

Full design rationale: [`ARCH.md`](ARCH.md)
