import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

/**
 * The `docs` content collection loads all markdown from the ephemeral _ingest/ directory.
 * Content is mounted at build time by CI (rsync from engine repos into _ingest/{engine}/).
 * The glob loader reads _ingest/**\/*.{md,mdx} — content IDs take the form {engine}/docs/page.
 */
export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/_ingest' }),
    schema: docsSchema(),
  }),
};
