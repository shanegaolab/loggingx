<!-- 告警事件：日志告警与监控告警合并展示，进行中的在前 -->
<template>
  <div class="events">
    <div class="toolbar">
      <ElRadioGroup v-model="status" size="small">
        <ElRadioButton value="firing">告警中</ElRadioButton>
        <ElRadioButton value="resolved">已恢复</ElRadioButton>
        <ElRadioButton value="">全部</ElRadioButton>
      </ElRadioGroup>
      <ElRadioGroup v-model="type" size="small">
        <ElRadioButton value="">全部类型</ElRadioButton>
        <ElRadioButton value="log">日志告警</ElRadioButton>
        <ElRadioButton value="host">监控告警</ElRadioButton>
      </ElRadioGroup>
      <ElSelect
        v-model="storeId"
        placeholder="全部日志库"
        clearable
        size="small"
        class="toolbar-store"
      >
        <ElOption
          v-for="store in ctx.stores.value"
          :key="store.id"
          :value="store.id"
          :label="store.name"
        />
      </ElSelect>
      <ElSelect v-model="days" size="small" class="toolbar-days">
        <ElOption :value="1" label="近 1 天" />
        <ElOption :value="7" label="近 7 天" />
        <ElOption :value="30" label="近 30 天" />
      </ElSelect>
      <ElButton size="small" :loading="loading" @click="load()">
        <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" class="mr-1" />刷新
      </ElButton>
      <span class="hint">每分钟评估一次规则，条件不再满足时自动恢复</span>
    </div>
    <ElTable
      v-loading="loading"
      :data="rows"
      size="small"
      height="100%"
      class="table"
      row-key="key"
    >
      <template #empty>
        <ElEmpty
          :image-size="72"
          :description="status === 'firing' ? '当前没有告警' : '没有告警记录'"
        />
      </template>
      <ElTableColumn label="级别" width="80">
        <template #default="{ row }">
          <ElTag
            :type="row.severity === 'critical' ? 'danger' : 'warning'"
            size="small"
            :effect="row.status === 'firing' ? 'dark' : 'plain'"
          >
            {{ SEVERITY_NAMES[row.severity as Api.Monitor.Severity] }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="告警" min-width="220">
        <template #default="{ row }">
          <div class="rule-name">
            <span class="type-tag" :class="`type-tag--${row.type}`">{{
              row.type === 'log' ? '日志' : '监控'
            }}</span>
            {{ row.ruleName }}
          </div>
          <div class="muted">{{ row.condition }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="对象" min-width="170">
        <template #default="{ row }">
          <template v-if="row.type === 'host'">
            <ElButton link type="primary" @click="openHost(row.host)">{{ row.host.host }}</ElButton>
            <div class="muted">{{ row.storeName }}</div>
          </template>
          <template v-else>
            <div>{{ row.storeName }}</div>
            <div class="muted">日志库</div>
          </template>
        </template>
      </ElTableColumn>
      <ElTableColumn label="当前 / 峰值" min-width="170">
        <template #default="{ row }">
          <div class="mono">{{ row.value }}</div>
          <div class="muted mono">峰值 {{ row.peak }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="140">
        <template #default="{ row }">
          <span :class="row.status === 'firing' ? 'text-firing' : 'muted'">
            {{ row.status === 'firing' ? '告警中' : '已恢复' }}
          </span>
          <div class="muted">持续 {{ formatDuration(row.startedAt, row.endedAt) }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="开始 / 恢复时间" width="170">
        <template #default="{ row }">
          <div>{{ row.startTime }}</div>
          <div class="muted">{{ row.resolveTime ?? '-' }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="row.type === 'host'"
            link
            type="primary"
            size="small"
            @click="openHost(row.host)"
            >主机</ElButton
          >
          <ElButton
            v-if="row.type === 'log' && row.log.sample"
            link
            type="primary"
            size="small"
            @click="sample = row.log"
            >示例</ElButton
          >
          <ElButton link type="primary" size="small" @click="openLogs(row)">日志</ElButton>
          <ElButton link type="primary" size="small" @click="recordsOf = row">通知记录</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog
      :model-value="!!sample"
      title="最新一条匹配日志"
      width="640px"
      @close="sample = undefined"
    >
      <pre class="sample">{{ sample?.sample }}</pre>
    </ElDialog>

    <ElDrawer
      :model-value="!!recordsOf"
      :title="`通知记录 · ${recordsOf?.ruleName ?? ''}`"
      size="760px"
      @close="recordsOf = undefined"
    >
      <NotifyRecords v-if="recordsOf" :event-type="recordsOf.type" :event-id="recordsOf.id" />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { fetchAlerts } from '@/api/monitor'
  import { fetchLogAlerts } from '@/api/alert-center'
  import {
    SEVERITY_NAMES,
    describeThreshold,
    formatAlertValue,
    formatDateTime
  } from '@/views/monitor/shared'
  import { ALERT_CENTER, formatDuration } from '../shared'
  import NotifyRecords from './notify-records.vue'

  const ctx = inject(ALERT_CENTER)!
  const router = useRouter()

  interface Row {
    key: string
    type: 'host' | 'log'
    id: number
    ruleName: string
    severity: Api.Monitor.Severity
    status: 'firing' | 'resolved'
    condition: string
    storeName: string
    value: string
    peak: string
    startedAt: number
    endedAt: number | null
    startTime: string
    resolveTime: string | null
    host?: Api.Monitor.AlertEvent
    log?: Api.AlertCenter.LogEvent
  }

  const status = ref<'firing' | 'resolved' | ''>('firing')
  const type = ref<'' | 'host' | 'log'>('')
  const storeId = ref<number>()
  const days = ref(7)
  const loading = ref(false)
  const rows = ref<Row[]>([])
  const sample = ref<Api.AlertCenter.LogEvent>()
  const recordsOf = ref<Row>()

  const fromHost = (event: Api.Monitor.AlertEvent): Row => ({
    key: `host-${event.id}`,
    type: 'host',
    id: event.id,
    ruleName: event.ruleName,
    severity: event.severity,
    status: event.status,
    condition: describeThreshold(event.metric, event.threshold),
    storeName: event.storeName ?? event.storeCode ?? '已删除的日志库',
    value: formatAlertValue(event.metric, event.value),
    peak: formatAlertValue(event.metric, event.peakValue),
    startedAt: event.startedAt,
    endedAt: event.resolveTime ? new Date(event.resolveTime.replace(' ', 'T')).getTime() : null,
    startTime: event.startTime,
    resolveTime: event.resolveTime,
    host: event
  })

  const fromLog = (event: Api.AlertCenter.LogEvent): Row => ({
    key: `log-${event.id}`,
    type: 'log',
    id: event.id,
    ruleName: event.ruleName,
    severity: event.severity,
    status: event.status,
    condition: `${event.windowMinutes} 分钟内匹配日志 > ${event.threshold} 条`,
    storeName: event.storeName ?? event.storeCode ?? '已删除的日志库',
    value: event.value === null ? '-' : `${event.value} 条`,
    peak: event.peakValue === null ? '-' : `${event.peakValue} 条`,
    startedAt: event.startedAt,
    endedAt: event.resolvedAt,
    startTime: event.startTime,
    resolveTime: event.resolveTime,
    log: event
  })

  const load = async (quiet = false) => {
    if (!quiet) loading.value = true
    try {
      const query = {
        status: status.value || undefined,
        storeId: storeId.value,
        days: days.value,
        limit: 500
      }
      const [hostEvents, logEvents] = await Promise.all([
        type.value === 'log' ? [] : fetchAlerts(query),
        type.value === 'host' ? [] : fetchLogAlerts(query)
      ])
      rows.value = [...hostEvents.map(fromHost), ...logEvents.map(fromLog)].sort(
        (a, b) =>
          Number(b.status === 'firing') - Number(a.status === 'firing') || b.startedAt - a.startedAt
      )
    } finally {
      loading.value = false
    }
  }

  const openHost = (event?: Api.Monitor.AlertEvent) => {
    if (event)
      router.push({ name: 'HostMonitor', query: { storeId: event.storeId, host: event.host } })
  }

  /** 监控告警：开始前 10 分钟到开始后 5 分钟的主机日志；日志告警：告警窗口内匹配规则的日志 */
  const openLogs = (row: Row) => {
    if (row.host) {
      const event = row.host
      router.push({
        name: 'LogQuery',
        query: {
          storeId: event.storeId,
          host: event.metric === 'offline' ? undefined : event.host,
          start: formatDateTime(event.startedAt - 600_000),
          end: formatDateTime(event.startedAt + 300_000)
        }
      })
      return
    }
    const event = row.log!
    const rule = ctx.logRules.value.find((r) => r.id === event.ruleId)
    router.push({
      name: 'LogQuery',
      query: {
        storeId: event.storeId,
        host: rule?.host ?? '',
        keyword: rule?.keyword ?? undefined,
        levels: rule?.levels.join(',') || undefined,
        start: formatDateTime(event.startedAt - event.windowMinutes * 60_000),
        end: formatDateTime((event.resolvedAt ?? Date.now()) + 60_000)
      }
    })
  }

  watch([status, type, storeId, days], () => load())

  let timer: ReturnType<typeof setInterval> | undefined
  const start = () => {
    clearInterval(timer)
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, 30_000)
  }
  const stop = () => clearInterval(timer)

  onMounted(() => {
    load()
    start()
  })
  onActivated(start)
  onDeactivated(stop)
  onBeforeUnmount(stop)
  defineExpose({ load })
</script>

<style scoped>
  .events {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .table {
    flex: 1;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 10px;
    align-items: center;
    margin-bottom: 10px;
  }

  .toolbar-store {
    width: 170px;
  }

  .toolbar-days {
    width: 110px;
  }

  .hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .rule-name {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .type-tag {
    display: inline-block;
    padding: 0 5px;
    margin-right: 4px;
    font-size: 11px;
    font-weight: normal;
    line-height: 18px;
    border-radius: 3px;
  }

  .type-tag--log {
    color: #7c3aed;
    background: color-mix(in srgb, #7c3aed 12%, transparent);
  }

  .type-tag--host {
    color: #0891b2;
    background: color-mix(in srgb, #0891b2 12%, transparent);
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .text-firing {
    font-weight: 600;
    color: var(--el-color-danger);
  }

  .sample {
    max-height: 50vh;
    padding: 12px;
    margin: 0;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    word-break: break-all;
    white-space: pre-wrap;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
  }
</style>
