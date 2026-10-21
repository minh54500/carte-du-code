// One run: analyse the project, then write the Markdown map, the graph page and the JSON export.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, isAbsolute, relative } from 'node:path';
import { analyze } from './analyze.mjs';
import { renderMarkdown } from './render-md.mjs';
import { renderHtml } from './render-html.mjs';
import { i18n } from './i18n.mjs';
import { index, diff } from './query.mjs';

// Analysis only, nothing written (also used by the MCP server).
export function mapOf(root, cfg, t = i18n(cfg.lang).t) {
  const outDir = isAbsolute(cfg.out) ? cfg.out : join(root, cfg.out);
  // the output folder never maps itself, wherever it is
  const outRel = relative(root, outDir).replace(/\\/g, '/');
  return analyze(root, outRel && !outRel.startsWith('..') ? { ...cfg, ignore: [...cfg.ignore, `${outRel}/`] } : cfg, t);
}

export function generate(root, cfg) {
  const { t, lang, html } = i18n(cfg.lang);
  const outDir = isAbsolute(cfg.out) ? cfg.out : join(root, cfg.out);
  const map = mapOf(root, cfg, t);
  mkdirSync(outDir, { recursive: true });
  const date = new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const htmlPath = join(cfg.out, 'carte-du-code.html');
  const paths = { md: join(outDir, 'carte-du-code.md'), html: join(outDir, 'carte-du-code.html'), json: join(outDir, 'carte-du-code.json') };
  // what changed since the previous run (its JSON), and the code's health
  let prev = null;
  try { prev = JSON.parse(readFileSync(paths.json, 'utf8')); } catch {}
  const changes = diff(prev, map);
  const health = index(map).health();
  const big = map.nodes.length > (cfg.condenseAbove ?? 400);
  const detailPath = join(outDir, 'carte-du-code-detail.md');
  if (big) writeFileSync(detailPath, renderMarkdown(map, t, { date, htmlPath, health, changes }));
  writeFileSync(paths.md, renderMarkdown(map, t, { date, htmlPath, health, changes, condensed: big, detail: join(cfg.out, 'carte-du-code-detail.md') }));
  writeFileSync(paths.html, renderHtml(map, t, { date, lang, html, root, health, changes }));
  if (cfg.json) writeFileSync(paths.json, JSON.stringify({
    name: map.name, kinds: map.kinds, generated: new Date().toISOString(), files: map.files,
    nodes: map.nodes.map(({ id, col, label, file, desc, badge, route, endpoint, uses, test, group }) => ({ id, col, label, file, desc, badge, route, endpoint, uses, test, group })),
    edges: map.edges, env: Object.fromEntries([...map.env].map(([k, v]) => [k, [...v]])), hosting: map.host,
    health: { unused: health.unused.map((n) => n.id), cycles: health.cycles.map((c) => c.map((n) => n.id)), sensitive: health.sensitive.map((x) => ({ id: x.n.id, dependents: x.count })) },
    changes,
  }, null, 2));
  return { map, paths, health, changes, summary: t('cli.done', { nodes: map.nodes.length, edges: map.edges.length, kinds: map.kinds.join(', ') || '?' }) };
}
