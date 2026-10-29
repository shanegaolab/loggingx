import asyncio

import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from loggingx_ai.config import Settings
from loggingx_ai.llm import ChatClient, LlmError
from loggingx_ai.main import create_app
from loggingx_ai.schemas import ChatReply, ChatRequest


class Broken(GenericFakeChatModel):
    async def _astream(self, *args, **kwargs):
        raise RuntimeError("quota")
        yield  # pragma: no cover

    async def _agenerate(self, *args, **kwargs):
        raise RuntimeError("quota")


def chat_client(models: dict[str, object], **settings) -> ChatClient:
    config = Settings(_env_file=None, deepseek_api_key="d", qwen_api_key="q", **settings)
    client = ChatClient(config)
    client._chat = lambda spec: models[spec.provider]
    return client


def fake(text: str) -> GenericFakeChatModel:
    return GenericFakeChatModel(messages=iter([AIMessage(text, usage_metadata={
        "input_tokens": 7, "output_tokens": 3, "total_tokens": 10})]))


def test_complete_falls_back_to_the_other_provider():
    client = chat_client({"deepseek": Broken(messages=iter([])), "qwen": fake("你好")})
    reply = asyncio.run(client.complete(ChatRequest(message="hi")))
    assert (reply.provider, reply.content, reply.prompt_tokens) == ("qwen", "你好", 7)


def test_pinned_provider_has_no_fallback():
    client = chat_client({"deepseek": fake("a"), "qwen": Broken(messages=iter([]))})
    with pytest.raises(LlmError, match="qwen"):
        asyncio.run(client.complete(ChatRequest(message="hi", provider="qwen", model="qwen-max")))
    assert client.chat_candidates("qwen", "qwen-max")[0].model == "qwen-max"
    with pytest.raises(LlmError, match="未知"):
        client.chat_candidates("openai", None)


def test_stream_yields_text_then_reply():
    client = chat_client({"deepseek": fake("库存 为负"), "qwen": fake("x")})

    async def collect():
        return [item async for item in client.stream(ChatRequest(message="hi", system_prompt="s"))]

    items = asyncio.run(collect())
    assert "".join(item for item in items if isinstance(item, str)) == "库存 为负"
    assert isinstance(items[-1], ChatReply) and items[-1].content == "库存 为负"


def test_chat_endpoints():
    config = Settings(_env_file=None, deepseek_api_key="d")
    client = ChatClient(config)
    client._chat = lambda spec: fake("答案")
    api = TestClient(create_app(config, client=client))
    body = api.post("/api/v1/chat", json={"message": "hi", "systemPrompt": "s"}).json()
    assert body["content"] == "答案" and body["promptTokens"] == 7

    with api.stream("POST", "/api/v1/chat/stream", json={"message": "hi"}) as response:
        text = "".join(response.iter_text())
    events = [line.removeprefix("event: ") for line in text.splitlines() if line.startswith("event: ")]
    assert events[0] == "message" and events[-1] == "done"

    assert api.post("/api/v1/chat", json={"message": "hi", "provider": "qwen"}).status_code == 400
    assert api.post("/api/v1/chat/stream", json={"message": "hi", "provider": "qwen"}).status_code == 400

    client._chat = lambda spec: Broken(messages=iter([]))
    failed = api.post("/api/v1/chat", json={"message": "hi"})
    assert failed.status_code == 502 and "调用模型失败" in failed.json()["detail"]
