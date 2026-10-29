<!-- 日志库的归档策略：超过 N 天的日志按天压缩上传，归档保留 M 天 -->
<template>
  <ElDialog
    v-model="visible"
    :title="`归档策略 · ${policy?.storeName ?? ''}`"
    width="520px"
    align-center
  >
    <ElForm v-if="policy" label-width="110px" class="policy-form">
      <ElFormItem label="启用归档">
        <ElSwitch v-model="form.enabled" />
      </ElFormItem>
      <ElFormItem label="归档时机">
        <div class="row">
          超过
          <ElInputNumber
            v-model="form.archiveAfterDays"
            :min="1"
            :max="Math.max(1, policy.retentionDays - 1)"
            controls-position="right"
          />
          天的日志
        </div>
        <span class="form-hint">
          日志库保留 {{ policy.retentionDays }} 天，归档时机须小于它，保证每天的日志在被删除前已归档
        </span>
      </ElFormItem>
      <ElFormItem label="归档保留">
        <div class="row">
          <ElInputNumber
            v-model="form.keepDays"
            :min="form.archiveAfterDays + 1"
            :max="3650"
            :step="30"
            controls-position="right"
          />
          天
        </div>
        <span class="form-hint"
          >超过这个天数的归档自动从存储中删除；也可以在存储桶上配置生命周期规则转为低频/归档存储</span
        >
      </ElFormItem>
      <div class="summary">
        每天凌晨 2:30，把该日志库 {{ form.archiveAfterDays }} 天前（含）还未归档的日期，按天压缩为
        .ndjson.gz 上传；日志查询可查最近
        {{ policy.retentionDays }} 天，更早的日志从归档恢复后可查，归档共保留
        {{ form.keepDays }} 天（约 {{ Math.round(form.keepDays / 30) }} 个月）。
      </div>
    </ElForm>
    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { saveBackupPolicy } from '@/api/backup'

  const props = defineProps<{ policy?: Api.Backup.Policy }>()
  const emit = defineEmits<{ saved: [] }>()
  const visible = defineModel<boolean>({ default: false })

  const saving = ref(false)
  const form = reactive({ enabled: true, archiveAfterDays: 1, keepDays: 180 })

  watch(visible, (open) => {
    const policy = props.policy
    if (!open || !policy) return
    const after = Math.min(policy.archiveAfterDays ?? 1, Math.max(1, policy.retentionDays - 1))
    Object.assign(form, {
      enabled: policy.enabled ?? true,
      archiveAfterDays: after,
      keepDays: Math.max(policy.keepDays ?? 180, after + 1)
    })
  })

  watch(
    () => form.archiveAfterDays,
    (days) => {
      if (form.keepDays <= days) form.keepDays = days + 1
    }
  )

  const save = async () => {
    if (!props.policy) return
    saving.value = true
    try {
      await saveBackupPolicy(props.policy.storeId, { ...form })
      ElMessage.success('归档策略已保存')
      visible.value = false
      emit('saved')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .policy-form :deep(.el-form-item__content) {
    flex-direction: column;
    align-items: flex-start;
  }

  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
  }

  .summary {
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
  }
</style>
