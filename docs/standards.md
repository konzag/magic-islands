# Compliance with homelab-scripts `docs/app-standard.md` (STD-01..STD-22)

Status on 2026-10-13. "N/A" items carry their reason in `docs/ADR/0001-public-game-via-funnel.md`.

| STD | Topic | Status | Where |
|---|---|---|---|
| 01 | VM layout `/opt/<app>/` | infra (provision-apps) | `docs/deploy.md` |
| 02 | Package structure `app/{api,core,services}` | yes (no `db/`: no DB) | `app/` |
| 03 | Entry point `app.main:app`, wiring only | yes | `app/main.py` |
| 04 | uvicorn launch, 1 worker, fixed port 8087 | yes | `docs/deploy.md`, `Dockerfile` |
| 05 | Tests in `tests/`, `test_*.py` | yes | `tests/` |
| 06 | `pytest.ini` (markers, strict, asyncio auto) | yes | `pytest.ini` |
| 07 | Fixtures `client`, `mock_external_apis` (`db_session` N/A) | yes | `tests/conftest.py` |
| 08 | Coverage gate | 90 % (ratchet up only) | `pytest.ini`, `.coveragerc` |
| 09 | Deployment (atomic, health-checked, rollback) | infra auto-deploy | `docs/deploy.md` |
| 10 | Created from template-app | yes (DB/SOPS removed) | `README.md` § Origin |
| 11 | Secrets via SOPS | N/A: no secrets | ADR-0001 |
| 12 | structlog JSON, `service` field, no f-string logs | yes | `app/core/logging.py` |
| 13 | `/health/{live,ready,security}`; `/api/v1/` | yes; no business API | `app/api/health.py` |
| 14 | Error shape `{"error": {code, message, trace_id, details}}` incl. 404/405/422/500 | yes | `app/core/errors.py` |
| 15 | Alembic | N/A: no DB | ADR-0001 |
| 16 | Pre-commit (ruff + ruff-format, mypy strict, bandit, gitleaks) | yes (ruff-format instead of black, like the fleet) | `.pre-commit-config.yaml` |
| 17 | Branch protection | deferred (GitHub Free) → Option B auto-merge + owner GO | `.github/workflows/automerge.yml` |
| 18 | CI: ruff, mypy, pytest+cov, pip-audit, bandit, `node --check`; Security: bandit, gitleaks, trivy, semgrep, SBOM; actions pinned by SHA | yes (deploy = infra auto-deploy, as for the other Option B apps) | `.github/workflows/` |
| 19 | Dockerfile (non-root, HEALTHCHECK) + compose | yes (not used in prod) | `Dockerfile`, `docker-compose.yml` |
| 20 | PostgreSQL | N/A: no DB | ADR-0001 |
| 21 | SLOs (availability, p95, 5xx) | via `/metrics` (instrumentator) + blackbox | infra |
| 22 | DR | N/A: nothing to back up beyond git | ADR-0001 |

Fleet extras: `/version` + `app_build_info{version,commit}`, OpenTelemetry (off by default), strict security
headers, Cache-Control baseline, no Server header, Dependabot grouped (minor/patch) with a 7-day cooldown,
targeting `staging`.
