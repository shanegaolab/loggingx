<!-- 工作台：日志量与错误、采集 Agent、主机与告警、备份的全局概览；各部分按权限显示 -->
<template>
  <div class="console">
    <div class="console-head">
      <div>
        <h2 class="console-head__title">{{ greeting }}，{{ userName }}</h2>
        <p class="console-head__sub">
          {{ today }}
          <template v-if="overview">
            · 数据更新于 {{ updatedText }}
            <ElButton link size="small" class="ml-1" :loading="loading" @click="load()">
              <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" />
            </ElButton>
          </template>
        </p>
      </div>
      <ElRadioGroup v-model="hours" size="small">
        <ElRadioButton v-for="item in RANGES" :key="item.hours" :value="item.hours">{{
          item.label
        }}</ElRadioButton>
      </ElRadioGroup>
    </div>

    <ElSkeleton v-if="!overview" :rows="8" animated class="console-card" />

    <template v-else>
      <!-- 指标卡片 -->
      <div class="kpis">
        <button
          v-for="card in cards"
          :key="card.key"
          type="button"
          class="kpi"
          :class="[`kpi--${card.tone}`, { 'is-link': !!card.to }]"
          @click="card.to && go(card.to)"
        >
          <div class="kpi__head">
            <span class="kpi__label">{{ card.label }}</span>
            <span class="kpi__icon"><LogxSvgIcon :icon="card.icon" /></span>
          </div>
          <div class="kpi__value">
            {{ card.value }}<span v-if="card.unit" class="kpi__unit">{{ card.unit }}</span>
          </div>
          <div class="kpi__foot">
            <span
              v-if="card.trend"
              class="kpi__trend"
              :class="card.trend.up === card.upIsBad ? 'is-bad' : 'is-good'"
              >{{ card.trend.text }}</span
            >
            <span class="kpi__note">{{ card.note }}</span>
          </div>
        </button>
      </div>

      <!-- 日志量趋势与级别分布 -->
      <div v-if="logs" class="grid grid--trend">
        <section class="console-card">
          <header class="card-head">
            <div>
              <div class="card-head__title">日志量趋势</div>
              <div class="card-head__sub">
                {{ rangeLabel }}内共 {{ logs.total.toLocaleString() }} 条，每
                {{ bucketText }} 一组，点击柱子查看该时段日志
              </div>
            </div>
          </header>
          <ElAlert v-if="!logs.available" type="warning" :closable="false" show-icon>
            日志存储暂时不可用，无法统计日志量
          </ElAlert>
          <LogTrend
            v-else
            :series="logs.series"
            :bucket-millis="overview.bucketMillis"
            @pick="openTrendLogs"
          />
        </section>
        <section class="console-card">
          <header class="card-head">
            <div>
              <div class="card-head__title">级别分布</div>
              <div class="card-head__sub">{{ rangeLabel }}内各级别日志占比</div>
            </div>
          </header>
          <LevelRing :levels="logs.levels" />
          <div class="error-rate">
            <span>错误率</span>
            <b :class="{ 'is-bad': errorRate >= 5 }">{{
              logs.total ? `${errorRate.toFixed(2)}%` : '-'
            }}</b>
            <span class="muted">ERROR + FATAL / 全部</span>
          </div>
        </section>
      </div>

      <div class="grid grid--three">
        <!-- 日志库排行 -->
        <section v-if="logs" class="console-card">
          <header class="card-head">
            <div class="card-head__title">日志库排行</div>
            <ElButton
              v-if="canOpen('LogStore')"
              link
              size="small"
              @click="go({ name: 'LogStore' })"
            >
              全部 <LogxSvgIcon icon="ri:arrow-right-s-line" />
            </ElButton>
          </header>
          <div v-if="!rankedStores.length" class="empty">{{ rangeLabel }}内没有日志</div>
          <div
            v-for="(store, index) in rankedStores"
            :key="store.storeId"
            class="rank"
            @click="go({ name: 'LogQuery', query: { storeId: store.storeId } })"
          >
            <span class="rank__no" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span>
            <div class="rank__body">
              <div class="rank__line">
                <span class="rank__name">{{ store.name }}</span>
                <span class="rank__count">{{ compactNumber(store.total) }}</span>
              </div>
              <div class="rank__bar">
                <div
                  class="rank__fill"
                  :style="{ width: `${(store.total * 100) / maxStoreTotal}%` }"
                >
                  <div
                    class="rank__errors"
                    :style="{ width: `${store.total ? (store.errors * 100) / store.total : 0}%` }"
                  ></div>
                </div>
              </div>
              <div class="rank__meta">
                {{ store.code }}
                <span v-if="store.errors" class="text-error"
                  >· {{ store.errors.toLocaleString() }} 条错误</span
                >
                <span v-if="!store.enabled">· 已停用</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 最近错误 -->
        <section v-if="logs" class="console-card">
          <header class="card-head">
            <div class="card-head__title">最近错误</div>
            <span class="card-head__sub">ERROR / FATAL</span>
          </header>
          <div v-if="!logs.recentErrors.length" class="empty empty--ok">
            <LogxSvgIcon icon="ri:checkbox-circle-line" />{{ rangeLabel }}内没有错误日志
          </div>
          <div
            v-for="error in logs.recentErrors"
            :key="error.id"
            class="error-item"
            @click="openError(error)"
          >
            <div class="error-item__line">
              <span class="error-item__level" :class="levelClass(error.level)">{{
                error.level
              }}</span>
              <span class="error-item__store">{{ error.storeName }}</span>
              <span v-if="error.host" class="error-item__host">{{ error.host }}</span>
              <span class="error-item__time">{{ formatRelative(error.time) }}</span>
            </div>
            <div class="error-item__message">{{ firstLine(error.message) }}</div>
          </div>
        </section>

        <!-- 主机与告警 -->
        <section v-if="hosts || alerts" class="console-card">
          <header class="card-head">
            <div class="card-head__title">主机与告警</div>
            <ElButton
              v-if="canOpen('HostMonitor')"
              link
              size="small"
              @click="go({ name: 'HostMonitor' })"
            >
              主机监控 <LogxSvgIcon icon="ri:arrow-right-s-line" />
            </ElButton>
          </header>
          <template v-if="alerts?.items.length">
            <div
              v-for="alert in alerts.items"
              :key="`${alert.type}-${alert.id}`"
              class="alert-item"
              :class="`alert-item--${alert.severity}`"
              @click="openAlert(alert)"
            >
              <LogxSvgIcon icon="ri:alarm-warning-line" class="alert-item__icon" />
              <div class="alert-item__body">
                <div class="alert-item__title">{{ alert.ruleName }}</div>
                <div class="alert-item__meta">
                  {{ alert.type === 'log' ? '日志库 ' : '' }}{{ alert.host }} ·
                  {{
                    alert.metric === 'log'
                      ? `${alert.value ?? '-'} 条匹配`
                      : formatAlertValue(alert.metric, alert.value)
                  }}
                  ·
                  {{ formatRelative(alert.startTime) }}开始
                </div>
              </div>
            </div>
          </template>
          <div v-else-if="alerts" class="ok-line"
            ><LogxSvgIcon icon="ri:shield-check-line" />当前没有告警</div
          >

          <div v-if="hosts?.top.length" class="host-head">资源占用 Top</div>
          <div
            v-for="host in hosts?.top ?? []"
            :key="`${host.storeId}/${host.host}`"
            class="host-row"
            @click="go({ name: 'HostMonitor', query: { storeId: host.storeId, host: host.host } })"
          >
            <span class="host-row__name">
              <i class="host-row__dot" :class="{ 'is-on': host.online }"></i>{{ host.hostname }}
            </span>
            <span class="host-row__metric">
              <span class="host-row__label">CPU</span>
              <span class="host-row__bar">
                <span
                  :style="{
                    width: `${host.cpuPercent ?? 0}%`,
                    background: usageColor(host.cpuPercent)
                  }"
                ></span>
              </span>
              <span class="host-row__value">{{ formatPercent(host.cpuPercent, 0) }}</span>
            </span>
            <span class="host-row__metric">
              <span class="host-row__label">内存</span>
              <span class="host-row__bar">
                <span
                  :style="{
                    width: `${host.memPercent ?? 0}%`,
                    background: usageColor(host.memPercent)
                  }"
                ></span>
              </span>
              <span class="host-row__value">{{ formatPercent(host.memPercent, 0) }}</span>
            </span>
          </div>
          <div v-if="hosts && !hosts.total" class="empty">
            还没有主机：部署采集 Agent 后自动出现
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import type { RouteLocationRaw } from 'vue-router'
  import { useUserStore } from '@/store/modules/user'
  import { fetchDashboardOverview } from '@/api/dashboard'
  import { formatRelative, levelClass } from '@/views/log/shared'
  import {
    formatAlertValue,
    formatBytes,
    formatDateTime,
    formatPercent,
    usageColor
  } from '@/views/monitor/shared'
  import LogTrend from './modules/log-trend.vue'
  import LevelRing from './modules/level-ring.vue'
  import { compactNumber, compareText } from './shared'

  defineOptions({ name: 'Console' })

  const RANGES = [
    { hours: 1, label: '1 小时' },
    { hours: 6, label: '6 小时' },
    { hours: 24, label: '24 小时' },
    { hours: 168, label: '7 天' }
  ]
  const RANGE_KEY = 'logx-console-hours'

  const router = useRouter()
  const userStore = useUserStore()
  const overview = ref<Api.Dashboard.Overview>()
  const loading = ref(false)
  const updatedAt = ref(0)
  const now = ref(Date.now())

  const readRange = () => {
    try {
      const saved = Number(localStorage.getItem(RANGE_KEY))
      return RANGES.some((range) => range.hours === saved) ? saved : 24
    } catch {
      return 24
    }
  }
  const hours = ref(readRange())

  const userName = computed(() => userStore.info?.userName || '你好')
  const greeting = computed(() => {
    const hour = new Date(now.value).getHours()
    if (hour < 6) return '夜深了'
    if (hour < 11) return '早上好'
    if (hour < 13) return '中午好'
    if (hour < 18) return '下午好'
    return '晚上好'
  })
  const today = computed(() =>
    new Date(now.value).toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  )
  const updatedText = computed(() => {
    const seconds = Math.round((now.value - updatedAt.value) / 1000)
    return seconds < 10
      ? '刚刚'
      : seconds < 60
        ? `${seconds} 秒前`
        : `${Math.floor(seconds / 60)} 分钟前`
  })

  const rangeLabel = computed(() => (hours.value === 168 ? '近 7 天' : `近 ${hours.value} 小时`))
  const bucketText = computed(() => {
    const minutes = (overview.value?.bucketMillis ?? 0) / 60_000
    return minutes >= 60 ? `${minutes / 60} 小时` : `${minutes} 分钟`
  })

  const logs = computed(() => overview.value?.logs ?? null)
  const hosts = computed(() => overview.value?.hosts ?? null)
  const alerts = computed(() => overview.value?.alerts ?? null)
  const errorRate = computed(() =>
    logs.value?.total ? (logs.value.errors * 100) / logs.value.total : 0
  )
  const rankedStores = computed(() => (logs.value?.stores ?? []).filter((store) => store.total > 0))
  const maxStoreTotal = computed(() =>
    Math.max(1, ...rankedStores.value.map((store) => store.total))
  )

  const canOpen = (name: string) => router.hasRoute(name)

  interface Card {
    key: string
    label: string
    icon: string
    value: string
    unit?: string
    note: string
    tone: 'blue' | 'red' | 'green' | 'amber' | 'violet' | 'slate'
    trend?: { text: string; up: boolean } | null
    /** 上升是坏事（如错误数） */
    upIsBad?: boolean
    to?: RouteLocationRaw
  }

  const cards = computed<Card[]>(() => {
    const data = overview.value
    if (!data) return []
    const list: Card[] = []
    const link = (name: string, query?: Record<string, string | number>) =>
      canOpen(name) ? { name, query } : undefined
    if (data.logs) {
      list.push({
        key: 'logs',
        label: `${rangeLabel.value}日志`,
        icon: 'ri:file-list-3-line',
        value: compactNumber(data.logs.total),
        unit: '条',
        note: data.logs.previousTotal ? '较上一时段' : '上一时段无日志',
        tone: 'blue',
        trend: compareText(data.logs.total, data.logs.previousTotal),
        to: link('LogQuery')
      })
      list.push({
        key: 'errors',
        label: '错误日志',
        icon: 'ri:error-warning-line',
        value: compactNumber(data.logs.errors),
        unit: '条',
        note: data.logs.total ? `错误率 ${errorRate.value.toFixed(2)}%` : '暂无日志',
        tone: 'red',
        trend: compareText(data.logs.errors, data.logs.previousErrors),
        upIsBad: true,
        to: link('LogQuery')
      })
      list.push({
        key: 'stores',
        label: '日志库',
        icon: 'ri:database-2-line',
        value: String(data.logs.storeCount),
        unit: '个',
        note: `${data.logs.enabledStores} 个启用`,
        tone: 'slate',
        to: link('LogStore')
      })
    }
    if (data.agents) {
      list.push({
        key: 'agents',
        label: '采集 Agent',
        icon: 'ri:radar-line',
        value: `${data.agents.online}`,
        unit: `/ ${data.agents.total}`,
        note: data.agents.total
          ? `在线率 ${Math.round((data.agents.online * 100) / data.agents.total)}%`
          : '尚未部署',
        tone: 'green',
        to: link('LogAgent')
      })
    }
    if (data.hosts) {
      list.push({
        key: 'hosts',
        label: '主机',
        icon: 'ri:server-line',
        value: `${data.hosts.online}`,
        unit: `/ ${data.hosts.total}`,
        note: data.hosts.alerting
          ? `${data.hosts.alerting} 台告警中`
          : `${data.hosts.monitored} 台上报资源`,
        tone: data.hosts.alerting ? 'amber' : 'violet',
        to: link('HostMonitor')
      })
    }
    if (data.alerts) {
      list.push({
        key: 'alerts',
        label: '进行中告警',
        icon: 'ri:alarm-warning-line',
        value: String(data.alerts.firing),
        unit: '条',
        note: data.alerts.critical
          ? `${data.alerts.critical} 条严重`
          : data.alerts.firing
            ? '均为警告'
            : '一切正常',
        tone: data.alerts.critical ? 'red' : data.alerts.firing ? 'amber' : 'green',
        to: link('AlertEvent')
      })
    }
    if (data.backup) {
      const backup = data.backup
      list.push({
        key: 'backup',
        label: '日志备份',
        icon: 'ri:archive-line',
        value: String(backup.archives),
        unit: '天',
        note: !backup.configured
          ? '未配置存储'
          : backup.failed || backup.pendingDays
            ? `${backup.failed} 天失败 · ${backup.pendingDays} 天待归档`
            : `${formatBytes(backup.archivedBytes)} · ${backup.enabledStores}/${backup.storeCount} 个库开启`,
        tone: backup.failed || backup.pendingDays ? 'amber' : 'slate',
        to: link('LogBackup')
      })
    }
    return list
  })

  const firstLine = (message: string) => message.split('\n')[0]

  const go = (to: RouteLocationRaw) => router.push(to)
  /** 监控告警打开主机详情；日志告警打开告警中心 */
  const openAlert = (alert: Api.Dashboard.Alerts['items'][number]) =>
    alert.type === 'log' || alert.metric === 'log'
      ? go({ name: 'AlertEvent' })
      : go({ name: 'HostMonitor', query: { storeId: alert.storeId, host: alert.host } })

  const openTrendLogs = (from: number, to: number) => {
    if (!canOpen('LogQuery')) return
    router.push({
      name: 'LogQuery',
      query: { start: formatDateTime(from), end: formatDateTime(to - 1000) }
    })
  }

  const openError = (error: Api.Dashboard.Logs['recentErrors'][number]) => {
    if (!canOpen('LogQuery')) return
    const time = new Date(error.time.replace(' ', 'T')).getTime()
    router.push({
      name: 'LogQuery',
      query: {
        storeId: error.storeId,
        host: error.host ?? undefined,
        start: formatDateTime(time - 60_000),
        end: formatDateTime(time + 60_000)
      }
    })
  }

  const load = async () => {
    loading.value = true
    try {
      overview.value = await fetchDashboardOverview(hours.value)
      updatedAt.value = Date.now()
      now.value = Date.now()
    } finally {
      loading.value = false
    }
  }

  watch(hours, (value) => {
    try {
      localStorage.setItem(RANGE_KEY, String(value))
    } catch {
      // 无法访问本地存储时忽略
    }
    load()
  })

  // 每分钟刷新数据，每 10 秒更新「数据更新于」
  let refresh: ReturnType<typeof setInterval> | undefined
  let clock: ReturnType<typeof setInterval> | undefined
  const start = () => {
    stop()
    refresh = setInterval(() => document.visibilityState === 'visible' && load(), 60_000)
    clock = setInterval(() => (now.value = Date.now()), 10_000)
  }
  const stop = () => {
    clearInterval(refresh)
    clearInterval(clock)
  }

  let activatedOnce = false
  onMounted(() => {
    load()
    start()
  })
  onActivated(() => {
    if (activatedOnce) load()
    activatedOnce = true
    start()
  })
  onDeactivated(stop)
  onBeforeUnmount(stop)
</script>

<style scoped>
  .console {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 16px;
  }

  .console-head {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
    justify-content: space-between;
  }

  .console-head__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .console-head__sub {
    display: flex;
    align-items: center;
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .console-card {
    padding: 16px 18px;
    background: var(--default-box-color, var(--el-bg-color));
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
  }

  /* KPI */
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .kpi {
    --tone: var(--el-color-primary);

    position: relative;
    padding: 14px 16px;
    overflow: hidden;
    text-align: left;
    background: var(--default-box-color, var(--el-bg-color));
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }

  .kpi::before {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    content: '';
    background: var(--tone);
    opacity: 0.85;
  }

  .kpi.is-link {
    cursor: pointer;
  }

  .kpi.is-link:hover {
    border-color: var(--tone);
    transform: translateY(-1px);
  }

  .kpi--blue {
    --tone: var(--el-color-primary);
  }

  .kpi--red {
    --tone: var(--el-color-danger);
  }

  .kpi--green {
    --tone: var(--el-color-success);
  }

  .kpi--amber {
    --tone: var(--el-color-warning);
  }

  .kpi--violet {
    --tone: #7c3aed;
  }

  .kpi--slate {
    --tone: #64748b;
  }

  .kpi__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kpi__label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .kpi__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    font-size: 16px;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 12%, transparent);
    border-radius: 8px;
  }

  .kpi__value {
    margin-top: 6px;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }

  .kpi__unit {
    margin-left: 4px;
    font-size: 13px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .kpi__foot {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .kpi__trend {
    padding: 0 6px;
    font-weight: 600;
    border-radius: 4px;
  }

  .kpi__trend.is-good {
    color: var(--el-color-success);
    background: rgb(22 163 74 / 10%);
  }

  .kpi__trend.is-bad {
    color: var(--el-color-danger);
    background: rgb(220 38 38 / 10%);
  }

  .kpi__note {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 布局 */
  .grid {
    display: grid;
    gap: 16px;
  }

  .grid--trend {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }

  .grid--three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .card-head {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .card-head__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .card-head__sub {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .error-rate {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding-top: 10px;
    margin-top: 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .error-rate b {
    font-size: 18px;
    color: var(--el-text-color-primary);
  }

  .error-rate b.is-bad,
  .text-error {
    color: var(--el-color-danger);
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .empty {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 24px 0;
    font-size: 13px;
    color: var(--el-text-color-placeholder);
  }

  .empty--ok {
    color: var(--el-color-success);
  }

  /* 日志库排行 */
  .rank {
    display: flex;
    gap: 10px;
    padding: 8px 6px;
    margin: 0 -6px;
    cursor: pointer;
    border-radius: 8px;
  }

  .rank:hover {
    background: var(--el-fill-color-lighter);
  }

  .rank__no {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color);
    border-radius: 6px;
  }

  .rank__no.is-top {
    color: #fff;
    background: var(--el-color-primary);
  }

  .rank__body {
    flex: 1;
    min-width: 0;
  }

  .rank__line {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }

  .rank__name {
    overflow: hidden;
    font-weight: 500;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rank__count {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .rank__bar {
    height: 6px;
    margin: 6px 0 4px;
    overflow: hidden;
    background: var(--el-fill-color);
    border-radius: 3px;
  }

  .rank__fill {
    display: flex;
    justify-content: flex-end;
    height: 100%;
    background: #93c5fd;
    border-radius: 3px;
  }

  .rank__errors {
    height: 100%;
    background: var(--el-color-danger);
  }

  .rank__meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  /* 最近错误 */
  .error-item {
    padding: 8px 6px;
    margin: 0 -6px;
    cursor: pointer;
    border-radius: 8px;
  }

  .error-item:hover {
    background: var(--el-fill-color-lighter);
  }

  .error-item + .error-item {
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .error-item__line {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .error-item__level {
    padding: 0 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--lx-level);
    background: color-mix(in srgb, var(--lx-level) 12%, transparent);
    border-radius: 4px;
  }

  .error-item__store {
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .error-item__host {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .error-item__time {
    margin-left: auto;
    white-space: nowrap;
  }

  .error-item__message {
    margin-top: 4px;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 主机与告警 */
  .alert-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 10px;
    margin-bottom: 8px;
    cursor: pointer;
    border-radius: 8px;
  }

  .alert-item--critical {
    background: rgb(220 38 38 / 8%);
  }

  .alert-item--warning {
    background: rgb(245 158 11 / 10%);
  }

  .alert-item__icon {
    flex: none;
    margin-top: 2px;
    font-size: 16px;
  }

  .alert-item--critical .alert-item__icon {
    color: var(--el-color-danger);
  }

  .alert-item--warning .alert-item__icon {
    color: var(--el-color-warning);
  }

  .alert-item__title {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .alert-item__meta {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ok-line {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--el-color-success);
    background: rgb(22 163 74 / 8%);
    border-radius: 8px;
  }

  .host-head {
    margin: 14px 0 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .host-row {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 6px;
    margin: 0 -6px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 8px;
  }

  .host-row:hover {
    background: var(--el-fill-color-lighter);
  }

  .host-row__name {
    overflow: hidden;
    font-weight: 500;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .host-row__dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    vertical-align: 1px;
    background: var(--el-text-color-placeholder);
    border-radius: 50%;
  }

  .host-row__dot.is-on {
    background: var(--el-color-success);
  }

  .host-row__metric {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .host-row__label {
    flex: none;
    color: var(--el-text-color-secondary);
  }

  .host-row__bar {
    flex: 1;
    height: 5px;
    overflow: hidden;
    background: var(--el-fill-color);
    border-radius: 3px;
  }

  .host-row__bar span {
    display: block;
    height: 100%;
    border-radius: 3px;
  }

  .host-row__value {
    min-width: 30px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    text-align: right;
  }

  @media (width <= 1200px) {
    .grid--three {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 900px) {
    .grid--trend,
    .grid--three {
      grid-template-columns: 1fr;
    }
  }
</style>
