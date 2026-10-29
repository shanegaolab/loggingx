<!-- 主机详情：资源趋势、选中时刻的进程、文件系统、容器与服务、告警记录，并可跳转到该主机的日志 -->
<template>
  <ElDrawer
    v-model="visible"
    size="min(1180px, 100%)"
    :with-header="false"
    destroy-on-close
    class="host-detail-drawer"
  >
    <div v-if="host" class="host-detail">
      <div class="detail-head">
        <div class="detail-head__icon">
          <LogxSvgIcon :icon="host.platform ? PLATFORM_ICONS[host.platform] : 'ri:server-line'" />
        </div>
        <div class="detail-head__main">
          <div class="detail-head__title">
            {{ host.hostname }}
            <span class="state" :class="host.online ? 'state--on' : 'state--off'">
              <i class="dot"></i>{{ host.online ? '在线' : '离线' }}
            </span>
            <ElTag
              v-if="host.alerts"
              :type="host.alertSeverity === 'critical' ? 'danger' : 'warning'"
              size="small"
            >
              {{ host.alerts }} 条告警
            </ElTag>
          </div>
          <div class="detail-head__meta">
            <span>{{ host.storeName ?? '-' }}（{{ host.storeCode }}）</span>
            <span v-if="host.platform">{{ PLATFORM_NAMES[host.platform] }}</span>
            <span v-if="host.ip">{{ host.ip }}</span>
            <span v-if="host.cpuCores">{{ host.cpuCores }} 核</span>
            <span v-if="host.memTotal">内存 {{ formatBytes(host.memTotal) }}</span>
            <span v-if="host.uptime">已运行 {{ formatUptime(host.uptime) }}</span>
            <span v-if="host.version">Vector {{ host.version }}</span>
          </div>
        </div>
        <div class="detail-head__actions">
          <ElButton @click="openLogs()">
            <LogxSvgIcon icon="ri:file-search-line" class="mr-1" />查看主机日志
          </ElButton>
          <ElButton circle @click="visible = false">
            <LogxSvgIcon icon="ri:close-line" />
          </ElButton>
        </div>
      </div>

      <div class="detail-toolbar">
        <ElRadioGroup v-model="rangeKey" size="small">
          <ElRadioButton v-for="item in RANGES" :key="item.key" :value="item.key">{{
            item.label
          }}</ElRadioButton>
        </ElRadioGroup>
        <ElButton size="small" :loading="loading" @click="loadSeries">
          <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" class="mr-1" />刷新
        </ElButton>
        <div v-if="picked" class="picked">
          <LogxSvgIcon icon="ri:focus-3-line" />
          已选 {{ formatDateTime(picked) }}
          <ElButton link type="primary" size="small" @click="openLogs(picked)"
            >查看前后 5 分钟日志</ElButton
          >
          <ElButton link size="small" @click="picked = null">清除</ElButton>
        </div>
        <span v-else class="hint">点击图表选中时间点，查看当时的进程和日志</span>
      </div>

      <ElAlert v-if="!loading && !hasData" type="info" :closable="false" show-icon class="mb-3">
        这段时间没有该主机的资源数据。请确认日志库的「采集配置 → 主机监控」已开启，且 Agent 在线。
      </ElAlert>

      <div class="charts">
        <MetricChart
          title="CPU 使用率"
          unit="percent"
          :lines="cpuLines"
          :range="range"
          :marked="picked"
          @pick="pick"
        />
        <MetricChart
          title="内存使用率"
          unit="percent"
          :lines="memLines"
          :range="range"
          :marked="picked"
          @pick="pick"
        />
        <MetricChart
          title="系统负载"
          unit="number"
          :lines="loadLines"
          :range="range"
          :marked="picked"
          empty-text="暂无数据（Windows 主机不提供系统负载）"
          @pick="pick"
        />
        <MetricChart
          title="磁盘读写"
          unit="rate"
          :lines="diskLines"
          :range="range"
          :marked="picked"
          @pick="pick"
        />
        <MetricChart
          title="网络流量"
          unit="rate"
          :lines="netLines"
          :range="range"
          :marked="picked"
          empty-text="暂无数据（Windows 主机暂不支持网络流量采集）"
          @pick="pick"
        />
        <MetricChart
          title="磁盘使用率（最满的文件系统）"
          unit="percent"
          :lines="fsLines"
          :range="range"
          :marked="picked"
          @pick="pick"
        />
      </div>

      <ElTabs v-model="tab" class="detail-tabs">
        <ElTabPane
          :label="picked ? `进程 Top（${formatAxisTime(picked, false)}）` : '进程 Top'"
          name="processes"
        >
          <ElTable v-loading="loadingProcesses" :data="processes" size="small" max-height="360">
            <template #empty>
              <span>{{
                picked ? '该时刻附近没有进程数据' : '没有进程数据：请在采集配置中开启「进程 Top」'
              }}</span>
            </template>
            <ElTableColumn label="进程" min-width="200">
              <template #default="{ row }">
                <span class="mono">{{ row.name }}</span>
                <span class="muted ml-2">PID {{ row.pid }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="CPU" width="200">
              <template #default="{ row }">
                <div v-if="row.cpuPercent !== null" class="bar-cell">
                  <ElProgress
                    :percentage="Math.min(100, row.cpuPercent / (host.cpuCores || 1))"
                    :color="usageColor(row.cpuPercent / (host.cpuCores || 1))"
                    :show-text="false"
                    :stroke-width="6"
                  />
                  <span class="mono">{{ formatPercent(row.cpuPercent) }}</span>
                </div>
                <span v-else class="muted">&lt; 0.5%</span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="内存" width="140">
              <template #default="{ row }">
                <span v-if="row.memBytes !== null" class="mono">{{
                  formatBytes(row.memBytes)
                }}</span>
                <span v-else class="muted">&lt; 50 MB</span>
              </template>
            </ElTableColumn>
          </ElTable>
          <div class="table-hint"
            >CPU 为单核百分比（多核进程可超过 100%）；只上报 CPU ≥ 0.5% 或内存 ≥ 50 MB 的进程。</div
          >
        </ElTabPane>
        <ElTabPane :label="`文件系统（${filesystems.length}）`" name="filesystems">
          <ElTable :data="filesystems" size="small">
            <ElTableColumn label="挂载点" min-width="200">
              <template #default="{ row }">
                <span class="mono">{{ row.mountpoint }}</span>
                <span v-if="row.fsType" class="muted ml-2">{{ row.fsType }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="使用率" min-width="220">
              <template #default="{ row }">
                <div class="bar-cell">
                  <ElProgress
                    :percentage="Math.min(100, row.usedPercent)"
                    :color="usageColor(row.usedPercent)"
                    :show-text="false"
                    :stroke-width="6"
                  />
                  <span class="mono">{{ formatPercent(row.usedPercent) }}</span>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="已用 / 总量" width="200">
              <template #default="{ row }">
                <span class="mono"
                  >{{ formatBytes(row.usedBytes) }} / {{ formatBytes(row.totalBytes) }}</span
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane :label="`容器与服务（${containers.length}）`" name="containers">
          <ElTable :data="containers" size="small" max-height="360">
            <template #empty>
              <span>没有数据：仅 Linux（cgroups v2）支持，并需在采集配置中开启「容器资源」</span>
            </template>
            <ElTableColumn label="名称" min-width="260">
              <template #default="{ row }">
                <ElTag size="small" effect="plain" class="mr-2">{{
                  CONTAINER_KINDS[row.kind as Api.Monitor.Container['kind']]
                }}</ElTag>
                <ElTooltip :content="row.cgroup" placement="top">
                  <span class="mono">{{ row.name }}</span>
                </ElTooltip>
              </template>
            </ElTableColumn>
            <ElTableColumn label="CPU" width="140">
              <template #default="{ row }">
                <span class="mono">{{ formatPercent(row.cpuPercent) }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="内存" width="140">
              <template #default="{ row }">
                <span class="mono">{{ formatBytes(row.memBytes) }}</span>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane :label="`告警记录（${alerts.length}）`" name="alerts">
          <ElTable :data="alerts" size="small" max-height="360">
            <template #empty><span>近 7 天没有告警</span></template>
            <ElTableColumn label="规则" min-width="180">
              <template #default="{ row }">
                <ElTag
                  :type="row.severity === 'critical' ? 'danger' : 'warning'"
                  size="small"
                  class="mr-2"
                >
                  {{ SEVERITY_NAMES[row.severity as Api.Monitor.Severity] }}
                </ElTag>
                {{ row.ruleName }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="90">
              <template #default="{ row }">
                <span :class="row.status === 'firing' ? 'text-firing' : 'muted'">
                  {{ row.status === 'firing' ? '告警中' : '已恢复' }}
                </span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="峰值" width="140">
              <template #default="{ row }">{{
                formatAlertValue(row.metric, row.peakValue)
              }}</template>
            </ElTableColumn>
            <ElTableColumn label="开始" width="170" prop="startTime" />
            <ElTableColumn label="恢复" width="170">
              <template #default="{ row }">{{ row.resolveTime ?? '-' }}</template>
            </ElTableColumn>
            <ElTableColumn label="" width="110">
              <template #default="{ row }">
                <ElButton link type="primary" size="small" @click="openLogs(row.startedAt)"
                  >当时日志</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import MetricChart from '../components/metric-chart.vue'
  import type { ChartLine } from '../components/metric-chart.vue'
  import {
    fetchAlerts,
    fetchHostContainers,
    fetchHostFilesystems,
    fetchHostProcesses,
    fetchHostSeries
  } from '@/api/monitor'
  import {
    PLATFORM_ICONS,
    PLATFORM_NAMES,
    SEVERITY_NAMES,
    formatAlertValue,
    formatAxisTime,
    formatBytes,
    formatDateTime,
    formatPercent,
    formatUptime,
    usageColor
  } from '../../shared'

  const props = defineProps<{ host?: Api.Monitor.Host }>()
  const visible = defineModel<boolean>({ default: false })

  const RANGES = [
    { key: '1h', label: '1 小时', ms: 3_600_000 },
    { key: '6h', label: '6 小时', ms: 6 * 3_600_000 },
    { key: '24h', label: '24 小时', ms: 24 * 3_600_000 },
    { key: '7d', label: '7 天', ms: 7 * 24 * 3_600_000 }
  ] as const

  const CONTAINER_KINDS: Record<Api.Monitor.Container['kind'], string> = {
    docker: 'Docker',
    kubernetes: 'K8s',
    service: '服务',
    other: 'cgroup'
  }

  const router = useRouter()
  const rangeKey = ref<(typeof RANGES)[number]['key']>('1h')
  const range = ref<[number, number]>([Date.now() - 3_600_000, Date.now()])
  const series = ref<Api.Monitor.SeriesPoint[]>([])
  const filesystems = ref<Api.Monitor.Filesystem[]>([])
  const processes = ref<Api.Monitor.Process[]>([])
  const containers = ref<Api.Monitor.Container[]>([])
  const alerts = ref<Api.Monitor.AlertEvent[]>([])
  const loading = ref(false)
  const loadingProcesses = ref(false)
  const picked = ref<number | null>(null)
  const tab = ref('processes')

  const hasData = computed(() =>
    series.value.some((point) => point.cpuPercent !== null || point.memPercent !== null)
  )

  const line = (
    name: string,
    color: string,
    value: (point: Api.Monitor.SeriesPoint) => number | null,
    area = false
  ): ChartLine => ({
    name,
    color,
    area,
    data: series.value.map((point) => [point.time, value(point)])
  })

  const cpuLines = computed(() => [line('CPU', '#2563eb', (p) => p.cpuPercent, true)])
  const memLines = computed(() => {
    const lines = [line('内存', '#7c3aed', (p) => p.memPercent, true)]
    if (series.value.some((p) => p.swapPercent))
      lines.push(line('Swap', '#a1a1aa', (p) => p.swapPercent))
    return lines
  })
  const loadLines = computed(() => [
    line('1 分钟', '#0891b2', (p) => p.load1),
    line('5 分钟', '#16a34a', (p) => p.load5),
    line('15 分钟', '#a1a1aa', (p) => p.load15)
  ])
  const diskLines = computed(() => [
    line('读', '#0ea5e9', (p) => p.diskReadBps, true),
    line('写', '#f97316', (p) => p.diskWriteBps, true)
  ])
  const netLines = computed(() => [
    line('接收', '#16a34a', (p) => p.netRxBps, true),
    line('发送', '#2563eb', (p) => p.netTxBps, true)
  ])
  const fsLines = computed(() => [line('磁盘', '#dc2626', (p) => p.diskMaxPercent, true)])

  const loadSeries = async () => {
    const host = props.host
    if (!host) return
    const span = RANGES.find((item) => item.key === rangeKey.value)!.ms
    const to = Date.now()
    range.value = [to - span, to]
    loading.value = true
    try {
      series.value = await fetchHostSeries(host.storeId, host.host, to - span, to + 1000)
    } finally {
      loading.value = false
    }
  }

  const loadProcesses = async () => {
    const host = props.host
    if (!host) return
    loadingProcesses.value = true
    try {
      processes.value = await fetchHostProcesses(host.storeId, host.host, picked.value ?? undefined)
    } finally {
      loadingProcesses.value = false
    }
  }

  const loadDetails = async () => {
    const host = props.host
    if (!host) return
    const [fs, cs, events] = await Promise.all([
      fetchHostFilesystems(host.storeId, host.host),
      fetchHostContainers(host.storeId, host.host),
      fetchAlerts({ storeId: host.storeId, host: host.host, days: 7, limit: 100 })
    ])
    filesystems.value = fs
    containers.value = cs
    alerts.value = events
  }

  const pick = (time: number) => {
    picked.value = time
    tab.value = 'processes'
  }

  /** 跳到日志查询：该主机、选中时刻前后 5 分钟或当前时间范围 */
  const openLogs = (at?: number) => {
    const host = props.host
    if (!host) return
    const [from, to] = at ? [at - 300_000, at + 300_000] : range.value
    visible.value = false
    router.push({
      name: 'LogQuery',
      query: {
        storeId: host.storeId,
        // Kubernetes 节点的日志按 Pod 记录主机名，只按时间过滤
        host: host.platform === 'kubernetes' ? undefined : host.host,
        start: formatDateTime(from),
        end: formatDateTime(to)
      }
    })
  }

  watch(rangeKey, () => {
    picked.value = null
    loadSeries()
  })
  watch(picked, loadProcesses)

  // 打开时加载；1 小时视图每 30 秒自动刷新
  let timer: ReturnType<typeof setInterval> | undefined
  watch(
    visible,
    (open) => {
      clearInterval(timer)
      if (!open || !props.host) return
      rangeKey.value = '1h'
      picked.value = null
      tab.value = 'processes'
      loadSeries()
      loadProcesses()
      loadDetails()
      timer = setInterval(() => {
        if (document.visibilityState !== 'visible' || rangeKey.value !== '1h') return
        loadSeries()
        if (!picked.value) loadProcesses()
      }, 30_000)
    },
    { immediate: true }
  )
  onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
  .host-detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-head {
    display: flex;
    gap: 14px;
    align-items: center;
  }

  .detail-head__icon {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    font-size: 22px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
    border-radius: 10px;
  }

  .detail-head__main {
    flex: 1;
    min-width: 0;
  }

  .detail-head__title {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .detail-head__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .detail-head__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .detail-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
  }

  .picked {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 2px 10px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
    border-radius: 12px;
  }

  .hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .charts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .bar-cell {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .bar-cell .el-progress {
    flex: 1;
  }

  .bar-cell .mono {
    min-width: 56px;
    text-align: right;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .table-hint {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .text-firing {
    font-weight: 600;
    color: var(--el-color-danger);
  }

  .state {
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    font-weight: 400;
  }

  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 5px;
    background: currentcolor;
    border-radius: 50%;
  }

  .state--on {
    color: var(--el-color-success);
  }

  .state--off {
    color: var(--el-text-color-secondary);
  }

  @media (width <= 1100px) {
    .charts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 640px) {
    .charts {
      grid-template-columns: 1fr;
    }

    .detail-head {
      flex-wrap: wrap;
    }
  }
</style>
