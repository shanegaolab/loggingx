<p align="center">
  <img src="loggingx-vue/public/favicon.svg" width="72" height="72" alt="LoggingX logo">
</p>

<h1 align="center">LoggingX</h1>

<p align="center">
  <b>Every log line, accounted for.</b><br>
  A self-hosted log platform: collect, search, monitor, alert and archive — with AI that reads your code to explain errors.
</p>

<p align="center">
  English · <a href="README.zh-CN.md">简体中文</a> · <a href="https://loggingx.com">loggingx.com</a>
</p>

---

LoggingX puts the whole log workflow into one system that runs on your own servers. Install an agent with one command, and logs from files and containers flow in without losing a line across network outages, crashes or restarts. Search them in seconds, watch them live, get notified by email or SMS when something goes wrong, and let AI find the cause by reading both the error logs and your Git repository.

## Features

**Log collection**
- Agent built on [Vector](https://vector.dev): one install command per server (Linux systemd, Windows service, Docker, Kubernetes DaemonSet), configuration pushed from the console.
- At-least-once delivery: acknowledgements, a 1 GiB disk buffer and read checkpoints survive network outages, agent restarts and log rotation; duplicate batches are dropped on the server.
- Multi-line Java / Python stack traces merged into one event; ingest over HTTP or Kafka.

**Search and live tail**
- Logs stored in ClickHouse; filter by keyword, level, host and TraceId with a time histogram.
- Live tail in the browser, like `tail -f` across servers.

**Host monitoring**
- CPU, memory, disk, network, load, top processes and container resources reported by the same agent.

**Alerting**
- Log alerts (count of matching levels or keywords in a time window) and host alerts (thresholds, agent offline).
- Email (SMTP) and SMS (Aliyun or Tencent Cloud) to users and notification groups, with recovery notices, repeat reminders and delivery records.

**AI ops**
- Ask questions in plain language; answers are retrieved from your knowledge base, past diagnoses, error groups, alerts, error logs and code, with numbered sources (RAG).
- AI diagnosis: new error types, log alerts or hand-picked logs are analysed together with the source code their stack traces point to, producing a cause, a fix suggestion and a diff.
- Multi-agent diagnosis (optional `loggingx-ai` service, LangGraph): log analysis and code analysis run in parallel, then root cause, fix and review agents on DeepSeek and Qwen; a rejected fix goes back for another round.
- Errors grouped by fingerprint; providers: DeepSeek, Qwen (Tongyi Qianwen), OpenAI, Anthropic Claude.

**Backups**
- Daily gzip-compressed NDJSON archives per log store in any S3-compatible storage (MinIO, Aliyun OSS, Tencent COS, AWS S3).
- Archive first, then delete: days that failed to archive are kept. Download archives or restore them for querying.

**Access control**
- Users, roles, menus, departments and posts; each role can be limited to specific log stores.
- JWT authentication, login protection and audit logging; secrets are stored AES-GCM encrypted.

**Console**
- Vue 3 + Element Plus, light and dark themes, Chinese and English.

## Architecture

```text
 servers / containers                         LoggingX
┌──────────────────────┐   HTTP / Kafka   ┌──────────────────┐      ┌──────────────────────────────┐
│ LoggingX Agent       │ ───────────────▶ │  loggingx-java   │ ───▶ │ ClickHouse  logs, host metrics│
│ (Vector, disk buffer)│                  │  Spring Boot 4   │ ───▶ │ MySQL       users, settings   │
└──────────────────────┘                  │                  │ ───▶ │ Redis       cache, dedup      │
                                          │                  │ ───▶ │ S3          archives          │
 browser ┌──────────────┐     /api        │                  │ ───▶ │ AI providers + Git repos      │
         │ loggingx-vue │ ──────────────▶ │                  │      └──────────────────────────────┘
         └──────────────┘                 └──────────────────┘
```

## Repository layout

```text
loggingx
├── loggingx-java      # Backend: Spring Boot 4.1 / Java 25, multi-module Maven project
│   ├── loggingx-web       # entry point and HTTP API
│   ├── loggingx-biz       # business services (logs, monitoring, alerting, AI, backups)
│   ├── loggingx-ai        # chat models via Spring AI
│   ├── loggingx-auth      # login, JWT, security
│   ├── loggingx-dao       # MySQL (MyBatis) and ClickHouse repositories
│   ├── loggingx-thirdparty, loggingx-common
│   └── docs/              # agent, alerting, AI diagnosis, backups
├── loggingx-vue       # Console: Vue 3 + TypeScript + Element Plus + Vite
│   └── promo/             # single-file product page
└── loggingx-ai        # Multi-agent AI diagnosis: Python 3.14, FastAPI, LangGraph, DeepSeek + Qwen
```

## Tech stack

| Part | Stack |
| --- | --- |
| Backend | Java 25, Spring Boot 4.1, Spring Security 7, Spring AI 2.0, MyBatis, JJWT |
| Storage | ClickHouse (logs, host metrics), MySQL (accounts, settings), Redis |
| Agent | Vector |
| Frontend | Vue 3.5, TypeScript, Element Plus, Vite 7, Pinia, ECharts 6, Tailwind CSS 4 |
| AI diagnosis | Python 3.14, FastAPI, LangGraph, LangChain, DeepSeek, Qwen (DashScope) |

## Quick start

Requirements: **Java 25**, **Maven 3.6.3+**, **Node.js 20.19+** and **pnpm 8.8+**.

**1. Backend (no external services needed)**

`TestLoggingxApplication` runs with an in-memory H2 database, an embedded Redis and in-memory log storage, so you can try LoggingX without installing MySQL, Redis or ClickHouse. Data is lost when it stops.

```bash
cd loggingx-java
mvn -pl loggingx-web -am install -DskipTests
mvn -pl loggingx-web spring-boot:test-run -Dspring-boot.run.profiles=dev
```

The API listens on `http://localhost:8080`. The `dev` profile seeds demo data and the accounts `super`, `admin` and `user` (password `123456`).

**2. Console**

```bash
cd loggingx-vue
pnpm install
pnpm dev
```

Open `http://localhost:3006`; requests to `/api` are proxied to `http://localhost:8080` (`VITE_API_PROXY_URL` in `.env.development`).

To run against real MySQL, Redis and ClickHouse instead, start the backend with `mvn spring-boot:run -pl loggingx-web -am -Dspring-boot.run.profiles=dev` and point it at them with the variables below.

## Configuration

All settings can be overridden with `LOGGINGX_*` environment variables, or with a `.env` file in the backend's working directory (ignored by git). The full list with defaults is in [`loggingx-java/.env.example`](loggingx-java/.env.example). The most important ones:

| Variable | Purpose |
| --- | --- |
| `LOGGINGX_JWT_SECRET` | **Required in production**, at least 32 bytes; startup fails without it outside the `dev` profile |
| `LOGGINGX_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | MySQL |
| `LOGGINGX_REDIS_HOST` / `_PORT` / `_PASSWORD` | Redis |
| `LOGGINGX_CLICKHOUSE_URL` / `_USERNAME` / `_PASSWORD` | ClickHouse; `LOGGINGX_LOG_STORAGE=memory` keeps logs in memory instead |
| `LOGGINGX_BOOTSTRAP_ADMIN_USERNAME` / `_PASSWORD` | First super administrator, created when none exists |
| `LOGGINGX_AI_DEEPSEEK_API_KEY`, `LOGGINGX_AI_OPENAI_API_KEY`, `LOGGINGX_AI_ANTHROPIC_API_KEY` | AI providers; a provider is enabled when its key is set |
| `LOGGINGX_AI_AGENT_URL` / `_API_KEY` | Hand AI diagnosis to the [loggingx-ai](loggingx-ai/README.md) multi-agent service (DeepSeek and Qwen keys are set there) |
| `LOGGINGX_BACKUP_SECRET` | Encrypts stored passwords and keys and signs download links (defaults to the JWT secret) |
| `LOGGINGX_KAFKA_ENABLED` / `_BOOTSTRAP_SERVERS` / `_TOPICS` | Optional Kafka ingestion |

## Deployment

**Backend.** `mvn clean package` builds `loggingx-web/target/loggingx.war`. Run it with `java -jar loggingx.war` (embedded Tomcat), or deploy it to **Tomcat 11** on Java 25 (rename it to `ROOT.war` to serve it at the root path). See [`loggingx-java/README.md`](loggingx-java/README.md) for details.

**Console.** `pnpm build` writes static files to `loggingx-vue/dist`. Serve them with any web server and forward `/api` to the backend, for example with Nginx:

```nginx
server {
    listen 80;
    server_name loggingx.example.com;
    root /var/www/loggingx;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;          # live tail and AI answers are streamed
        proxy_read_timeout 1h;
    }
}
```

## Documentation

- [Backend: modules, configuration, API conventions](loggingx-java/README.md)
- [Agent: installation, reliability, host monitoring](loggingx-java/docs/agent.md)
- [Alerting and notifications](loggingx-java/docs/alerting.md)
- [AI ops: Q&A, diagnosis, error groups](loggingx-java/docs/ai-diagnosis.md)
- [Multi-agent AI diagnosis service](loggingx-ai/README.md)
- [Backups and restore](loggingx-java/docs/backup.md)

## Contributing

Issues and pull requests are welcome at [github.com/shanegaolab/loggingx](https://github.com/shanegaolab/loggingx/issues). Before sending a pull request, run `mvn test` in `loggingx-java`, `pnpm lint` in `loggingx-vue` and `uv run pytest` in `loggingx-ai`.
