/** 工作台共用 */
import { levelClass } from '@/views/log/shared'

/** 级别颜色：读取 log-levels.css 中的 --lx-level，跟随明暗主题 */
export function levelColor(level: string): string {
  const probe = document.createElement('span')
  probe.className = levelClass(level)
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const color = getComputedStyle(probe).getPropertyValue('--lx-level').trim()
  probe.remove()
  return color || '#94a3b8'
}

/** 环比：+12% / -8% / 持平；上一时段为 0 时返回 null */
export function compareText(
  current: number,
  previous: number
): { text: string; up: boolean } | null {
  if (!previous) return null
  const change = ((current - previous) * 100) / previous
  if (Math.abs(change) < 0.5) return { text: '持平', up: false }
  return {
    text: `${change > 0 ? '+' : ''}${change.toFixed(change >= 100 || change <= -100 ? 0 : 1)}%`,
    up: change > 0
  }
}

/** 大数字：1.2万 / 3.4亿 */
export function compactNumber(value: number): string {
  if (value >= 1e8) return `${(value / 1e8).toFixed(1)}亿`
  if (value >= 1e4) return `${(value / 1e4).toFixed(1)}万`
  return value.toLocaleString()
}
