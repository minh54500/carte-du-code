// The Markdown map: what an AI assistant reads first, compact and grouped by column.
export const COLUMNS = ['page', 'bloc', 'data', 'db', 'server', 'tool'];
export const columnTitle = (col, web, t) => t(col === 'page' ? (web ? 'col.page' : 'col.entry') : `col.${col}`);

export function renderMarkdown(map, t, { date, htmlPath }) {
  const by = (col) => map.nodes.filter((n) => n.col === col).sort((a, b) => (a.route ?? a.label).localeCompare(b.route ?? b.label));
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const outOf = new Map(), inOf = new Map();
  for (const e of map.edges) { (outOf.get(e.from) || outOf.set(e.from, []).get(e.from)).push(byId.get(e.to)); (inOf.get(e.to) || inOf.set(e.to, []).get(e.to)).push(byId.get(e.from)); }
  const names = (list = [], max = 8) => { const u = [...new Set(list.map((n) => n.label))]; return u.slice(0, max).join(', ') + (u.length > max ? ` +${u.length - max}` : ''); };
  const L = [`# ${t('md.title', { name: map.name })}`, '', t('md.generated', { date, nodes: map.nodes.length, edges: map.edges.length, html: htmlPath }), t('md.kind', { kinds: map.kinds.join(' · ') || t('md.unknown') }), '', t('md.howto'), ''];
  for (const col of COLUMNS) {
    const list = by(col);
    if (!list.length) continue;
    L.push(`## ${columnTitle(col, map.web, t)} (${list.length})`, '');
    for (const n of list) {
      const o = outOf.get(n.id), i = inOf.get(n.id);
      const where = n.file && n.file !== n.label && !/^(table|rpc|model|bucket):/.test(n.id) ? ` \`${n.file}\`` : '';
      L.push(`- **${n.label}**${where}${n.desc ? ` : ${n.desc}` : ''}${n.badge ? ` [${n.badge}]` : ''}`);
      const rel = [o?.length ? `→ ${names(o)}` : '', i?.length ? `← ${names(i)}` : ''].filter(Boolean).join(' · ');
      if (rel) L.push(`  ${rel}`);
    }
    L.push('');
  }
  if (map.env.size) {
    L.push(`## ${t('md.env')}`, '');
    for (const [n, fs] of [...map.env].sort()) L.push(`- \`${n}\` ← ${[...fs].map((f) => byId.get(f)?.label || f).join(', ')}`);
    L.push('');
  }
  if (map.host.length) L.push(`## ${t('md.host')}`, '', ...map.host.map((h) => `- ${h}`), '');
  return L.join('\n');
}
