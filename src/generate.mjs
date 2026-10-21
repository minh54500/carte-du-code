// One run: analyse the project, then write the Markdown map, the graph page and the JSON export.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, isAbsolute, relative } from 'node:path';
import { analyze } from './analyze.mjs';
import { renderMarkdown } from './render-md.mjs';
import { renderHtml } from './render-html.mjs';
import { i18n } from './i18n.mjs';

export function generate(root, cfg) {
  const { t, lang, html } = i18n(cfg.lang);
  const outDir = isAbsolute(cfg.out) ? cfg.out : join(root, cfg.out);
  // the output folder never maps itself, wherever it is
  const outRel = relative(root, outDir).replace(/\\/g, '/');
  const map = analyze(root, outRel && !outRel.startsWith('..') ? { ...cfg, ignore: [...cfg.ignore, `${outRel}/`] } : cfg, t);
  mkdirSync(outDir, { recursive: true });
  const date = new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const htmlPath = join(cfg.out, 'carte-du-code.html');
  const paths = { md: join(outDir, 'carte-du-code.md'), html: join(outDir, 'carte-du-code.html'), json: join(outDir, 'carte-du-code.json') };
  writeFileSync(paths.md, renderMarkdown(map, t, { date, htmlPath }));
  writeFileSync(paths.html, renderHtml(map, t, { date, lang, html }));
  if (cfg.json) writeFileSync(paths.json, JSON.stringify({
    name: map.name, kinds: map.kinds, generated: new Date().toISOString(), files: map.files,
    nodes: map.nodes.map(({ id, col, label, file, desc, badge, route, endpoint, uses }) => ({ id, col, label, file, desc, badge, route, endpoint, uses })),
    edges: map.edges, env: Object.fromEntries([...map.env].map(([k, v]) => [k, [...v]])), hosting: map.host,
  }, null, 2));
  return { map, paths, summary: t('cli.done', { nodes: map.nodes.length, edges: map.edges.length, kinds: map.kinds.join(', ') || '?' }) };
}
