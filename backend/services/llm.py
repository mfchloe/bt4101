import base64
import json
import os
import re

import httpx
import json_repair
from dotenv import load_dotenv
from openai import OpenAI

from config import ENV_PATH

load_dotenv(ENV_PATH)

# School LLM service (OpenAI-compatible API)
client = OpenAI(
    api_key=os.environ["SOCLAAS_API_KEY"],
    base_url=os.environ["SOCLAAS_BASE_URL"],
    # Brief outages (502s, dropped connections) are retried twice with short
    # waits. The model can think for over a minute before its first word, so
    # allow 3 minutes of silence before giving up on a request.
    max_retries=2,
    timeout=httpx.Timeout(180, connect=15),
)
MODEL = "gemma4:26b" # can change later


def _complete(messages):
    """Run one chat request and return the reply text.

    Replies are streamed: the service cuts off any request that hasn't
    finished after 60 seconds ("502 provider request failed"), but a streamed
    reply keeps the connection alive, so long jobs such as transcribing a
    scanned page or marking with a checklist can finish.
    """
    stream = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0,  # same input -> same output, deterministic
        stream=True,
    )
    return "".join(
        chunk.choices[0].delta.content or ""
        for chunk in stream
        if chunk.choices
    )


def chat(prompt):
    """Send one prompt and return the reply text."""
    return _complete([{"role": "user", "content": prompt}])


def read_image(prompt, image_bytes, mime_type):
    """Send one prompt with an image (e.g. a scanned page) and return the reply text."""
    data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"
    return _complete([{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": data_url}},
        ],
    }])


def parse_json(reply):
    """Parse the JSON object in an LLM reply, ignoring any text around it.

    Models sometimes return almost-valid JSON (a trailing comma, a comment, a
    cut-off ending); json_repair fixes those instead of failing the request.
    """
    match = re.search(r"\{.*\}", reply, re.DOTALL)
    if not match:
        raise ValueError(f"LLM did not return JSON: {reply[:200]}")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        repaired = json_repair.loads(match.group(0))
        if not isinstance(repaired, dict) or not repaired:
            raise ValueError(f"LLM returned JSON that could not be repaired: {reply[:200]}")
        return repaired


def chat_json(prompt):
    """Like chat(), but parse the reply as JSON."""
    return parse_json(chat(prompt))
