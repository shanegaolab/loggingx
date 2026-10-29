import request from '@/utils/http'
import { streamEvents } from '@/utils/http/sse'

// ---------- 设置 ----------

export function fetchAiSettings() {
  return request.get<Api.AiDiagnosis.Settings>({ url: '/api/ai-diagnosis/settings' })
}

export function saveAiSettings(data: {
  provider: string | null
  model: string | null
  dailyLimit: number
  notification: Api.AlertCenter.RuleNotify
}) {
  return request.put<Api.AiDiagnosis.Settings>({
    url: '/api/ai-diagnosis/settings',
    data,
    showSuccessMessage: false
  })
}

// ---------- 日志库与代码仓库 ----------

export function fetchAiStores() {
  return request.get<Api.AiDiagnosis.StoreConfig[]>({ url: '/api/ai-diagnosis/stores' })
}

export function saveAiStore(storeId: number, data: Api.AiDiagnosis.StoreForm) {
  return request.put<Api.AiDiagnosis.StoreConfig>({
    url: `/api/ai-diagnosis/stores/${storeId}`,
    data,
    showSuccessMessage: false
  })
}

/** 立即克隆或更新代码仓库，同时验证地址和令牌 */
export function syncAiStore(storeId: number) {
  return request.post<{ commit: string; files: number }>({
    url: `/api/ai-diagnosis/stores/${storeId}/sync`,
    showSuccessMessage: false,
    showErrorMessage: false
  })
}

// ---------- 错误归类 ----------

export function fetchErrorGroups(params: { storeId?: number; status?: string; limit?: number }) {
  return request.get<Api.AiDiagnosis.Group[]>({ url: '/api/ai-diagnosis/groups', params })
}

export function setErrorGroupStatus(id: number, status: Api.AiDiagnosis.ReviewState) {
  return request.put<void>({
    url: `/api/ai-diagnosis/groups/${id}/status`,
    data: { status },
    showSuccessMessage: false
  })
}

export function analyzeErrorGroup(id: number) {
  return request.post<Api.AiDiagnosis.Item>({
    url: `/api/ai-diagnosis/groups/${id}/analyze`,
    showSuccessMessage: false
  })
}

// ---------- 诊断记录 ----------

export function fetchDiagnoses(params: {
  storeId?: number
  state?: string
  trigger?: string
  days?: number
  limit?: number
}) {
  return request.get<Api.AiDiagnosis.Item[]>({ url: '/api/ai-diagnosis/diagnoses', params })
}

export function fetchDiagnosis(id: number) {
  return request.get<Api.AiDiagnosis.Detail>({ url: `/api/ai-diagnosis/diagnoses/${id}` })
}

export function setDiagnosisState(id: number, state: Api.AiDiagnosis.ReviewState) {
  return request.put<void>({
    url: `/api/ai-diagnosis/diagnoses/${id}/state`,
    data: { state },
    showSuccessMessage: false
  })
}

export function reanalyzeDiagnosis(id: number) {
  return request.post<Api.AiDiagnosis.Item>({
    url: `/api/ai-diagnosis/diagnoses/${id}/reanalyze`,
    showSuccessMessage: false
  })
}

/** 对日志查询里选中的一条日志做 AI 分析 */
export function analyzeLog(data: {
  storeId: number
  message: string
  host?: string | null
  source?: string | null
  time?: string | null
}) {
  return request.post<Api.AiDiagnosis.Item>({
    url: '/api/ai-diagnosis/analyze',
    data,
    showSuccessMessage: false
  })
}

// ---------- 顶栏通知 ----------

export function fetchNotices() {
  return request.get<Api.Notice.List>({ url: '/api/notices', showErrorMessage: false })
}

export function readNotices() {
  return request.post<void>({ url: '/api/notices/read', showSuccessMessage: false })
}

// ---------- 运维问答与知识库 ----------

export function fetchKnowledge() {
  return request.get<Api.AiOps.Knowledge[]>({ url: '/api/ai-ops/knowledge' })
}

export function fetchKnowledgeDetail(id: number) {
  return request.get<Api.AiOps.KnowledgeDetail>({ url: `/api/ai-ops/knowledge/${id}` })
}

export function saveKnowledge(id: number | undefined, data: Api.AiOps.KnowledgeForm) {
  return id
    ? request.put<Api.AiOps.Knowledge>({
        url: `/api/ai-ops/knowledge/${id}`,
        data,
        showSuccessMessage: false
      })
    : request.post<Api.AiOps.Knowledge>({
        url: '/api/ai-ops/knowledge',
        data,
        showSuccessMessage: false
      })
}

export function deleteKnowledge(id: number) {
  return request.del<void>({ url: `/api/ai-ops/knowledge/${id}` })
}

export interface AskParams {
  question: string
  storeId?: number
  hours: number
  history: Api.AiOps.Turn[]
}

/**
 * 流式提问：先收到引用资料，再逐段收到回答
 */
export function askOps(
  params: AskParams,
  handlers: {
    onSources: (sources: Api.AiOps.Source[]) => void
    onDelta: (text: string) => void
    onDone: (reply: {
      model: string | null
      promptTokens: number | null
      completionTokens: number | null
    }) => void
    onError: (message: string) => void
  },
  signal: AbortSignal
) {
  return streamEvents('/api/ai-ops/ask/stream', {
    method: 'POST',
    body: params,
    signal,
    onEvent: (event, data) => {
      const payload = JSON.parse(data)
      if (event === 'sources') handlers.onSources(payload)
      else if (event === 'message') handlers.onDelta(payload.content ?? '')
      else if (event === 'done') handlers.onDone(payload)
      else if (event === 'error') handlers.onError(payload.msg ?? '回答失败')
    }
  })
}
