<!-- 诊断详情：结论、原因、修改建议与 diff、相关代码、原始日志 -->
<template>
  <ElDrawer
    :model-value="diagnosisId !== undefined"
    :title="detail?.item.errorType ?? 'AI 诊断'"
    size="min(880px, 100%)"
    @close="emit('close')"
  >
    <div v-loading="loading" class="detail">
      <template v-if="detail">
        <div class="head">
          <div class="head__tags">
            <ElTag size="small" effect="plain">{{ TRIGGER_NAMES[detail.item.triggerType] }}</ElTag>
            <ElTag
              v-if="detail.item.confidence"
              size="small"
              :type="CONFIDENCE[detail.item.confidence].type"
              >{{ CONFIDENCE[detail.item.confidence].label }}</ElTag
            >
            <ElTag
              size="small"
              :type="detail.item.reviewState === 'open' ? 'danger' : 'info'"
              effect="plain"
              >{{ REVIEW_NAMES[detail.item.reviewState] }}</ElTag
            >
            <span class="muted"
              >{{ detail.item.storeName }} · {{ detail.item.host ?? '-' }} ·
              {{ detail.item.logTime ?? detail.item.createTime }}</span
            >
          </div>
          <div v-if="pending" class="pending">
            <LogxSvgIcon icon="ri:loader-4-line" class="spin" />
            {{ STATUS_NAMES[detail.item.status] }}，通常需要 10 到 60 秒…
          </div>
          <ElAlert
            v-else-if="detail.item.status === 'failed'"
            type="error"
            :closable="false"
            show-icon
            title="分析失败"
            :description="detail.item.error ?? ''"
          />
          <p v-else class="summary">{{ detail.item.summary }}</p>
          <div class="actions">
            <ElButton
              v-if="detail.item.reviewState === 'open'"
              type="primary"
              size="small"
              @click="setState('resolved')"
              >标记已处理</ElButton
            >
            <ElButton
              v-if="detail.item.reviewState === 'open'"
              size="small"
              @click="setState('ignored')"
              >忽略</ElButton
            >
            <ElButton v-else size="small" @click="setState('open')">重新打开</ElButton>
            <ElButton size="small" :disabled="pending" @click="reanalyze">重新分析</ElButton>
            <ElButton size="small" @click="openLogs">查看日志</ElButton>
          </div>
        </div>

        <section v-if="detail.rootCause" class="block">
          <h3>原因分析</h3>
          <div class="prose">{{ detail.rootCause }}</div>
        </section>

        <section v-if="detail.suggestion" class="block">
          <h3>修改建议</h3>
          <div class="prose">{{ detail.suggestion }}</div>
        </section>

        <section v-if="detail.diff" class="block">
          <div class="block__head">
            <h3>代码修改</h3>
            <ElButton link type="primary" size="small" @click="copy(detail.diff)"
              >复制 diff</ElButton
            >
          </div>
          <pre class="code diff"><span
            v-for="(line, i) in diffLines(detail.diff)"
            :key="i"
            :class="`diff--${line.kind}`"
          >{{ line.text }}
</span></pre>
          <p class="muted">AI 生成的修改需经过评审和测试后再合入。</p>
        </section>

        <section class="block">
          <h3>
            相关代码
            <span v-if="detail.repoCommit" class="mono muted"
              >提交 {{ detail.repoCommit.slice(0, 10) }}</span
            >
          </h3>
          <p v-if="!detail.codeRefs.length" class="muted">
            没有用到代码：日志库未关联代码仓库，或仓库里找不到堆栈对应的文件。
          </p>
          <div v-for="ref in detail.codeRefs" :key="ref.path + ref.startLine" class="ref">
            <div class="ref__head">
              <span class="mono">{{ ref.path }}</span>
              <span class="muted mono">{{ ref.frame }}</span>
            </div>
            <pre class="code"><span
              v-for="(line, i) in ref.text.split('\n')"
              :key="i"
              :class="{ 'code--focus': ref.startLine + i === ref.focusLine }"
            ><span class="code__no">{{ ref.startLine + i }}</span>{{ line }}
</span></pre>
          </div>
        </section>

        <section class="block">
          <h3>原始日志</h3>
          <pre class="code">{{ detail.logText }}</pre>
          <p v-if="detail.model" class="muted">
            {{ PROVIDER_NAMES[detail.provider ?? ''] ?? detail.provider }} · {{ detail.model }}
            <template v-if="detail.promptTokens">
              · 输入 {{ detail.promptTokens }} / 输出
              {{ detail.completionTokens ?? '-' }} tokens</template
            >
          </p>
        </section>
      </template>
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { fetchDiagnosis, reanalyzeDiagnosis, setDiagnosisState } from '@/api/ai-diagnosis'
  import {
    CONFIDENCE,
    PROVIDER_NAMES,
    REVIEW_NAMES,
    STATUS_NAMES,
    TRIGGER_NAMES,
    diffLines
  } from '../shared'

  const props = defineProps<{ diagnosisId?: number }>()
  const emit = defineEmits<{ close: []; changed: []; open: [id: number] }>()
  const router = useRouter()

  const loading = ref(false)
  const detail = ref<Api.AiDiagnosis.Detail>()
  const pending = computed(
    () => detail.value?.item.status === 'pending' || detail.value?.item.status === 'running'
  )

  let timer: ReturnType<typeof setTimeout> | undefined
  const load = async (quiet = false) => {
    clearTimeout(timer)
    if (props.diagnosisId === undefined) return
    if (!quiet) loading.value = true
    try {
      detail.value = await fetchDiagnosis(props.diagnosisId)
      if (pending.value) timer = setTimeout(() => load(true), 3000)
      else if (quiet) emit('changed')
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.diagnosisId,
    () => {
      detail.value = undefined
      load()
    }
  )
  onBeforeUnmount(() => clearTimeout(timer))

  const setState = async (state: Api.AiDiagnosis.ReviewState) => {
    if (!detail.value) return
    await setDiagnosisState(detail.value.item.id, state)
    detail.value.item.reviewState = state
    ElMessage.success(
      state === 'resolved' ? '已标记为已处理' : state === 'ignored' ? '已忽略' : '已重新打开'
    )
    emit('changed')
  }

  const reanalyze = async () => {
    if (!detail.value) return
    const item = await reanalyzeDiagnosis(detail.value.item.id)
    ElMessage.success('已提交重新分析')
    emit('changed')
    emit('open', item.id)
  }

  /** 出错前后 10 分钟、同一主机的错误日志 */
  const openLogs = () => {
    const item = detail.value?.item
    if (!item) return
    const center = item.logTime ? new Date(item.logTime.replace(' ', 'T')).getTime() : Date.now()
    const format = (ms: number) => {
      const d = new Date(ms)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }
    router.push({
      name: 'LogQuery',
      query: {
        storeId: item.storeId,
        host: item.host ?? '',
        levels: 'ERROR,FATAL',
        start: format(center - 600_000),
        end: format(center + 600_000)
      }
    })
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success('已复制')
    } catch {
      ElMessage.warning('复制失败，请手动选择复制')
    }
  }
</script>

<style scoped>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-height: 200px;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .head__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .summary {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.5;
    color: var(--el-text-color-primary);
  }

  .pending {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 14px;
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

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .actions .el-button {
    margin: 0;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .block h3 {
    display: flex;
    gap: 10px;
    align-items: baseline;
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .block__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .prose {
    font-size: 14px;
    line-height: 1.8;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
  }

  .code {
    max-height: 420px;
    padding: 12px 0;
    margin: 0;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
  }

  .code > span {
    display: block;
    padding: 0 12px;
  }

  .code:not(.diff) {
    padding-inline: 12px;
  }

  .code:not(.diff) > span {
    padding: 0;
  }

  .code--focus {
    background: color-mix(in srgb, var(--el-color-danger) 14%, transparent);
  }

  .code__no {
    display: inline-block;
    width: 44px;
    margin-right: 12px;
    color: var(--el-text-color-placeholder);
    text-align: right;
    user-select: none;
  }

  .diff--add {
    color: var(--el-color-success-dark-2);
    background: color-mix(in srgb, var(--el-color-success) 12%, transparent);
  }

  .diff--del {
    color: var(--el-color-danger-dark-2);
    background: color-mix(in srgb, var(--el-color-danger) 12%, transparent);
  }

  .diff--hunk {
    color: var(--el-color-primary);
  }

  .diff--file {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .ref {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ref__head {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: 13px;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .muted {
    margin: 0;
    font-size: 12px;
    font-weight: normal;
    color: var(--el-text-color-secondary);
  }
</style>
