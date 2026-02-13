import sqlite3
from flask import Flask, request, jsonify, g

from db import get_db_connection, init_db

app = Flask(__name__)


def get_db():
    if "db" not in g:
        g.db = get_db_connection()
    return g.db


@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.before_request
def ensure_db():
    # In a real production app, you'd run this once at startup
    # but keeping it here for simplicity and consistency with original
    init_db()


@app.route("/met", methods=["GET"])
def met():
    username = request.args.get("username")
    if not username:
        return jsonify({"error": "username parameter required"}), 400

    username = username.strip().lower()

    db = get_db()
    row = db.execute(
        "SELECT id, username, processed, location FROM data "
        "WHERE username = ? AND deleted_at IS NULL",
        (username,),
    ).fetchone()

    if row is None:
        try:
            db.execute(
                "INSERT INTO data (username, processed) VALUES (?, 0)",
                (username,),
            )
            db.commit()
        except sqlite3.IntegrityError:
            # Handle race condition where another thread inserted it
            db.rollback()
            row = db.execute(
                "SELECT id, username, processed, location FROM data "
                "WHERE username = ? AND deleted_at IS NULL",
                (username,),
            ).fetchone()
            if row:
                return jsonify(
                    {
                        "username": row["username"],
                        "processed": bool(row["processed"]),
                        "location": row["location"],
                    }
                )

        return jsonify({"username": username, "processed": False, "location": None})

    return jsonify(
        {
            "username": row["username"],
            "processed": bool(row["processed"]),
            "location": row["location"],
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
