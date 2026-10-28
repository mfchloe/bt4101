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

The Flask server runs at `http://127.0.0.1:5001`. Check that it is responding at `http://127.0.0.1:5001/health`; it should return `{"status":"ok"}`.

## Run the frontend

Open a second terminal from the repository root and run:

```sh
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173/`.

Keep both terminals running while using the app. Stop either server with `Ctrl+C`.

## Podcast audio (optional)

Podcast scripts can be turned into audio with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), a free text-to-speech model that runs locally. Download its two model files (about 120 MB) once, from the repository root:

```sh
mkdir -p backend/tts_models
cd backend/tts_models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

Without them, the rest of the app works, but "Create audio" on a generated podcast shows an error.
