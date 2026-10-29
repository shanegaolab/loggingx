<!-- 通知记录：每次邮件 / 短信发送的对象与结果；传入 eventType + eventId 时只看某条告警的 -->
<template>
  <div class="records">
    <div v-if="!eventId" class="toolbar">
      <ElRadioGroup v-model="type" size="small">
        <ElRadioButton value="">全部</ElRadioButton>
        <ElRadioButton value="log">日志告警</ElRadioButton>
        <ElRadioButton value="host">监控告警</ElRadioButton>
        <ElRadioButton value="ai">AI 诊断</ElRadioButton>
        <ElRadioButton value="test">测试</ElRadioButton>
      </ElRadioGroup>
      <ElRadioGroup v-model="result" size="small">
        <ElRadioButton value="">全部结果</ElRadioButton>
        <ElRadioButton value="failed">仅失败</ElRadioButton>
      </ElRadioGroup>
      <ElButton size="small" :loading="loading" @click="load">
        <LogxSvgIcon v-if="!loading" icon="ri:refresh-line" class="mr-1" />刷新
      </ElButton>
      <span class="hint">保留最近 90 天</span>
    </div>
    <ElTable v-loading="loading" :data="shown" size="small" class="table" height="100%">
      <template #empty>
        <ElEmpty :image-size="72" description="没有通知记录" />
      </template>
      <ElTableColumn label="时间" width="165" prop="sendTime" />
      <ElTableColumn v-if="!eventId" label="规则" min-width="160">
        <template #default="{ row }">
          <div>{{ row.ruleName }}</div>
          <div class="muted">{{ TYPE_NAMES[row.eventType as keyof typeof TYPE_NAMES] }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="类型" width="90">
        <template #default="{ row }">
          <ElTag size="small" :type="KIND_TAGS[row.kind as Kind]" effect="plain">
            {{ KIND_NAMES[row.kind as Kind] }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="渠道" width="70">
        <template #default="{ row }">{{
          CHANNEL_NAMES[row.channel as Api.AlertCenter.Channel]
        }}</template>
      </ElTableColumn>
      <ElTableColumn label="接收人" min-width="180" prop="recipient" />
      <ElTableColumn label="结果" min-width="200">
        <template #default="{ row }">
          <span v-if="row.status === 'success'" class="ok">
            <LogxSvgIcon icon="ri:checkbox-circle-fill" /> 成功
          </span>
          <div v-else class="failed">
            <LogxSvgIcon icon="ri:close-circle-fill" /> 失败
            <div class="error">{{ row.error }}</div>
          </div>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { fetchNotifyRecords } from '@/api/alert-center'
  import { CHANNEL_NAMES, KIND_NAMES } from '../shared'

  type Kind = Api.AlertCenter.NotifyRecord['kind']

  const props = defineProps<{ eventType?: 'host' | 'log'; eventId?: number }>()

  const TYPE_NAMES = { host: '监控告警', log: '日志告警', ai: 'AI 诊断', test: '测试发送' }
  const KIND_TAGS: Record<Kind, 'danger' | 'success' | 'warning' | 'info' | 'primary'> = {
    firing: 'danger',
    resolved: 'success',
    repeat: 'warning',
    diagnosis: 'primary',
    test: 'info'
  }

  const type = ref('')
  const result = ref('')
  const loading = ref(false)
  const list = ref<Api.AlertCenter.NotifyRecord[]>([])
  const shown = computed(() =>
    result.value ? list.value.filter((record) => record.status === result.value) : list.value
  )

  const load = async () => {
    loading.value = true
    try {
      list.value = await fetchNotifyRecords({
        eventType: props.eventId ? props.eventType : type.value || undefined,
        eventId: props.eventId,
        limit: 500
      })
    } finally {
      loading.value = false
    }
  }

  watch(type, load)
  watch(() => [props.eventType, props.eventId], load)
  onMounted(load)
  defineExpose({ load })
</script>

<style scoped>
  .records {
    display: flex;
    flex: 1;
    flex-direction: column;
    height: 100%;
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

  .hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ok {
    color: var(--el-color-success);
  }

  .failed {
    color: var(--el-color-danger);
  }

  .error {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    word-break: break-all;
  }
</style>
