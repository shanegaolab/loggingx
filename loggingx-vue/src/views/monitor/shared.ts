/** 主机监控页面共用的格式化与常量 */

export const PLATFORM_ICONS: Record<Api.Agent.Platform, string> = {
  linux: 'ri:terminal-box-line',
  docker: 'ri:box-3-line',
  kubernetes: 'ri:ship-2-line',
  windows: 'ri:windows-line'
}

export const PLATFORM_NAMES: Record<Api.Agent.Platform, string> = {
  linux: 'Linux',
  docker: 'Docker',
  kubernetes: 'Kubernetes 节点',
  windows: 'Windows'
}

export const ALERT_METRICS: Record<Api.Monitor.AlertMetric, string> = {
  cpu: 'CPU 使用率',
  memory: '内存使用率',
  disk: '磁盘使用率',
  load: '系统负载',
  offline: '主机离线'
}

export const SEVERITY_NAMES: Record<Api.Monitor.Severity, string> = {
  critical: '严重',
  warning: '警告'
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/** 1536 → 1.5 KB */
export function formatBytes(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  let size = Math.abs(value)
  let unit = 0
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024
    unit++
  }
  const text = unit === 0 ? String(Math.round(size)) : size.toFixed(size >= 100 ? 0 : digits)
  return `${value < 0 ? '-' : ''}${text} ${UNITS[unit]}`
}

/** 每秒字节数 → 1.5 MB/s */
export function formatRate(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : `${formatBytes(value)}/s`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '-'
    : `${value.toFixed(digits)}%`
}

/** 秒 → 3 天 4 小时 */
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  return `${minutes} 分钟`
}

/** 进度条颜色：≥ 90% 红，≥ 75% 橙，其余绿 */
export function usageColor(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return 'var(--el-border-color)'
  if (percent >= 90) return '#dc2626'
  if (percent >= 75) return '#f59e0b'
  return '#16a34a'
}

/** 告警值按指标格式化 */
export function formatAlertValue(metric: Api.Monitor.AlertMetric, value: number | null): string {
  if (value === null || value === undefined) return '-'
  switch (metric) {
    case 'load':
      return `${value.toFixed(2)} / 核`
    case 'offline':
      return `${Math.round(value)} 分钟未同步`
    default:
      return formatPercent(value)
  }
}

/** 规则条件的文字描述，如「CPU 使用率 > 90%，持续 5 分钟」 */
export function describeRule(
  rule: Pick<Api.Monitor.AlertRule, 'metric' | 'threshold' | 'durationMinutes'>
) {
  switch (rule.metric) {
    case 'offline':
      return `超过 ${rule.durationMinutes} 分钟未同步`
    case 'disk':
      return `任一文件系统使用率 > ${rule.threshold}%`
    case 'load':
      return `每核负载 > ${rule.threshold}，持续 ${rule.durationMinutes} 分钟`
    default:
      return `${ALERT_METRICS[rule.metric]} > ${rule.threshold}%，持续 ${rule.durationMinutes} 分钟`
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 毫秒 → 2026-10-27 10:00:00（日志查询的时间格式） */
export function formatDateTime(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 毫秒 → 10:00 或 10-27 10:00（跨天时） */
export function formatAxisTime(ms: number, withDate: boolean): string {
  const date = new Date(ms)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return withDate ? `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}` : time
}

/** 告警阈值的文字描述，如「CPU 使用率 > 90%」 */
export function describeThreshold(metric: Api.Monitor.AlertMetric, threshold: number): string {
  switch (metric) {
    case 'offline':
      return 'Agent 未同步'
    case 'load':
      return `每核负载 > ${threshold}`
    default:
      return `${ALERT_METRICS[metric]} > ${threshold}%`
  }
}
