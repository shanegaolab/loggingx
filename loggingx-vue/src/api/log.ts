import request from '@/utils/http'
import { streamEvents } from '@/utils/http/sse'

// ---------------- 日志库管理 ----------------

// 获取日志库列表（含上报 Token、近 24 小时日志数）
export function fetchGetLogStoreList() {
  return request.get<Api.Log.Store[]>({
    url: '/api/logstore/list'
  })
}

// 获取日志库选项（不含 Token），供日志查询、实时日志页面选择日志库
export function fetchGetLogStoreOptions() {
  return request.get<Api.Log.StoreOption[]>({
    url: '/api/logstore/options'
  })
}

// 新增日志库
export function fetchCreateLogStore(data: Api.Log.StoreForm) {
  return request.post<Api.Log.Store>({
    url: '/api/logstore',
    data
  })
}

// 编辑日志库（编码不可修改）
export function fetchUpdateLogStore(id: number, data: Api.Log.StoreForm) {
  return request.put<Api.Log.Store>({
    url: `/api/logstore/${id}`,
    data
  })
}

// 重新生成上报 Token，旧 Token 立即失效
export function fetchRegenerateLogStoreToken(id: number) {
  return request.post<Api.Log.Store>({
    url: `/api/logstore/${id}/token`
  })
}

// 删除日志库及其全部日志；deleteArchives 为 true 时同时删除它在备份存储中的归档文件
export function fetchDeleteLogStore(id: number, deleteArchives = false) {
  return request.del<void>({
    url: `/api/logstore/${id}`,
    params: deleteArchives ? { deleteArchives: true } : {}
  })
}

// ---------------- 日志查询 ----------------

// 查询日志（按时间倒序分页，附带各级别命中数）
export function fetchSearchLogs(params: Api.Log.SearchParams) {
  return request.get<Api.Log.SearchResult>({
    url: '/api/logs/search',
    params
  })
}

// ---------------- 实时日志 ----------------

export interface LogTailOptions {
  storeId: number
  levels?: string[]
  keyword?: string
  /** 收到一批日志（先是最近的日志，之后是新日志） */
  onLogs: (records: Api.Log.LogRecord[]) => void
  /** 服务端已发送完最近日志，开始推送新日志 */
  onReady?: () => void
  signal: AbortSignal
}

// 订阅日志库的实时日志（SSE），连接结束（服务端超时）时 resolve，调用方可重连
export function streamLogTail({
  storeId,
  levels,
  keyword,
  onLogs,
  onReady,
  signal
}: LogTailOptions) {
  const query = new URLSearchParams({ storeId: String(storeId) })
  if (levels?.length) query.set('levels', levels.join(','))
  if (keyword) query.set('keyword', keyword)
  return streamEvents(`/api/logs/tail?${query}`, {
    signal,
    onEvent: (event, data) => {
      if (event === 'logs') onLogs(JSON.parse(data) as Api.Log.LogRecord[])
      else if (event === 'ready') onReady?.()
    }
  })
}
