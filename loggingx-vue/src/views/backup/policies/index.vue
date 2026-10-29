<!-- 归档策略：S3 兼容存储、每天的归档任务，以及各日志库的归档时机与保留天数 -->
<template>
  <div class="backup-page logx-full-height">
    <ElCard shadow="never" class="backup-head">
      <div class="head-grid">
        <div class="head-block">
          <div class="head-block__title">
            <LogxSvgIcon icon="ri:cloud-line" />备份存储
            <ElButton link type="primary" size="small" @click="storageVisible = true">
              {{ storage ? '修改' : '配置' }}
            </ElButton>
          </div>
          <template v-if="storage">
            <div class="head-block__main mono"
              >{{ storage.bucket }}{{ storage.prefix ? `/${storage.prefix}` : '' }}</div
            >
            <div class="head-block__meta mono">{{ storage.endpoint }} · {{ storage.region }}</div>
          </template>
          <template v-else>
            <div class="head-block__main muted">尚未配置</div>
            <div class="head-block__meta"
              >归档文件保存到 S3 兼容对象存储（MinIO / OSS / COS / S3）</div
            >
          </template>
        </div>
        <div class="head-block">
          <div class="head-block__title">
            <LogxSvgIcon icon="ri:archive-line" />已归档
            <ElButton
              v-if="canSeeArchives"
              link
              type="primary"
              size="small"
              @click="showArchives()"
            >
              查看记录
            </ElButton>
          </div>
          <div class="head-block__main">
            {{ totals.archives }} 天 · {{ formatBytes(totals.size) }}
          </div>
          <div class="head-block__meta">
            原始 {{ formatBytes(totals.raw)
            }}<template v-if="totals.size">，压缩为 {{ ratio(totals.raw, totals.size) }}</template>
          </div>
        </div>
        <div class="head-block">
          <div class="head-block__title">
            <LogxSvgIcon icon="ri:time-line" />归档任务
            <span class="muted small">每天 02:30 自动执行</span>
          </div>
          <div class="head-block__main">
            <template v-if="status?.running"
              ><span class="running"><i class="dot"></i>正在归档…</span></template
            >
            <template v-else-if="status?.lastFinishTime">
              上次 {{ status.lastFinishTime.slice(5, 16) }}：归档 {{ status.archived }} 天
              <span v-if="status.failed" class="text-danger">，失败 {{ status.failed }}</span>
              <span v-if="status.deleted">，清理 {{ status.deleted }}</span>
            </template>
            <span v-else class="muted">本次启动后尚未执行</span>
          </div>
          <div v-if="status?.error" class="head-block__meta text-danger">{{ status.error }}</div>
          <ElButton
            size="small"
            class="mt-2"
            :disabled="!storage || !enabledCount"
            :loading="status?.running"
            @click="run"
          >
            <LogxSvgIcon v-if="!status?.running" icon="ri:play-line" class="mr-1" />立即归档
          </ElButton>
        </div>
      </div>
      <ElAlert v-if="!storage" type="warning" :closable="false" show-icon class="mt-3">
        先配置备份存储，再为日志库开启归档。
        <ElButton link type="primary" @click="storageVisible = true">配置存储</ElButton>
      </ElAlert>
    </ElCard>

    <ElCard shadow="never" class="backup-body">
      <div class="body-title">
        归档策略
        <span class="muted">{{ enabledCount }}/{{ policies.length }} 个日志库已开启</span>
      </div>
      <ElTable v-loading="loading" :data="policies" size="small" height="100%" class="table">
        <ElTableColumn label="日志库" min-width="180">
          <template #default="{ row }">
            <div class="name">{{ row.storeName }}</div>
            <div class="muted">{{ row.storeCode }} · 日志保留 {{ row.retentionDays }} 天</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="归档" width="90">
          <template #default="{ row }">
            <ElTag v-if="row.enabled" type="success" size="small" effect="plain">已开启</ElTag>
            <ElTag v-else-if="row.enabled === false" type="info" size="small" effect="plain"
              >已暂停</ElTag
            >
            <span v-else class="muted">未开启</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="策略" min-width="200">
          <template #default="{ row }">
            <template v-if="row.archiveAfterDays">
              超过 {{ row.archiveAfterDays }} 天归档，保留 {{ row.keepDays }} 天
              <ElTooltip
                v-if="row.archiveAfterDays >= row.retentionDays"
                content="归档时机不小于日志保留天数，部分日志会在归档前被删除"
              >
                <LogxSvgIcon icon="ri:error-warning-line" class="text-warning" />
              </ElTooltip>
            </template>
            <span v-else class="muted">-</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="已归档" min-width="170">
          <template #default="{ row }">
            <template v-if="row.archives">
              <div>{{ row.archives }} 天 · {{ formatBytes(row.archivedBytes) }}</div>
              <div class="muted"
                >原始 {{ formatBytes(row.rawBytes) }}，压缩为
                {{ ratio(row.rawBytes, row.archivedBytes) }}</div
              >
            </template>
            <span v-else class="muted">-</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="最近归档日" width="120">
          <template #default="{ row }">
            {{ row.latestDay ?? '-' }}
            <div v-if="row.failed" class="text-danger small">{{ row.failed }} 天失败，下次重试</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <ElButton
              link
              type="primary"
              size="small"
              :disabled="!storage"
              @click="editPolicy(row)"
            >
              {{ row.archiveAfterDays ? '设置' : '开启归档' }}
            </ElButton>
            <ElButton
              v-if="row.archives && canSeeArchives"
              link
              type="primary"
              size="small"
              @click="showArchives(row.storeId)"
            >
              归档记录
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <StorageDialog v-model="storageVisible" :storage="storage" @saved="loadAll" />
    <PolicyDialog v-model="policyVisible" :policy="editing" @saved="loadPolicies" />
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import StorageDialog from '../modules/storage-dialog.vue'
  import PolicyDialog from '../modules/policy-dialog.vue'
  import {
    fetchBackupPolicies,
    fetchBackupStatus,
    fetchBackupStorage,
    runBackup
  } from '@/api/backup'
  import { formatBytes } from '@/views/monitor/shared'
  import { ratio } from '../shared'

  defineOptions({ name: 'LogBackup' })

  const router = useRouter()
  const route = useRoute()
  const storage = ref<Api.Backup.Storage | null>(null)
  const status = ref<Api.Backup.Status>()
  const policies = ref<Api.Backup.Policy[]>([])
  const loading = ref(false)
  const storageVisible = ref(false)
  const policyVisible = ref(false)
  const editing = ref<Api.Backup.Policy>()

  const canSeeArchives = computed(() => router.hasRoute('BackupArchive'))
  const enabledCount = computed(() => policies.value.filter((policy) => policy.enabled).length)
  const totals = computed(() => ({
    archives: policies.value.reduce((sum, policy) => sum + policy.archives, 0),
    size: policies.value.reduce((sum, policy) => sum + policy.archivedBytes, 0),
    raw: policies.value.reduce((sum, policy) => sum + policy.rawBytes, 0)
  }))

  const loadPolicies = async () => {
    loading.value = true
    try {
      policies.value = await fetchBackupPolicies()
    } finally {
      loading.value = false
    }
  }

  const loadStatus = async () => {
    status.value = await fetchBackupStatus()
  }

  const loadAll = async () => {
    storage.value = await fetchBackupStorage()
    await Promise.all([loadPolicies(), loadStatus()])
  }

  const editPolicy = (policy: Api.Backup.Policy) => {
    editing.value = policy
    policyVisible.value = true
  }

  const showArchives = (storeId?: number) =>
    router.push({ name: 'BackupArchive', query: storeId ? { storeId } : undefined })

  const run = async () => {
    status.value = await runBackup()
    ElMessage.success('已开始归档，完成后自动刷新')
    poll()
  }

  // 归档进行中每 3 秒刷新状态，结束后刷新各日志库的归档统计
  let timer: ReturnType<typeof setTimeout> | undefined
  const poll = () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      await loadStatus()
      if (status.value?.running) poll()
      else loadPolicies()
    }, 3000)
  }

  /**
   * 从日志库卡片带 storeId 进来：未设置归档的直接打开策略设置，已设置的打开其归档记录
   */
  const applyRoute = () => {
    const storeId = Number(route.query.storeId)
    const policy = policies.value.find((item) => item.storeId === storeId)
    if (!policy) return
    if (!policy.archiveAfterDays) {
      if (storage.value) editPolicy(policy)
      else storageVisible.value = true
    } else if (canSeeArchives.value) {
      showArchives(storeId)
    }
  }
  watch(
    () => route.query.storeId,
    (id) => {
      if (id && route.name === 'LogBackup') applyRoute()
    }
  )

  let activatedOnce = false
  onMounted(async () => {
    await loadAll()
    applyRoute()
    if (status.value?.running) poll()
  })
  // 页面被缓存时，再次进入刷新（首次进入由 onMounted 加载）
  onActivated(() => {
    if (activatedOnce) loadAll()
    activatedOnce = true
  })
  onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
  .backup-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .backup-head {
    flex: none;
  }

  .backup-head :deep(.el-card__body) {
    padding: 16px 20px;
  }

  .head-grid {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1.2fr;
    gap: 16px;
  }

  .head-block + .head-block {
    padding-left: 16px;
    border-left: 1px solid var(--el-border-color-lighter);
  }

  .head-block__title {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .head-block__main {
    margin-top: 6px;
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .head-block__meta {
    margin-top: 2px;
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .backup-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .backup-body :deep(.el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 14px 20px 16px;
  }

  .body-title {
    display: flex;
    gap: 10px;
    align-items: baseline;
    margin-bottom: 10px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .table {
    flex: 1;
    min-height: 0;
  }

  .name {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  .muted {
    font-size: 12px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .small {
    font-size: 12px;
  }

  .text-danger {
    color: var(--el-color-danger);
  }

  .text-warning {
    color: var(--el-color-warning);
  }

  .running {
    display: inline-flex;
    align-items: center;
    color: var(--el-color-primary);
  }

  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 6px;
    background: currentcolor;
    border-radius: 50%;
    animation: pulse 1.2s infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }

  @media (width <= 640px) {
    .head-grid {
      grid-template-columns: 1fr;
    }

    .head-block + .head-block {
      padding-top: 12px;
      padding-left: 0;
      border-top: 1px solid var(--el-border-color-lighter);
      border-left: none;
    }
  }
</style>
