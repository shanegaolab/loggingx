"""HTTP request and response bodies, camelCase on the wire like loggingx-java."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Confidence = Literal["high", "medium", "low"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CodeRef(CamelModel):
    """Code around a stack frame, as loggingx-java's CodeRepositories.CodeRef."""

    path: str
    start_line: int = Field(ge=1)
    focus_line: int = Field(default=0, ge=0)
    frame: str = ""
    text: str


class DiagnoseRequest(CamelModel):
    log_text: str = Field(min_length=1, max_length=100_000)
    store_id: int | None = None
    store_name: str | None = Field(default=None, max_length=200)
    host: str | None = Field(default=None, max_length=128)
    source: str | None = Field(default=None, max_length=255)
    time: datetime | None = None
    repo_commit: str | None = Field(default=None, max_length=64)
    # Code loggingx-java already took from the clone; when empty the service looks in repo_root/store-<storeId>.
    code_refs: list[CodeRef] = Field(default_factory=list, max_length=20)


class AgentStep(CamelModel):
    """One model call: which agent, which model, and what it cost."""

    agent: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    duration_ms: int = 0


class ChatTurn(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=50_000)


class ChatRequest(CamelModel):
    message: str = Field(min_length=1, max_length=100_000)
    system_prompt: str | None = Field(default=None, max_length=50_000)
    # Pins a provider (deepseek or qwen) and optionally its model; otherwise LOGGINGX_AI_CHAT_MODEL with fallback.
    provider: str | None = Field(default=None, max_length=32)
    model: str | None = Field(default=None, max_length=128)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class ChatReply(CamelModel):
    provider: str
    model: str
    content: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class DiagnoseResponse(CamelModel):
    """Fields match loggingx-java's ai_diagnosis columns so the result can be stored as is."""

    summary: str
    root_cause: str
    suggestion: str
    diff: str | None
    confidence: Confidence
    error_type: str | None
    fingerprint: str
    error_category: str | None
    code_refs: list[CodeRef]
    review_issues: list[str]
    provider: str | None
    model: str | None
    prompt_tokens: int
    completion_tokens: int
    steps: list[AgentStep]
