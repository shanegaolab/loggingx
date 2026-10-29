/** 备份管理两个页面共用的文案与格式化 */

type Archive = Api.Backup.Archive
type RestoreStatus = Api.Backup.RestoreStatus

export const RESTORE_NAMES: Record<RestoreStatus, string> = {
  restoring: '恢复中',
  restored: '已恢复',
  failed: '恢复失败',
  expired: '恢复已过期'
}

export const RESTORE_TAGS: Record<RestoreStatus, 'warning' | 'primary' | 'danger' | 'info'> = {
  restoring: 'warning',
  restored: 'primary',
  failed: 'danger',
  expired: 'info'
}

export const RESTORE_TIPS: Record<RestoreStatus, (archive: Archive) => string> = {
  restoring: () => '正在从存储读取并写回日志库',
  restored: (archive) => `可在日志查询中查看，保留到 ${archive.restoredUntil}`,
  failed: (archive) => `恢复失败：${archive.restoreError ?? ''}，可重新恢复`,
  expired: (archive) => `恢复的日志已于 ${archive.restoredUntil} 清理，可再次恢复`
}

/** 压缩比，如「1/12」 */
export const ratio = (raw: number, size: number) =>
  size ? `1/${Math.max(1, Math.round(raw / size))}` : '-'
