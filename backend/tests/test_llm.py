"""The model provider switch, with every provider faked: no network, no keys."""

import json
import logging
from types import SimpleNamespace

import boto3
import httpx
import pytest
from botocore.stub import Stubber

from app import llm
from app.llm import (
    AnthropicProvider, BedrockProvider, DeepSeekProvider, LLMError, Reply, complete, get_provider,
)

FAKE_KEY = "sk-test-not-a-real-key-000"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for var in ("LLM_PROVIDER", "LLM_MODEL", "DEEPSEEK_API_KEY", "ANTHROPIC_API_KEY", "AWS_REGION"):
        monkeypatch.delenv(var, raising=False)
    get_provider.cache_clear()
    yield
    get_provider.cache_clear()


# ---- DeepSeek ------------------------------------------------------------
def deepseek_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_deepseek_sends_an_openai_style_request_and_parses_the_reply():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": "Hello, DapUp!"}}],
            "usage": {"prompt_tokens": 12, "completion_tokens": 5},
        })

    provider = DeepSeekProvider(api_key=FAKE_KEY, model="deepseek-v4-pro", client=deepseek_client(handler))
    reply = provider.complete(system="Be brief.", user="Say hi", max_tokens=64)

    assert seen["url"] == "https://api.deepseek.com/chat/completions"
    assert seen["auth"] == f"Bearer {FAKE_KEY}"
    assert seen["body"] == {
        "model": "deepseek-v4-pro",
        "messages": [{"role": "system", "content": "Be brief."}, {"role": "user", "content": "Say hi"}],
        "max_tokens": 64,
    }
    assert reply == Reply(text="Hello, DapUp!", provider="deepseek", model="deepseek-v4-pro",
                          input_tokens=12, output_tokens=5)


def test_deepseek_omits_the_system_message_when_there_is_none():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": "hi"}}]})

    provider = DeepSeekProvider(api_key=FAKE_KEY, model="m", client=deepseek_client(handler))
    reply = provider.complete(system=None, user="Say hi")
    assert seen["body"]["messages"] == [{"role": "user", "content": "Say hi"}]
    assert seen["body"]["max_tokens"] == 1024
    assert reply.input_tokens is None and reply.output_tokens is None


def test_deepseek_error_mentions_the_status_but_never_the_key():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "Authentication Fails"}})

    provider = DeepSeekProvider(api_key=FAKE_KEY, model="m", client=deepseek_client(handler))
    with pytest.raises(LLMError) as excinfo:
        provider.complete(system=None, user="hi")
    assert "401" in str(excinfo.value)
    assert FAKE_KEY not in str(excinfo.value)
    assert isinstance(excinfo.value, RuntimeError)


# ---- Anthropic -----------------------------------------------------------
_RESPONSE = SimpleNamespace(
    content=[SimpleNamespace(type="text", text="Hello "), SimpleNamespace(type="thinking", text=None),
             SimpleNamespace(type="text", text="from Claude.")],
    usage=SimpleNamespace(input_tokens=20, output_tokens=7),
)


class FakeAnthropic:
    def __init__(self):
        self.calls = []
        self.messages = self

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return _RESPONSE


def test_anthropic_concatenates_text_blocks_and_passes_the_system_prompt():
    client = FakeAnthropic()
    provider = AnthropicProvider(api_key=FAKE_KEY, model="claude-opus-5", client=client)
    reply = provider.complete(system="Be brief.", user="Say hi", max_tokens=32)
    assert client.calls == [{
        "model": "claude-opus-5", "max_tokens": 32, "system": "Be brief.",
        "messages": [{"role": "user", "content": "Say hi"}],
    }]
    assert reply == Reply(text="Hello from Claude.", provider="anthropic", model="claude-opus-5",
                          input_tokens=20, output_tokens=7)


def test_anthropic_omits_system_when_none():
    client = FakeAnthropic()
    AnthropicProvider(api_key=FAKE_KEY, model="m", client=client).complete(system=None, user="hi")
    assert "system" not in client.calls[0]


def test_anthropic_default_client_has_a_bounded_timeout_and_no_retries(monkeypatch):
    import anthropic

    seen = {}

    def fake_client(**kwargs):
        seen.update(kwargs)
        return FakeAnthropic()

    monkeypatch.setattr(anthropic, "Anthropic", fake_client)
    AnthropicProvider(api_key=FAKE_KEY, model="m")
    assert seen == {"api_key": FAKE_KEY, "timeout": llm.TIMEOUT_SECONDS, "max_retries": 0}


# ---- Bedrock -------------------------------------------------------------
@pytest.fixture
def bedrock():
    client = boto3.client(
        "bedrock-runtime", region_name="us-west-2",
        aws_access_key_id="testing", aws_secret_access_key="testing",
    )
    with Stubber(client) as stub:
        yield client, stub
        stub.assert_no_pending_responses()


def test_bedrock_converse_with_system_and_usage(bedrock):
    client, stub = bedrock
    stub.add_response("converse", {
        "output": {"message": {"role": "assistant", "content": [{"text": "Hello via Bedrock."}]}},
        "stopReason": "end_turn",
        "usage": {"inputTokens": 9, "outputTokens": 4, "totalTokens": 13},
        "metrics": {"latencyMs": 100},
    }, expected_params={
        "modelId": "us.anthropic.claude-opus-5",
        "system": [{"text": "Be brief."}],
        "messages": [{"role": "user", "content": [{"text": "Say hi"}]}],
        "inferenceConfig": {"maxTokens": 16},
    })
    provider = BedrockProvider(model="us.anthropic.claude-opus-5", region="us-west-2", client=client)
    reply = provider.complete(system="Be brief.", user="Say hi", max_tokens=16)
    assert reply == Reply(text="Hello via Bedrock.", provider="bedrock", model="us.anthropic.claude-opus-5",
                          input_tokens=9, output_tokens=4)


def test_bedrock_omits_system_when_none(bedrock):
    client, stub = bedrock
    stub.add_response("converse", {
        "output": {"message": {"role": "assistant", "content": [{"text": "hi"}]}},
        "stopReason": "end_turn",
        "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
        "metrics": {"latencyMs": 1},
    }, expected_params={
        "modelId": "m",
        "messages": [{"role": "user", "content": [{"text": "Say hi"}]}],
        "inferenceConfig": {"maxTokens": 1024},
    })
    reply = BedrockProvider(model="m", region="us-west-2", client=client).complete(system=None, user="Say hi")
    assert reply.text == "hi"


# ---- the env switch ------------------------------------------------------
def test_unset_provider_means_not_configured():
    assert get_provider() is None
    assert complete("sys", "user") is None


def test_empty_provider_means_not_configured(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "")
    assert get_provider() is None


def test_deepseek_without_a_key_raises_and_logs_the_variable_name(monkeypatch, caplog):
    monkeypatch.setenv("LLM_PROVIDER", "deepseek")
    with caplog.at_level(logging.ERROR, logger="dapup.llm"), pytest.raises(LLMError, match="DEEPSEEK_API_KEY is not set"):
        get_provider()
    assert any("DEEPSEEK_API_KEY" in r.getMessage() for r in caplog.records)


def test_anthropic_without_a_key_raises(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    with pytest.raises(LLMError, match="ANTHROPIC_API_KEY is not set"):
        get_provider()


def test_unknown_provider_raises(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    with pytest.raises(LLMError, match="LLM_PROVIDER"):
        get_provider()


def test_deepseek_selected_with_its_default_model(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", FAKE_KEY)
    provider = get_provider()
    assert isinstance(provider, DeepSeekProvider)
    assert provider.model == "deepseek-v4-pro"
    assert get_provider() is provider  # cached


def test_anthropic_selected_with_its_default_model(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", FAKE_KEY)
    provider = get_provider()
    assert isinstance(provider, AnthropicProvider)
    assert provider.model == "claude-opus-5"


def test_bedrock_selected_with_its_default_model_and_region(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    provider = get_provider()
    assert isinstance(provider, BedrockProvider)
    assert provider.model == "us.anthropic.claude-opus-5"
    assert provider.client.meta.region_name == "us-west-2"


def test_llm_model_overrides_the_default(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("LLM_MODEL", "us.anthropic.claude-sonnet-5")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    provider = get_provider()
    assert provider.model == "us.anthropic.claude-sonnet-5"
    assert provider.client.meta.region_name == "us-east-1"


def test_complete_routes_through_the_configured_provider(monkeypatch):
    class Fake:
        def complete(self, *, system, user, max_tokens=1024):
            return Reply(text=f"{system}|{user}|{max_tokens}", provider="fake", model="m",
                         input_tokens=None, output_tokens=None)

    monkeypatch.setattr(llm, "get_provider", lambda: Fake())
    assert complete("s", "u", max_tokens=5).text == "s|u|5"
