/// <reference types="vite/client" />

declare module 'nprogress'

declare module 'crypto-js'

declare module 'vue-img-cutter'

declare module 'file-saver'

// 环境变量类型声明（对应 .env* 文件，获得类型提示与拼写检查）
interface ImportMetaEnv {
  readonly VITE_VERSION: string
  readonly VITE_PORT: string
  readonly VITE_BASE_URL: string
  readonly VITE_API_URL: string
  readonly VITE_API_PROXY_URL?: string
  readonly VITE_ACCESS_MODE: 'frontend' | 'backend'
  readonly VITE_WITH_CREDENTIALS: string
  readonly VITE_OPEN_ROUTE_INFO: string
  readonly VITE_LOCK_ENCRYPT_KEY: string
  readonly VITE_DROP_CONSOLE?: string
  /** WebSocket 地址（实时日志推送），未配置时需在 WebSocketClient 中显式传入 url */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 全局变量声明
declare const __APP_VERSION__: string // 版本号
