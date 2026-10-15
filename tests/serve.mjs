// Tiny stand-in for games-hub (copied from konzag/games-template), for the Playwright tests only (127.0.0.1, no dependencies):
//   /                         -> index.html with the hub's CSP (tests/hub-csp.mjs)
//   /static/fonts/comfortaa.css -> empty stylesheet (the real one lives in the hub)
//   anything else in the repo -> the file, if its type is a static web type
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameCsp } from './hub-csp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/static/fonts/comfortaa.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      return res.end('');
    }
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, rel);
    const type = TYPES[path.extname(file)];
    if (!file.startsWith(root + path.sep) || !type || rel.split('/').some((p) => p.startsWith('.') || p === 'tests' || p === 'node_modules' || p === 'app') || !fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    const body = fs.readFileSync(file);
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
    if (type.startsWith('text/html')) headers['Content-Security-Policy'] = gameCsp(body.toString('utf8'));
    res.writeHead(200, headers);
    res.end(body);
  })
  .listen(port, '127.0.0.1', () => console.log(`magic-islands test server on http://127.0.0.1:${port}`));
