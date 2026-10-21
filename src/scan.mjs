// The files of the project: git's list when it is a repository (it already respects .gitignore),
// otherwise a walk that skips dependencies, builds and caches. Only code and the config files the map reads are kept.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const SKIP = /(^|\/)(node_modules|\.git|dist|build|build-cache|\.next|\.astro|\.svelte-kit|\.nuxt|\.output|\.vercel|\.netlify|\.turbo|coverage|\.venv|venv|env|__pycache__|\.pytest_cache|\.mypy_cache|graphify-out|_archive|vendor|Pods|DerivedData|\.build|docs\/carte|\.agents|\.claude|(?:tests?|__tests__|spec)\/fixtures|__fixtures__)(\/|$)/;
export const CODE = /\.(astro|tsx?|jsx?|mjs|cjs|mts|cts|svelte|vue|py|swift|html?|sql|sh|command|prisma)$/;
const CONFIG = /(^|\/)(package\.json|vercel\.json|netlify\.toml|wrangler\.toml|_headers|_redirects|tsconfig\.json|jsconfig\.json)$/;

const globToRe = (g) => new RegExp('(^|/)' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*').replace(/\/$/, '(/|$)') + (g.endsWith('/') ? '' : '($|/)'));

export function scan(root, ignore = []) {
  const extra = ignore.map(globToRe);
  let files = [];
  try {
    // quotePath off and NUL-separated: accented names (mentions-légales.astro) come back as they are
    files = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  } catch {
    const walk = (d) => {
      if (files.length > 50000) return; // a home folder or a disk, not a project
      let names = [];
      try { names = readdirSync(join(root, d)); } catch { return; }
      for (const n of names) {
        const p = d ? `${d}/${n}` : n;
        if (SKIP.test(p)) continue;
        let s; try { s = statSync(join(root, p)); } catch { continue; }
        if (s.isDirectory()) walk(p); else files.push(p);
      }
    };
    walk('');
  }
  const kept = files.filter((f) => !SKIP.test(f) && !extra.some((re) => re.test(f)) && (CODE.test(f) || CONFIG.test(f)));
  const set = new Set(kept);
  const has = (f) => set.has(f) || (!SKIP.test(f) && existsSync(join(root, f)) && statSync(join(root, f)).isFile());
  const cache = new Map();
  const read = (f) => { if (!cache.has(f)) { try { cache.set(f, readFileSync(join(root, f), 'utf8').replace(/\r\n?/g, '\n')); } catch { cache.set(f, ''); } } return cache.get(f); };
  const json = (f) => { try { return JSON.parse(read(f).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1')); } catch { return null; } };
  return { files: kept, has, read, json };
}
