## Summary
<!-- What does this PR change, and why? -->

## Checklist
- [ ] Targets `staging` (never `main`; the release PR staging -> main is the owner's GO)
- [ ] `ruff check . && ruff format --check .`, `mypy`, `pytest` (coverage gate 90%) and `node --check` on the inline game script pass locally
- [ ] Game page still self-contained (no `<script src>`, no inline handlers, no third-party URLs); `[hidden]` fix kept
- [ ] New env vars added to `.env.example` (names only, no values)
- [ ] No secrets, tokens or hostnames-with-credentials in code, logs or tests
- [ ] Commits are GPG-signed
