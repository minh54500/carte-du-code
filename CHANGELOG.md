# Changelog

## 1.1.0 (2026-10-21)

- `carte mcp`: MCP server, so an AI assistant asks the map directly (`overview`, `search`, `item`, `who_uses`, `uses`, `path`, `health`) instead of reading the whole file.
- Code health in the map and the graph: files nobody imports, import cycles, sensitive files (most dependents).
- Changes since the previous map (new and gone items, links added and removed), shown in the Markdown and as green rings in the graph.
- Graph: folder bubbles for big projects (default above 600 files, click to open a folder), filters by column and for tests, Health and Changes panels, "Open in VS Code" links, a link to each item (`#n=…`), pinch zoom.
- Large projects (over 400 items): the Markdown is condensed by folder, every file is detailed in `carte-du-code-detail.md`.
- Monorepos (npm, yarn and pnpm workspaces): packages imported by name, routes named after their app.
- Django (models, urls.py), Drizzle, Firestore, Mongoose; Next.js layouts, SvelteKit layouts and load files, Nuxt layouts and server routes.
- The path between two items follows the real dependencies first (page → data → script → table).
- 17 tests on 8 small projects.

## 1.0.0 (2026-10-21)

- First release: `carte`, `carte live`, `carte init [--claude]`.
- Markdown map for AI assistants, HTML graph (brain and columns views, search, chain highlight, PNG export), JSON export.
- Astro, Next.js, SvelteKit, Nuxt, React Router, Vite, React, HTML; Python, Swift, shell scripts.
- Supabase / SQL migrations (tables, RLS, policies, security definer functions, format() loops, pg_cron, storage), Prisma.
- Vercel, Netlify, Supabase Edge functions; Express, Fastify, Flask, FastAPI routes; fetch calls to them.
- French and English. Barnes-Hut layout: 1,500 files ready in about 0.3 s.
