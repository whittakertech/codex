# Codex Architecture

Codex is the documentation publishing authority for the WhittakerTech ecosystem.

It is not a documentation generator.  
It is not a site theme.  
It is not a build helper.

Codex is a stateful documentation compiler and publisher.

---

# 1. Purpose

Codex exists to:

- Publish documentation for all WhittakerTech repositories.
- Standardize presentation across engines.
- Orchestrate publishing tools (Virgil, Lorelei, future tools).
- Maintain incremental publishing state.
- Deploy static documentation sites.

Codex does **not** own source code.
Codex does **not** own API documentation generation.
Codex does **not** depend on engine language or framework.

---

# 2. System Overview

The documentation pipeline consists of four layers:

1. **Source Layer** – Engine repositories (Midas, Poly, Argus, etc.)
2. **Compilation Layer** – Codex (Astro + tool orchestration)
3. **State Layer** – Overlay branches (`source/{repo}`)
4. **Deployment Layer** – Engine `gh-pages` branches

Each layer has a strict responsibility boundary.

---

# 3. Responsibilities by Layer

## 3.1 Engine Repositories

Engines:

- Own code.
- Own handwritten documentation.
- Generate API documentation (e.g., YARD).
- Trigger Codex.

Engines do not:

- Run Astro.
- Manage publishing tools.
- Persist publishing state.
- Define site structure.

Generated documentation (e.g., `docs/api/`) may remain ephemeral and passed via CI artifacts.

---

## 3.2 Codex Repository

Codex owns:

- Astro configuration.
- Theme and layout (Starlight).
- Publishing workflows.
- Tool orchestration.
- Incremental publishing logic.
- Overlay state management.

Codex is language-agnostic.

Codex consumes structured documentation content and produces a static site.

---

## 3.3 Overlay Branches

For each engine repository, Codex maintains an overlay branch:

```
source/{owner}/{repo}
```

Example:

```
source/whittakertech/midas
```

Overlay branches:

- Are orphan branches (no shared history with `main`).
- Contain only allowed publishing state.
- Are machine-managed.
- Are not development branches.

Overlay branches persist only minimal tool state.

They are publishing state ledgers, not artifact stores.

---

## 3.4 Deployment Branches

Each engine repository owns a `gh-pages` branch.

Codex publishes static site output into this branch.

`gh-pages` contains:

- Fully built static HTML.
- Generated assets required for serving.
- No publishing state metadata.

---

# 4. Repository Structure (Codex)

```
codex/
├─ astro/
│  ├─ astro.config.mjs
│  ├─ package.json
│  ├─ src/
│  │  ├─ content/
│  │  │  └─ _ingest/        (gitignored)
│  │  ├─ layouts/
│  │  ├─ components/
│  │  └─ pages/
│  ├─ public/
│  │  └─ _generated/        (gitignored)
│  └─ dist/                 (ephemeral)
│
├─ tools/
│  ├─ virgil/
│  ├─ lorelei/
│  └─ index.ts
│
├─ state/
│  ├─ loader.ts
│  ├─ writer.ts
│  └─ schema.ts
│
├─ .codex_artifacts
└─ .github/workflows/publish_docs.yml
```

`_ingest/`, `_generated/`, and `dist/` are ephemeral.

They are never committed.

---

# 5. Publishing Lifecycle

## Step 1 – Engine Workflow

Engine CI:

1. Checkout.
2. Generate API documentation.
3. Upload generated docs as artifact.
4. Invoke Codex reusable workflow.

---

## Step 2 – Codex Workflow

Codex performs:

### A. Setup

- Checkout Codex.
- Shallow clone engine repository.
- Download documentation artifact.
- Restore overlay branch state.

### B. Ingestion

Mount engine content into:

```
astro/src/content/_ingest/{engine}/
```

Mount generated API docs.
Mount handwritten docs.
Mount public assets.

No source repo mutation occurs.

---

### C. Tool Orchestration

Each tool:

- Loads prior state from overlay.
- Inspects ingested content.
- Computes new state.
- Emits ephemeral output into Astro public directories.

Tool output must be deterministic.

---

### D. Astro Build

Astro compiles content into:

```
astro/dist/
```

This is the deployable static site.

---

### E. Persist State

Codex writes updated tool state into:

```
state/
```

Codex commits only paths declared in `.codex_artifacts`.

Overlay branches may contain less than declared paths but never more.

Deleted state files must be deleted in the branch.

History retains prior states via Git.

---

### F. Deployment

Codex:

- Replaces contents of engine `gh-pages`.
- Commits built static site.
- Pushes.

---

# 6. `.codex_artifacts`

`.codex_artifacts` is the inverse of `.gitignore`.

It defines:

- What Codex is allowed to write into overlay branches.

It does not define:

- Required files.
- Completeness guarantees.

Overlay branches may contain any subset of declared paths, but nothing outside them.

Example:

```
state/
```

---

# 7. Tool Contract

Each Codex tool must:

- Be deterministic.
- Accept prior state.
- Produce new state.
- Persist only minimal necessary data.
- Avoid storing derived binaries unless unavoidable.

Tool state must be namespaced under:

```
state/{tool_name}.json
```

---

# 8. Determinism

Codex must be deterministic given:

- Engine repository commit.
- Generated documentation artifact.
- Previous overlay state.
- Codex version.

Generated artifacts (e.g., images) should be reproducible.

Overlay branches store state, not large binaries, whenever possible.

---

# 9. Design Principles

1. Engines own content.
2. Codex owns compilation.
3. Overlay owns publishing state.
4. `gh-pages` owns deployment.
5. State is minimal.
6. Builds are deterministic.
7. No developer machine authority.
8. Clear separation of responsibilities.
9. Overlay branches are machine-managed.
10. Codex remains language-agnostic.

---

# 10. Conceptual Model

Codex is a documentation compiler.

Input:
- Engine source + documentation content.
- Tool state from overlay.

Process:
- Tool orchestration.
- Site compilation.

Output:
- Updated publishing state.
- Static site deployment.

Codex is infrastructure.

It is not documentation itself.

---

# 11. Future Extensions

Codex may support:

- Cross-engine search indexing.
- Ecosystem-wide navigation.
- Versioned documentation builds.
- Multi-engine aggregation.
- Additional publishing tools.

Overlay branches scale per-engine.

Codex main branch evolves publishing infrastructure independently.

---

# 12. Summary

Codex is the centralized documentation publisher for WhittakerTech.

It:

- Compiles.
- Orchestrates.
- Persists minimal state.
- Publishes static sites.

It does not:

- Own source code.
- Generate API documentation.
- Store large derived artifacts unnecessarily.
- Blur responsibility boundaries.

Codex is a platform.

And it exists to make documentation consistent, deterministic, and durable across the entire ecosystem.
