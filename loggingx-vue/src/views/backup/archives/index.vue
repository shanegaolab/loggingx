<!-- 归档记录：每个日志库每天一份归档，可下载或恢复到日志库查看 -->
<template>
  <LogxPageCard>
    <div class="toolbar">
      <ElSelect
        v-model="filterStore"
        placeholder="全部日志库"
        clearable
        size="small"
        class="toolbar-store"
      >
        <ElOption
          v-for="item in policies"
          :key="item.storeId"
          :value="item.storeId"
          :label="item.storeName"
        />
      </ElSelect>
      <ElRadioGroup v-model="filterStatus" size="small">
        <ElRadioButton value="">全部</ElRadioButton>
        <ElRadioButton value="success">成功</ElRadioButton>
        <ElRadioButton value="failed">失败</ElRadioButton>
      </ElRadioGroup>
      <ElButton size="small" :loading="loading" @click="load()">
        <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" class="mr-1" />刷新
      </ElButton>
      <span class="muted small"
        >归档为 gzip 压缩的 JSON Lines，下载后可用 zcat / 解压工具直接查看</span
      >
      <span v-if="status?.running" class="running small"><i class="dot"></i>正在归档…</span>
    </div>
    <ElTable v-loading="loading" :data="archives" size="small" height="100%" class="table">
      <template #empty>
        <ElEmpty :image-size="72" description="还没有归档" />
      </template>
      <ElTableColumn label="日期" width="120">
        <template #default="{ row }"
          ><span class="mono">{{ row.day }}</span></template
        >
      </ElTableColumn>
      <ElTableColumn label="日志库" min-width="140">
        <template #default="{ row }">{{ storeName(row) }}</template>
      </ElTableColumn>
      <ElTableColumn label="日志数" width="110" align="right">
        <template #default="{ row }"
          ><span class="mono">{{ row.recordCount.toLocaleString() }}</span></template
        >
      </ElTableColumn>
      <ElTableColumn label="大小" width="170">
        <template #default="{ row }">
          <template v-if="row.status === 'success'">
            <span class="mono">{{ formatBytes(row.sizeBytes) }}</span>
            <span class="muted"> / 原始 {{ formatBytes(row.rawBytes) }}</span>
          </template>
          <span v-else class="muted">-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="状态" min-width="200">
        <template #default="{ row }">
          <template v-if="row.status === 'failed'">
            <ElTooltip :content="row.error ?? ''" placement="top">
              <ElTag type="danger" size="small">归档失败</ElTag>
            </ElTooltip>
            <span class="muted small ml-2">下次运行重试</span>
          </template>
          <template v-else>
            <ElTag type="success" size="small" effect="plain">已归档</ElTag>
            <template v-if="row.restoreStatus">
              <ElTooltip
                :content="RESTORE_TIPS[row.restoreStatus as Api.Backup.RestoreStatus](row)"
                placement="top"
              >
                <ElTag
                  :type="RESTORE_TAGS[row.restoreStatus as Api.Backup.RestoreStatus]"
                  size="small"
                  class="ml-1"
                >
                  {{ RESTORE_NAMES[row.restoreStatus as Api.Backup.RestoreStatus] }}
                </ElTag>
              </ElTooltip>
            </template>
          </template>
        </template>
      </ElTableColumn>
      <ElTableColumn label="归档时间" width="160" prop="archiveTime" />
      <ElTableColumn label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'success'">
            <ElButton link type="primary" size="small" @click="download(row)">下载</ElButton>
            <ElButton
              v-if="row.restoreStatus === 'restored'"
              link
              type="primary"
              size="small"
              @click="openLogs(row)"
              >查看日志</ElButton
            >
            <ElButton
              v-else
              link
              type="primary"
              size="small"
              :disabled="row.restoreStatus === 'restoring' || !storeExists(row)"
              @click="restore(row)"
              >恢复</ElButton
            >
          </template>
        </template>
      </ElTableColumn>
    </ElTable>
  </LogxPageCard>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import LogxPageCard from '@/components/core/cards/logx-page-card/index.vue'
  import { ElMessageBox } from 'element-plus'
  import {
    fetchArchiveDownloadLink,
    fetchArchives,
    fetchBackupPolicies,
    fetchBackupStatus,
    restoreArchive
  } from '@/api/backup'
  import { formatBytes } from '@/views/monitor/shared'
  import { RESTORE_NAMES, RESTORE_TAGS, RESTORE_TIPS } from '../shared'

  defineOptions({ name: 'BackupArchive' })

  type Archive = Api.Backup.Archive

  const router = useRouter()
  const route = useRoute()
  const status = ref<Api.Backup.Status>()
  const policies = ref<Api.Backup.Policy[]>([])
  const archives = ref<Archive[]>([])
  const loading = ref(false)
  const filterStore = ref<number>()
  const filterStatus = ref('')

  const storeName = (archive: Archive) =>
    policies.value.find((policy) => policy.storeId === archive.storeId)?.storeName ??
    `${archive.storeCode}（已删除）`
  const storeExists = (archive: Archive) =>
    policies.value.some((policy) => policy.storeId === archive.storeId)

  const load = async (quiet = false) => {
    if (!quiet) loading.value = true
    try {
      archives.value = await fetchArchives({
        storeId: filterStore.value,
        status: filterStatus.value || undefined,
        limit: 1000
      })
    } finally {
      loading.value = false
    }
  }

  const loadStatus = async () => {
    status.value = await fetchBackupStatus()
  }

  // 日志库名称取自归档策略列表
  const loadAll = async () => {
    policies.value = await fetchBackupPolicies()
    await Promise.all([load(), loadStatus()])
  }

  const restore = async (archive: Archive) => {
    try {
      await ElMessageBox.confirm(
        `把 ${storeName(archive)} ${archive.day} 的 ${archive.recordCount.toLocaleString()} 条日志恢复到日志库？恢复后可在日志查询中查看，保留 7 天后自动清理（不影响归档文件）。`,
        '恢复归档',
        { confirmButtonText: '恢复', cancelButtonText: '取消', type: 'info' }
      )
    } catch {
      return
    }
    await restoreArchive(archive.id)
    ElMessage.success('已开始恢复，完成后可查看日志')
    await load(true)
    poll()
  }

  const download = async (archive: Archive) => {
    const { url } = await fetchArchiveDownloadLink(archive.id)
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
    // 下载链接自带 10 分钟有效的签名，浏览器直接下载，不经过前端内存
    window.open(`${base}${url}`, '_blank', 'noopener')
  }

  const openLogs = (archive: Archive) => {
    router.push({
      name: 'LogQuery',
      query: {
        storeId: archive.storeId,
        start: `${archive.day} 00:00:00`,
        end: `${archive.day} 23:59:59`
      }
    })
  }

  const busy = () =>
    status.value?.running || archives.value.some((archive) => archive.restoreStatus === 'restoring')

  // 有归档或恢复在进行时每 3 秒刷新，结束后停止
  let timer: ReturnType<typeof setTimeout> | undefined
  const poll = () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      await Promise.all([loadStatus(), load(true)])
      if (busy()) poll()
    }, 3000)
  }

  watch([filterStore, filterStatus], () => load())

  // 从归档策略带 ?storeId= 进来时只看该日志库
  const applyRoute = () => {
    if (route.name !== 'BackupArchive') return
    const storeId = Number(route.query.storeId)
    filterStore.value = storeId || undefined
  }
  watch(() => route.query.storeId, applyRoute)

  let activatedOnce = false
  onMounted(async () => {
    applyRoute()
    await loadAll()
    if (busy()) poll()
  })
  // 页面被缓存时，再次进入刷新（首次进入由 onMounted 加载）
  onActivated(() => {
    if (activatedOnce) loadAll()
    activatedOnce = true
  })
  onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 10px;
    align-items: center;
    margin-bottom: 10px;
  }

  .toolbar-store {
    width: 180px;
  }

  .table {
    flex: 1;
    min-height: 0;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .small {
    font-size: 12px;
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
</style>
