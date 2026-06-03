import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

/**
 * The `docs` content collection loads all markdown from the ephemeral _ingest/
 * directory, which CI mounts at build time (rsync from engine repos into
 * _ingest/{engine}/). Content IDs take the form {engine}/page, and Starlight
 * generates the routes for them natively from this collection — no custom
 * catch-all route is needed.
 *
 * The glob `base` lives outside src/content/ on purpose: Astro forbids the glob
 * loader from reading files inside src/content/. `[^_]` skips underscore-prefixed
 * files/dirs (Astro treats them as private).
 */
export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/_ingest' }),
    schema: docsSchema(),
  }),
};
