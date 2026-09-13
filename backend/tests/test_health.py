from fastapi.testclient import TestClient

from app.main import app, allowed_origins

client = TestClient(app)


def test_health_returns_200_json():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "dapup-api"
    assert "version" in body


def test_health_needs_no_auth_or_external_services():
    # No Authorization header, no database, no network: still healthy.
    assert client.get("/health").status_code == 200


def test_allowed_origins_parses_comma_separated_env(monkeypatch):
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS", " https://www.dapup.space, https://dapup.space ,"
    )
    assert allowed_origins() == ["https://www.dapup.space", "https://dapup.space"]


def test_allowed_origins_defaults_to_none(monkeypatch):
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    assert allowed_origins() == []
