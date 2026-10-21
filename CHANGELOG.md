# Changelog

## 1.2.0 (2026-10-21)

From running the map on real projects (an Astro + Supabase site, a Swift app, a toolkit of scripts).

- Supabase: each SQL function is linked to the tables it reads and writes and to the functions it calls; triggers link a table to the function they run, policies to the function they check; a pg_cron job to the tables its command touches. A page now reaches a table through a `security definer` function (`/prise-commande → loyalty_visit() → customers`).
- A function no longer takes the `security definer` of the next function in the same file; an `alter function … security definer` added later counts.
- Migrations written by `supabase db diff` or pg_dump (`create table "public"."orders"`) are read: before, they gave one false table named `public`.
- Files with the same name get as much of their folder as tells them apart (`data/ui`, `admin/ui`), or their extension when they share the folder (`Card.astro`, `Card.tsx`), in the map, the graph and the MCP answers. An MCP question on a shared name lists the candidates instead of answering about the first one; a file asked by its path (`server.js`, `lib/hours`) is the file itself, not the routes or models it declares, nor its test.
- A file's role is also read in the comment right under its imports (Swift's `///` above the type, a note after `import type …`), when it introduces the code (a declaration, an export, a blank line); not a comment above one constant, `// MARK:` or `#if`.
- Swift: types named only in comments or texts are no longer links; `extension Store` is part of Store's file; no import cycles (one module sees every type); "directly or not" stops at direct links between Swift files, so sensitive files are ranked by real use, except between a type and its extensions.
- Sensitive files show their direct users too, and ties go to the most used directly.
- Code health lists the files to describe first: the most used ones without a top comment.
- A script nobody imports that reads its command line (`process.argv`, `sys.argv`, a `#!` line) is a command, not a building block, and no longer "maybe unused".
- `docs/`, `examples/`, `brouillons/` and `drafts/` go to their own column, "Docs and drafts", out of the site's blocks.
- 23 tests on 9 small projects (Swift added).

## 1.1.1 (2026-10-21)

Fixes from a full code review of 1.1.0.

- Monorepos: no more crash on nested `"exports"` conditions (tsup, unbuild); subpath imports (`@repo/ui/button` through `"exports": { "./*": … }`), `$lib/` in a SvelteKit app of the workspace, `~/` and `@/` in Nuxt (and Nuxt 4's `app/` folder).
- "Maybe unused" leaves out the files the framework loads by itself: Django migrations, `admin.py`, `apps.py`; Next `_app`, `not-found`, `sitemap`…; SvelteKit hooks and `+error`; Astro content config; Nuxt auto-imported folders.
- Django routes carry the prefix of their `include()`; a route `/` no longer links every file that contains a slash.
- Windows line endings and accented file names (`mentions-légales.astro`) are read correctly.
- MCP server: a malformed line gets an error and the server goes on; batches; unknown tool and missing arguments as JSON-RPC errors; absolute and Windows paths understood; refuses a home folder or a whole disk.
- "Who uses" gives the same direction directly and with `deep`. Firestore is only looked for in Firebase projects.
- Graph: folder colours stay the same from one map to the next; compact bar and touch help on phones; labels no longer overlap; sensitive files leave tests out of the count.
- Faster on big projects (patterns built once; a 1,500-file import loop with 100 tables: 0.9 s → 0.3 s).
- A `.carterc.json` cannot send the output outside its project. VS Code links work for folders with `#` or `?`.

## 1.1.0 (2026-10-21)

- `carte mcp`: MCP server, so an AI assistant asks the map directly (`overview`, `search`, `item`, `who_uses`, `uses`, `path`, `health`) instead of reading the whole file.
- Code health in the map and the graph: files nobody imports, import cycles, sensitive files (most dependents).
- Changes since the previous map (new and gone items, links added and removed), shown in the Markdown and as green rings in the graph.
- Graph: folder bubbles for big projects (default above 600 files, click to open a folder), filters by column and for tests, Health and Changes panels, "Open in VS Code" links, a link to each item (`#n=…`), pinch zoom.
- Large projects (over 400 items): the Markdown is condensed by folder, every file is detailed in `carte-du-code-detail.md`.
- Monorepos (npm, yarn and pnpm workspaces): packages imported by name, routes named after their app.
- Django (models, urls.py), Drizzle, Firestore, Mongoose; Next.js layouts, SvelteKit layouts and load files, Nuxt layouts and server routes.
- The path between two items follows the real dependencies first (page → data → script → table).
- 17 tests on 8 small projects (18 since 1.1.1).

## 1.0.0 (2026-10-21)

- First release: `carte`, `carte live`, `carte init [--claude]`.
- Markdown map for AI assistants, HTML graph (brain and columns views, search, chain highlight, PNG export), JSON export.
- Astro, Next.js, SvelteKit, Nuxt, React Router, Vite, React, HTML; Python, Swift, shell scripts.
- Supabase / SQL migrations (tables, RLS, policies, security definer functions, format() loops, pg_cron, storage), Prisma.
- Vercel, Netlify, Supabase Edge functions; Express, Fastify, Flask, FastAPI routes; fetch calls to them.
- French and English. Barnes-Hut layout: 1,500 files ready in about 0.3 s.
