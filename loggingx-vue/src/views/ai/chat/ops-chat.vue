<!-- 智能问答：用自然语言问运维问题，AI 结合知识库、诊断、告警、日志和代码回答并标注出处 -->
<template>
  <div class="chat">
    <div ref="scrollRef" class="chat__scroll">
      <div class="chat__column">
        <div v-if="!turns.length" class="welcome">
          <div class="welcome__icon"><LogxSvgIcon icon="ri:robot-2-line" /></div>
          <div class="welcome__title">问一问线上发生了什么</div>
          <p class="welcome__text">
            AI 会先在知识库、历史 AI
            诊断、错误归类、告警和所选时间范围内的错误日志里查找相关资料，再根据资料回答，并用
            [编号] 标出出处；问题里提到类名或文件名时，还会附上关联代码仓库里的代码。
          </p>
          <div class="examples">
            <button
              v-for="example in EXAMPLES"
              :key="example.text"
              type="button"
              class="example"
              @click="ask(example.text)"
            >
              <LogxSvgIcon :icon="example.icon" class="example__icon" />
              <span>{{ example.text }}</span>
            </button>
          </div>
        </div>

        <div v-for="(turn, index) in turns" :key="index" class="turn">
          <div class="bubble bubble--user">{{ turn.question }}</div>
          <div class="reply">
            <div class="reply__avatar"><LogxSvgIcon icon="ri:robot-2-line" /></div>
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
                <div class="sources__title">
                  <LogxSvgIcon icon="ri:book-open-line" /> 参考资料
                </div>
                <button
                  v-for="source in turn.sources"
                  :key="source.ref"
                  :id="`src-${index}-${source.ref}`"
                  type="button"
                  class="source"
                  :class="{ 'source--active': turn.active === source.ref }"
                  @click="openSource(source)"
                >
                  <span class="source__ref">{{ source.ref }}</span>
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
      </div>
    </div>

    <form class="composer" @submit.prevent="ask()">
      <div class="composer__box">
        <label for="ops-question" class="sr-only">问题</label>
        <ElInput
          id="ops-question"
          v-model="question"
          type="textarea"
          class="composer__input"
          :autosize="{ minRows: 2, maxRows: 6 }"
          resize="none"
          maxlength="2000"
          placeholder="例如：订单服务最近一小时为什么一直报错？（Enter 发送，Shift + Enter 换行）"
          @keydown.enter.exact.prevent="ask()"
        />
        <div class="composer__bar">
          <ElSelect
            v-model="storeId"
            placeholder="全部日志库"
            clearable
            size="small"
            class="w-store"
          >
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
          <ElButton v-if="turns.length" size="small" text @click="reset">
            <LogxSvgIcon icon="ri:add-line" class="mr-1" />新对话
          </ElButton>
          <ElButton v-if="streaming" class="composer__send" type="danger" plain @click="stop">
            <LogxSvgIcon icon="ri:stop-fill" class="mr-1" />停止
          </ElButton>
          <ElButton
            v-else
            class="composer__send"
            type="primary"
            native-type="submit"
            :disabled="!question.trim()"
          >
            <LogxSvgIcon icon="ri:send-plane-2-line" class="mr-1" />提问
          </ElButton>
        </div>
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
    { icon: 'ri:bar-chart-2-line', text: '最近 24 小时哪个服务报错最多？主要是什么错误？' },
    { icon: 'ri:history-line', text: 'OutOfMemoryError 以前是怎么处理的？' },
    { icon: 'ri:database-2-line', text: '数据库连接池耗尽一般是什么原因，怎么排查？' },
    { icon: 'ri:alarm-warning-line', text: '当前有哪些告警，和哪些错误日志有关？' }
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
  /* 配色、圆角都取自全局主题变量（--logx-*、--custom-radius），亮色/暗色模式自动跟随 */
  .chat {
    --chat-radius: calc(var(--custom-radius, 8px) + 4px);
    --chat-width: 860px;

    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .chat__scroll {
    flex: 1;
    min-height: 0;
    padding: 8px 4px;
    overflow-y: auto;
  }

  .chat__column {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: var(--chat-width);
    margin: 0 auto;
  }

  .welcome {
    margin: 40px auto 0;
    text-align: center;
  }

  .welcome__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    font-size: 26px;
    color: var(--logx-primary);
    background: color-mix(in srgb, var(--logx-primary) 10%, transparent);
    border-radius: var(--chat-radius);
  }

  .welcome__title {
    margin-top: 16px;
    font-size: 24px;
    font-weight: 600;
    color: var(--logx-gray-900);
    letter-spacing: -0.01em;
  }

  .welcome__text {
    max-width: 680px;
    margin: 10px auto 28px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--logx-gray-600);
  }

  .examples {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  .example {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    min-height: 52px;
    padding: 14px 16px;
    font: inherit;
    font-size: 13px;
    line-height: 1.6;
    color: var(--logx-gray-800);
    text-align: left;
    cursor: pointer;
    background: var(--default-box-color);
    border: 1px solid var(--default-border);
    border-radius: var(--chat-radius);
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .example:hover,
  .example:focus-visible {
    border-color: color-mix(in srgb, var(--logx-primary) 45%, transparent);
    outline: none;
    box-shadow: 0 4px 16px rgb(0 0 0 / 6%);
  }

  .example__icon {
    flex: none;
    margin-top: 2px;
    font-size: 16px;
    color: var(--logx-primary);
  }

  .turn {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .bubble--user {
    align-self: flex-end;
    max-width: 80%;
    padding: 10px 16px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--logx-on-primary, #fff);
    white-space: pre-wrap;
    background: var(--logx-primary);
    border-radius: var(--chat-radius) var(--chat-radius) 4px var(--chat-radius);
  }

  .reply {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .reply__avatar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    font-size: 17px;
    color: var(--logx-primary);
    background: color-mix(in srgb, var(--logx-primary) 10%, transparent);
    border-radius: 50%;
  }

  .answer {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 14px 18px;
    background: var(--logx-gray-100);
    border: 1px solid var(--logx-card-border);
    border-radius: 4px var(--chat-radius) var(--chat-radius);
  }

  .answer__error {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--logx-danger);
  }

  .thinking {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--logx-gray-600);
  }

  .thinking .spin {
    color: var(--logx-primary);
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
    color: var(--logx-gray-900);
    overflow-wrap: anywhere;
  }

  .md :deep(p) {
    margin: 0 0 8px;
  }

  .md :deep(> :last-child) {
    margin-bottom: 0;
  }

  .md :deep(h3),
  .md :deep(h4),
  .md :deep(h5),
  .md :deep(h6) {
    margin: 14px 0 6px;
    font-size: 15px;
    font-weight: 600;
  }

  .md :deep(ul),
  .md :deep(ol) {
    padding-left: 22px;
    margin: 0 0 8px;
  }

  .md :deep(strong) {
    font-weight: 600;
  }

  .md :deep(code) {
    padding: 1px 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12.5px;
    background: var(--logx-gray-200);
    border-radius: 4px;
  }

  .md :deep(pre) {
    padding: 12px 14px;
    margin: 0 0 8px;
    overflow-x: auto;
    background: var(--default-box-color);
    border: 1px solid var(--default-border);
    border-radius: var(--custom-radius, 8px);
  }

  .md :deep(pre code) {
    padding: 0;
    background: none;
  }

  .md :deep(.md-cite) {
    padding: 0 3px;
    margin: 0 1px;
    font-size: 11px;
    font-weight: 600;
    color: var(--logx-primary);
    cursor: pointer;
    background: color-mix(in srgb, var(--logx-primary) 10%, transparent);
    border-radius: 4px;
  }

  .sources {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 12px;
    border-top: 1px solid var(--default-border);
  }

  .sources__title {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--logx-gray-600);
  }

  .source {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
    padding: 6px 8px;
    font: inherit;
    font-size: 13px;
    color: var(--logx-gray-800);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: var(--custom-radius, 8px);
  }

  .source:hover,
  .source:focus-visible {
    background: var(--logx-hover-color);
    outline: none;
  }

  .source--active {
    background: color-mix(in srgb, var(--logx-primary) 10%, transparent);
  }

  .source__ref {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    font-size: 11px;
    font-weight: 600;
    color: var(--logx-primary);
    background: color-mix(in srgb, var(--logx-primary) 10%, transparent);
    border-radius: 50%;
  }

  .source__type {
    flex: none;
    padding: 0 6px;
    font-size: 11px;
    line-height: 18px;
    border-radius: 4px;
  }

  .type--knowledge {
    color: var(--logx-success);
    background: color-mix(in srgb, var(--logx-success) 12%, transparent);
  }

  .type--diagnosis {
    color: var(--logx-primary);
    background: color-mix(in srgb, var(--logx-primary) 12%, transparent);
  }

  .type--group,
  .type--log,
  .type--stats {
    color: var(--logx-danger);
    background: color-mix(in srgb, var(--logx-danger) 10%, transparent);
  }

  .type--alert {
    color: var(--logx-warning);
    background: color-mix(in srgb, var(--logx-warning) 14%, transparent);
  }

  .type--code {
    color: var(--logx-gray-700);
    background: var(--logx-gray-200);
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
    color: var(--logx-gray-600);
  }

  .muted {
    font-size: 12px;
    color: var(--logx-gray-600);
  }

  .composer {
    width: 100%;
    max-width: var(--chat-width);
    margin: 0 auto;
  }

  .composer__box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: var(--default-box-color);
    border: 1px solid var(--default-border);
    border-radius: calc(var(--chat-radius) + 4px);
    box-shadow: 0 2px 12px rgb(0 0 0 / 4%);
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .composer__box:focus-within {
    border-color: color-mix(in srgb, var(--logx-primary) 55%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--logx-primary) 12%, transparent);
  }

  /* 输入框融入外框，不再单独描边 */
  .composer__input :deep(.el-textarea__inner) {
    padding: 2px 4px;
    font-size: 14px;
    line-height: 1.7;
    background: transparent;
    box-shadow: none !important;
  }

  .composer__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .composer__send {
    margin-left: auto;
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
