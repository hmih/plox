import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import db as db_module  # noqa: E402
from app import app  # noqa: E402
from db import get_db, init_db  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db(tmp_path):
    db_path = str(tmp_path / "test.db")
    os.environ["PLOX_DB_PATH"] = db_path
    db_module.DATABASE = db_path
    with app.app_context():
        init_db()
    yield


@pytest.fixture
def client():
    with app.test_client() as c:
        yield c


def test_met_missing_username(client):
    resp = client.get("/met")
    assert resp.status_code == 400
    assert resp.json["error"] == "username parameter required"


def test_met_new_username(client):
    resp = client.get("/met?username=testuser")
    assert resp.status_code == 200
    data = resp.json
    assert data["username"] == "testuser"
    assert data["processed"] is False
    assert data["location"] is None


def test_met_idempotent(client):
    client.get("/met?username=testuser")
    resp = client.get("/met?username=testuser")
    data = resp.json
    assert data["processed"] is False

    db = get_db()
    count = db.execute(
        "SELECT COUNT(*) as c FROM data WHERE username = 'testuser'"
    ).fetchone()["c"]
    assert count == 1


def test_met_processed_username(client):
    with app.app_context():
        db = get_db()
        db.execute(
            "INSERT INTO data (username, processed, location) VALUES (?, 1, ?)",
            ("knownuser", "Germany"),
        )
        db.commit()

    resp = client.get("/met?username=knownuser")
    data = resp.json
    assert data["processed"] is True
    assert data["location"] == "Germany"


def test_met_normalizes_username(client):
    client.get("/met?username=TestUser")
    resp = client.get("/met?username=testuser")
    data = resp.json
    assert data["username"] == "testuser"
    assert data["processed"] is False
