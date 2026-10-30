# loggingx-ai

[LoggingX](../README.zh-CN.md) 的 AI 诊断服务：把一条错误日志和它堆栈指向的源代码交给多个 agent 协作分析，给出结论、根本原因、修改建议和 diff。

技术栈：Python 3.14、FastAPI、LangGraph、DeepSeek、通义千问（Qwen）。

## 多 agent 流程

```text
parse ─▶ locate_code ─┬─▶ log_analyst  (DeepSeek) ─┐
                      └─▶ code_analyst (Qwen Coder)─┴─▶ root_cause (DeepSeek) ─▶ fixer (Qwen Coder) ─▶ reviewer (Qwen) ─▶ finalize
                                                                                    ▲                    │
                                                                                    └── 评审不通过，重做 ──┘
```

| 节点 | 类型 | 作用 |
| --- | --- | --- |
| `parse` | 规则 | 解析异常类型、栈帧（Java/Kotlin、Python、JS/TS、Go）和指纹，与 loggingx-java 的 `StackTraces` 一致 |
| `locate_code` | 规则 | 使用请求里的 `codeRefs`；没有时按 `storeId` 到 `LOGGINGX_AI_REPO_ROOT/store-<id>` 找栈帧对应文件，取出错行上下 30 行 |
| `log_analyst` | agent | 从日志提取现象、上下文、错误分类和原因假设 |
| `code_analyst` | agent | 阅读代码找可疑行；没有代码时跳过。与 `log_analyst` 并行 |
| `root_cause` | agent | 综合两份分析和原文，给出结论、根本原因、证据和置信度 |
| `fixer` | agent | 给出最小修改建议和统一 diff |
| `reviewer` | agent | 用另一个模型复核证据、修改和 diff；不通过时把意见交回 `fixer` 重做（默认 1 次） |
| `finalize` | 规则 | 汇总结果；置信度取根因和评审中较低的一个，评审仍未通过时最高为 medium，并在建议末尾列出评审意见 |

每个 agent 的模型都可单独配置（`provider:model`）。某个提供方没有配置密钥或调用失败时，自动换用另一个提供方的默认模型，只配一个提供方也能运行。

## 本地运行

需要 [uv](https://docs.astral.sh/uv/)（会自动下载 Python 3.14）：

```powershell
uv sync
Copy-Item .env.example .env   # 填入 DeepSeek 和/或千问的 API Key
uv run uvicorn main:app --reload --port 8001
```

打开 `http://localhost:8001/docs` 查看接口。测试与检查：

```bash
uv run pytest
uv run ruff check .
```

## 接口

请求和响应都是 camelCase，字段与 loggingx-java 的 `ai_diagnosis` 表对应，可直接保存。配置了 `LOGGINGX_AI_API_KEY` 时需带 `X-API-Key` 请求头。

**`POST /api/v1/diagnoses`**

```json
{
  "logText": "java.lang.NullPointerException ...\n\tat com.shop.OrderService.submit(OrderService.java:88)",
  "storeId": 3,
  "storeName": "shop",
  "host": "web-01",
  "source": "/var/log/shop/app.log",
  "time": "2026-10-29T10:00:00+08:00",
  "repoCommit": "a1b2c3d4e5",
  "codeRefs": [
    {"path": "src/main/java/com/shop/OrderService.java", "startLine": 58, "focusLine": 88,
     "frame": "com.shop.OrderService.submit(OrderService.java:88)", "text": "..."}
  ]
}
```

只有 `logText` 必填。响应：

```json
{
  "summary": "一句话结论",
  "rootCause": "根本原因分析",
  "suggestion": "Markdown 修改建议",
  "diff": "统一 diff，没有时为 null",
  "confidence": "high | medium | low",
  "errorType": "java.lang.NullPointerException",
  "fingerprint": "sha1",
  "errorCategory": "空指针",
  "codeRefs": [],
  "reviewIssues": [],
  "provider": "deepseek",
  "model": "deepseek-chat",
  "promptTokens": 5321,
  "completionTokens": 1204,
  "steps": [{"agent": "log_analyst", "provider": "deepseek", "model": "deepseek-chat",
             "promptTokens": 900, "completionTokens": 200, "durationMs": 3100}]
}
```

模型调用全部失败时返回 `502`，`detail` 里是各提供方的错误。

**`POST /api/v1/diagnoses/stream`**：请求同上，返回 SSE。每个节点完成时发 `agent` 事件（`{"agent": "...", "output": {...}}`），最后是 `result`（同上面的响应）和 `done`；出错时发 `error`。

**`POST /api/v1/chat`**：一轮普通对话，loggingx-java 的 AI 对话和智能问答用它。

```json
{"provider": "deepseek", "model": "deepseek-chat", "message": "你好", "systemPrompt": "用中文回答"}
```

只有 `message` 必填；`provider` 留空时用第一个已配置的提供方，`model` 留空时用该提供方的默认模型（`LOGGINGX_AI_<PROVIDER>_MODEL`）。响应 `{"provider", "model", "content", "promptTokens", "completionTokens"}`。提供方未知或未配置返回 `400`，模型调用失败返回 `502`。

**`POST /api/v1/chat/stream`**：请求同上，返回 SSE：`delta`（`{"content": "..."}`）若干，然后 `result`（同上面的响应）和 `done`；出错时发 `error`（`{"message": "..."}`）。

**`GET /health`**：`{"status": "ok", "providers": ["deepseek", "qwen"]}`，loggingx-java 用它列出可选的提供方。

## 与 loggingx-java 对接

loggingx-java 不直接调用任何模型，全部经过本服务：`LOGGINGX_AI_AGENT_URL`（默认 `http://localhost:8001`）指向本服务，`LOGGINGX_AI_AGENT_API_KEY` 与本服务的 `LOGGINGX_AI_API_KEY` 对应。`AiDiagnosisService` 通过 `AiAgentClient` 把日志、`CodeRepositories.snippets(...)` 取出的代码和提交号发到 `POST /api/v1/diagnoses`，并把结果写回 `ai_diagnosis`；AI 对话和智能问答通过 `AiChatService` 调用 `/api/v1/chat`、`/api/v1/chat/stream`。详见 [`loggingx-java/docs/ai-diagnosis.md`](../loggingx-java/docs/ai-diagnosis.md)。

注意：日志和代码片段会发送给所选的模型提供方，请确认符合公司的代码安全要求；需要时可把 `*_BASE_URL` 指向内部模型网关。AI 给出的修改需要评审和测试后再合入。

## 目录

```text
loggingx_ai/
├── main.py          # FastAPI 应用和接口（诊断、对话）
├── config.py        # LOGGINGX_AI_* 配置
├── llm.py           # DeepSeek / 千问模型路由、JSON 输出和失败切换
├── stacktrace.py    # 堆栈解析和指纹
├── code.py          # 在仓库中定位栈帧对应的代码
├── schemas.py       # 请求与响应
└── diagnosis/
    ├── graph.py     # LangGraph 多 agent 流程
    └── prompts.py   # 各 agent 的提示词和输出结构
tests/               # 用假模型测试整个流程，不调用真实 API
```
