import logging
import os
import time

from db import get_db, init_db

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s"
)
logger = logging.getLogger("plox-worker")

POLL_INTERVAL = int(os.environ.get("PLOX_POLL_INTERVAL", "10"))


def process_pending():
    db = get_db()
    rows = db.execute(
        "SELECT id, username FROM data WHERE processed = 0 AND deleted_at IS NULL"
    ).fetchall()

    for row in rows:
        logger.info("[DRY-RUN] Would scrape x.com/%s/about", row["username"])


def run():
    init_db()
    logger.info("Plox worker started (DRY-RUN mode)")
    while True:
        try:
            process_pending()
        except Exception:
            logger.exception("Error in worker loop")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
