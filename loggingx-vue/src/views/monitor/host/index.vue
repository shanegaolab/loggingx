<!-- 主机监控：所有采集 Agent 所在主机的 CPU、内存、磁盘、网络概览，点击查看趋势与进程 -->
<template>
  <div class="host-page logx-full-height">
    <ElCard shadow="never" class="host-toolbar">
      <div class="host-toolbar__inner">
        <div class="summary">
          <div class="summary__item">
            <span class="summary__value">{{ hosts.length }}</span>
            <span class="summary__label">主机</span>
          </div>
          <div class="summary__divider"></div>
          <div class="summary__item">
            <span class="summary__value summary__value--ok">{{ counts.online }}</span>
            <span class="summary__label">在线</span>
          </div>
          <div class="summary__divider"></div>
          <div class="summary__item">
            <span class="summary__value" :class="{ 'summary__value--bad': counts.alerting }">{{
              counts.alerting
            }}</span>
            <span class="summary__label">告警中</span>
          </div>
          <div class="summary__divider"></div>
          <div class="summary__item">
            <span class="summary__value">{{ formatPercent(avgCpu, 0) }}</span>
            <span class="summary__label">平均 CPU</span>
          </div>
        </div>
        <div class="host-toolbar__actions">
          <ElSelect
            v-model="storeId"
            placeholder="全部日志库"
            clearable
            filterable
            class="store-select"
          >
            <ElOption
              v-for="store in stores"
              :key="store.storeId"
              :value="store.storeId"
              :label="store.name"
            >
              <span>{{ store.name }}</span>
              <span class="option-meta">{{ store.code }}</span>
            </ElOption>
          </ElSelect>
          <ElInput v-model="keyword" placeholder="主机名或 IP" clearable class="search">
            <template #prefix><LogxSvgIcon icon="ri:search-line" /></template>
          </ElInput>
          <ElTooltip content="每 30 秒自动刷新" placement="top">
            <ElButton :loading="loading" circle @click="load()">
              <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" />
            </ElButton>
          </ElTooltip>
        </div>
      </div>
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
          {{ item.label }} <b>{{ counts[item.value] }}</b>
        </button>
      </div>
    </ElCard>

    <ElCard shadow="never" class="host-body">
      <ElTable
        v-loading="loading && !loaded"
        :data="visibleHosts"
        row-key="key"
        class="host-table"
        height="100%"
        :row-class-name="rowClass"
        @row-click="openDetail"
      >
        <template #empty>
          <ElEmpty
            :image-size="80"
            :description="
              hosts.length
                ? '没有符合条件的主机'
                : '还没有主机。在日志库中部署采集 Agent 后，主机会自动出现在这里'
            "
          >
            <ElButton
              v-if="!hosts.length && canDeploy"
              type="primary"
              @click="router.push({ name: 'LogAgent', query: { tab: 'deploy' } })"
            >
              去部署 Agent
            </ElButton>
          </ElEmpty>
        </template>
        <ElTableColumn label="主机" min-width="210" fixed="left">
          <template #default="{ row }">
            <div class="host">
              <span class="host__state" :class="row.online ? 'is-online' : 'is-offline'"></span>
              <LogxSvgIcon
                :icon="
                  row.platform
                    ? PLATFORM_ICONS[row.platform as Api.Agent.Platform]
                    : 'ri:server-line'
                "
                class="host__icon"
              />
              <div class="host__text">
                <div class="host__name">{{ row.hostname }}</div>
                <div class="host__meta"
                  >{{ row.storeName ?? row.storeCode
                  }}<template v-if="row.ip"> · {{ row.ip }}</template></div
                >
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="CPU" min-width="150" sortable :sort-method="sortBy('cpuPercent')">
          <template #default="{ row }">
            <UsageCell
              v-if="row.sampleTime"
              :percent="row.cpuPercent"
              :sub="row.cpuCores ? `${row.cpuCores} 核` : ''"
            />
            <NotReported v-else :online="row.online" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="内存" min-width="170" sortable :sort-method="sortBy('memPercent')">
          <template #default="{ row }">
            <UsageCell
              v-if="row.sampleTime"
              :percent="row.memPercent"
              :sub="
                row.memTotal ? `${formatBytes(row.memUsed)} / ${formatBytes(row.memTotal)}` : ''
              "
            />
            <NotReported v-else :online="row.online" />
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="磁盘"
          min-width="160"
          sortable
          :sort-method="sortBy('diskMaxPercent')"
        >
          <template #default="{ row }">
            <UsageCell
              v-if="row.sampleTime"
              :percent="row.diskMaxPercent"
              :sub="row.diskMaxMount ?? ''"
            />
            <NotReported v-else :online="row.online" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="负载" width="120">
          <template #default="{ row }">
            <template v-if="row.sampleTime && row.load1 !== null">
              <div class="mono">{{ row.load1.toFixed(2) }}</div>
              <div class="host__meta mono"
                >{{ row.load5?.toFixed(2) }} / {{ row.load15?.toFixed(2) }}</div
              >
            </template>
            <span v-else class="muted">-</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="网络" width="150">
          <template #default="{ row }">
            <template v-if="row.sampleTime && row.netRxBps !== null">
              <div class="mono rate"
                ><LogxSvgIcon icon="ri:arrow-down-line" class="rate__in" />{{
                  formatRate(row.netRxBps)
                }}</div
              >
              <div class="mono rate"
                ><LogxSvgIcon icon="ri:arrow-up-line" class="rate__out" />{{
                  formatRate(row.netTxBps)
                }}</div
              >
            </template>
            <span v-else class="muted">-</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="运行时长" width="120">
          <template #default="{ row }">
            <span class="muted">{{ row.sampleTime ? formatUptime(row.uptime) : '-' }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="告警" width="100">
          <template #default="{ row }">
            <ElTag
              v-if="row.alerts"
              :type="row.alertSeverity === 'critical' ? 'danger' : 'warning'"
              size="small"
              effect="dark"
            >
              {{ row.alerts }} 条
            </ElTag>
            <span v-else class="muted">-</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="" width="72" fixed="right">
          <template #default>
            <ElButton link type="primary" size="small">详情</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <HostDetail v-model="detailVisible" :host="current" />
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import HostDetail from './modules/host-detail.vue'
  import { fetchHosts } from '@/api/monitor'
  import { fetchGetLogStoreOptions } from '@/api/log'
  import {
    PLATFORM_ICONS,
    formatBytes,
    formatPercent,
    formatRate,
    formatUptime,
    usageColor
  } from '../shared'

  defineOptions({ name: 'HostMonitor' })

  type Host = Api.Monitor.Host & { key: string }
  type Filter = 'all' | 'online' | 'offline' | 'alerting' | 'unmonitored'

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'online', label: '在线' },
    { value: 'offline', label: '离线' },
    { value: 'alerting', label: '告警中' },
    { value: 'unmonitored', label: '未上报资源' }
  ]
  const MATCHES: Record<Filter, (host: Host) => boolean> = {
    all: () => true,
    online: (host) => host.online,
    offline: (host) => !host.online,
    alerting: (host) => host.alerts > 0,
    unmonitored: (host) => !host.sampleTime
  }

  /** 使用率单元格：进度条 + 百分比 + 次要信息 */
  const UsageCell = defineComponent({
    props: { percent: { type: Number, default: null }, sub: { type: String, default: '' } },
    setup(cellProps) {
      return () =>
        h('div', { class: 'usage' }, [
          h('div', { class: 'usage__row' }, [
            h('div', { class: 'usage__bar' }, [
              h('div', {
                class: 'usage__fill',
                style: {
                  width: `${Math.min(100, cellProps.percent ?? 0)}%`,
                  background: usageColor(cellProps.percent)
                }
              })
            ]),
            h('span', { class: 'usage__value' }, formatPercent(cellProps.percent, 0))
          ]),
          cellProps.sub ? h('div', { class: 'usage__sub' }, cellProps.sub) : null
        ])
    }
  })

  const NotReported = defineComponent({
    props: { online: { type: Boolean, default: false } },
    setup(cellProps) {
      return () =>
        h(
          'span',
          {
            class: 'muted',
            title: cellProps.online
              ? 'Agent 在线但没有上报资源：在日志库的采集配置中开启「主机监控」'
              : 'Agent 离线'
          },
          cellProps.online ? '未上报' : '-'
        )
    }
  })

  const route = useRoute()
  const router = useRouter()
  const hosts = ref<Host[]>([])
  const stores = ref<Api.Log.StoreOption[]>([])
  const storeId = ref<number>()
  const keyword = ref('')
  const filter = ref<Filter>('all')
  const loading = ref(false)
  const loaded = ref(false)
  const detailVisible = ref(false)
  const current = ref<Host>()
  const canDeploy = computed(() => router.hasRoute('LogAgent'))

  const counts = computed(
    () =>
      Object.fromEntries(
        FILTERS.map(({ value }) => [value, hosts.value.filter(MATCHES[value]).length])
      ) as Record<Filter, number>
  )

  const avgCpu = computed(() => {
    const values = hosts.value
      .map((host) => host.cpuPercent)
      .filter((value): value is number => value !== null)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  })

  const visibleHosts = computed(() => {
    const text = keyword.value.trim().toLowerCase()
    return hosts.value.filter(
      (host) =>
        MATCHES[filter.value](host) &&
        (!text || host.hostname.toLowerCase().includes(text) || (host.ip ?? '').includes(text))
    )
  })

  const sortBy = (field: 'cpuPercent' | 'memPercent' | 'diskMaxPercent') => (a: Host, b: Host) =>
    (a[field] ?? -1) - (b[field] ?? -1)

  const rowClass = ({ row }: { row: Host }) =>
    row.alerts ? (row.alertSeverity === 'critical' ? 'row-critical' : 'row-warning') : ''

  const load = async (quiet = false) => {
    if (!quiet) loading.value = true
    try {
      const list = await fetchHosts(storeId.value)
      hosts.value = list.map((host) => ({ ...host, key: `${host.storeId}/${host.host}` }))
      loaded.value = true
      // 详情打开时同步更新其中的主机信息
      if (current.value) {
        current.value = hosts.value.find((host) => host.key === current.value!.key) ?? current.value
      }
    } finally {
      loading.value = false
    }
  }

  const openDetail = (host: Host) => {
    current.value = host
    detailVisible.value = true
  }

  /** 从告警中心等页面带 storeId + host 进来时直接打开详情 */
  const openFromRoute = () => {
    const host = route.query.host as string | undefined
    if (!host) return
    const found = hosts.value.find(
      (item) => item.host === host.toLowerCase() && item.storeId === Number(route.query.storeId)
    )
    if (found) openDetail(found)
  }

  watch(storeId, () => load())
  watch(counts, (value) => {
    if (filter.value !== 'all' && !value[filter.value]) filter.value = 'all'
  })
  watch(() => route.query.host, openFromRoute)

  let timer: ReturnType<typeof setInterval> | undefined
  const start = () => {
    clearInterval(timer)
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, 30_000)
  }

  onMounted(async () => {
    fetchGetLogStoreOptions().then((list) => (stores.value = list))
    await load()
    openFromRoute()
    start()
  })
  onActivated(() => {
    if (loaded.value) load(true)
    start()
  })
  onDeactivated(() => clearInterval(timer))
  onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
  .host-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .host-toolbar {
    flex: none;
  }

  .host-toolbar :deep(.el-card__body) {
    padding: 14px 20px 12px;
  }

  .host-toolbar__inner {
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
    font-size: 22px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .summary__value--ok {
    color: var(--el-color-success);
  }

  .summary__value--bad {
    color: var(--el-color-danger);
  }

  .summary__label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .summary__divider {
    width: 1px;
    height: 18px;
    background: var(--el-border-color-lighter);
  }

  .host-toolbar__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .store-select {
    width: 180px;
  }

  .search {
    width: 200px;
  }

  .option-meta {
    float: right;
    margin-left: 16px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
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

  .filter--alerting:not(:disabled) b {
    color: var(--el-color-danger);
  }

  .host-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .host-body :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    padding: 6px 12px 12px;
  }

  .host-table :deep(.el-table__row) {
    cursor: pointer;
  }

  .host-table :deep(.row-critical td:first-child) {
    box-shadow: inset 3px 0 0 var(--el-color-danger);
  }

  .host-table :deep(.row-warning td:first-child) {
    box-shadow: inset 3px 0 0 var(--el-color-warning);
  }

  .host {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .host__state {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .host__state.is-online {
    background: var(--el-color-success);
    box-shadow: 0 0 0 3px rgb(22 163 74 / 15%);
  }

  .host__state.is-offline {
    background: var(--el-text-color-placeholder);
  }

  .host__icon {
    flex: none;
    font-size: 18px;
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
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .rate {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .rate__in {
    color: var(--el-color-success);
  }

  .rate__out {
    color: var(--el-color-primary);
  }

  :deep(.usage__row) {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  :deep(.usage__bar) {
    flex: 1;
    height: 6px;
    overflow: hidden;
    background: var(--el-fill-color);
    border-radius: 3px;
  }

  :deep(.usage__fill) {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
  }

  :deep(.usage__value) {
    min-width: 36px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-primary);
    text-align: right;
  }

  :deep(.usage__sub) {
    overflow: hidden;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (width <= 640px) {
    .host-toolbar__actions {
      flex-wrap: wrap;
      width: 100%;
    }

    .store-select,
    .search {
      flex: 1;
      width: auto;
    }
  }
</style>
