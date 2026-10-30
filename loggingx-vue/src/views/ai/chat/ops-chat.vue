<!-- 智能问答：用自然语言问运维问题，AI 结合知识库、诊断、告警、日志和代码回答并标注出处 -->
<template>
  <div class="chat">
    <div ref="scrollRef" class="chat__scroll">
      <div class="chat__column">
        <div v-if="!turns.length" class="welcome">
          <div class="welcome__icon"><LogxSvgIcon icon="ri:sparkling-2-fill" /></div>
          <div class="welcome__title">
            问一问<span class="welcome__accent">线上</span>发生了什么
          </div>
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
              <span class="example__icon"><LogxSvgIcon :icon="example.icon" /></span>
              <span class="example__text">{{ example.text }}</span>
              <LogxSvgIcon icon="ri:arrow-right-up-line" class="example__go" />
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
            <div class="reply__avatar"><LogxSvgIcon icon="ri:sparkling-2-fill" /></div>
            <div class="answer">
              <div v-if="turn.error" class="answer__error">
                <LogxSvgIcon icon="ri:error-warning-line" /> {{ turn.error }}
              </div>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                v-else-if="turn.answer"
                class="md"
                :class="{ 'md--streaming': streaming && index === turns.length - 1 }"
                @click="onCite($event, turn)"
                v-html="render(turn.answer)"
              ></div>
              <div v-else class="thinking">
                <span class="thinking__dots" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="thinking__text">{{
                  turn.sources ? '正在根据资料回答…' : '正在查找相关资料…'
                }}</span>
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

    /* 主色渐变：图标、头像、用户气泡、发送按钮共用 */
    --chat-gradient: linear-gradient(
      135deg,
      color-mix(in srgb, var(--logx-primary) 72%, #fff) 0%,
      var(--logx-primary) 100%
    );
    --chat-glow: color-mix(in srgb, var(--logx-primary) 45%, transparent);

    /* 比卡片略深（亮色）或略亮（暗色）的底色：示例、资料列表、代码块用 */
    --chat-surface: color-mix(in srgb, var(--logx-gray-900) 3%, var(--default-box-color));
    --chat-surface-strong: color-mix(in srgb, var(--logx-gray-900) 7%, var(--default-box-color));

    /* 卡片的两层阴影：贴边的细影 + 柔和的远影，让卡片浮在背景上 */
    --chat-shadow: 0 1px 2px rgb(0 0 0 / 4%), 0 8px 24px -14px rgb(0 0 0 / 16%);
    --chat-shadow-hover: 0 1px 2px rgb(0 0 0 / 4%), 0 14px 32px -14px rgb(0 0 0 / 22%);

    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .chat__scroll {
    flex: 1;
    min-height: 0;
    padding: 8px 4px 24px;
    overflow-y: auto;

    /* 上下边缘淡出，内容滚到输入框后面时不会生硬截断 */
    mask-image: linear-gradient(
      to bottom,
      transparent 0,
      #000 12px,
      #000 calc(100% - 28px),
      transparent 100%
    );
  }

  .chat__column {
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 100%;
    max-width: var(--chat-width);
    margin: 0 auto;
  }

  /* ---------- 开场 ---------- */

  .welcome {
    position: relative;
    margin: 48px auto 0;
    text-align: center;
  }

  /* 标题后面一团很淡的主色光晕 */
  .welcome::before {
    position: absolute;
    top: -60px;
    left: 50%;
    z-index: -1;
    width: min(620px, 100%);
    height: 280px;
    pointer-events: none;
    content: '';
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--logx-primary) 14%, transparent),
      transparent
    );
    transform: translateX(-50%);
  }

  .welcome > * {
    animation: rise 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .welcome > :nth-child(2) {
    animation-delay: 0.06s;
  }

  .welcome > :nth-child(3) {
    animation-delay: 0.12s;
  }

  .welcome > :nth-child(4) {
    animation-delay: 0.18s;
  }

  .welcome__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    font-size: 28px;
    color: #fff;
    background: var(--chat-gradient);
    border-radius: calc(var(--chat-radius) + 4px);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 35%),
      0 10px 28px -8px var(--chat-glow);
  }

  .welcome__title {
    margin-top: 20px;
    font-size: 28px;
    font-weight: 600;
    color: var(--logx-gray-900);
    letter-spacing: -0.02em;
  }

  .welcome__accent {
    color: transparent;
    background: var(--chat-gradient);
    background-clip: text;
  }

  .welcome__text {
    max-width: 640px;
    margin: 12px auto 32px;
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
    position: relative;
    display: flex;
    gap: 12px;
    align-items: center;
    min-height: 64px;
    padding: 12px 36px 12px 14px;
    font: inherit;
    font-size: 13px;
    line-height: 1.6;
    color: var(--logx-gray-800);
    text-align: left;
    cursor: pointer;
    background: linear-gradient(180deg, var(--default-box-color), var(--chat-surface));
    border: 1px solid var(--logx-card-border);
    border-radius: var(--chat-radius);
    box-shadow: var(--chat-shadow);
    transition:
      transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1),
      box-shadow 0.25s,
      border-color 0.25s;
  }

  .example:hover,
  .example:focus-visible {
    border-color: color-mix(in srgb, var(--logx-primary) 35%, transparent);
    outline: none;
    box-shadow: var(--chat-shadow-hover);
    transform: translateY(-2px);
  }

  .example:active {
    transform: translateY(0);
  }

  .example__icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    font-size: 16px;
    color: var(--logx-primary);
    background: color-mix(in srgb, var(--logx-primary) 10%, transparent);
    border-radius: var(--custom-radius, 8px);
    transition:
      color 0.25s,
      background 0.25s;
  }

  .example:hover .example__icon,
  .example:focus-visible .example__icon {
    color: #fff;
    background: var(--chat-gradient);
  }

  .example__go {
    position: absolute;
    top: 50%;
    right: 12px;
    font-size: 16px;
    color: var(--logx-primary);
    opacity: 0;
    transition:
      opacity 0.25s,
      transform 0.25s;
    transform: translate(-4px, -50%);
  }

  .example:hover .example__go,
  .example:focus-visible .example__go {
    opacity: 1;
    transform: translate(0, -50%);
  }

  /* ---------- 对话 ---------- */

  .turn {
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
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
    color: #fff;
    white-space: pre-wrap;
    background: var(--chat-gradient);
    border-radius: var(--chat-radius) var(--chat-radius) 4px var(--chat-radius);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 18%),
      0 8px 20px -10px var(--chat-glow);
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
    font-size: 16px;
    color: #fff;
    background: var(--chat-gradient);
    border-radius: var(--custom-radius, 8px);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 30%),
      0 6px 14px -6px var(--chat-glow);
  }

  .answer {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 16px 20px;
    background: var(--default-box-color);
    border: 1px solid var(--logx-card-border);
    border-radius: 4px var(--chat-radius) var(--chat-radius);
    box-shadow: var(--chat-shadow);
  }

  .answer__error {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--logx-danger);
  }

  /* 三个跳动的点 + 一道扫过文字的高光 */
  .thinking {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 14px;
  }

  .thinking__dots {
    display: inline-flex;
    gap: 4px;
  }

  .thinking__dots i {
    width: 6px;
    height: 6px;
    background: var(--logx-primary);
    border-radius: 50%;
    animation: bounce 1.2s ease-in-out infinite;
  }

  .thinking__dots i:nth-child(2) {
    animation-delay: 0.15s;
  }

  .thinking__dots i:nth-child(3) {
    animation-delay: 0.3s;
  }

  .thinking__text {
    color: transparent;
    background: linear-gradient(
        90deg,
        var(--logx-gray-600) 0%,
        var(--logx-gray-600) 40%,
        var(--logx-primary) 50%,
        var(--logx-gray-600) 60%,
        var(--logx-gray-600) 100%
      )
      0 0 / 250% 100%;
    background-clip: text;
    animation: shimmer 2s linear infinite;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      opacity: 0.35;
      transform: translateY(0);
    }

    40% {
      opacity: 1;
      transform: translateY(-4px);
    }
  }

  @keyframes shimmer {
    from {
      background-position: 100% 0;
    }

    to {
      background-position: -150% 0;
    }
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .welcome > *,
    .turn,
    .thinking__dots i,
    .thinking__text,
    .md--streaming > :last-child::after {
      animation: none;
    }
  }

  /* ---------- 回答正文 ---------- */

  .md {
    font-size: 14px;
    line-height: 1.85;
    color: var(--logx-gray-900);
    overflow-wrap: anywhere;
  }

  /* 生成中在末尾显示闪烁的光标 */
  .md--streaming > :last-child::after {
    display: inline-block;
    width: 2px;
    height: 1.1em;
    margin-left: 2px;
    vertical-align: text-bottom;
    content: '';
    background: var(--logx-primary);
    animation: blink 1s step-end infinite;
  }

  .md :deep(p) {
    margin: 0 0 10px;
  }

  .md :deep(> :last-child) {
    margin-bottom: 0;
  }

  .md :deep(h3),
  .md :deep(h4),
  .md :deep(h5),
  .md :deep(h6) {
    margin: 18px 0 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--logx-gray-900);
  }

  .md :deep(> h3:first-child),
  .md :deep(> h4:first-child) {
    margin-top: 0;
  }

  .md :deep(ul),
  .md :deep(ol) {
    padding-left: 22px;
    margin: 0 0 10px;
  }

  /* 全局 reset 去掉了列表符号，这里加回来 */
  .md :deep(ul) {
    list-style: disc;
  }

  .md :deep(ol) {
    list-style: decimal;
  }

  .md :deep(li) {
    padding-left: 2px;
    margin: 2px 0;
  }

  .md :deep(li::marker) {
    font-weight: 600;
    color: var(--logx-primary);
  }

  .md :deep(strong) {
    font-weight: 600;
    color: var(--logx-gray-900);
  }

  .md :deep(a) {
    color: var(--logx-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .md :deep(code) {
    padding: 1px 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12.5px;
    color: var(--logx-gray-800);
    background: var(--chat-surface-strong);
    border-radius: 5px;
  }

  .md :deep(pre) {
    position: relative;
    padding: 14px 16px;
    margin: 0 0 10px;
    overflow-x: auto;
    line-height: 1.7;
    background: var(--chat-surface);
    border: 1px solid var(--logx-card-border);
    border-radius: var(--custom-radius, 8px);
    box-shadow: inset 0 1px 2px rgb(0 0 0 / 4%);
  }

  .md :deep(pre code) {
    padding: 0;
    background: none;
  }

  .md :deep(.md-cite) {
    padding: 1px 4px;
    margin: 0 1px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--logx-primary);
    cursor: pointer;
    background: color-mix(in srgb, var(--logx-primary) 10%, transparent);
    border-radius: 4px;
    transition:
      color 0.2s,
      background 0.2s;
  }

  .md :deep(.md-cite:hover) {
    color: #fff;
    background: var(--logx-primary);
  }

  .sources {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 8px 6px;
    margin: 2px -6px 0;
    background: var(--chat-surface);
    border: 1px solid var(--logx-card-border);
    border-radius: var(--chat-radius);
  }

  .sources__title {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 0 8px;
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
    background: var(--default-box-color);
    outline: none;
    box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
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
    background: var(--chat-surface-strong);
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
    background: var(--chat-surface);
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
    padding: 12px 12px 10px;
    background: color-mix(in srgb, var(--default-box-color) 86%, transparent);
    backdrop-filter: blur(16px) saturate(1.5);
    border: 1px solid var(--logx-card-border);
    border-radius: calc(var(--chat-radius) + 6px);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 4%),
      0 16px 40px -20px rgb(0 0 0 / 24%);
    transition:
      border-color 0.25s,
      box-shadow 0.25s;
  }

  .composer__box:focus-within,
  .composer__box.is-dragging {
    border-color: color-mix(in srgb, var(--logx-primary) 45%, transparent);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--logx-primary) 10%, transparent),
      0 16px 40px -20px var(--chat-glow);
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

  /* 日志库、时间范围做成胶囊，融入输入框 */
  .composer__bar :deep(.el-select__wrapper) {
    min-height: 28px;
    padding: 2px 10px;
    background: var(--chat-surface-strong);
    border-radius: 999px;
    box-shadow: none;
  }

  .composer__bar :deep(.el-select__wrapper.is-focused),
  .composer__bar :deep(.el-select__wrapper:hover) {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--logx-primary) 40%, transparent);
  }

  .composer__send {
    margin-left: auto;
    border-radius: 999px;
    transition:
      transform 0.2s,
      box-shadow 0.2s,
      opacity 0.2s;
  }

  .composer__send.el-button--primary {
    background: var(--chat-gradient);
    border-color: transparent;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 25%),
      0 6px 16px -8px var(--chat-glow);
  }

  .composer__send.el-button--primary.is-disabled {
    box-shadow: none;
    opacity: 0.45;
  }

  .composer__send.el-button--primary:not(.is-disabled):hover {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 25%),
      0 10px 22px -8px var(--chat-glow);
    transform: translateY(-1px);
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
