import request from '@/utils/http'

/** 告警规则可选的日志库 */
export function fetchAlertStores() {
  return request.get<Api.AlertCenter.StoreOption[]>({ url: '/api/alert-center/stores' })
}

/** 可选的通知用户（邮箱、手机号已脱敏） */
export function fetchNotifyUsers() {
  return request.get<Api.AlertCenter.UserOption[]>({ url: '/api/alert-center/users' })
}

// ---------- 日志告警 ----------

export function fetchLogRules() {
  return request.get<Api.AlertCenter.LogRule[]>({ url: '/api/alert-center/log-rules' })
}

export function createLogRule(data: Api.AlertCenter.LogRuleForm) {
  return request.post<Api.AlertCenter.LogRule>({
    url: '/api/alert-center/log-rules',
    data,
    showSuccessMessage: false
  })
}

export function updateLogRule(id: number, data: Api.AlertCenter.LogRuleForm) {
  return request.put<Api.AlertCenter.LogRule>({
    url: `/api/alert-center/log-rules/${id}`,
    data,
    showSuccessMessage: false
  })
}

export function deleteLogRule(id: number) {
  return request.del<void>({ url: `/api/alert-center/log-rules/${id}` })
}

export interface LogAlertQuery {
  status?: 'firing' | 'resolved'
  storeId?: number
  days?: number
  limit?: number
}

export function fetchLogAlerts(query: LogAlertQuery = {}) {
  return request.get<Api.AlertCenter.LogEvent[]>({
    url: '/api/alert-center/log-alerts',
    params: query
  })
}

// ---------- 通知渠道 ----------

export function fetchNotifyChannels() {
  return request.get<Api.AlertCenter.Channels>({ url: '/api/alert-center/notify/channels' })
}

export function saveEmailSettings(data: Api.AlertCenter.EmailSettings) {
  return request.put<Api.AlertCenter.EmailSettings>({
    url: '/api/alert-center/notify/email',
    data,
    showSuccessMessage: false
  })
}

export function saveSmsSettings(data: Api.AlertCenter.SmsSettings) {
  return request.put<Api.AlertCenter.SmsSettings>({
    url: '/api/alert-center/notify/sms',
    data,
    showSuccessMessage: false
  })
}

/** 用当前填写（未保存）的配置发一封测试邮件 */
export function testEmail(settings: Api.AlertCenter.EmailSettings, to: string) {
  return request.post<void>({
    url: '/api/alert-center/notify/email/test',
    data: { settings, to },
    showSuccessMessage: false,
    showErrorMessage: false
  })
}

export function testSms(settings: Api.AlertCenter.SmsSettings, phone: string) {
  return request.post<void>({
    url: '/api/alert-center/notify/sms/test',
    data: { settings, phone },
    showSuccessMessage: false,
    showErrorMessage: false
  })
}

// ---------- 通知组 ----------

export function fetchNotifyGroups() {
  return request.get<Api.AlertCenter.Group[]>({ url: '/api/alert-center/notify/groups' })
}

export function createNotifyGroup(data: Api.AlertCenter.GroupForm) {
  return request.post<Api.AlertCenter.Group>({
    url: '/api/alert-center/notify/groups',
    data,
    showSuccessMessage: false
  })
}

export function updateNotifyGroup(id: number, data: Api.AlertCenter.GroupForm) {
  return request.put<Api.AlertCenter.Group>({
    url: `/api/alert-center/notify/groups/${id}`,
    data,
    showSuccessMessage: false
  })
}

export function deleteNotifyGroup(id: number) {
  return request.del<void>({ url: `/api/alert-center/notify/groups/${id}` })
}

// ---------- 通知记录 ----------

export function fetchNotifyRecords(params: {
  eventType?: string
  eventId?: number
  limit?: number
}) {
  return request.get<Api.AlertCenter.NotifyRecord[]>({
    url: '/api/alert-center/notify/records',
    params
  })
}
