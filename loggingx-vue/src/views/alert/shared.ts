/** 告警中心各页面共用的数据与文案 */
import { onMounted, provide, ref, type InjectionKey, type Ref } from 'vue'
import {
  fetchAlertStores,
  fetchLogRules,
  fetchNotifyGroups,
  fetchNotifyUsers
} from '@/api/alert-center'

export const CHANNEL_NAMES: Record<Api.AlertCenter.Channel, string> = {
  email: '邮件',
  sms: '短信'
}

export const KIND_NAMES: Record<Api.AlertCenter.NotifyRecord['kind'], string> = {
  firing: '告警',
  resolved: '恢复',
  repeat: '重复提醒',
  diagnosis: 'AI 建议',
  test: '测试'
}

/** 规则对话框、通知组等共用的选项，由告警中心页面加载后注入 */
export interface AlertCenterContext {
  stores: Ref<Api.AlertCenter.StoreOption[]>
  users: Ref<Api.AlertCenter.UserOption[]>
  groups: Ref<Api.AlertCenter.Group[]>
  logRules: Ref<Api.AlertCenter.LogRule[]>
  reloadGroups: () => Promise<void>
  reloadLogRules: () => Promise<void>
}

export const ALERT_CENTER: InjectionKey<AlertCenterContext> = Symbol('alert-center')

/**
 * 告警中心的页面加载自己用到的选项并注入给子组件；没加载的保持空列表
 * （各页面权限不同，例如只有告警事件页的角色无权读取通知组）
 */
export function provideAlertCenter(load: {
  stores?: boolean
  users?: boolean
  groups?: boolean
  logRules?: boolean
}): AlertCenterContext {
  const ctx: AlertCenterContext = {
    stores: ref([]),
    users: ref([]),
    groups: ref([]),
    logRules: ref([]),
    reloadGroups: async () => {
      ctx.groups.value = await fetchNotifyGroups()
    },
    reloadLogRules: async () => {
      ctx.logRules.value = await fetchLogRules()
    }
  }
  provide(ALERT_CENTER, ctx)
  onMounted(() => {
    if (load.stores) fetchAlertStores().then((list) => (ctx.stores.value = list))
    if (load.users) fetchNotifyUsers().then((list) => (ctx.users.value = list))
    if (load.groups) ctx.reloadGroups()
    if (load.logRules) ctx.reloadLogRules()
  })
  return ctx
}

export const emptyNotify = (): Api.AlertCenter.RuleNotify => ({
  channels: [],
  userIds: [],
  groupIds: [],
  notifyResolved: true,
  repeatMinutes: 0
})

/** 「邮件 + 短信 → 2 人、1 个组」 */
export function describeNotify(
  notify: Api.AlertCenter.RuleNotify | undefined,
  groups: Api.AlertCenter.Group[]
): string {
  if (!notify?.channels.length) return '不通知'
  const who: string[] = []
  if (notify.userIds.length) who.push(`${notify.userIds.length} 人`)
  const names = notify.groupIds
    .map((id) => groups.find((group) => group.id === id)?.name)
    .filter(Boolean)
  if (names.length) who.push(names.join('、'))
  return `${notify.channels.map((c) => CHANNEL_NAMES[c]).join(' + ')} → ${who.join('，') || '-'}`
}

/** 「最近 5 分钟 ERROR、FATAL 且包含 "timeout" 的日志 > 10 条」 */
export function describeLogRule(
  rule: Pick<Api.AlertCenter.LogRule, 'levels' | 'keyword' | 'host' | 'windowMinutes' | 'threshold'>
): string {
  const parts: string[] = []
  if (rule.levels.length) parts.push(rule.levels.join('、'))
  if (rule.keyword) parts.push(`包含「${rule.keyword}」`)
  if (rule.host) parts.push(`主机 ${rule.host}`)
  return `最近 ${rule.windowMinutes} 分钟 ${parts.join(' 且 ') || '所有'} 的日志 > ${rule.threshold} 条`
}

export function formatDuration(startedAt: number, endedAt?: number | null): string {
  const minutes = Math.max(0, Math.round(((endedAt ?? Date.now()) - startedAt) / 60_000))
  if (minutes < 60) return `${minutes} 分钟`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
  return `${Math.floor(minutes / 1440)} 天 ${Math.floor((minutes % 1440) / 60)} 小时`
}

export const userLabel = (user: Api.AlertCenter.UserOption) =>
  user.nickName && user.nickName !== user.username
    ? `${user.nickName}（${user.username}）`
    : user.username
