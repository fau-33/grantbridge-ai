"""Unit tests for the anti-SSRF guard in services.validate_public_url."""

from __future__ import annotations

import socket

import pytest

import services
from services import ServiceError, validate_public_url

PUBLIC_IP = "93.184.215.14"


def _fake_getaddrinfo(mapping: dict[str, list[str]]):
    def resolver(host, port, *args, **kwargs):
        if host not in mapping:
            raise socket.gaierror(f"unknown host {host}")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in mapping[host]]

    return resolver


@pytest.fixture(autouse=True)
def offline_dns(monkeypatch):
    """Keep DNS deterministic and offline."""
    monkeypatch.setattr(
        services.socket,
        "getaddrinfo",
        _fake_getaddrinfo(
            {
                "www.greengrants.org": [PUBLIC_IP],
                "rebind.attacker.example": ["10.0.0.5"],
                "mixed.attacker.example": [PUBLIC_IP, "169.254.169.254"],
            }
        ),
    )


def _assert_blocked(url: str) -> ServiceError:
    with pytest.raises(ServiceError) as exc_info:
        validate_public_url(url)
    assert exc_info.value.status_code == 422
    return exc_info.value


@pytest.mark.parametrize(
    "url",
    [
        "https://www.greengrants.org/grants",
        "http://www.greengrants.org:80/apply",
        "https://www.greengrants.org:443/apply?lang=en",
        f"https://{PUBLIC_IP}/call-for-proposals",
    ],
)
def test_allows_public_urls(url):
    assert validate_public_url(url) == url


def test_strips_surrounding_whitespace():
    assert validate_public_url("  https://www.greengrants.org/  ") == "https://www.greengrants.org/"


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://127.0.0.1:80/admin",
        "http://127.1.2.3/",
        "http://localhost/",
        "http://0.0.0.0/",
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
    ],
)
def test_blocks_loopback(url):
    _assert_blocked(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",
        "http://169.254.169.254/computeMetadata/v1/",
        "http://[::ffff:169.254.169.254]/",
        "http://metadata.google.internal/computeMetadata/v1/",
    ],
)
def test_blocks_cloud_metadata_endpoints(url):
    _assert_blocked(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://10.0.0.1/",
        "http://172.16.5.4/",
        "http://172.31.255.255/",
        "http://192.168.1.1/",
        "http://100.64.0.1/",
        "http://[fd00::1]/",
        "http://[fe80::1]/",
        "http://224.0.0.1/",
    ],
)
def test_blocks_private_and_reserved_ips(url):
    _assert_blocked(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://user:pass@www.greengrants.org/",
        "https://user@www.greengrants.org/",
        "https://:secret@www.greengrants.org/",
        "https://www.greengrants.org@127.0.0.1/",
    ],
)
def test_blocks_embedded_credentials(url):
    error = _assert_blocked(url)
    assert "credenciais" in error.message


@pytest.mark.parametrize(
    "url",
    [
        "http://db.internal/",
        "http://api.service.internal/health",
        "http://METADATA.GOOGLE.INTERNAL/",
        "http://router.internal./",
        "http://printer.local/",
        "http://app.localhost/",
        "http://1.0.0.127.in-addr.arpa/",
    ],
)
def test_blocks_internal_suffixes(url):
    error = _assert_blocked(url)
    assert "locais ou privadas" in error.message


@pytest.mark.parametrize(
    "url",
    [
        "ftp://www.greengrants.org/file",
        "file:///etc/passwd",
        "gopher://www.greengrants.org/",
        "javascript:alert(1)",
        "www.greengrants.org",
        "https://",
        "",
        "   ",
        "https://www.greengrants.org/" + "a" * 2048,
    ],
)
def test_blocks_invalid_scheme_or_shape(url):
    _assert_blocked(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://www.greengrants.org:8080/",
        "http://www.greengrants.org:22/",
        "http://www.greengrants.org:6379/",
    ],
)
def test_blocks_non_standard_ports(url):
    _assert_blocked(url)


def test_blocks_invalid_port():
    _assert_blocked("https://www.greengrants.org:99999/")


def test_blocks_hostname_resolving_to_private_ip():
    error = _assert_blocked("https://rebind.attacker.example/")
    assert "rede privada" in error.message


def test_blocks_hostname_when_any_record_is_private():
    _assert_blocked("https://mixed.attacker.example/")


def test_fails_closed_when_dns_cannot_resolve():
    error = _assert_blocked("https://does-not-exist.example/")
    assert "resolver" in error.message


def test_ingest_endpoint_rejects_ssrf_before_scraping(client, monkeypatch):
    import main

    async def must_not_scrape(_url):  # pragma: no cover - should never run
        raise AssertionError("Firecrawl must not be called for blocked URLs")

    monkeypatch.setattr(main, "scrape_with_firecrawl", must_not_scrape)

    response = client.post("/api/ingest-url", json={"url": "http://169.254.169.254/latest/meta-data/"})

    assert response.status_code == 422
    assert "detail" in response.json()
