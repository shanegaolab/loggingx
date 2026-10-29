<!-- 错误归类：同一类错误（异常类型 + 出错方法）合并计数 -->
<template>
  <div class="list">
    <div class="toolbar">
      <ElRadioGroup v-model="status" size="small">
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
      <ElButton size="small" :loading="loading" @click="load">
        <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" class="mr-1" />刷新
      </ElButton>
      <span class="hint"
        >开启「新错误自动分析」的日志库，每分钟把新的 ERROR、FATAL
        日志按类型归类；行号变化、参数不同算同一类</span
      >
    </div>
    <ElTable v-loading="loading" :data="list" size="small" height="100%" class="table">
      <template #empty>
        <ElEmpty :image-size="72" description="没有错误归类记录" />
      </template>
      <ElTableColumn label="错误" min-width="320">
        <template #default="{ row }">
          <div class="type">{{ row.errorType ?? '错误日志' }}</div>
          <div class="location" :title="row.location ?? ''">{{ row.location ?? '-' }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="日志库 / 主机" min-width="140">
        <template #default="{ row }">
          <div>{{ row.storeName ?? '-' }}</div>
          <div class="muted">{{ row.host ?? '-' }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="次数" width="90" align="right">
        <template #default="{ row }">
          <span class="count">{{ row.occurrences.toLocaleString() }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="首次 / 最近出现" width="170">
        <template #default="{ row }">
          <div>{{ row.firstSeen }}</div>
          <div class="muted">{{ row.lastSeen }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="row.diagnosisId"
            link
            type="primary"
            size="small"
            @click="emit('open', row.diagnosisId)"
            >查看诊断</ElButton
          >
          <ElButton link type="primary" size="small" @click="analyze(row)">
            {{ row.diagnosisId ? '重新分析' : 'AI 分析' }}
          </ElButton>
          <ElButton
            v-if="row.status === 'open'"
            link
            size="small"
            @click="setStatus(row, 'ignored')"
            >忽略</ElButton
          >
          <ElButton v-else link size="small" @click="setStatus(row, 'open')">重新打开</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { analyzeErrorGroup, fetchErrorGroups, setErrorGroupStatus } from '@/api/ai-diagnosis'

  defineProps<{ stores: Api.AiDiagnosis.StoreConfig[] }>()
  const emit = defineEmits<{ open: [id: number]; analyzed: [] }>()

  const status = ref<'' | Api.AiDiagnosis.ReviewState>('open')
  const storeId = ref<number>()
  const loading = ref(false)
  const list = ref<Api.AiDiagnosis.Group[]>([])

  const load = async () => {
    loading.value = true
    try {
      list.value = await fetchErrorGroups({
        status: status.value || undefined,
        storeId: storeId.value,
        limit: 500
      })
    } finally {
      loading.value = false
    }
  }

  const analyze = async (group: Api.AiDiagnosis.Group) => {
    const item = await analyzeErrorGroup(group.id)
    group.diagnosisId = item.id
    ElMessage.success('已提交分析')
    emit('analyzed')
    emit('open', item.id)
  }

  const setStatus = async (group: Api.AiDiagnosis.Group, next: Api.AiDiagnosis.ReviewState) => {
    await setErrorGroupStatus(group.id, next)
    ElMessage.success(next === 'ignored' ? '已忽略' : '已重新打开')
    load()
  }

  watch([status, storeId], load)
  onMounted(load)
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

  .hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .type {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .location {
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
