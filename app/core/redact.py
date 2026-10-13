"""Secret redaction for log lines and error strings shown in the UI.

Two layers: exact configured secret values (from Settings.secret_values()) and generic token shapes
(Authorization headers, PVE API tokens, GitHub PATs, Grafana service-account tokens, URL userinfo).
"""

import re
from collections.abc import Iterable

MASK = "***"

_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(?i)(authorization\s*[:=]\s*)(bearer|basic|token)?\s*[^\s,;\"']+"), MASK),
    (re.compile(r"(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}"), MASK),
    (re.compile(r"PVEAPIToken=[^\s,;\"']+"), MASK),
    (re.compile(r"\b(ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{10,}"), MASK),
    (re.compile(r"\bglsa_[A-Za-z0-9_]{10,}"), MASK),
    (re.compile(r"(://)[^/\s:@]+:[^/\s@]+@"), r"\1" + MASK + "@"),
)


def redact(text: str, secrets: Iterable[str] = ()) -> str:
    """Return `text` with every known secret value and token-looking string masked."""
    out = text
    for secret in secrets:
        if secret and len(secret) >= 4:
            out = out.replace(secret, MASK)
    for pattern, replacement in _PATTERNS:
        out = pattern.sub(replacement, out)
    return out
