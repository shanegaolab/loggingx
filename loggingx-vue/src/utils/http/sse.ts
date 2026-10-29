/**
 * Server-Sent Events 客户端
 *
 * 浏览器原生 EventSource 不能携带 Authorization 请求头，这里用 fetch 读取 text/event-stream，
 * 按 SSE 协议拆分事件。支持通过 AbortSignal 主动断开。
 *
 * @module utils/http/sse
 */
import { useUserStore } from '@/store/modules/user'
import { HttpError } from './error'
import { ApiStatus } from './status'
import { $t } from '@/locales'

const { VITE_API_URL } = import.meta.env

export interface SseOptions {
  /** 收到一个事件（data 为原始文本，多行 data 以换行连接） */
  onEvent: (event: string, data: string) => void
  /** 用于断开连接 */
  signal: AbortSignal
  /** 默认 GET；POST 时 body 以 JSON 发送 */
  method?: 'GET' | 'POST'
  body?: unknown
}

/** 拼接接口基础路径，如 VITE_API_URL 为 / 时得到 /api/... */
function resolveUrl(path: string): string {
  const base = (VITE_API_URL || '/').replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * 打开 SSE 连接并持续读取，直到服务端关闭或 signal 中断
 * @returns 连接正常结束时 resolve；主动中断时 resolve；出错时 reject
 */
export async function streamEvents(
  path: string,
  { onEvent, signal, method = 'GET', body }: SseOptions
): Promise<void> {
  const userStore = useUserStore()
  let response: Response
  try {
    response = await fetch(resolveUrl(path), {
      method,
      headers: {
        Accept: 'text/event-stream',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(userStore.accessToken ? { Authorization: `Bearer ${userStore.accessToken}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    })
  } catch (error) {
    if (signal.aborted) return
    throw error
  }

  if (response.status === ApiStatus.unauthorized) {
    userStore.logOut()
    throw new HttpError($t('httpMsg.unauthorized'), ApiStatus.unauthorized)
  }
  if (!response.ok || !response.body) {
    // 出错时后端返回统一的 { code, msg } JSON
    let message = $t('httpMsg.requestFailed')
    try {
      const body = await response.json()
      if (body?.msg) message = body.msg
    } catch {
      // 非 JSON 响应，使用默认提示
    }
    throw new HttpError(message, response.status)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []

  const dispatchLine = (line: string) => {
    if (line === '') {
      if (dataLines.length > 0) onEvent(eventName, dataLines.join('\n'))
      eventName = 'message'
      dataLines = []
      return
    }
    // 冒号开头为注释（服务端心跳）
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon < 0 ? line : line.slice(0, colon)
    let value = colon < 0 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') eventName = value
    else if (field === 'data') dataLines.push(value)
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let newline: number
      while ((newline = buffer.search(/\r?\n/)) >= 0) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(buffer[newline] === '\r' ? newline + 2 : newline + 1)
        dispatchLine(line)
      }
    }
  } catch (error) {
    if (signal.aborted) return
    throw error
  } finally {
    reader.releaseLock()
  }
}
