<!-- 实时日志页面：订阅日志库，持续显示新日志 -->
<template>
  <div class="log-tail-page logx-full-height">
    <ElCard shadow="never" class="toolbar-card">
      <div class="toolbar">
        <div class="toolbar__filters">
          <ElSelect
            v-model="storeId"
            :loading="loadingStores"
            placeholder="选择日志库"
            no-data-text="暂无日志库，请先在日志库管理中新建"
            filterable
            class="toolbar__store"
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
          <ElSelect
            v-model="levels"
            multiple
            collapse-tags
            collapse-tags-tooltip
            clearable
            placeholder="全部级别"
            class="toolbar__levels"
          >
            <ElOption v-for="level in LOG_LEVELS" :key="level" :value="level" :label="level">
              <LogLevelTag :level="level" />
            </ElOption>
          </ElSelect>
          <ElInput
            v-model="keywordInput"
            placeholder="只看包含关键字的日志，回车生效"
            clearable
            class="toolbar__keyword"
            @keyup.enter="applyKeyword"
            @clear="applyKeyword"
          >
            <template #prefix>
              <LogxSvgIcon icon="ri:search-line" />
            </template>
          </ElInput>
        </div>
        <div class="toolbar__controls">
          <div class="toolbar__status" :class="`is-${status}`">
            <span class="status-dot"></span>
            <span>{{ statusText }}</span>
            <span class="toolbar__count">{{ lines.length.toLocaleString() }} 行</span>
          </div>
          <label class="toolbar__switch">
            <ElSwitch v-model="autoScroll" size="small" />
            <span>自动滚动</span>
          </label>
          <ElButton @click="clearLines">
            <LogxSvgIcon icon="ri:eraser-line" class="mr-1" />清屏
          </ElButton>
          <ElButton :type="running ? 'default' : 'primary'" @click="toggleRunning">
            <LogxSvgIcon :icon="running ? 'ri:pause-line' : 'ri:play-line'" class="mr-1" />
            {{ running ? '暂停' : '继续' }}
          </ElButton>
        </div>
      </div>
    </ElCard>

    <div class="console-wrap">
      <div ref="consoleRef" class="log-console" @scroll="handleScroll">
        <div v-if="lines.length === 0" class="log-console__empty">
          <LogxSvgIcon icon="ri:terminal-box-line" class="log-console__empty-icon" />
          <span>{{ emptyText }}</span>
          <ElButton
            v-if="noStores && canManageStores"
            type="primary"
            size="small"
            @click="goCreateStore"
          >
            去创建日志库
          </ElButton>
        </div>
        <div
          v-for="line in lines"
          :key="line.id"
          class="log-line"
          :class="[`log-line--${line.level.toLowerCase()}`]"
        >
          <span class="log-line__time">{{ line.time.slice(11) }}</span>
          <span class="log-line__level">{{ line.level.padEnd(5) }}</span>
          <span v-if="line.host" class="log-line__host">{{ line.host }}</span>
          <span class="log-line__message">{{ line.message }}</span>
        </div>
      </div>
      <button v-if="unseen > 0" type="button" class="new-lines" @click="scrollToBottom">
        <LogxSvgIcon icon="ri:arrow-down-line" />{{ unseen.toLocaleString() }} 条新日志
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import LogLevelTag from '../components/log-level-tag.vue'
  import { streamLogTail } from '@/api/log'
  import { LOG_LEVELS, useLogStoreSelection } from '../shared'

  defineOptions({ name: 'LogTail' })

  /** 最多保留的行数，超出时丢弃最早的行 */
  const MAX_LINES = 2000
  /** 断线后的重连间隔 */
  const RECONNECT_DELAY = 3000

  type Status = 'idle' | 'connecting' | 'live' | 'retrying'

  const {
    stores,
    storeId,
    loadingStores,
    storesLoaded,
    canManageStores,
    goCreateStore,
    loadStores
  } = useLogStoreSelection()

  const noStores = computed(() => storesLoaded.value && stores.value.length === 0)

  const levels = ref<Api.Log.Level[]>([])
  const keywordInput = ref('')
  const keyword = ref('')
  const running = ref(true)
  const autoScroll = ref(true)
  const status = ref<Status>('idle')
  const lines = shallowRef<Api.Log.LogRecord[]>([])
  const consoleRef = ref<HTMLElement>()
  /** 关闭自动滚动后新到的行数，提示用户回到底部查看 */
  const unseen = ref(0)

  const emptyText = computed(() => {
    if (noStores.value) {
      return canManageStores.value
        ? '还没有日志库，日志要先上报到某个日志库才能查看'
        : '还没有日志库，请联系管理员创建'
    }
    if (!storeId.value) return '请先选择日志库'
    if (!running.value) return '已暂停，点击「继续」接收日志'
    return levels.value.length || keyword.value ? '等待符合条件的新日志…' : '等待新日志…'
  })

  let controller: AbortController | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  // 已显示的日志 ID，重连时服务端会重发最近日志，借此去重
  let seenIds = new Set<string>()

  const statusText = computed(
    () =>
      ({
        idle: '已暂停',
        connecting: '连接中…',
        live: '实时接收中',
        retrying: '连接断开，稍后重连…'
      })[status.value]
  )

  const appendLines = (records: Api.Log.LogRecord[]) => {
    const fresh = records.filter((record) => !seenIds.has(record.id))
    if (fresh.length === 0) return
    fresh.forEach((record) => seenIds.add(record.id))
    let next = [...lines.value, ...fresh]
    if (next.length > MAX_LINES) {
      const dropped = next.slice(0, next.length - MAX_LINES)
      dropped.forEach((record) => seenIds.delete(record.id))
      next = next.slice(next.length - MAX_LINES)
    }
    lines.value = next
    if (autoScroll.value) {
      nextTick(() => {
        const el = consoleRef.value
        if (el) el.scrollTop = el.scrollHeight
      })
    } else {
      unseen.value += fresh.length
    }
  }

  const scrollToBottom = () => {
    autoScroll.value = true
    unseen.value = 0
    nextTick(() => {
      const el = consoleRef.value
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    controller?.abort()
    controller = null
  }

  const connect = async () => {
    disconnect()
    if (!running.value || !storeId.value) {
      status.value = 'idle'
      return
    }
    const current = new AbortController()
    controller = current
    status.value = 'connecting'
    try {
      await streamLogTail({
        storeId: storeId.value,
        levels: levels.value,
        keyword: keyword.value || undefined,
        signal: current.signal,
        onLogs: appendLines,
        onReady: () => {
          if (controller === current) status.value = 'live'
        }
      })
    } catch (error) {
      console.warn('[LogTail] 实时日志连接失败', error)
    }
    // 连接结束（服务端超时、网络中断或出错）：仍在运行则稍后重连
    if (controller === current && running.value) {
      status.value = 'retrying'
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY)
    }
  }

  const toggleRunning = () => {
    running.value = !running.value
    if (running.value) connect()
    else {
      disconnect()
      status.value = 'idle'
    }
  }

  const clearLines = () => {
    lines.value = []
    seenIds = new Set()
    unseen.value = 0
  }

  const applyKeyword = () => {
    keyword.value = keywordInput.value.trim()
  }

  /** 用户向上滚动查看历史时暂停自动滚动，滚回底部时恢复 */
  const handleScroll = () => {
    const el = consoleRef.value
    if (!el) return
    autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (autoScroll.value) unseen.value = 0
  }

  // 手动打开自动滚动时直接回到底部
  watch(autoScroll, (enabled) => {
    if (enabled && unseen.value > 0) scrollToBottom()
  })

  // 切换日志库或过滤条件：清屏并重新订阅（服务端按新条件重发最近日志）
  watch([storeId, levels, keyword], () => {
    clearLines()
    connect()
  })

  onMounted(async () => {
    await loadStores()
  })

  onBeforeUnmount(() => {
    running.value = false
    disconnect()
  })
</script>

<style scoped>
  .log-tail-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ---------- 工具栏 ---------- */
  .toolbar-card :deep(.el-card__body) {
    padding: 14px 16px;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    justify-content: space-between;
  }

  .toolbar__filters,
  .toolbar__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .toolbar__filters {
    flex: 1;
    min-width: 0;
  }

  .toolbar__controls .el-button {
    margin: 0;
  }

  .toolbar__store {
    width: 200px;
  }

  .toolbar__levels {
    width: 200px;
  }

  .toolbar__keyword {
    flex: 1;
    min-width: 200px;
    max-width: 360px;
  }

  .toolbar__switch {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--el-text-color-regular);
    cursor: pointer;
  }

  .toolbar__status {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-lighter);
    border-radius: 14px;
  }

  .toolbar__count {
    padding-left: 6px;
    color: var(--el-text-color-secondary);
    border-left: 1px solid var(--el-border-color-lighter);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    background: var(--el-text-color-placeholder);
    border-radius: 50%;
  }

  .is-live .status-dot {
    background: var(--el-color-success);
    box-shadow: 0 0 0 3px rgb(22 163 74 / 18%);
    animation: pulse 2s ease-in-out infinite;
  }

  .is-connecting .status-dot,
  .is-retrying .status-dot {
    background: var(--el-color-warning);
  }

  @keyframes pulse {
    50% {
      box-shadow: 0 0 0 5px rgb(22 163 74 / 6%);
    }
  }

  /* ---------- 终端（深浅主题下保持一致） ---------- */
  .console-wrap {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 300px;
  }

  .log-console {
    flex: 1;
    padding: 12px 0;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.7;
    color: #d4d7dd;
    background: #14161a;
    border-radius: calc(var(--custom-radius, 8px) + 2px);
  }

  .log-console__empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    padding-top: 80px;
    color: #6b7280;
  }

  .log-console__empty-icon {
    font-size: 32px;
    opacity: 0.6;
  }

  .log-line {
    --line-level: #9ca3af;

    display: flex;
    gap: 12px;
    padding: 1px 16px;
    border-left: 2px solid transparent;
  }

  .log-line:hover {
    background: rgb(255 255 255 / 4%);
  }

  .log-line--trace {
    --line-level: #64748b;
  }

  .log-line--debug {
    --line-level: #94a3b8;
  }

  .log-line--info {
    --line-level: #60a5fa;
  }

  .log-line--warn {
    --line-level: #fbbf24;
  }

  .log-line--error {
    --line-level: #f87171;
  }

  .log-line--fatal {
    --line-level: #e879f9;
  }

  /* WARN 及以上整行轻微着色，便于在滚动中发现 */
  .log-line--warn,
  .log-line--error,
  .log-line--fatal {
    background: color-mix(in srgb, var(--line-level) 7%, transparent);
    border-left-color: var(--line-level);
  }

  .log-line__time {
    flex-shrink: 0;
    color: #6b7280;
  }

  .log-line__level {
    flex-shrink: 0;
    font-weight: 600;
    color: var(--line-level);
    white-space: pre;
  }

  .log-line__host {
    flex-shrink: 0;
    color: #a78bfa;
  }

  .log-line__message {
    min-width: 0;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .new-lines {
    position: absolute;
    bottom: 16px;
    left: 50%;
    display: inline-flex;
    gap: 4px;
    align-items: center;
    height: 30px;
    padding: 0 14px;
    font-size: 12px;
    color: #fff;
    cursor: pointer;
    background: var(--el-color-primary);
    border: none;
    border-radius: 15px;
    box-shadow: 0 4px 12px rgb(0 0 0 / 30%);
    transform: translateX(-50%);
  }

  .new-lines:hover {
    background: var(--el-color-primary-dark-2);
  }

  @media (width <= 768px) {
    .toolbar__store,
    .toolbar__levels,
    .toolbar__keyword {
      flex: 1 1 100%;
      width: 100%;
      max-width: none;
    }

    .log-line__host {
      display: none;
    }
  }
</style>
