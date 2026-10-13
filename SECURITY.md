# Security

This is a private homelab project. Report problems to the owner directly (GitHub: @konzag); do not open
public issues.

Threat model and exposure decisions: `docs/ADR/0001-public-game-via-funnel.md`. In short, the page is public and
holds no data. The CSP allows only the page's own inline blocks by hash, with no network access. Every
non-game route is unreachable through the Funnel, and `/metrics` is restricted to the Prometheus host.
