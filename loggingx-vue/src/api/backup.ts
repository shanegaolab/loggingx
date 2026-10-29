import request from '@/utils/http'

/** 备份存储配置；未配置时为 null */
export function fetchBackupStorage() {
  return request.get<Api.Backup.Storage | null>({ url: '/api/backup/storage' })
}

/** 保存存储配置；secretKey 留空沿用已保存的 */
export function saveBackupStorage(data: Api.Backup.StorageForm) {
  return request.put<Api.Backup.Storage>({
    url: '/api/backup/storage',
    data,
    showSuccessMessage: false
  })
}

/** 测试连接：访问存储桶，写入并删除一个测试对象（不保存配置） */
export function testBackupStorage(data: Api.Backup.StorageForm) {
  return request.post<void>({
    url: '/api/backup/storage/test',
    data,
    showSuccessMessage: false
  })
}

export function fetchBackupPolicies() {
  return request.get<Api.Backup.Policy[]>({ url: '/api/backup/policies' })
}

export function saveBackupPolicy(
  storeId: number,
  data: { enabled: boolean; archiveAfterDays: number; keepDays: number }
) {
  return request.put<void>({
    url: `/api/backup/policies/${storeId}`,
    data,
    showSuccessMessage: false
  })
}

export function fetchBackupStatus() {
  return request.get<Api.Backup.Status>({ url: '/api/backup/status' })
}

/** 立即执行一次归档（后台运行） */
export function runBackup() {
  return request.post<Api.Backup.Status>({ url: '/api/backup/run', showSuccessMessage: false })
}

export function fetchArchives(params: { storeId?: number; status?: string; limit?: number }) {
  return request.get<Api.Backup.Archive[]>({ url: '/api/backup/archives', params })
}

/** 恢复归档到日志库（后台运行） */
export function restoreArchive(id: number) {
  return request.post<Api.Backup.Archive>({
    url: `/api/backup/archives/${id}/restore`,
    showSuccessMessage: false
  })
}

/** 获取 10 分钟内有效的下载链接 */
export function fetchArchiveDownloadLink(id: number) {
  return request.post<{ url: string }>({
    url: `/api/backup/archives/${id}/download-link`,
    showSuccessMessage: false
  })
}
