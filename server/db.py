import os
import sqlite3

DATABASE = os.environ.get("PLOX_DB_PATH", "/data/plox.db")

_connection = None


def get_db():
    global _connection
    if _connection is None:
        _connection = sqlite3.connect(DATABASE)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA journal_mode=WAL")
    return _connection


_initialized = False


def init_db():
    global _initialized
    if _initialized:
        return
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            processed INTEGER NOT NULL DEFAULT 0,
            location TEXT,
            created_at TIMESTAMP DEFAULT (datetime('now')),
            updated_at TIMESTAMP DEFAULT (datetime('now')),
            deleted_at TIMESTAMP
        )
    """
    )
    db.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_data_username
        ON data(username) WHERE deleted_at IS NULL
    """
    )
    db.commit()
    _initialized = True
