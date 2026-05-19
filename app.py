import os
from typing import Any

import requests
from flask import Flask, jsonify, render_template, request


OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_WEB_SEARCH_URL = "https://ollama.com/api/web_search"
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "")
REQUEST_TIMEOUT = 60


app = Flask(__name__)


def fetch_json(method: str, url: str, **kwargs: Any) -> Any:
    response = requests.request(method, url, timeout=REQUEST_TIMEOUT, **kwargs)
    response.raise_for_status()
    return response.json()


def build_web_context(query: str) -> str:
    if not OLLAMA_API_KEY:
        raise RuntimeError("Missing OLLAMA_API_KEY for web search.")

    payload = {"query": query}
    headers = {"Authorization": f"Bearer {OLLAMA_API_KEY}"}
    data = fetch_json("POST", OLLAMA_WEB_SEARCH_URL, json=payload, headers=headers)
    results = data.get("results", [])

    if not results:
        return "No web results were returned."

    lines = ["Use the following web search results when they are relevant:"]
    for index, item in enumerate(results[:5], start=1):
        title = item.get("title", "Untitled")
        url = item.get("url", "")
        snippet = item.get("snippet", "")
        lines.append(f"{index}. {title}")
        if url:
            lines.append(f"   URL: {url}")
        if snippet:
            lines.append(f"   Snippet: {snippet}")
    return "\n".join(lines)


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.get("/api/models")
def get_models():
    try:
        data = fetch_json("GET", f"{OLLAMA_BASE_URL}/api/tags")
        models = data.get("models", [])
        return jsonify({"models": [{"name": model.get("name", "")} for model in models]})
    except requests.RequestException as exc:
        return jsonify({"error": f"Unable to reach Ollama at {OLLAMA_BASE_URL}: {exc}"}), 502


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    model = payload.get("model", "").strip()
    message = payload.get("message", "").strip()
    history = payload.get("history", [])
    enable_web_search = bool(payload.get("enableWebSearch"))
    think = payload.get("think")

    if not model:
        return jsonify({"error": "Model is required."}), 400
    if not message:
        return jsonify({"error": "Message is required."}), 400

    messages = []
    web_results = None

    if enable_web_search:
        try:
            web_results = build_web_context(message)
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "You may use the provided web search context to answer. "
                        "If the web context is insufficient, say so plainly."
                    ),
                }
            )
            messages.append({"role": "system", "content": web_results})
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 400
        except requests.RequestException as exc:
            return jsonify({"error": f"Web search request failed: {exc}"}), 502

    for item in history:
        role = item.get("role", "").strip()
        content = item.get("content", "").strip()
        if role in {"user", "assistant", "system"} and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})

    try:
        data = fetch_json(
            "POST",
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": model,
                "messages": messages,
                "think": think,
                "stream": False,
            },
        )
    except requests.RequestException as exc:
        return jsonify({"error": f"Chat request to Ollama failed: {exc}"}), 502

    reply = data.get("message", {}).get("content", "").strip()
    thinking = data.get("message", {}).get("thinking", "").strip()
    return jsonify({"reply": reply, "thinking": thinking, "webContext": web_results})


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
