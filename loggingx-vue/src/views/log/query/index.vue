<!-- 日志查询页面 -->
<template>
  <div class="log-query-page logx-full-height">
    <ElCard shadow="never" class="search-card">
      <div class="search-row">
        <ElSelect
          v-model="storeId"
          :loading="loadingStores"
          placeholder="选择日志库"
          no-data-text="暂无日志库，请先在日志库管理中新建"
          filterable
          class="search-row__store"
        >
          <template #prefix>
            <LogxSvgIcon icon="ri:database-2-line" />
          </template>
          <ElOption
            v-for="store in stores"
            :key="store.storeId"
            :value="store.storeId"
            :label="store.enabled ? store.name : `${store.name}（已停用）`"
          />
        </ElSelect>
        <ElDatePicker
          v-model="filters.timeRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          :shortcuts="timeShortcuts"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          class="search-row__time"
        />
        <ElInput
          v-model="filters.keyword"
          placeholder="搜索日志内容，不区分大小写，回车查询"
          clearable
          class="search-row__keyword"
          @keyup.enter="search(1)"
          @clear="search(1)"
        >
          <template #prefix>
            <LogxSvgIcon icon="ri:search-line" />
          </template>
        </ElInput>
        <ElButton type="primary" :loading="loading" @click="search(1)">查询</ElButton>
        <ElButton :class="{ 'is-open': showMore }" @click="showMore = !showMore">
          <LogxSvgIcon icon="ri:filter-3-line" class="mr-1" />筛选
          <span v-if="moreCount" class="search-row__badge">{{ moreCount }}</span>
        </ElButton>
      </div>
      <ElCollapseTransition>
        <div v-show="showMore" class="more-row">
          <div class="more-row__field">
            <span class="more-row__label">主机</span>
            <ElInput
              v-model="filters.host"
              placeholder="精确匹配"
              clearable
              @keyup.enter="search(1)"
              @clear="search(1)"
            />
          </div>
          <div class="more-row__field">
            <span class="more-row__label">TraceId</span>
            <ElInput
              v-model="filters.traceId"
              placeholder="精确匹配"
              clearable
              @keyup.enter="search(1)"
              @clear="search(1)"
            />
          </div>
          <ElButton link type="primary" @click="resetFilters">重置全部条件</ElButton>
        </div>
      </ElCollapseTransition>
    </ElCard>

    <ElCard shadow="never" class="result-card">
      <div class="result-head">
        <div class="facets">
          <button
            v-for="level in LOG_LEVELS"
            :key="level"
            type="button"
            class="facet"
            :class="[
              levelClass(level),
              {
                'is-active': filters.levels.includes(level),
                'is-empty': !(levelCounts[level] ?? 0)
              }
            ]"
            :title="filters.levels.includes(level) ? '取消筛选' : `只看 ${level}（可多选）`"
            @click="toggleLevel(level)"
          >
            <i class="facet__dot"></i>
            <span>{{ level }}</span>
            <span class="facet__count">{{ (levelCounts[level] ?? 0).toLocaleString() }}</span>
          </button>
        </div>
        <div class="result-head__right">
          <ElTag
            v-for="chip in activeChips"
            :key="chip.field"
            closable
            size="small"
            type="info"
            class="filter-chip"
            @close="clearFilter(chip.field)"
            >{{ chip.label }}：{{ chip.value }}</ElTag
          >
          <span class="result-total"
            >共 <b>{{ total.toLocaleString() }}</b> 条</span
          >
        </div>
      </div>

      <div class="result-table">
        <ElTable
          v-loading="loading"
          :data="records"
          row-key="id"
          height="100%"
          size="small"
          :row-class-name="rowClassName"
        >
          <template #empty>
            <div v-if="storesLoaded && !stores.length" class="no-store">
              <p>还没有日志库，日志要先上报到某个日志库才能查询</p>
              <ElButton v-if="canManageStores" type="primary" size="small" @click="goCreateStore">
                去创建日志库
              </ElButton>
              <p v-else class="no-store__hint">请联系管理员创建日志库</p>
            </div>
            <span v-else>{{
              storeId ? '没有符合条件的日志，试试放宽时间范围或条件' : '请先选择日志库'
            }}</span>
          </template>
          <ElTableColumn type="expand" width="32">
            <template #default="{ row }">
              <div class="log-detail">
                <div class="log-detail__main">
                  <div class="log-detail__bar">
                    <span>日志内容</span>
                    <ElButton link type="primary" size="small" @click="copy(row.message)">
                      复制
                    </ElButton>
                  </div>
                  <pre class="log-detail__block">{{ row.message }}</pre>
                  <template v-if="row.fields">
                    <div class="log-detail__bar">
                      <span>附加字段</span>
                      <ElButton
                        link
                        type="primary"
                        size="small"
                        @click="copy(JSON.stringify(row.fields, null, 2))"
                      >
                        复制
                      </ElButton>
                    </div>
                    <pre class="log-detail__block">{{ JSON.stringify(row.fields, null, 2) }}</pre>
                  </template>
                </div>
                <dl class="log-detail__meta">
                  <dt>日志时间</dt>
                  <dd class="mono">{{ row.time }}</dd>
                  <dt>接收时间</dt>
                  <dd class="mono">{{ row.receivedAt }}</dd>
                  <dt>级别</dt>
                  <dd><LogLevelTag :level="row.level" /></dd>
                  <dt>主机</dt>
                  <dd class="mono">
                    {{ row.host ?? '-' }}
                    <ElButton
                      v-if="row.host && canMonitorHosts"
                      link
                      type="primary"
                      size="small"
                      class="ml-2"
                      @click="openHostMonitor(row.host)"
                      >主机监控</ElButton
                    >
                  </dd>
                  <dt>来源</dt>
                  <dd class="mono">{{ row.source ?? '-' }}</dd>
                  <dt>TraceId</dt>
                  <dd class="mono">
                    <ElButton
                      v-if="row.traceId"
                      link
                      type="primary"
                      size="small"
                      @click="filterBy('traceId', row.traceId)"
                      >{{ row.traceId }}</ElButton
                    >
                    <template v-else>-</template>
                  </dd>
                  <dt>行序号</dt>
                  <dd class="mono">{{ row.seq ?? '-' }}</dd>
                  <template v-if="canAnalyze && ['ERROR', 'FATAL'].includes(row.level)">
                    <dt>AI 分析</dt>
                    <dd>
                      <ElButton
                        link
                        type="primary"
                        size="small"
                        :loading="analyzing === row.id"
                        @click="analyzeRow(row)"
                        >结合代码分析这条错误</ElButton
                      >
                    </dd>
                  </template>
                </dl>
              </div>
            </template>
          </ElTableColumn>
          <!-- 窄屏只显示时分秒，把宽度留给日志内容 -->
          <ElTableColumn prop="time" label="时间" :width="compact ? 96 : 184">
            <template #default="{ row }">
              <span class="mono cell-time" :title="row.time">{{
                compact ? row.time.slice(11) : row.time
              }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="level" label="级别" width="76">
            <template #default="{ row }">
              <LogLevelTag :level="row.level" />
            </template>
          </ElTableColumn>
          <ElTableColumn v-if="!compact" prop="host" label="主机" width="128" show-overflow-tooltip>
            <template #default="{ row }">
              <span
                v-if="row.host"
                class="mono cell-link"
                title="只看此主机"
                @click.stop="filterBy('host', row.host)"
                >{{ row.host }}</span
              >
            </template>
          </ElTableColumn>
          <ElTableColumn prop="message" label="内容" :min-width="compact ? 240 : 420">
            <template #default="{ row }">
              <div class="cell-message">
                <span class="mono cell-message__text">{{ firstLine(row.message) }}</span>
                <span v-if="extraLines(row.message)" class="cell-message__more"
                  >+{{ extraLines(row.message) }} 行</span
                >
                <span
                  v-if="row.traceId"
                  class="cell-message__trace mono"
                  title="只看此 Trace"
                  @click.stop="filterBy('traceId', row.traceId)"
                  >{{ row.traceId }}</span
                >
              </div>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="result-footer">
        <span class="result-footer__hint"
          >按日志时间倒序；同一时间按行序号排列。点击主机、Trace 可快速筛选</span
        >
        <ElPagination
          v-model:current-page="current"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="sizes, prev, pager, next"
          size="small"
          background
          @current-change="search()"
          @size-change="search(1)"
        />
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import LogLevelTag from '../components/log-level-tag.vue'
  import { fetchSearchLogs } from '@/api/log'
  import { analyzeLog } from '@/api/ai-diagnosis'
  import { LOG_LEVELS, isAlertLevel, levelClass, useLogStoreSelection } from '../shared'

  defineOptions({ name: 'LogQuery' })

  const {
    stores,
    storeId,
    loadingStores,
    storesLoaded,
    canManageStores,
    goCreateStore,
    loadStores
  } = useLogStoreSelection()

  const formatTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  /** 最近 N 分钟（结束时间留 1 分钟余量，包含刚写入的日志） */
  const lastMinutes = (minutes: number): [Date, Date] => {
    const now = Date.now()
    return [new Date(now - minutes * 60_000), new Date(now + 60_000)]
  }

  const timeShortcuts = [
    { text: '最近 15 分钟', value: () => lastMinutes(15) },
    { text: '最近 1 小时', value: () => lastMinutes(60) },
    { text: '最近 4 小时', value: () => lastMinutes(240) },
    { text: '最近 24 小时', value: () => lastMinutes(1440) },
    { text: '最近 7 天', value: () => lastMinutes(10080) }
  ]

  const createFilters = () => ({
    timeRange: lastMinutes(60).map(formatTime) as [string, string] | null,
    keyword: '',
    host: '',
    traceId: '',
    levels: [] as Api.Log.Level[]
  })

  type ChipField = 'keyword' | 'host' | 'traceId'

  const filters = reactive(createFilters())
  // 最近一次查询实际使用的条件，用于展示已生效的筛选
  const applied = reactive({ keyword: '', host: '', traceId: '' })
  const showMore = ref(false)
  const loading = ref(false)
  const records = ref<Api.Log.LogRecord[]>([])
  const levelCounts = ref<Record<string, number>>({})
  const current = ref(1)
  const size = ref(50)
  const total = ref(0)

  const moreCount = computed(() => [filters.host, filters.traceId].filter(Boolean).length)

  // 窄屏（手机、窄窗口）下精简表格列
  const { width: windowWidth } = useWindowSize()
  const compact = computed(() => windowWidth.value < 768)

  const activeChips = computed(() =>
    (
      [
        { field: 'keyword', label: '关键字', value: applied.keyword },
        { field: 'host', label: '主机', value: applied.host },
        { field: 'traceId', label: 'Trace', value: applied.traceId }
      ] as { field: ChipField; label: string; value: string }[]
    ).filter((chip) => chip.value)
  )

  const firstLine = (message: string) => {
    const newline = message.indexOf('\n')
    return newline < 0 ? message : message.slice(0, newline)
  }

  const extraLines = (message: string) => message.split('\n').length - 1

  const rowClassName = ({ row }: { row: Api.Log.LogRecord }) =>
    isAlertLevel(row.level) ? `lx-alert-row ${levelClass(row.level)}` : ''

  const search = async (page?: number) => {
    if (!storeId.value) return
    if (page) current.value = page
    loading.value = true
    try {
      const keyword = filters.keyword.trim()
      const host = filters.host.trim()
      const traceId = filters.traceId.trim()
      const result = await fetchSearchLogs({
        storeId: storeId.value,
        startTime: filters.timeRange?.[0],
        endTime: filters.timeRange?.[1],
        levels: filters.levels.length ? filters.levels.join(',') : undefined,
        keyword: keyword || undefined,
        host: host || undefined,
        traceId: traceId || undefined,
        current: current.value,
        size: size.value
      })
      records.value = result.records
      total.value = result.total
      levelCounts.value = result.levelCounts
      Object.assign(applied, { keyword, host, traceId })
    } finally {
      loading.value = false
    }
  }

  const toggleLevel = (level: Api.Log.Level) => {
    const index = filters.levels.indexOf(level)
    if (index >= 0) filters.levels.splice(index, 1)
    else filters.levels.push(level)
    search(1)
  }

  const filterBy = (field: 'host' | 'traceId', value: string) => {
    filters[field] = value
    search(1)
  }

  const clearFilter = (field: ChipField) => {
    filters[field] = ''
    search(1)
  }

  const resetFilters = () => {
    Object.assign(filters, createFilters())
    search(1)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success('已复制')
    } catch {
      ElMessage.error('复制失败，请手动选择复制')
    }
  }

  watch(storeId, (id, previous) => {
    if (id === undefined) {
      // 日志库被删除或已无日志库：清空上一个日志库的结果
      records.value = []
      total.value = 0
      levelCounts.value = {}
    } else if (id !== previous) {
      search(1)
    }
  })

  /**
   * 从主机监控、告警中心跳转过来时带的条件：host（主机名）、start / end（yyyy-MM-dd HH:mm:ss），
   * 以及日志告警的 keyword、levels（逗号分隔）。
   * @return 是否带了条件
   */
  const route = useRoute()
  const router = useRouter()
  const canMonitorHosts = computed(() => router.hasRoute('HostMonitor'))

  // 有「AI 诊断」菜单时，错误日志可以提交给 AI 结合代码分析
  const canAnalyze = computed(() => router.hasRoute('AiDiagnosis'))
  const analyzing = ref<string>()
  const analyzeRow = async (row: Api.Log.LogRecord) => {
    if (!storeId.value) return
    analyzing.value = row.id
    try {
      const item = await analyzeLog({
        storeId: storeId.value,
        message: row.message,
        host: row.host,
        source: row.source,
        time: row.time
      })
      ElMessage({
        type: 'success',
        message: '已提交 AI 分析，完成后可在「AI 诊断」查看',
        duration: 4000
      })
      router.push({ name: 'AiDiagnosis', query: { id: item.id } })
    } finally {
      analyzing.value = undefined
    }
  }
  const openHostMonitor = (host: string) =>
    router.push({ name: 'HostMonitor', query: { storeId: storeId.value, host } })

  const applyRouteFilters = () => {
    const { host, start, end, keyword, levels } = route.query
    if (typeof host !== 'string' && typeof start !== 'string') return false
    filters.host = typeof host === 'string' ? host : ''
    filters.keyword = typeof keyword === 'string' ? keyword : ''
    filters.levels =
      typeof levels === 'string' && levels ? (levels.split(',') as Api.Log.Level[]) : []
    if (typeof start === 'string' && typeof end === 'string') filters.timeRange = [start, end]
    return true
  }

  // 页面被缓存时，再次跳转进来（URL 变化）也要应用新条件
  watch(
    () => route.fullPath,
    () => {
      if (route.name !== 'LogQuery' || !applyRouteFilters()) return
      const id = Number(route.query.storeId)
      if (id && id !== storeId.value && stores.value.some((store) => store.storeId === id)) {
        storeId.value = id // 切换日志库会触发查询
      } else {
        search(1)
      }
    }
  )

  onMounted(async () => {
    // 先应用条件，加载日志库后的首次查询即使用它们
    applyRouteFilters()
    await loadStores()
  })
</script>

<style scoped>
  .log-query-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  /* ---------- 搜索栏 ---------- */
  .search-card :deep(.el-card__body) {
    padding: 14px 16px;
  }

  .search-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .search-row .el-button {
    margin: 0;
  }

  .search-row__store {
    width: 200px;
  }

  .search-row__time {
    flex: 0 0 360px;
  }

  .search-row__keyword {
    flex: 1;
    min-width: 220px;
  }

  .search-row__badge {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    margin-left: 4px;
    font-size: 11px;
    line-height: 16px;
    color: #fff;
    background: var(--el-color-primary);
    border-radius: 8px;
  }

  .is-open {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }

  .more-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 20px;
    align-items: center;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .more-row__field {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 280px;
  }

  .more-row__label {
    flex-shrink: 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  /* ---------- 结果区 ---------- */
  .result-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .result-card :deep(.el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 0;
  }

  .result-head {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .facets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .facet {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: var(--el-fill-color-lighter);
    border: 1px solid transparent;
    border-radius: 6px;
    transition: all 0.15s;
  }

  .facet:hover {
    border-color: var(--lx-level);
  }

  .facet.is-empty {
    opacity: 0.5;
  }

  .facet.is-active {
    color: var(--lx-level);
    background: color-mix(in srgb, var(--lx-level) 12%, transparent);
    border-color: var(--lx-level);
    opacity: 1;
  }

  .facet__dot {
    width: 8px;
    height: 8px;
    background: var(--lx-level);
    border-radius: 2px;
  }

  .facet__count {
    color: var(--el-text-color-secondary);
  }

  .facet.is-active .facet__count {
    color: inherit;
  }

  .result-head__right {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .filter-chip {
    max-width: 260px;
  }

  .result-total {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .result-total b {
    color: var(--el-text-color-primary);
  }

  .result-table {
    flex: 1;
    min-height: 240px;
  }

  .no-store {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    padding: 24px 0;
    line-height: 1.6;
  }

  .no-store p {
    margin: 0;
  }

  .no-store__hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  /* WARN 及以上的行在左侧标出级别色 */
  .result-table :deep(.lx-alert-row > td:first-child) {
    box-shadow: inset 3px 0 0 var(--lx-level);
  }

  .result-table :deep(.el-table__cell) {
    padding: 6px 0;
  }

  .cell-time {
    color: var(--el-text-color-secondary);
  }

  .cell-link {
    color: var(--el-text-color-regular);
    cursor: pointer;
  }

  .cell-link:hover {
    color: var(--el-color-primary);
    text-decoration: underline;
  }

  .cell-message {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .cell-message__text {
    overflow: hidden;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cell-message__more {
    flex-shrink: 0;
    padding: 0 6px;
    font-size: 11px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color);
    border-radius: 4px;
  }

  .cell-message__trace {
    flex-shrink: 0;
    max-width: 180px;
    padding: 0 6px;
    margin-left: auto;
    overflow: hidden;
    font-size: 11px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }

  .cell-message__trace:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }

  .result-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .result-footer__hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  /* ---------- 展开详情 ---------- */
  .log-detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 16px;
    padding: 4px 16px 12px 40px;
  }

  .log-detail__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 8px 0 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .log-detail__block {
    max-height: 320px;
    padding: 10px 12px;
    margin: 0;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    word-break: break-all;
    white-space: pre-wrap;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }

  .log-detail__meta {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 8px 12px;
    align-content: start;
    padding: 12px 14px;
    margin: 8px 0 0;
    font-size: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .log-detail__meta dt {
    color: var(--el-text-color-secondary);
  }

  .log-detail__meta dd {
    margin: 0;
    word-break: break-all;
  }

  @media (width <= 960px) {
    .search-row__store,
    .search-row__time {
      flex: 1 1 100%;
      width: 100%;
    }

    .log-detail {
      grid-template-columns: 1fr;
      padding-left: 16px;
    }
  }
</style>
