import os
import sqlite3

DATABASE = os.environ.get("PLOX_DB_PATH", "/data/plox.db")

def get_db_connection():
    conn = sqlite3.connect(DATABASE, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# Alias for backward compatibility
get_db = get_db_connection


def init_db():
    db = get_db_connection()
    try:
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
    finally:
        db.close()
