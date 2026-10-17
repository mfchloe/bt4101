import os

from flask import Flask
from flask_cors import CORS

from config import UPLOAD_DIR
from db import init_db
from routes.library import library_bp

app = Flask(__name__)
CORS(app)

os.makedirs(UPLOAD_DIR, exist_ok=True)
init_db()

# Each feature's routes live in routes/<feature>.py
app.register_blueprint(library_bp)


@app.route("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    # Port 5001 because macOS AirPlay Receiver already uses 5000
    app.run(debug=True, port=5001)
