// `carte init`: refresh the map after every git commit, keep the generated folder out of git,
// and (with --claude) tell Claude Code, in the project's CLAUDE.md, to read the map before searching files.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const START = '# carte-du-code-start', END = '# carte-du-code-end';

export function installHook(root, cfg, t, { claude = false } = {}) {
  const msgs = [];
  let gitDir = null;
  try { gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  if (!gitDir) msgs.push(t('cli.nogit'));
  else {
    const hooksDir = join(resolve(root, gitDir), 'hooks');
    mkdirSync(hooksDir, { recursive: true });
    const hook = join(hooksDir, 'post-commit');
    // a global `carte` command when there is one, else this very copy of the module
    const self = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'carte.mjs');
    const block = `${START}\n( if command -v carte >/dev/null 2>&1; then carte "$(git rev-parse --show-toplevel)" --quiet; elif [ -f "${self}" ]; then node "${self}" "$(git rev-parse --show-toplevel)" --quiet; fi ) >/dev/null 2>&1 &\n${END}\n`;
    let cur = existsSync(hook) ? readFileSync(hook, 'utf8') : '#!/bin/sh\n';
    cur = cur.replace(new RegExp(`${START}[\\s\\S]*?${END}\\n?`), '');
    writeFileSync(hook, cur.replace(/\n*$/, '\n') + block);
    chmodSync(hook, 0o755);
    msgs.push(t('cli.hook'));
  }
  const gi = join(root, '.gitignore');
  const g = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  const line = cfg.out.replace(/\/?$/, '/');
  if (!g.split('\n').some((l) => l.trim() === line || l.trim() === cfg.out)) writeFileSync(gi, g.replace(/\n*$/, g ? '\n' : '') + `\n# carte-du-code (regenerated)\n${line}\n`);
  if (claude) {
    const cm = join(root, 'CLAUDE.md');
    const text = existsSync(cm) ? readFileSync(cm, 'utf8') : '';
    const section = `<!-- carte-du-code -->\n## Code map\n\nBefore searching this project's files, refresh and read its map: \`carte --quiet\`, then \`${cfg.out}/carte-du-code.md\` (pages, blocks, data, database, server, tools, who uses what). If the \`carte\` MCP tools are connected, ask them instead: \`overview\`, \`item\`, \`who_uses\` (with deep before changing a shared file), \`path\`, \`search\`. Skip it for a small change in a file you already know.\n<!-- /carte-du-code -->\n`;
    const next = /<!-- carte-du-code -->[\s\S]*?<!-- \/carte-du-code -->\n?/.test(text) ? text.replace(/<!-- carte-du-code -->[\s\S]*?<!-- \/carte-du-code -->\n?/, section) : text.replace(/\n*$/, text ? '\n\n' : '') + section;
    writeFileSync(cm, next);
    msgs.push(t('cli.claude'));
  }
  return msgs;
}
