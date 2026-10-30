from fastapi.testclient import TestClient

from loggingx_ai.config import Settings
from loggingx_ai.diagnosis import Diagnoser
from loggingx_ai.main import create_app
from tests.conftest import FakeChat, FakeLlm
from tests.test_stacktrace import JAVA


def client(**settings) -> TestClient:
    config = Settings(_env_file=None, **settings)
    return TestClient(create_app(config, Diagnoser(FakeLlm(), config), FakeChat(config)))


def test_diagnose_returns_camel_case():
    response = client().post("/api/v1/diagnoses", json={"logText": JAVA, "storeName": "shop"})
    assert response.status_code == 200
    body = response.json()
    assert body["rootCause"] and body["confidence"] == "high"
    assert body["promptTokens"] == 40 and len(body["steps"]) == 4


def test_api_key_required_when_configured():
    api = client(api_key="secret")
    assert api.post("/api/v1/diagnoses", json={"logText": JAVA}).status_code == 401
    ok = api.post("/api/v1/diagnoses", json={"logText": JAVA}, headers={"X-API-Key": "secret"})
    assert ok.status_code == 200


def test_stream_emits_agents_then_result():
    with client().stream("POST", "/api/v1/diagnoses/stream", json={"logText": JAVA}) as response:
        text = "".join(response.iter_text())
    events = [line.removeprefix("event: ") for line in text.splitlines() if line.startswith("event: ")]
    assert events[0] == "agent" and events[-2:] == ["result", "done"]


def test_health_lists_configured_providers():
    assert client(deepseek_api_key="k").get("/health").json()["providers"] == ["deepseek"]


def test_chat_defaults_to_first_configured_provider():
    response = client(qwen_api_key="k", qwen_model="qwen-plus").post("/api/v1/chat", json={"message": "hi"})
    assert response.status_code == 200
    assert response.json() == {"provider": "qwen", "model": "qwen-plus", "content": "echo: hi", "promptTokens": 3,
                               "completionTokens": 2}


def test_chat_uses_requested_provider_and_model():
    api = client(deepseek_api_key="k", qwen_api_key="k")
    body = api.post("/api/v1/chat", json={"provider": "QWEN", "model": "qwen-max", "message": "hi"}).json()
    assert (body["provider"], body["model"]) == ("qwen", "qwen-max")


def test_chat_rejects_unconfigured_provider():
    api = client(deepseek_api_key="k")
    assert api.post("/api/v1/chat", json={"provider": "qwen", "message": "hi"}).status_code == 400
    assert api.post("/api/v1/chat", json={"provider": "openai", "message": "hi"}).status_code == 400
    assert client().post("/api/v1/chat", json={"message": "hi"}).status_code == 400


def test_chat_stream_emits_deltas_then_result():
    with client(deepseek_api_key="k").stream("POST", "/api/v1/chat/stream", json={"message": "hi"}) as response:
        text = "".join(response.iter_text())
    events = [line.removeprefix("event: ") for line in text.splitlines() if line.startswith("event: ")]
    assert events == ["delta", "delta", "result", "done"]
    assert '"content": "echo: hi"' in text
