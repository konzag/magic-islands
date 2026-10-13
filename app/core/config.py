"""Settings: environment variables only. The app has no secrets (no DB, no tokens, no user data)."""

import ipaddress
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", env_ignore_empty=True)

    service_name: str = "magic-islands"
    environment: Literal["dev", "test", "prod", "staging"] = "dev"
    port: int = 8087
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # /metrics is served only to these socket peers (comma list of IPs/CIDRs): the Prometheus host (monitor).
    # Never through Tailscale Funnel or any proxy, whatever the peer (app/core/guards.py).
    metrics_allow_ips: str = "192.168.1.11"

    # OpenTelemetry (off unless OTEL_ENABLED=true)
    otel_enabled: bool = False
    otel_exporter_otlp_endpoint: str = Field(default="http://localhost:4317", min_length=1)

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper_level(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value

    @property
    def docs_enabled(self) -> bool:
        return self.environment not in ("prod", "staging")

    @property
    def metrics_networks(self) -> tuple[IPNetwork, ...]:
        """Parsed METRICS_ALLOW_IPS; invalid entries are dropped (fail closed: fewer peers, never more)."""
        nets: list[IPNetwork] = []
        for item in (p.strip() for p in self.metrics_allow_ips.split(",")):
            if not item:
                continue
            try:
                nets.append(ipaddress.ip_network(item, strict=False))
            except ValueError:
                continue
        return tuple(nets)


settings = Settings()
