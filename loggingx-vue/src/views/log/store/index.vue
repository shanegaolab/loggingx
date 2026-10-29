<!-- 日志库管理页面：卡片展示每个日志库的状态、近期写入和上报 Token -->
<template>
  <div class="log-store-page logx-full-height">
    <ElCard shadow="never" class="store-toolbar">
      <div class="store-toolbar__inner">
        <div class="summary">
          <div class="summary__item">
            <span class="summary__value">{{ stores.length }}</span>
            <span class="summary__label">日志库</span>
            <span v-if="disabledCount" class="summary__extra">{{ disabledCount }} 个已停用</span>
          </div>
          <div class="summary__divider"></div>
          <div class="summary__item">
            <span class="summary__value">{{ totalRecent }}</span>
            <span class="summary__label">近 24 小时日志</span>
          </div>
          <div class="summary__divider"></div>
          <div class="summary__item">
            <span class="summary__value">{{ latestLogText }}</span>
            <span class="summary__label">最近写入</span>
          </div>
          <div class="summary__divider"></div>
          <div class="summary__item">
            <span class="summary__value">{{ onlineAgents }}/{{ totalAgents }}</span>
            <span class="summary__label">Agent 在线</span>
          </div>
        </div>
        <div class="store-toolbar__actions">
          <ElInput
            v-model="keyword"
            placeholder="搜索名称或编码"
            clearable
            class="store-toolbar__search"
          >
            <template #prefix>
              <LogxSvgIcon icon="ri:search-line" />
            </template>
          </ElInput>
          <ElTooltip content="刷新" placement="top">
            <ElButton :loading="loading" circle @click="getStores">
              <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" />
            </ElButton>
          </ElTooltip>
          <ElButton type="primary" @click="showDialog('add')">
            <LogxSvgIcon icon="ri:add-line" class="mr-1" />新增日志库
          </ElButton>
        </div>
      </div>
    </ElCard>

    <div v-loading="loading" class="store-body">
      <ElEmpty
        v-if="!loading && filteredStores.length === 0"
        :description="stores.length ? '没有匹配的日志库' : '还没有日志库，创建一个开始接入日志'"
      >
        <ElButton v-if="!stores.length" type="primary" @click="showDialog('add')">
          新增日志库
        </ElButton>
      </ElEmpty>

      <div v-else class="store-grid">
        <div
          v-for="store in filteredStores"
          :key="store.storeId"
          class="store-card"
          :class="{ 'is-disabled': !store.enabled }"
        >
          <div class="store-card__head">
            <div class="store-card__icon">
              <LogxSvgIcon icon="ri:database-2-line" />
            </div>
            <div class="store-card__title">
              <div class="store-card__name" :title="store.name">{{ store.name }}</div>
              <div class="store-card__code">{{ store.code }}</div>
            </div>
            <span class="status" :class="store.enabled ? 'status--on' : 'status--off'">
              <i class="status__dot"></i>{{ store.enabled ? '启用' : '停用' }}
            </span>
            <ElDropdown
              trigger="click"
              @command="(command: string) => handleCommand(command, store)"
            >
              <ElButton text circle size="small" class="store-card__more">
                <LogxSvgIcon icon="ri:more-2-fill" />
              </ElButton>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem command="edit">编辑</ElDropdownItem>
                  <ElDropdownItem command="agent">采集 Agent</ElDropdownItem>
                  <ElDropdownItem command="deploy">部署 Agent</ElDropdownItem>
                  <ElDropdownItem v-if="canBackup" command="backup">归档备份</ElDropdownItem>
                  <ElDropdownItem command="guide">接入指引</ElDropdownItem>
                  <ElDropdownItem command="token">重置 Token</ElDropdownItem>
                  <ElDropdownItem command="delete" divided>
                    <span class="text-[var(--el-color-danger)]">删除</span>
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>

          <p class="store-card__desc" :class="{ 'is-empty': !store.description }">
            {{ store.description || '暂无描述' }}
          </p>

          <div class="store-card__metrics">
            <div class="metric">
              <div class="metric__value">
                {{ store.recentCount === null ? '-' : store.recentCount.toLocaleString() }}
              </div>
              <div class="metric__label">近 24 小时</div>
            </div>
            <div class="metric">
              <ElTooltip
                :content="store.lastLogTime ?? ''"
                :disabled="!store.lastLogTime"
                placement="top"
              >
                <div class="metric__value">
                  {{ store.lastLogTime ? formatRelative(store.lastLogTime) : '-' }}
                </div>
              </ElTooltip>
              <div class="metric__label">最近日志</div>
            </div>
            <div class="metric">
              <div class="metric__value">{{ store.retentionDays }} 天</div>
              <div class="metric__label">保留时长</div>
            </div>
            <ElTooltip
              :content="store.agentCount ? '查看采集 Agent' : '还没有 Agent，点击部署'"
              placement="top"
            >
              <button type="button" class="metric metric--link" @click="openAgents(store)">
                <div class="metric__value">
                  <template v-if="store.agentCount">
                    <i class="agent-dot" :class="{ 'is-online': store.onlineAgentCount }"></i
                    >{{ store.onlineAgentCount }}/{{ store.agentCount }}
                  </template>
                  <LogxSvgIcon v-else icon="ri:add-circle-line" class="agent-add" />
                </div>
                <div class="metric__label">{{
                  store.agentCount ? 'Agent 在线' : '部署 Agent'
                }}</div>
              </button>
            </ElTooltip>
          </div>

          <div class="store-card__token">
            <span class="store-card__token-label">Token</span>
            <code class="store-card__token-value">{{ maskToken(store.ingestToken) }}</code>
            <ElTooltip content="复制 Token" placement="top">
              <ElButton text circle size="small" @click="copyToken(store.ingestToken)">
                <LogxSvgIcon icon="ri:file-copy-line" />
              </ElButton>
            </ElTooltip>
            <ElButton link type="primary" size="small" class="ml-auto" @click="showGuide(store)">
              接入指引
            </ElButton>
          </div>

          <div v-if="canBackup" class="store-card__backup">
            <LogxSvgIcon
              icon="ri:archive-line"
              class="store-card__backup-icon"
              :class="{ 'is-on': store.backup?.enabled }"
            />
            <span class="store-card__backup-text">{{ backupText(store) }}</span>
            <ElTooltip
              v-if="store.backup?.failed || store.backup?.pendingDays"
              :content="`${store.backup.failed ? `${store.backup.failed} 天归档失败，下次运行重试。` : ''}${
                store.backup.pendingDays
                  ? `${store.backup.pendingDays} 天已超过保留期，归档成功前暂不删除。`
                  : ''
              }`"
              placement="top"
            >
              <LogxSvgIcon icon="ri:error-warning-fill" class="store-card__backup-warn" />
            </ElTooltip>
            <ElButton link type="primary" size="small" class="ml-auto" @click="openBackup(store)">
              {{ store.backup?.enabled || store.backup?.archives ? '备份管理' : '开启归档' }}
            </ElButton>
          </div>

          <div class="store-card__foot">
            <ElButton size="small" @click="openPage('LogQuery', store)">
              <LogxSvgIcon icon="ri:search-line" class="mr-1" />查询日志
            </ElButton>
            <ElButton size="small" @click="openPage('LogTail', store)">
              <LogxSvgIcon icon="ri:terminal-box-line" class="mr-1" />实时日志
            </ElButton>
          </div>
        </div>
      </div>
    </div>

    <StoreDialog
      v-model="dialogVisible"
      :dialog-type="dialogType"
      :store-data="currentStore"
      @success="handleSaved"
    />
    <IngestGuide v-model="guideVisible" :store="currentStore" />

    <ElDrawer
      v-model="agentVisible"
      :title="agentStore ? `采集 Agent · ${agentStore.name}（${agentStore.code}）` : '采集 Agent'"
      size="min(960px, 100%)"
      destroy-on-close
      class="agent-drawer"
    >
      <AgentWorkspace
        v-if="agentStore"
        v-model:tab="agentTab"
        :store="agentStore"
        :meta="agentMeta"
        @agents-changed="onAgentsChanged"
      />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import {
    fetchDeleteLogStore,
    fetchGetLogStoreList,
    fetchRegenerateLogStoreToken
  } from '@/api/log'
  import StoreDialog from './modules/store-dialog.vue'
  import IngestGuide from './modules/ingest-guide.vue'
  import AgentWorkspace from '../agent/modules/agent-workspace.vue'
  import type { AgentTab } from '../agent/modules/agent-workspace.vue'
  import { fetchAgentMeta } from '@/api/agent'
  import { ElCheckbox, ElMessageBox } from 'element-plus'
  import { formatBytes } from '../../monitor/shared'
  import { formatRelative } from '../shared'

  defineOptions({ name: 'LogStore' })

  type LogStore = Api.Log.Store

  const router = useRouter()
  const canBackup = computed(() => router.hasRoute('LogBackup'))
  const loading = ref(false)
  const stores = ref<LogStore[]>([])
  const keyword = ref('')

  const dialogVisible = ref(false)
  const guideVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const currentStore = ref<LogStore>()

  const filteredStores = computed(() => {
    const text = keyword.value.trim().toLowerCase()
    if (!text) return stores.value
    return stores.value.filter(
      (store) => store.name.toLowerCase().includes(text) || store.code.includes(text)
    )
  })

  const disabledCount = computed(() => stores.value.filter((store) => !store.enabled).length)

  const totalAgents = computed(() =>
    stores.value.reduce((sum, store) => sum + (store.agentCount ?? 0), 0)
  )
  const onlineAgents = computed(() =>
    stores.value.reduce((sum, store) => sum + (store.onlineAgentCount ?? 0), 0)
  )

  // 采集 Agent 抽屉
  const agentVisible = ref(false)
  const agentStoreId = ref<number>()
  const agentTab = ref<AgentTab>('agents')
  const agentMeta = ref<Api.Agent.Meta>()
  const agentStore = computed(() =>
    stores.value.find((store) => store.storeId === agentStoreId.value)
  )

  const openAgents = async (store: LogStore, tab?: AgentTab) => {
    agentStoreId.value = store.storeId
    agentTab.value = tab ?? (store.agentCount ? 'agents' : 'deploy')
    agentVisible.value = true
    if (!agentMeta.value) agentMeta.value = await fetchAgentMeta()
  }

  /** Agent 列表刷新时同步更新卡片上的数量 */
  const onAgentsChanged = (agents: Api.Agent.Instance[]) => {
    const store = agentStore.value
    if (!store) return
    store.agentCount = agents.length
    store.onlineAgentCount = agents.filter((agent) => agent.online).length
  }

  const agentImpact = (store: LogStore) =>
    store.agentCount
      ? `该日志库有 ${store.agentCount} 个 Agent（${store.onlineAgentCount ?? 0} 个在线）。`
      : ''

  // 日志存储不可用时 recentCount 为 null
  const totalRecent = computed(() =>
    stores.value.some((store) => store.recentCount === null)
      ? '-'
      : stores.value.reduce((sum, store) => sum + (store.recentCount ?? 0), 0).toLocaleString()
  )

  const latestLogText = computed(() => {
    const latest = stores.value
      .map((store) => store.lastLogTime)
      .filter((time): time is string => !!time)
      .sort()
      .pop()
    return latest ? formatRelative(latest) : '-'
  })

  /** 只显示 Token 首尾，避免在页面上完整暴露 */
  const maskToken = (token: string) => `${token.slice(0, 7)}••••••${token.slice(-4)}`

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      ElMessage.success('Token 已复制')
    } catch {
      ElMessage.error('复制失败，请在接入指引中手动复制')
    }
  }

  const openPage = (name: 'LogQuery' | 'LogTail', store: LogStore) => {
    router.push({ name, query: { storeId: store.storeId } })
  }

  const handleCommand = (command: string, store: LogStore) => {
    if (command === 'edit') showDialog('edit', store)
    else if (command === 'agent') openAgents(store, 'agents')
    else if (command === 'deploy') openAgents(store, 'deploy')
    else if (command === 'guide') showGuide(store)
    else if (command === 'token') regenerateToken(store)
    else if (command === 'backup') openBackup(store)
    else if (command === 'delete') deleteStore(store)
  }

  onMounted(() => {
    getStores()
  })

  const getStores = async (): Promise<void> => {
    loading.value = true
    try {
      stores.value = await fetchGetLogStoreList()
    } finally {
      loading.value = false
    }
  }

  const showDialog = (type: 'add' | 'edit', store?: LogStore): void => {
    dialogType.value = type
    currentStore.value = store
    dialogVisible.value = true
  }

  const showGuide = (store: LogStore): void => {
    currentStore.value = store
    guideVisible.value = true
  }

  /** 新增成功后直接进入部署 Agent */
  const handleSaved = async (saved: LogStore, type: 'add' | 'edit'): Promise<void> => {
    await getStores()
    if (type === 'add') {
      const created = stores.value.find((store) => store.storeId === saved.storeId) ?? saved
      openAgents(created, 'deploy')
    }
  }

  const regenerateToken = async (store: LogStore): Promise<void> => {
    const agents = store.agentCount
      ? `${agentImpact(store)}它们会在下次同步时自动换用新 Token（离线的 Agent 上线后换用）。`
      : ''
    try {
      await ElMessageBox.confirm(
        `重置后旧 Token 立即失效。${agents}手动部署的 Agent 和其他采集端需要换用新 Token。确定重置"${store.name}"的上报 Token 吗？`,
        '重置 Token',
        { confirmButtonText: '重置', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    const updated = await fetchRegenerateLogStoreToken(store.storeId)
    await getStores()
    if (store.agentCount) {
      ElMessage.success(`Token 已重置，${store.agentCount} 个 Agent 将自动换用新 Token`)
      openAgents(stores.value.find((item) => item.storeId === store.storeId) ?? updated, 'agents')
    } else {
      ElMessage.success('Token 已重置')
      showGuide(updated)
    }
  }

  const deleteStore = async (store: LogStore): Promise<void> => {
    const agents = store.agentCount
      ? `${agentImpact(store)}它们会被移除且无法继续上报，请在这些主机上执行卸载命令。`
      : ''
    const archives = store.backup?.archives ?? 0
    // 有归档时可选择一并删除；默认保留，以后仍可在备份管理中下载
    const deleteArchives = ref(false)
    const message = () =>
      h('div', [
        h(
          'p',
          `删除日志库"${store.name}"会同时删除其全部日志，且不可恢复。${agents}${
            archives
              ? `该日志库在备份存储中有 ${archives} 天的归档，默认保留，仍可在备份管理中下载。`
              : ''
          }确定删除吗？`
        ),
        archives
          ? h(
              ElCheckbox,
              {
                modelValue: deleteArchives.value,
                'onUpdate:modelValue': (value: string | number | boolean) => {
                  deleteArchives.value = !!value
                },
                class: 'mt-2'
              },
              () => `同时删除 ${archives} 天的归档文件（不可恢复）`
            )
          : null
      ])
    try {
      await ElMessageBox.confirm(message, '删除日志库', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'error'
      })
    } catch {
      return
    }
    await fetchDeleteLogStore(store.storeId, deleteArchives.value)
    ElMessage.success(deleteArchives.value ? '已删除日志库及其归档' : '删除成功')
    getStores()
  }

  /** 日志库卡片上的归档状态 */
  const backupText = (store: LogStore) => {
    const backup = store.backup
    if (!backup?.enabled) {
      return backup?.archives ? `归档已暂停 · 已归档 ${backup.archives} 天` : '未开启归档'
    }
    const parts = [`超过 ${backup.archiveAfterDays} 天归档`]
    parts.push(
      backup.archives
        ? `已归档 ${backup.archives} 天 · ${formatBytes(backup.archivedBytes)}`
        : '暂无归档'
    )
    return parts.join(' · ')
  }

  const openBackup = (store: LogStore) => {
    router.push({ name: 'LogBackup', query: { storeId: store.storeId } })
  }
</script>

<style scoped>
  .log-store-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .store-toolbar {
    flex: none;
  }

  .store-toolbar :deep(.el-card__body) {
    padding: 14px 20px;
  }

  .store-toolbar__inner {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
    align-items: center;
    justify-content: space-between;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    align-items: center;
  }

  .summary__item {
    display: flex;
    gap: 6px;
    align-items: baseline;
  }

  .summary__value {
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .summary__label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .summary__extra {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .summary__divider {
    width: 1px;
    height: 20px;
    background: var(--el-border-color-lighter);
  }

  .store-toolbar__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .store-toolbar__search {
    width: 220px;
  }

  .store-body {
    flex: 1;
    min-height: 200px;
    overflow: auto;
  }

  .store-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }

  .store-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 16px 14px;
    background: var(--default-box-color, var(--el-bg-color));
    border: 1px solid var(--default-border, var(--el-border-color-lighter));
    border-radius: calc(var(--custom-radius, 8px) + 2px);
    transition:
      box-shadow 0.2s,
      border-color 0.2s;
  }

  .store-card:hover {
    border-color: var(--el-border-color);
    box-shadow: 0 4px 16px rgb(0 0 0 / 6%);
  }

  .store-card.is-disabled .store-card__icon,
  .store-card.is-disabled .store-card__name,
  .store-card.is-disabled .store-card__metrics {
    opacity: 0.55;
  }

  .store-card__head {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .store-card__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 18px;
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
    border-radius: 8px;
  }

  .store-card__title {
    flex: 1;
    min-width: 0;
  }

  .store-card__name {
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .store-card__code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .store-card__more {
    flex-shrink: 0;
  }

  .status {
    display: inline-flex;
    flex-shrink: 0;
    gap: 5px;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .status__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .status--on .status__dot {
    background: var(--el-color-success);
    box-shadow: 0 0 0 3px rgb(22 163 74 / 15%);
  }

  .status--off .status__dot {
    background: var(--el-text-color-placeholder);
  }

  .store-card__desc {
    display: -webkit-box;
    min-height: 40px;
    margin: 0;
    overflow: hidden;
    -webkit-line-clamp: 2;
    font-size: 13px;
    line-height: 20px;
    color: var(--el-text-color-regular);
    -webkit-box-orient: vertical;
  }

  .store-card__desc.is-empty {
    color: var(--el-text-color-placeholder);
  }

  .store-card__metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 10px 0;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .metric {
    text-align: center;
  }

  .metric + .metric {
    border-left: 1px solid var(--el-border-color-lighter);
  }

  .metric__value {
    font-size: 16px;
    font-weight: 600;
    line-height: 22px;
    color: var(--el-text-color-primary);
  }

  .metric__label {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .store-card__backup {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .store-card__backup-icon {
    flex: none;
    color: var(--el-text-color-placeholder);
  }

  .store-card__backup-icon.is-on {
    color: var(--el-color-success);
  }

  .store-card__backup-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .store-card__backup-warn {
    flex: none;
    color: var(--el-color-warning);
  }

  .store-card__token {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
    font-size: 12px;
  }

  .store-card__token-label {
    color: var(--el-text-color-secondary);
  }

  .store-card__token-value {
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--el-text-color-regular);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .store-card__foot {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .store-card__foot .el-button {
    margin: 0;
  }

  .metric--link {
    padding: 0;
    font: inherit;
    cursor: pointer;
    background: none;
    border: none;
    border-left: 1px solid var(--el-border-color-lighter);
  }

  .metric--link:hover .metric__value,
  .metric--link:hover .metric__label {
    color: var(--el-color-primary);
  }

  .agent-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 6px;
    vertical-align: 2px;
    background: var(--el-text-color-placeholder);
    border-radius: 50%;
  }

  .agent-dot.is-online {
    background: var(--el-color-success);
    box-shadow: 0 0 0 3px rgb(22 163 74 / 15%);
  }

  .agent-add {
    font-size: 18px;
    color: var(--el-text-color-secondary);
    vertical-align: -3px;
  }

  @media (width <= 640px) {
    .store-toolbar__actions {
      width: 100%;
    }

    .store-toolbar__search {
      flex: 1;
      width: auto;
    }

    .store-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<style>
  /* 抽屉渲染在 body 下，scoped 样式不生效 */
  .agent-drawer .el-drawer__header {
    margin-bottom: 0;
  }

  .agent-drawer .el-drawer__body {
    padding-top: 4px;
  }
</style>
