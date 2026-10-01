import json
import os
import re

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# School LLM service (OpenAI-compatible API)
client = OpenAI(
    api_key=os.environ["SOCLAAS_API_KEY"],
    base_url=os.environ["SOCLAAS_BASE_URL"],
)
MODEL = "gemma4:26b" # can change later


def chat(prompt):
    """Send one prompt and return the reply text."""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,  # same input -> same output, deterministic
    )
    return response.choices[0].message.content


def chat_json(prompt):
    """Like chat(), but parse the reply as JSON (ignoring any text around it)."""
    reply = chat(prompt)
    match = re.search(r"\{.*\}", reply, re.DOTALL)
    if not match:
        raise ValueError(f"LLM did not return JSON: {reply[:200]}")
    return json.loads(match.group(0))
