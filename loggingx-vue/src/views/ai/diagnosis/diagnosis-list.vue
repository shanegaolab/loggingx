<!-- 诊断记录：每条错误的 AI 分析结果 -->
<template>
  <div class="list">
    <div class="toolbar">
      <ElRadioGroup v-model="state" size="small">
        <ElRadioButton value="open">待处理</ElRadioButton>
        <ElRadioButton value="resolved">已处理</ElRadioButton>
        <ElRadioButton value="ignored">已忽略</ElRadioButton>
        <ElRadioButton value="">全部</ElRadioButton>
      </ElRadioGroup>
      <ElSelect v-model="storeId" placeholder="全部日志库" clearable size="small" class="w-store">
        <ElOption
          v-for="store in stores"
          :key="store.storeId"
          :value="store.storeId"
          :label="store.storeName"
        />
      </ElSelect>
      <ElSelect v-model="trigger" placeholder="全部来源" clearable size="small" class="w-trigger">
        <ElOption v-for="(label, key) in TRIGGER_NAMES" :key="key" :value="key" :label="label" />
      </ElSelect>
      <ElButton size="small" :loading="loading" @click="load()">
        <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" class="mr-1" />刷新
      </ElButton>
      <span class="hint">AI 的结论仅供参考，修改前请先核对代码</span>
    </div>
    <ElTable
      v-loading="loading"
      :data="list"
      size="small"
      height="100%"
      class="table"
      row-class-name="clickable"
      @row-click="(row: Api.AiDiagnosis.Item) => emit('open', row.id)"
    >
      <template #empty>
        <ElEmpty :image-size="72" :description="emptyText" />
      </template>
      <ElTableColumn label="错误与结论" min-width="340">
        <template #default="{ row }">
          <div class="type">{{ row.errorType ?? '错误日志' }}</div>
          <div v-if="row.status === 'success'" class="summary">{{ row.summary }}</div>
          <div v-else-if="row.status === 'failed'" class="failed">分析失败：{{ row.error }}</div>
          <div v-else class="pending">
            <LogxSvgIcon icon="ri:loader-4-line" class="spin" />{{
              STATUS_NAMES[row.status as Api.AiDiagnosis.Status]
            }}
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="把握" width="100">
        <template #default="{ row }">
          <ElTag v-if="row.confidence" size="small" :type="CONFIDENCE[row.confidence].type">
            {{ CONFIDENCE[row.confidence].label }}
          </ElTag>
          <span v-else class="muted">-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="日志库 / 主机" min-width="150">
        <template #default="{ row }">
          <div>{{ row.storeName ?? '-' }}</div>
          <div class="muted">{{ row.host ?? '-' }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="来源" width="100">
        <template #default="{ row }">
          <div>{{ TRIGGER_NAMES[row.triggerType as Api.AiDiagnosis.Trigger] }}</div>
          <div v-if="row.createdBy" class="muted">{{ row.createdBy }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="时间" width="170" prop="createTime" />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          <span :class="row.reviewState === 'open' ? 'state-open' : 'muted'">
            {{ REVIEW_NAMES[row.reviewState as Api.AiDiagnosis.ReviewState] }}
          </span>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { fetchDiagnoses } from '@/api/ai-diagnosis'
  import { CONFIDENCE, REVIEW_NAMES, STATUS_NAMES, TRIGGER_NAMES } from '../shared'

  defineProps<{ stores: Api.AiDiagnosis.StoreConfig[] }>()
  const emit = defineEmits<{ open: [id: number] }>()

  const state = ref<'' | Api.AiDiagnosis.ReviewState>('open')
  const storeId = ref<number>()
  const trigger = ref<Api.AiDiagnosis.Trigger>()
  const loading = ref(false)
  const list = ref<Api.AiDiagnosis.Item[]>([])

  const emptyText = computed(() =>
    state.value === 'open'
      ? '没有待处理的诊断。在「AI 设置」里为日志库开启自动分析，或在日志查询里对错误日志点「AI 分析」'
      : '没有诊断记录'
  )

  let timer: ReturnType<typeof setTimeout> | undefined
  const load = async (quiet = false) => {
    clearTimeout(timer)
    if (!quiet) loading.value = true
    try {
      list.value = await fetchDiagnoses({
        state: state.value || undefined,
        storeId: storeId.value,
        trigger: trigger.value,
        days: 30,
        limit: 300
      })
      // 有分析中的记录时自动刷新
      if (list.value.some((item) => item.status === 'pending' || item.status === 'running')) {
        timer = setTimeout(() => load(true), 4000)
      }
    } finally {
      loading.value = false
    }
  }

  watch([state, storeId, trigger], () => load())
  onMounted(load)
  onActivated(() => load(true))
  onBeforeUnmount(() => clearTimeout(timer))
  defineExpose({ load })
</script>

<style scoped>
  .list {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .table {
    flex: 1;
    min-height: 0;
  }

  .table :deep(.clickable) {
    cursor: pointer;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 10px;
    align-items: center;
    margin-bottom: 10px;
  }

  .w-store {
    width: 170px;
  }

  .w-trigger {
    width: 120px;
  }

  .hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .type {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .summary {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .failed {
    color: var(--el-color-danger);
  }

  .pending {
    display: flex;
    gap: 6px;
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

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .state-open {
    font-weight: 600;
    color: var(--el-color-danger);
  }
</style>
