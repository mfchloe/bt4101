# FYP

## Prerequisites

- Python 3
- Node.js and npm

## Run the backend

From the repository root, open a terminal and run:

```sh
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

The Flask server runs at `http://127.0.0.1:5000`. Check that it is responding at `http://127.0.0.1:5000/health`; it should return `{"status":"ok"}`.

## Run the frontend

Open a second terminal from the repository root and run:

```sh
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173/`.

Keep both terminals running while using the app. Stop either server with `Ctrl+C`.