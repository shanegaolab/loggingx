<!-- 已登记的采集 Agent：在线状态、配置同步情况、版本；每 15 秒自动刷新 -->
<template>
  <div class="agent-list">
    <div class="agent-list__bar">
      <div class="filters">
        <button
          v-for="item in FILTERS"
          :key="item.value"
          type="button"
          class="filter"
          :class="[`filter--${item.value}`, { 'is-active': filter === item.value }]"
          :disabled="item.value !== 'all' && !counts[item.value]"
          @click="filter = item.value"
        >
          <i v-if="item.dot" class="dot"></i>{{ item.label }}
          <b>{{ counts[item.value] }}</b>
        </button>
      </div>
      <div class="agent-list__actions">
        <ElInput
          v-if="agents.length > 5"
          v-model="keyword"
          size="small"
          clearable
          placeholder="主机名或 IP"
          class="agent-list__search"
        >
          <template #prefix><LogxSvgIcon icon="ri:search-line" /></template>
        </ElInput>
        <ElButton size="small" :loading="loading" @click="load()">
          <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" class="mr-1" />刷新
        </ElButton>
      </div>
    </div>

    <ElTable v-loading="loading && !loaded" :data="visibleAgents" size="small" class="agent-table">
      <template #empty>
        <ElEmpty
          v-if="!agents.length"
          :image-size="72"
          description="还没有 Agent。部署后，Agent 会自动出现在这里"
        >
          <ElButton type="primary" size="small" @click="emit('deploy')">去部署</ElButton>
        </ElEmpty>
        <span v-else>没有符合条件的 Agent</span>
      </template>
      <ElTableColumn label="主机" min-width="160">
        <template #default="{ row }">
          <div class="host">
            <LogxSvgIcon
              :icon="PLATFORM_ICONS[row.platform as Api.Agent.Platform]"
              class="host__icon"
            />
            <div class="host__text">
              <div class="host__name">{{ row.hostname }}</div>
              <div class="host__meta"
                >{{ PLATFORM_NAMES[row.platform as Api.Agent.Platform]
                }}<template v-if="row.ip"> · {{ row.ip }}</template></div
              >
            </div>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn v-if="!storeId" label="日志库" min-width="130">
        <template #default="{ row }">
          <div class="host__name">{{ row.storeName }}</div>
          <div class="host__meta">{{ row.storeCode }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="110">
        <template #default="{ row }">
          <span class="state" :class="row.online ? 'state--on' : 'state--off'">
            <i class="dot"></i>{{ row.online ? '在线' : '离线' }}
          </span>
          <ElTooltip :content="`最近同步：${row.lastSeenTime}`" :disabled="!row.lastSeenTime">
            <div class="host__meta">{{
              row.lastSeenTime ? formatRelative(row.lastSeenTime) : '-'
            }}</div>
          </ElTooltip>
        </template>
      </ElTableColumn>
      <ElTableColumn label="采集配置" width="110">
        <template #default="{ row }">
          <ElTooltip :content="SYNC_TIPS[row.syncState as Api.Agent.SyncState]" placement="top">
            <ElTag
              :type="SYNC_TAGS[row.syncState as Api.Agent.SyncState]"
              size="small"
              effect="light"
            >
              {{ SYNC_NAMES[row.syncState as Api.Agent.SyncState] }}
            </ElTag>
          </ElTooltip>
        </template>
      </ElTableColumn>
      <ElTableColumn label="版本" width="100">
        <template #default="{ row }">
          <div class="mono">{{ row.version ?? '-' }}</div>
          <ElTooltip
            v-if="row.outdated"
            :content="`LoggingX 当前安装 Vector ${meta?.version ?? ''}，在该主机重新执行安装命令即可升级`"
          >
            <span class="upgrade">可升级</span>
          </ElTooltip>
        </template>
      </ElTableColumn>
      <ElTableColumn label="登记时间" min-width="100">
        <template #default="{ row }">
          <ElTooltip :content="row.registerTime ?? ''" :disabled="!row.registerTime">
            <span>{{ row.registerTime ? formatRelative(row.registerTime) : '-' }}</span>
          </ElTooltip>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="64" fixed="right">
        <template #default="{ row }">
          <ElButton link type="danger" size="small" @click="remove(row)">移除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { ElMessageBox } from 'element-plus'
  import { fetchAgents, removeAgent } from '@/api/agent'
  import { formatRelative } from '../../shared'

  const props = defineProps<{ storeId?: number; meta?: Api.Agent.Meta }>()
  const emit = defineEmits<{ deploy: []; changed: [agents: Api.Agent.Instance[]] }>()

  const PLATFORM_ICONS: Record<Api.Agent.Platform, string> = {
    linux: 'ri:terminal-box-line',
    docker: 'ri:box-3-line',
    kubernetes: 'ri:ship-2-line',
    windows: 'ri:windows-line'
  }
  const PLATFORM_NAMES: Record<Api.Agent.Platform, string> = {
    linux: 'Linux',
    docker: 'Docker',
    kubernetes: 'Kubernetes 节点',
    windows: 'Windows'
  }
  const SYNC_NAMES: Record<Api.Agent.SyncState, string> = {
    synced: '已同步',
    pending: '待同步',
    invalid: '无可采集内容'
  }
  const SYNC_TAGS: Record<Api.Agent.SyncState, 'success' | 'warning' | 'danger'> = {
    synced: 'success',
    pending: 'warning',
    invalid: 'danger'
  }
  const SYNC_TIPS: Record<Api.Agent.SyncState, string> = {
    synced: '正在使用日志库当前的采集配置',
    pending: '采集配置或 Token 已变更，Agent 下次同步时自动应用（离线的 Agent 上线后应用）',
    invalid: '采集配置中没有适用于该环境的日志路径，请在「采集配置」中补充'
  }

  type Filter = 'all' | 'online' | 'offline' | 'unsynced'
  const FILTERS: { value: Filter; label: string; dot?: boolean }[] = [
    { value: 'all', label: '全部' },
    { value: 'online', label: '在线', dot: true },
    { value: 'offline', label: '离线', dot: true },
    { value: 'unsynced', label: '配置未同步' }
  ]
  const MATCHES: Record<Filter, (agent: Api.Agent.Instance) => boolean> = {
    all: () => true,
    online: (agent) => agent.online,
    offline: (agent) => !agent.online,
    unsynced: (agent) => agent.syncState !== 'synced'
  }

  const agents = ref<Api.Agent.Instance[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const filter = ref<Filter>('all')
  const keyword = ref('')

  const counts = computed(
    () =>
      Object.fromEntries(
        FILTERS.map(({ value }) => [value, agents.value.filter(MATCHES[value]).length])
      ) as Record<Filter, number>
  )

  const visibleAgents = computed(() => {
    const text = keyword.value.trim().toLowerCase()
    return agents.value.filter(
      (agent) =>
        MATCHES[filter.value](agent) &&
        (!text ||
          agent.hostname.toLowerCase().includes(text) ||
          (agent.ip ?? '').includes(text) ||
          (agent.storeCode ?? '').includes(text))
    )
  })

  // 当前筛选项没有 Agent 了（例如都上线了）时回到全部
  watch(counts, (value) => {
    if (filter.value !== 'all' && !value[filter.value]) filter.value = 'all'
  })

  const load = async (quiet = false) => {
    if (!quiet) loading.value = true
    try {
      agents.value = await fetchAgents(props.storeId)
      loaded.value = true
      emit('changed', agents.value)
    } finally {
      loading.value = false
    }
  }

  const remove = async (agent: Api.Agent.Instance) => {
    try {
      await ElMessageBox.confirm(
        `从列表中移除「${agent.hostname}」？这不会停止该主机上的采集：要停止采集请在该主机上执行卸载命令；若 Agent 仍持有有效的 Token，会在下次同步时重新登记（怀疑 Token 泄露请重置 Token）。`,
        '移除 Agent',
        { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await removeAgent(agent.agentId)
    ElMessage.success('已移除')
    load()
  }

  // 页面可见时每 15 秒静默刷新
  let timer: ReturnType<typeof setInterval> | undefined
  const start = () => {
    stop()
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, 15000)
  }
  const stop = () => timer && clearInterval(timer)

  watch(
    () => props.storeId,
    () => {
      loaded.value = false
      agents.value = []
      filter.value = 'all'
      keyword.value = ''
      load()
    },
    { immediate: true }
  )
  onMounted(start)
  onActivated(start)
  onDeactivated(stop)
  onBeforeUnmount(stop)

  defineExpose({ load })
</script>

<style scoped>
  .agent-list__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .agent-list__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .agent-list__search {
    width: 180px;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .filter {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: var(--el-fill-color-lighter);
    border: 1px solid transparent;
    border-radius: 13px;
    transition: all 0.15s;
  }

  .filter b {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .filter:hover:not(:disabled) {
    border-color: var(--el-border-color);
  }

  .filter.is-active {
    background: var(--el-bg-color);
    border-color: var(--el-text-color-primary);
  }

  .filter:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .filter--unsynced:not(:disabled) b {
    color: var(--el-color-warning);
  }

  .upgrade {
    font-size: 12px;
    color: var(--el-color-warning);
    cursor: help;
  }

  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 5px;
    vertical-align: 1px;
    background: currentcolor;
    border-radius: 50%;
  }

  .filter--online .dot,
  .state--on .dot {
    color: var(--el-color-success);
    box-shadow: 0 0 0 3px rgb(22 163 74 / 15%);
  }

  .filter--offline .dot,
  .state--off .dot {
    color: var(--el-text-color-placeholder);
  }

  .host {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .host__icon {
    flex: none;
    font-size: 20px;
    color: var(--el-text-color-secondary);
  }

  .host__text {
    min-width: 0;
  }

  .host__name {
    overflow: hidden;
    font-weight: 500;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .host__meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .state {
    font-size: 13px;
  }

  .state--on {
    color: var(--el-color-success);
  }

  .state--off {
    color: var(--el-text-color-secondary);
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }
</style>
