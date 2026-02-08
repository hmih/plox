from flask import Flask, request, jsonify

from db import get_db, init_db

app = Flask(__name__)


@app.before_request
def ensure_db():
    init_db()


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


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
        db.execute(
            "INSERT INTO data (username, processed) VALUES (?, 0)",
            (username,),
        )
        db.commit()
        return jsonify({"username": username, "processed": False, "location": None})

    if row["processed"]:
        return jsonify(
            {
                "username": row["username"],
                "processed": True,
                "location": row["location"],
            }
        )

    return jsonify({"username": row["username"], "processed": False, "location": None})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
