<!-- 智能问答：用自然语言问运维问题，AI 结合知识库、诊断、告警、日志和代码回答并标注出处 -->
<template>
  <div class="chat">
    <div ref="scrollRef" class="chat__scroll">
      <div v-if="!turns.length" class="welcome">
        <div class="welcome__title">问一问线上发生了什么</div>
        <p class="welcome__text">
          AI 会先在知识库、历史 AI
          诊断、错误归类、告警和所选时间范围内的错误日志里查找相关资料，再根据资料回答，并用 [编号]
          标出出处；问题里提到类名或文件名时，还会附上关联代码仓库里的代码。
        </p>
        <div class="examples">
          <button
            v-for="example in EXAMPLES"
            :key="example"
            type="button"
            class="example"
            @click="ask(example)"
          >
            {{ example }}
          </button>
        </div>
      </div>

      <div v-for="(turn, index) in turns" :key="index" class="turn">
        <div class="bubble bubble--user">{{ turn.question }}</div>
        <div class="answer">
          <div v-if="turn.error" class="answer__error">
            <LogxSvgIcon icon="ri:error-warning-line" /> {{ turn.error }}
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-else-if="turn.answer"
            class="md"
            @click="onCite($event, turn)"
            v-html="render(turn.answer)"
          ></div>
          <div v-else class="thinking">
            <LogxSvgIcon icon="ri:loader-4-line" class="spin" />
            {{ turn.sources ? '正在根据资料回答…' : '正在查找相关资料…' }}
          </div>

          <div v-if="turn.sources?.length" class="sources">
            <div class="sources__title">参考资料</div>
            <button
              v-for="source in turn.sources"
              :key="source.ref"
              :id="`src-${index}-${source.ref}`"
              type="button"
              class="source"
              :class="{ 'source--active': turn.active === source.ref }"
              @click="openSource(source)"
            >
              <span class="source__ref">[{{ source.ref }}]</span>
              <span class="source__type" :class="`type--${source.type}`">{{
                TYPE_NAMES[source.type]
              }}</span>
              <span class="source__title">{{ source.title }}</span>
              <span class="source__meta">{{
                [source.storeName, source.time].filter(Boolean).join(' · ')
              }}</span>
            </button>
          </div>
          <div v-else-if="turn.sources && !turn.error" class="muted"
            >没有找到相关资料，回答仅供参考</div
          >
          <div v-if="turn.model" class="muted">
            {{ turn.model }}
            <template v-if="turn.tokens"> · {{ turn.tokens }} tokens</template>
          </div>
        </div>
      </div>
    </div>

    <form class="composer" @submit.prevent="ask()">
      <div class="composer__options">
        <ElSelect v-model="storeId" placeholder="全部日志库" clearable size="small" class="w-store">
          <ElOption
            v-for="store in stores"
            :key="store.storeId"
            :value="store.storeId"
            :label="store.storeName"
          />
        </ElSelect>
        <ElSelect v-model="hours" size="small" class="w-hours">
          <ElOption :value="1" label="最近 1 小时" />
          <ElOption :value="6" label="最近 6 小时" />
          <ElOption :value="24" label="最近 24 小时" />
          <ElOption :value="72" label="最近 3 天" />
          <ElOption :value="168" label="最近 7 天" />
        </ElSelect>
        <ElButton v-if="turns.length" size="small" link @click="reset">新对话</ElButton>
      </div>
      <div class="composer__row">
        <label for="ops-question" class="sr-only">问题</label>
        <ElInput
          id="ops-question"
          v-model="question"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 5 }"
          resize="none"
          maxlength="2000"
          placeholder="例如：订单服务最近一小时为什么一直报错？（Enter 发送，Shift + Enter 换行）"
          @keydown.enter.exact.prevent="ask()"
        />
        <ElButton v-if="streaming" type="danger" plain @click="stop">停止</ElButton>
        <ElButton v-else type="primary" native-type="submit" :disabled="!question.trim()"
          >提问</ElButton
        >
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { HttpError } from '@/utils/http/error'
  import { renderMarkdown } from '@/utils/markdown'
  import { askOps } from '@/api/ai-diagnosis'

  defineProps<{ stores: Api.AiDiagnosis.StoreConfig[] }>()
  const emit = defineEmits<{ openDiagnosis: [id: number]; openKnowledge: [id: number] }>()
  const router = useRouter()

  const EXAMPLES = [
    '最近 24 小时哪个服务报错最多？主要是什么错误？',
    'OutOfMemoryError 以前是怎么处理的？',
    '数据库连接池耗尽一般是什么原因，怎么排查？',
    '当前有哪些告警，和哪些错误日志有关？'
  ]

  const TYPE_NAMES: Record<Api.AiOps.Source['type'], string> = {
    knowledge: '知识库',
    diagnosis: 'AI 诊断',
    group: '错误归类',
    alert: '告警',
    log: '日志',
    stats: '统计',
    code: '代码'
  }

  interface ChatTurn {
    question: string
    answer: string
    sources?: Api.AiOps.Source[]
    error?: string
    model?: string | null
    tokens?: number | null
    active?: number
  }

  const question = ref('')
  const storeId = ref<number>()
  const hours = ref(24)
  const turns = ref<ChatTurn[]>([])
  const streaming = ref(false)
  const scrollRef = ref<HTMLElement>()
  let controller: AbortController | undefined

  const render = (text: string) => renderMarkdown(text)

  const scrollToBottom = () =>
    nextTick(() => scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight }))

  const ask = async (text?: string) => {
    const content = (text ?? question.value).trim()
    if (!content || streaming.value) return
    question.value = ''
    const history: Api.AiOps.Turn[] = turns.value
      .filter((turn) => turn.answer && !turn.error)
      .slice(-3)
      .flatMap((turn) => [
        { role: 'user' as const, content: turn.question },
        { role: 'assistant' as const, content: turn.answer }
      ])
    turns.value.push({ question: content, answer: '' })
    const turn = turns.value[turns.value.length - 1]
    streaming.value = true
    controller = new AbortController()
    scrollToBottom()
    try {
      await askOps(
        { question: content, storeId: storeId.value, hours: hours.value, history },
        {
          onSources: (sources) => {
            turn.sources = sources
            scrollToBottom()
          },
          onDelta: (delta) => {
            turn.answer += delta
            scrollToBottom()
          },
          onDone: (reply) => {
            turn.model = reply.model
            turn.tokens =
              reply.promptTokens != null ? reply.promptTokens + (reply.completionTokens ?? 0) : null
          },
          onError: (message) => {
            turn.error = message
          }
        },
        controller.signal
      )
    } catch (error) {
      turn.error = error instanceof HttpError ? error.message : '回答失败，请稍后再试'
    } finally {
      streaming.value = false
      if (!turn.answer && !turn.error && controller?.signal.aborted) turn.error = '已停止'
    }
  }

  const stop = () => controller?.abort()

  const reset = () => {
    stop()
    turns.value = []
  }

  /** 点击回答中的 [n]：高亮并滚动到对应资料 */
  const onCite = (event: MouseEvent, turn: ChatTurn) => {
    const target = (event.target as HTMLElement).closest('.md-cite') as HTMLElement | null
    if (!target) return
    const ref = Number(target.dataset.ref)
    turn.active = ref
    const index = turns.value.indexOf(turn)
    document
      .getElementById(`src-${index}-${ref}`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const openSource = (source: Api.AiOps.Source) => {
    const id = source.id === null ? NaN : Number(source.id)
    switch (source.type) {
      case 'diagnosis':
        emit('openDiagnosis', id)
        break
      case 'knowledge':
        emit('openKnowledge', id)
        break
      case 'alert':
        router.push({ name: 'AlertEvent' })
        break
      case 'log':
      case 'stats':
        router.push({
          name: 'LogQuery',
          query: {
            storeId: source.storeId ?? undefined,
            levels: 'ERROR,FATAL',
            start: source.time ?? undefined
          }
        })
        break
      default:
        break
    }
  }

  onBeforeUnmount(stop)
</script>

<style scoped>
  .chat {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .chat__scroll {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 22px;
    min-height: 0;
    padding: 8px 4px;
    overflow-y: auto;
  }

  .welcome {
    max-width: 760px;
    margin: 32px auto 0;
    text-align: center;
  }

  .welcome__title {
    font-size: 22px;
    font-weight: 700;
    color: var(--el-text-color-primary);
  }

  .welcome__text {
    margin: 10px 0 20px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--el-text-color-secondary);
  }

  .examples {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
  }

  .example {
    min-height: 44px;
    padding: 10px 14px;
    font: inherit;
    font-size: 13px;
    color: var(--el-text-color-regular);
    text-align: left;
    cursor: pointer;
    background: var(--el-fill-color-lighter);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .example:hover,
  .example:focus-visible {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary-light-5);
  }

  .turn {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 920px;
  }

  .bubble--user {
    align-self: flex-end;
    max-width: 80%;
    padding: 10px 14px;
    font-size: 14px;
    line-height: 1.7;
    color: #fff;
    white-space: pre-wrap;
    background: var(--el-color-primary);
    border-radius: 12px 12px 2px;
  }

  .answer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 14px 16px;
    background: var(--el-fill-color-lighter);
    border-radius: 2px 12px 12px;
  }

  .answer__error {
    color: var(--el-color-danger);
  }

  .thinking {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--el-color-primary);
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation: none;
    }
  }

  .md {
    font-size: 14px;
    line-height: 1.8;
    color: var(--el-text-color-primary);
    overflow-wrap: anywhere;
  }

  .md :deep(p) {
    margin: 0 0 8px;
  }

  .md :deep(h3),
  .md :deep(h4),
  .md :deep(h5),
  .md :deep(h6) {
    margin: 12px 0 6px;
    font-size: 15px;
  }

  .md :deep(ul),
  .md :deep(ol) {
    padding-left: 22px;
    margin: 0 0 8px;
  }

  .md :deep(code) {
    padding: 1px 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12.5px;
    background: var(--el-fill-color);
    border-radius: 4px;
  }

  .md :deep(pre) {
    padding: 12px;
    margin: 0 0 8px;
    overflow-x: auto;
    background: var(--el-fill-color);
    border-radius: 6px;
  }

  .md :deep(pre code) {
    padding: 0;
    background: none;
  }

  .md :deep(.md-cite) {
    margin: 0 1px;
    font-weight: 600;
    color: var(--el-color-primary);
    cursor: pointer;
  }

  .sources {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 10px;
    border-top: 1px dashed var(--el-border-color);
  }

  .sources__title {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  .source {
    display: flex;
    gap: 8px;
    align-items: baseline;
    min-width: 0;
    padding: 4px 6px;
    font: inherit;
    font-size: 13px;
    color: var(--el-text-color-regular);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 4px;
  }

  .source:hover,
  .source:focus-visible,
  .source--active {
    background: var(--el-color-primary-light-9);
  }

  .source__ref {
    flex: none;
    font-weight: 600;
    color: var(--el-color-primary);
  }

  .source__type {
    flex: none;
    padding: 0 6px;
    font-size: 11px;
    line-height: 18px;
    border-radius: 3px;
  }

  .type--knowledge {
    color: #0f766e;
    background: color-mix(in srgb, #0f766e 12%, transparent);
  }

  .type--diagnosis {
    color: #7c3aed;
    background: color-mix(in srgb, #7c3aed 12%, transparent);
  }

  .type--group,
  .type--log,
  .type--stats {
    color: var(--el-color-danger);
    background: color-mix(in srgb, var(--el-color-danger) 10%, transparent);
  }

  .type--alert {
    color: var(--el-color-warning-dark-2);
    background: color-mix(in srgb, var(--el-color-warning) 14%, transparent);
  }

  .type--code {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .source__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source__meta {
    flex: none;
    margin-left: auto;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .composer__options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .composer__row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }

  .w-store {
    width: 170px;
  }

  .w-hours {
    width: 130px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
