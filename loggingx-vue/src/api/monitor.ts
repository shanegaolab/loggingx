import request from '@/utils/http'

/** 主机列表；不传 storeId 时返回所有日志库的主机 */
export function fetchHosts(storeId?: number) {
  return request.get<Api.Monitor.Host[]>({
    url: '/api/monitor/hosts',
    params: storeId ? { storeId } : {}
  })
}

/** 主机在 [from, to) 内的趋势，时间为毫秒 */
export function fetchHostSeries(storeId: number, host: string, from: number, to: number) {
  return request.get<Api.Monitor.SeriesPoint[]>({
    url: '/api/monitor/hosts/series',
    params: { storeId, host, from, to }
  })
}

export function fetchHostFilesystems(storeId: number, host: string) {
  return request.get<Api.Monitor.Filesystem[]>({
    url: '/api/monitor/hosts/filesystems',
    params: { storeId, host }
  })
}

/** 某一时刻（默认现在）的进程 Top */
export function fetchHostProcesses(storeId: number, host: string, at?: number) {
  return request.get<Api.Monitor.Process[]>({
    url: '/api/monitor/hosts/processes',
    params: at ? { storeId, host, at } : { storeId, host }
  })
}

export function fetchHostContainers(storeId: number, host: string) {
  return request.get<Api.Monitor.Container[]>({
    url: '/api/monitor/hosts/containers',
    params: { storeId, host }
  })
}

export interface AlertQuery {
  status?: 'firing' | 'resolved'
  storeId?: number
  host?: string
  days?: number
  limit?: number
}

/** 告警事件：进行中的总是在前 */
export function fetchAlerts(query: AlertQuery = {}) {
  return request.get<Api.Monitor.AlertEvent[]>({
    url: '/api/monitor/alerts',
    params: query
  })
}

export function fetchAlertRules() {
  return request.get<Api.Monitor.AlertRule[]>({
    url: '/api/monitor/alert-rules'
  })
}

export function createAlertRule(data: Api.Monitor.AlertRuleForm) {
  return request.post<Api.Monitor.AlertRule>({
    url: '/api/monitor/alert-rules',
    data,
    showSuccessMessage: false
  })
}

export function updateAlertRule(id: number, data: Api.Monitor.AlertRuleForm) {
  return request.put<Api.Monitor.AlertRule>({
    url: `/api/monitor/alert-rules/${id}`,
    data,
    showSuccessMessage: false
  })
}

export function deleteAlertRule(id: number) {
  return request.del<void>({
    url: `/api/monitor/alert-rules/${id}`
  })
}
