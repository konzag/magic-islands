# Security

Private homelab project: report problems to the owner directly (GitHub: @konzag), not in public issues.

This repo is a static game (one `index.html`). It is served by konzag/games-hub at `/magic-islands/` behind
that app's CSP: one inline script (hashed), no inline handlers, no network calls, no third-party resources.
The game keeps its progress only in the tablet's localStorage.
