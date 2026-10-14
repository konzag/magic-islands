// The CSP that games-hub sends with every game page (games-hub app/services/catalog.py, page_csp).
// The tests serve the game with the same policy, so a CSP violation fails here before it reaches the hub.
import crypto from 'node:crypto';

const sha256 = (text) => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;

export function gameCsp(html, { saves = false } = {}) {
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => sha256(m[1]));
  return [
    "default-src 'none'",
    `script-src 'self' ${[...new Set(scripts)].join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "media-src 'self'",
    `connect-src ${saves ? "'self'" : "'none'"}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
