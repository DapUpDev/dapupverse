"""One ask-the-model function, three providers behind an env switch.

Which model answers is decided by environment variables, not by code:

    LLM_PROVIDER   deepseek | anthropic | bedrock   (unset => not configured)
    LLM_MODEL      optional; each provider has a default below
    DEEPSEEK_API_KEY / ANTHROPIC_API_KEY   the key for the hosted APIs
    AWS_REGION     for Bedrock (default us-west-2); Bedrock needs no key,
                   the ECS task role is allowed to invoke Anthropic models

`complete(system, user)` is the one call the rest of the app makes. It
returns None when no provider is configured, so a missing switch never
crashes the worker; it raises LLMError when a configured provider fails.

Keys never reach the log: errors mention which variable is missing or
which status code came back, never the value. Prompt bodies are also kept
out of log lines (the callers log a short prefix at most).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Protocol

log = logging.getLogger("dapup.llm")

PROVIDERS = ("deepseek", "anthropic", "bedrock")
DEFAULT_MODELS = {
    "deepseek": "deepseek-v4-pro",
    "anthropic": "claude-opus-5",
    "bedrock": "us.anthropic.claude-opus-5",
}
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
TIMEOUT_SECONDS = 60


class LLMError(RuntimeError):
    """A provider is misconfigured or answered with an error."""


@dataclass(frozen=True)
class Reply:
    text: str
    provider: str
    model: str
    input_tokens: int | None
    output_tokens: int | None


class Provider(Protocol):
    def complete(self, *, system: str | None, user: str, max_tokens: int = 1024) -> Reply: ...


def _messages(system: str | None, user: str) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": system}] if system else []
    messages.append({"role": "user", "content": user})
    return messages


def _int_or_none(value: Any) -> int | None:
    return int(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


class DeepSeekProvider:
    """OpenAI-compatible chat completions over plain HTTPS."""

    name = "deepseek"

    def __init__(self, api_key: str, model: str, client=None) -> None:
        import httpx

        self.model = model
        self._headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        self.client = client or httpx.Client(timeout=TIMEOUT_SECONDS)

    def complete(self, *, system: str | None, user: str, max_tokens: int = 1024) -> Reply:
        body = {"model": self.model, "messages": _messages(system, user), "max_tokens": max_tokens}
        response = self.client.post(DEEPSEEK_URL, headers=self._headers, json=body)
        if response.status_code < 200 or response.status_code >= 300:
            raise LLMError(f"DeepSeek answered HTTP {response.status_code} for model {self.model}")
        try:
            data = response.json()
            text = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMError("DeepSeek answered with an unexpected body") from exc
        usage = data.get("usage") or {}
        return Reply(
            text=text or "", provider=self.name, model=self.model,
            input_tokens=_int_or_none(usage.get("prompt_tokens")),
            output_tokens=_int_or_none(usage.get("completion_tokens")),
        )


class AnthropicProvider:
    """The official anthropic SDK; imported lazily so the module loads
    without it (Bedrock and DeepSeek do not need it)."""

    name = "anthropic"

    def __init__(self, api_key: str | None, model: str, client=None) -> None:
        self.model = model
        if client is None:
            import anthropic

            # Bounded like the other two providers: the SDK's defaults are a
            # 10-minute read timeout and two retries, longer than the queue's
            # 5-minute visibility window, so a slow call could be billed twice.
            client = anthropic.Anthropic(api_key=api_key, timeout=TIMEOUT_SECONDS, max_retries=0)
        self.client = client

    def complete(self, *, system: str | None, user: str, max_tokens: int = 1024) -> Reply:
        kwargs: dict[str, Any] = {
            "model": self.model, "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": user}],
        }
        if system:
            kwargs["system"] = system
        response = self.client.messages.create(**kwargs)
        text = "".join(getattr(block, "text", "") for block in response.content if getattr(block, "type", "") == "text")
        usage = getattr(response, "usage", None)
        return Reply(
            text=text, provider=self.name, model=self.model,
            input_tokens=_int_or_none(getattr(usage, "input_tokens", None)),
            output_tokens=_int_or_none(getattr(usage, "output_tokens", None)),
        )


class BedrockProvider:
    """Anthropic models through Amazon Bedrock's Converse API, signed with
    the task role: no key to store or rotate."""

    name = "bedrock"

    def __init__(self, model: str, region: str, client=None) -> None:
        import boto3

        self.model = model
        self.client = client or boto3.client("bedrock-runtime", region_name=region)

    def complete(self, *, system: str | None, user: str, max_tokens: int = 1024) -> Reply:
        kwargs: dict[str, Any] = {
            "modelId": self.model,
            "messages": [{"role": "user", "content": [{"text": user}]}],
            "inferenceConfig": {"maxTokens": max_tokens},
        }
        if system:
            kwargs["system"] = [{"text": system}]
        response = self.client.converse(**kwargs)
        try:
            text = response["output"]["message"]["content"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("Bedrock answered with an unexpected body") from exc
        usage = response.get("usage") or {}
        return Reply(
            text=text, provider=self.name, model=self.model,
            input_tokens=_int_or_none(usage.get("inputTokens")),
            output_tokens=_int_or_none(usage.get("outputTokens")),
        )


def _require(var: str) -> str:
    value = os.getenv(var)
    if not value:
        log.error("%s is not set; LLM_PROVIDER=%s needs it", var, os.getenv("LLM_PROVIDER"))
        raise LLMError(f"{var} is not set")
    return value


@lru_cache
def get_provider() -> Provider | None:
    """None when LLM_PROVIDER is unset or empty. Raises LLMError for an
    unknown provider or a missing key (the log names the variable only)."""
    name = (os.getenv("LLM_PROVIDER") or "").strip().lower()
    if not name:
        return None
    if name not in PROVIDERS:
        raise LLMError(f"LLM_PROVIDER={name!r} is not one of {', '.join(PROVIDERS)}")
    model = (os.getenv("LLM_MODEL") or "").strip() or DEFAULT_MODELS[name]
    if name == "deepseek":
        return DeepSeekProvider(api_key=_require("DEEPSEEK_API_KEY"), model=model)
    if name == "anthropic":
        return AnthropicProvider(api_key=_require("ANTHROPIC_API_KEY"), model=model)
    return BedrockProvider(model=model, region=os.getenv("AWS_REGION", "us-west-2"))


def complete(system: str | None, user: str, max_tokens: int = 1024) -> Reply | None:
    """Ask the configured model; None when none is configured."""
    provider = get_provider()
    if provider is None:
        return None
    return provider.complete(system=system, user=user, max_tokens=max_tokens)
