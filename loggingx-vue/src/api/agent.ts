import request from '@/utils/http'
import { useUserStore } from '@/store/modules/user'
import { HttpError } from '@/utils/http/error'
import { $t } from '@/locales'

const { VITE_API_URL } = import.meta.env

/** 采集 Agent 版本、安装包、Kafka 默认配置 */
export function fetchAgentMeta() {
  return request.get<Api.Agent.Meta>({
    url: '/api/agent/meta'
  })
}

/** 日志库的采集配置（未保存过时返回默认配置） */
export function fetchCollectConfig(storeId: number) {
  return request.get<Api.Agent.CollectConfigView>({
    url: '/api/agent/collect',
    params: { storeId }
  })
}

/** 保存采集配置；该日志库已登记的 Agent 在下次同步时自动应用 */
export function saveCollectConfig(storeId: number, data: Api.Agent.CollectConfig) {
  return request.put<Api.Agent.CollectConfigView>({
    url: `/api/agent/collect?storeId=${storeId}`,
    data,
    showSuccessMessage: false
  })
}

/** 已登记的 Agent；不传 storeId 时返回所有日志库的 */
export function fetchAgents(storeId?: number) {
  return request.get<Api.Agent.Instance[]>({
    url: '/api/agent/agents',
    params: storeId ? { storeId } : {}
  })
}

/** 移除 Agent 记录（Agent 仍持有有效 Token 时会在下次同步时重新登记） */
export function removeAgent(agentId: number) {
  return request.del({
    url: `/api/agent/agents/${agentId}`
  })
}

/** Agent 生成文件的种类：配置、Linux/Docker 安装脚本、Windows 安装脚本、Kubernetes 清单 */
export type AgentFileKind = 'config' | 'install.sh' | 'install.ps1' | 'kubernetes.yaml'

/** 生成文件的查询参数；采集内容来自日志库的采集配置，这里只有环境和 LoggingX 地址 */
export function buildAgentQuery(
  platform: Api.Agent.Platform,
  server: string,
  extra: Record<string, string> = {}
) {
  const query = new URLSearchParams({ platform, server, ...extra })
  return query.toString()
}

/**
 * 以当前登录用户身份获取某日志库的 Agent 配置或安装脚本（纯文本）。
 * 接口返回的不是统一的 JSON 结构，因此直接用 fetch；出错时解析后端的 { msg }。
 */
export async function fetchAgentFile(
  kind: AgentFileKind,
  storeId: number,
  platform: Api.Agent.Platform,
  server: string,
  extra: Record<string, string> = {}
): Promise<string> {
  const base = (VITE_API_URL || '/').replace(/\/+$/, '')
  const query = buildAgentQuery(platform, server, { ...extra, storeId: String(storeId) })
  const { accessToken } = useUserStore()
  const response = await fetch(`${base}/api/agent/${kind}?${query}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  })
  const text = await response.text()
  if (!response.ok) {
    let message = $t('httpMsg.requestFailed')
    try {
      message = JSON.parse(text).msg || message
    } catch {
      // 非 JSON 错误响应，使用默认提示
    }
    throw new HttpError(message, response.status)
  }
  return text
}
