<p align="center">
  <img src="loggingx-vue/public/favicon.svg" width="72" height="72" alt="LoggingX logo">
</p>

<h1 align="center">LoggingX</h1>

<p align="center">
  <b>每一行日志，都有着落。</b><br>
  私有部署的日志平台：采集、查询、监控、告警、归档，出了错 AI 会结合你的代码告诉你原因。
</p>

<p align="center">
  <a href="README.md">English</a> · 简体中文 · <a href="https://loggingx.com">loggingx.com</a>
</p>

---

LoggingX 把日志相关的工作放进一套部署在你自己服务器上的系统。服务器上用一条命令装好 Agent，文件和容器里的日志就会源源不断地进来，断网、崩溃、重启都不会丢一行。几秒内就能查到想要的日志，也能实时滚动查看；出了问题通过邮件或短信通知到人；AI 会同时阅读错误日志和你的 Git 代码仓库，找出原因。

## 功能

**日志采集**
- 基于 [Vector](https://vector.dev) 的 Agent：每台服务器一条命令安装（Linux systemd、Windows 服务、Docker、Kubernetes DaemonSet），采集配置在控制台修改、远程下发。
- 至少一次送达：确认机制、1 GiB 磁盘缓冲和读取进度记录，网络中断、Agent 重启、日志轮转都能接上；重复的批次在服务端去重。
- Java、Python 多行异常堆栈合并为一条；支持 HTTP 和 Kafka 两种上报方式。

**查询与实时日志**
- 日志存在 ClickHouse，按关键字、级别、主机、TraceId 组合筛选，带时间分布柱状图。
- 浏览器里实时滚动查看，像在多台服务器上同时 `tail -f`。

**主机监控**
- 同一个 Agent 上报 CPU、内存、磁盘、网络、负载、进程 Top 和容器资源。

**告警**
- 日志告警（时间窗口内匹配级别或关键字的日志条数超过阈值）和监控告警（资源阈值、Agent 离线）。
- 邮件（SMTP）和短信（阿里云或腾讯云）通知系统用户和通知组，支持恢复通知、重复提醒和发送记录。

**AI 运维**
- 用自然语言提问，AI 从知识库、历史诊断、错误归类、告警、错误日志和代码中检索资料后回答，并标注出处（RAG）。
- AI 诊断：新出现的错误类型、日志告警或手动选择的日志，连同堆栈指向的源代码一起分析，给出原因、修改建议和 diff。
- 多 agent 诊断（`loggingx-ai` 服务，基于 LangGraph）：日志分析和代码分析并行，再由根因、修复、评审 agent 依次完成，模型用 DeepSeek 和通义千问；评审不通过会退回修复重做。
- 错误按指纹归类；模型使用 DeepSeek 和通义千问，互为备份。所有 AI 功能都由 Python 服务 `loggingx-ai` 完成。

**日志备份**
- 每天把各日志库的日志按天压缩为 gzip 格式的 NDJSON，存到 S3 兼容对象存储（MinIO、阿里云 OSS、腾讯云 COS、AWS S3）。
- 先归档、再删除：归档失败的日期不会被清理。归档可以下载，也可以恢复回日志库查询。

**权限**
- 用户、角色、菜单、部门、岗位；每个角色可限定能访问的日志库。
- JWT 认证、登录保护和操作审计；保存的密码和密钥使用 AES-GCM 加密。

**控制台**
- Vue 3 + Element Plus，支持亮色和暗黑主题、中英文切换。

## 架构

```text
 服务器 / 容器                                LoggingX
┌──────────────────────┐   HTTP / Kafka   ┌──────────────────┐      ┌──────────────────────────────┐
│ LoggingX Agent       │ ───────────────▶ │  loggingx-java   │ ───▶ │ ClickHouse  日志、主机指标     │
│ (Vector，磁盘缓冲)    │                  │  Spring Boot 4   │ ───▶ │ MySQL       账号、配置         │
└──────────────────────┘                  │                  │ ───▶ │ Redis       缓存、去重         │
                                          │                  │ ───▶ │ S3          日志归档           │
 浏览器  ┌──────────────┐     /api        │                  │ ───▶ │ AI 模型 + Git 代码仓库         │
         │ loggingx-vue │ ──────────────▶ │                  │      └──────────────────────────────┘
         └──────────────┘                 └──────────────────┘
```

## 目录结构

```text
loggingx
├── loggingx-java      # 后端：Spring Boot 4.1 / Java 25，Maven 多模块
│   ├── loggingx-web       # 启动入口和 HTTP 接口
│   ├── loggingx-biz       # 业务服务（日志、监控、告警、AI、备份）
│   ├── loggingx-ai        # 调用 loggingx-ai 服务的客户端
│   ├── loggingx-auth      # 登录、JWT、安全配置
│   ├── loggingx-dao       # MySQL（MyBatis）和 ClickHouse 数据访问
│   ├── loggingx-thirdparty、loggingx-common
│   └── docs/              # Agent、告警、AI 诊断、备份文档
├── loggingx-vue       # 控制台：Vue 3 + TypeScript + Element Plus + Vite
│   └── promo/             # 单文件产品宣传页
└── loggingx-ai        # 全部 AI 能力（对话、智能问答、多 agent 诊断）：Python 3.14、FastAPI、LangGraph、DeepSeek + 通义千问
```

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 后端 | Java 25、Spring Boot 4.1、Spring Security 7、MyBatis、JJWT |
| 存储 | ClickHouse（日志、主机指标）、MySQL（账号、配置）、Redis |
| 采集 | Vector |
| 前端 | Vue 3.5、TypeScript、Element Plus、Vite 7、Pinia、ECharts 6、Tailwind CSS 4 |
| AI | Python 3.14、FastAPI、LangGraph、LangChain、DeepSeek、通义千问（百炼 DashScope） |

## 快速开始

环境要求：**Java 25**、**Maven 3.6.3+**、**Node.js 20.19+**、**pnpm 8.8+**。

**1. 启动后端（不需要任何外部服务）**

`TestLoggingxApplication` 使用内存 H2 数据库、进程内 Redis 和内存日志存储，不安装 MySQL、Redis、ClickHouse 也能体验 LoggingX，停止后数据清空。

```bash
cd loggingx-java
mvn -pl loggingx-web -am install -DskipTests
mvn -pl loggingx-web spring-boot:test-run -Dspring-boot.run.profiles=dev
```

接口地址为 `http://localhost:8080`。`dev` profile 会写入演示数据和 `super`、`admin`、`user` 三个账号，密码都是 `123456`。

**2. 启动控制台**

```bash
cd loggingx-vue
pnpm install
pnpm dev
```

打开 `http://localhost:3006`，`/api` 请求会代理到 `http://localhost:8080`（`.env.development` 中的 `VITE_API_PROXY_URL`）。

如果要连接真实的 MySQL、Redis 和 ClickHouse，用 `mvn spring-boot:run -pl loggingx-web -am -Dspring-boot.run.profiles=dev` 启动后端，并按下面的环境变量配置连接信息。

## 配置

所有配置都可以用 `LOGGINGX_*` 环境变量覆盖，也可以写在后端启动目录下的 `.env` 文件中（已被 git 忽略）。完整列表和默认值见 [`loggingx-java/.env.example`](loggingx-java/.env.example)，常用的有：

| 变量 | 说明 |
| --- | --- |
| `LOGGINGX_JWT_SECRET` | **生产环境必填**，至少 32 字节；不使用 `dev` profile 时未设置会启动失败 |
| `LOGGINGX_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | MySQL |
| `LOGGINGX_REDIS_HOST` / `_PORT` / `_PASSWORD` | Redis |
| `LOGGINGX_CLICKHOUSE_URL` / `_USERNAME` / `_PASSWORD` | ClickHouse；`LOGGINGX_LOG_STORAGE=memory` 时日志只保存在内存 |
| `LOGGINGX_BOOTSTRAP_ADMIN_USERNAME` / `_PASSWORD` | 没有超级管理员时自动创建的第一个超级管理员 |
| `LOGGINGX_AI_URL` / `_API_KEY` / `_TIMEOUT` | 所有 AI 功能调用的 [loggingx-ai](loggingx-ai/README.md) 服务（DeepSeek、通义千问的 Key 在那里配置）；不设置时 AI 功能不可用 |
| `LOGGINGX_BACKUP_SECRET` | 加密保存的密码和密钥、为下载链接签名（默认同 JWT 密钥） |
| `LOGGINGX_KAFKA_ENABLED` / `_BOOTSTRAP_SERVERS` / `_TOPICS` | 可选的 Kafka 日志上报 |

## 部署

**后端。** 执行 `mvn clean package` 生成 `loggingx-web/target/loggingx.war`。可以直接 `java -jar loggingx.war` 用内嵌 Tomcat 运行，也可以部署到运行在 Java 25 上的 **Tomcat 11**（改名为 `ROOT.war` 即部署在根路径）。详见 [`loggingx-java/README.md`](loggingx-java/README.md)。

**控制台。** 执行 `pnpm build`，静态文件输出到 `loggingx-vue/dist`，用任意 Web 服务器托管，并把 `/api` 转发到后端。以 Nginx 为例：

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
        proxy_buffering off;          # 实时日志和 AI 回答是流式输出
        proxy_read_timeout 1h;
    }
}
```

> 中国大陆的服务器使用域名访问前，需要先完成 ICP 备案。

## 文档

- [后端：模块、配置、接口约定](loggingx-java/README.md)
- [Agent：安装、可靠性、主机监控](loggingx-java/docs/agent.md)
- [告警与通知](loggingx-java/docs/alerting.md)
- [AI 运维：智能问答、诊断、错误归类](loggingx-java/docs/ai-diagnosis.md)
- [多 agent AI 诊断服务](loggingx-ai/README.md)
- [日志备份与恢复](loggingx-java/docs/backup.md)

## 参与贡献

欢迎在 [github.com/shanegaolab/loggingx](https://github.com/shanegaolab/loggingx/issues) 提 Issue 和 Pull Request。提交 PR 前，请在 `loggingx-java` 下运行 `mvn test`，在 `loggingx-vue` 下运行 `pnpm lint`，在 `loggingx-ai` 下运行 `uv run pytest`。
