// `carte live`: redraws the map each time a code file is saved, and the graph page in the browser reloads itself.
import { watch, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { join, isAbsolute } from 'node:path';
import { generate } from './generate.mjs';
import { i18n } from './i18n.mjs';
import { SKIP, CODE, scan } from './scan.mjs';

export function live(root, cfg, { port = 4747, open = true } = {}) {
  const { t } = i18n(cfg.lang);
  const outDir = isAbsolute(cfg.out) ? cfg.out : join(root, cfg.out);
  const html = join(outDir, 'carte-du-code.html');
  const clients = new Set();
  let timer = null;
  const rebuild = (why) => {
    try { generate(root, cfg); } catch (e) { console.error(e.message); return; }
    console.log(`${new Date().toLocaleTimeString()} ${t('cli.rebuilt')}${why ? ` (${why})` : ''}`);
    for (const res of clients) res.write('data: reload\n\n');
  };
  const reloader = '<script>new EventSource("/events").onmessage=()=>location.reload()</script>';
  const server = createServer((req, res) => {
    if (req.url === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': ok\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (!existsSync(html)) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(t('html.loading')); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(readFileSync(html, 'utf8').replace('</body>', `${reloader}</body>`));
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(t('cli.live', { root, url }));
    if (open) try { execFileSync(process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open', [url], { stdio: 'ignore' }); } catch {}
  });
  rebuild();
  const outRel = cfg.out.replace(/\/$/, '');
  try {
    watch(root, { recursive: true }, (_, file) => {
      if (!file) return;
      const f = String(file).replace(/\\/g, '/');
      if (SKIP.test(f) || f.startsWith(outRel) || !(CODE.test(f) || /(package|vercel|tsconfig)\.json$/.test(f))) return;
      clearTimeout(timer);
      timer = setTimeout(() => rebuild(f), 350);
    });
  } catch {
    // Linux before Node 20 cannot watch a whole tree: compare the files' dates every 3 seconds instead
    const stamp = () => scan(root, cfg.ignore).files.map((f) => { try { return statSync(join(root, f)).mtimeMs; } catch { return 0; } }).join();
    let last = stamp();
    setInterval(() => { const now = stamp(); if (now !== last) { last = now; rebuild(); } }, 3000);
  }
  return server;
}
