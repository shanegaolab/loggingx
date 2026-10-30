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
            [编号]
            标出出处；问题里提到类名或文件名时，还会附上关联代码仓库里的代码。也可以上传日志、堆栈或配置文件让
            AI 一起分析。
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
          <div class="ask">
            <div class="bubble bubble--user">{{ turn.question }}</div>
            <div v-if="turn.files.length" class="files files--sent">
              <span v-for="file in turn.files" :key="file.name" class="file">
                <LogxSvgIcon icon="ri:file-text-line" class="file__icon" />
                <span class="file__name">{{ file.name }}</span>
              </span>
            </div>
          </div>
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
              <div v-if="turn.answer || turn.error" class="answer__foot">
                <span v-if="turn.model" class="muted">
                  {{ turn.model }}
                  <template v-if="turn.tokens"> · {{ turn.tokens }} tokens</template>
                </span>
                <span class="answer__actions">
                  <ElTooltip v-if="turn.answer" content="复制回答" placement="top">
                    <button
                      type="button"
                      class="icon-btn"
                      aria-label="复制回答"
                      @click="copy(turn)"
                    >
                      <LogxSvgIcon icon="ri:file-copy-line" />
                    </button>
                  </ElTooltip>
                  <ElTooltip
                    v-if="index === turns.length - 1 && !streaming"
                    content="重新回答"
                    placement="top"
                  >
                    <button type="button" class="icon-btn" aria-label="重新回答" @click="retry">
                      <LogxSvgIcon icon="ri:refresh-line" />
                    </button>
                  </ElTooltip>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <form class="composer" @submit.prevent="ask()">
      <div
        class="composer__box"
        :class="{ 'is-dragging': dragging }"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.self="dragging = false"
        @drop.prevent="onDrop"
      >
        <div v-if="files.length" class="files">
          <span v-for="(file, i) in files" :key="file.name" class="file" :title="file.note">
            <LogxSvgIcon icon="ri:file-text-line" class="file__icon" />
            <span class="file__name">{{ file.name }}</span>
            <span class="file__size">{{ file.size }}</span>
            <button
              type="button"
              class="file__remove"
              :aria-label="`移除 ${file.name}`"
              @click="files.splice(i, 1)"
            >
              <LogxSvgIcon icon="ri:close-line" />
            </button>
          </span>
        </div>
        <label for="ops-question" class="sr-only">问题</label>
        <ElInput
          id="ops-question"
          v-model="question"
          type="textarea"
          class="composer__input"
          :autosize="{ minRows: 2, maxRows: 6 }"
          resize="none"
          maxlength="2000"
          :placeholder="
            files.length
              ? '说说想让 AI 从文件里看什么，不填则直接分析错误原因（Enter 发送）'
              : '例如：订单服务最近一小时为什么一直报错？（Enter 发送，Shift + Enter 换行，可拖入或粘贴日志文件）'
          "
          @keydown.enter.exact.prevent="ask()"
          @paste="onPaste"
        />
        <div v-if="dragging" class="composer__drop">
          <LogxSvgIcon icon="ri:upload-cloud-2-line" /> 松开即可添加文件
        </div>
        <div class="composer__bar">
          <input
            ref="fileRef"
            type="file"
            multiple
            :accept="ACCEPT"
            class="sr-only"
            tabindex="-1"
            @change="onPick"
          />
          <ElTooltip
            :content="`上传日志、堆栈或配置等文本文件，最多 ${MAX_FILES} 个`"
            placement="top"
          >
            <button
              type="button"
              class="icon-btn"
              aria-label="上传文件"
              :disabled="files.length >= MAX_FILES"
              @click="fileRef?.click()"
            >
              <LogxSvgIcon icon="ri:attachment-2" />
            </button>
          </ElTooltip>
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
            :disabled="!question.trim() && !files.length"
          >
            <LogxSvgIcon icon="ri:send-plane-2-line" class="mr-1" />提问
          </ElButton>
        </div>
      </div>
      <p class="composer__hint">AI 根据检索到的资料回答，结论请结合实际日志核实</p>
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

  /** 上传文件：只读文本，最多 3 个；超长的保留开头和结尾（日志的报错通常在末尾） */
  const MAX_FILES = 3
  const MAX_FILE_CHARS = 20000
  const MAX_FILE_BYTES = 10 * 1024 * 1024
  const ACCEPT =
    '.log,.txt,.out,.err,.json,.yaml,.yml,.xml,.csv,.md,.properties,.conf,.ini,.toml,.env,' +
    '.java,.kt,.py,.js,.ts,.go,.sql,.sh,.trace,.stack,text/*'
  const DEFAULT_FILE_QUESTION = '请分析上传的文件，找出其中的错误、原因和处理建议'

  interface ChatFile extends Api.AiOps.Attachment {
    /** 文件大小，如 12.3 KB */
    size: string
    /** 截取说明，悬停时显示 */
    note?: string
  }

  interface ChatTurn {
    question: string
    files: ChatFile[]
    answer: string
    sources?: Api.AiOps.Source[]
    error?: string
    model?: string | null
    tokens?: number | null
    active?: number
  }

  const question = ref('')
  const files = ref<ChatFile[]>([])
  const dragging = ref(false)
  const fileRef = ref<HTMLInputElement>()
  const storeId = ref<number>()
  const hours = ref(24)
  const turns = ref<ChatTurn[]>([])
  const streaming = ref(false)
  const scrollRef = ref<HTMLElement>()
  let controller: AbortController | undefined

  const render = (text: string) => renderMarkdown(text)

  const formatSize = (bytes: number) =>
    bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  /** 超长时保留开头 30% 和结尾 70% */
  const clip = (text: string) => {
    if (text.length <= MAX_FILE_CHARS) return { content: text }
    const marker = `\n…（中间省略 ${text.length - MAX_FILE_CHARS} 个字符）…\n`
    const room = MAX_FILE_CHARS - marker.length
    const headLength = Math.floor(room * 0.3)
    return {
      content: text.slice(0, headLength) + marker + text.slice(text.length - (room - headLength)),
      note: `文件共 ${text.length} 个字符，只发送开头和结尾共 ${MAX_FILE_CHARS} 个`
    }
  }

  const addFiles = async (list: Iterable<File>) => {
    for (const file of list) {
      if (files.value.length >= MAX_FILES) {
        ElMessage.warning(`最多上传 ${MAX_FILES} 个文件`)
        return
      }
      if (files.value.some((item) => item.name === file.name)) continue
      if (file.size > MAX_FILE_BYTES) {
        ElMessage.warning(`${file.name} 超过 10 MB，请截取相关片段后再上传`)
        continue
      }
      const text = await file.text()
      if (text.slice(0, 4096).includes('\u0000')) {
        ElMessage.warning(`${file.name} 不是文本文件，目前只支持日志、堆栈、配置等文本`)
        continue
      }
      if (!text.trim()) {
        ElMessage.warning(`${file.name} 是空文件`)
        continue
      }
      files.value.push({ name: file.name, size: formatSize(file.size), ...clip(text) })
    }
  }

  const onPick = async (event: Event) => {
    const input = event.target as HTMLInputElement
    await addFiles(Array.from(input.files ?? []))
    input.value = ''
  }

  const onDrop = (event: DragEvent) => {
    dragging.value = false
    addFiles(Array.from(event.dataTransfer?.files ?? []))
  }

  /** 粘贴文件时作为附件；粘贴普通文字照常输入 */
  const onPaste = (event: ClipboardEvent) => {
    const pasted = Array.from(event.clipboardData?.files ?? [])
    if (!pasted.length) return
    event.preventDefault()
    addFiles(pasted)
  }

  /** 正在看上面的内容时不强制滚到底 */
  const scrollToBottom = (force = false) => {
    const el = scrollRef.value
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (force || nearBottom) nextTick(() => el.scrollTo({ top: el.scrollHeight }))
  }

  const ask = async (text?: string, attached?: ChatFile[]) => {
    if (streaming.value) return
    const sending = attached ?? files.value
    const content = (text ?? question.value).trim() || (sending.length ? DEFAULT_FILE_QUESTION : '')
    if (!content) return
    if (!attached) {
      question.value = ''
      files.value = []
    }
    const history: Api.AiOps.Turn[] = turns.value
      .filter((turn) => turn.answer && !turn.error)
      .slice(-3)
      .flatMap((turn) => [
        {
          role: 'user' as const,
          content: turn.files.length
            ? `${turn.question}（附件：${turn.files.map((file) => file.name).join('、')}）`
            : turn.question
        },
        { role: 'assistant' as const, content: turn.answer }
      ])
    turns.value.push({ question: content, files: sending, answer: '' })
    const turn = turns.value[turns.value.length - 1]
    streaming.value = true
    controller = new AbortController()
    scrollToBottom(true)
    try {
      await askOps(
        {
          question: content,
          storeId: storeId.value,
          hours: hours.value,
          history,
          attachments: sending.map(({ name, content }) => ({ name, content }))
        },
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

  /** 重新回答最后一个问题 */
  const retry = () => {
    const last = turns.value.pop()
    if (last) ask(last.question, last.files)
  }

  const { copy: writeClipboard } = useClipboard({ legacy: true })
  const copy = async (turn: ChatTurn) => {
    await writeClipboard(turn.answer)
    ElMessage.success('已复制')
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

  .ask {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
  }

  .bubble--user {
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

  .answer__foot {
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: 24px;
  }

  .answer__actions {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 16px;
    color: var(--logx-gray-600);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: var(--custom-radius, 8px);
    transition:
      color 0.2s,
      background 0.2s;
  }

  .icon-btn:hover:not(:disabled),
  .icon-btn:focus-visible {
    color: var(--logx-primary);
    background: var(--logx-hover-color);
    outline: none;
  }

  .icon-btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .files {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .files--sent {
    justify-content: flex-end;
    max-width: 80%;
  }

  .file {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    max-width: 260px;
    height: 30px;
    padding: 0 6px 0 10px;
    font-size: 12px;
    color: var(--logx-gray-800);
    background: var(--logx-gray-100);
    border: 1px solid var(--default-border);
    border-radius: var(--custom-radius, 8px);
  }

  .files--sent .file {
    padding-right: 10px;
  }

  .file__icon {
    flex: none;
    font-size: 15px;
    color: var(--logx-primary);
  }

  .file__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file__size {
    flex: none;
    color: var(--logx-gray-600);
  }

  .file__remove {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 13px;
    color: var(--logx-gray-600);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 50%;
  }

  .file__remove:hover,
  .file__remove:focus-visible {
    color: var(--logx-danger);
    background: var(--logx-hover-color);
    outline: none;
  }

  .composer {
    width: 100%;
    max-width: var(--chat-width);
    margin: 0 auto;
  }

  .composer__box {
    position: relative;
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

  .composer__box:focus-within,
  .composer__box.is-dragging {
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

  /* 拖入文件时盖住输入框的提示层；不拦截事件，避免 dragleave 来回触发 */
  .composer__drop {
    position: absolute;
    inset: 0;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--logx-primary);
    pointer-events: none;
    background: color-mix(in srgb, var(--default-box-color) 88%, var(--logx-primary));
    border: 1px dashed var(--logx-primary);
    border-radius: inherit;
  }

  .composer__hint {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--logx-gray-500);
    text-align: center;
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
