<!-- 新增 / 编辑监控告警规则 -->
<template>
  <ElDialog
    v-model="visible"
    :title="rule ? '编辑监控告警规则' : '新增监控告警规则'"
    width="620px"
    align-center
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <div class="section-title">触发条件</div>
      <ElFormItem label="名称" prop="name">
        <ElInput v-model="form.name" maxlength="64" placeholder="如 CPU 使用率过高" />
      </ElFormItem>
      <ElFormItem label="指标" prop="metric">
        <ElSelect v-model="form.metric" class="w-full">
          <ElOption
            v-for="(label, value) in ALERT_METRICS"
            :key="value"
            :value="value"
            :label="label"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="form.metric !== 'offline'" label="阈值" prop="threshold">
        <ElInputNumber
          v-model="form.threshold"
          :min="form.metric === 'load' ? 0.1 : 1"
          :max="form.metric === 'load' ? 100 : 99"
          :step="form.metric === 'load' ? 0.5 : 5"
          :precision="form.metric === 'load' ? 1 : 0"
          controls-position="right"
        />
        <span class="unit">{{
          form.metric === 'load' ? '每核负载（1 分钟负载 ÷ CPU 核数）' : '%'
        }}</span>
      </ElFormItem>
      <ElFormItem
        v-if="form.metric !== 'disk'"
        :label="form.metric === 'offline' ? '离线超过' : '持续'"
        prop="durationMinutes"
      >
        <ElInputNumber
          v-model="form.durationMinutes"
          :min="1"
          :max="1440"
          controls-position="right"
        />
        <span class="unit">分钟</span>
      </ElFormItem>
      <ElFormItem label="级别">
        <ElRadioGroup v-model="form.severity">
          <ElRadio value="warning">警告</ElRadio>
          <ElRadio value="critical">严重</ElRadio>
        </ElRadioGroup>
      </ElFormItem>
      <ElFormItem label="适用范围">
        <ElSelect v-model="form.storeId" clearable placeholder="全部日志库的主机" class="w-full">
          <ElOption
            v-for="store in ctx.stores.value"
            :key="store.id"
            :value="store.id"
            :label="store.name"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="启用">
        <ElSwitch v-model="form.enabled" />
      </ElFormItem>
      <div class="preview">规则：{{ describeRule(form) }}</div>
      <div class="section-title">通知</div>
      <NotifyFields v-model="form.notification" />
    </ElForm>
    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { createAlertRule, updateAlertRule } from '@/api/monitor'
  import { ALERT_METRICS, describeRule } from '@/views/monitor/shared'
  import { ALERT_CENTER, emptyNotify } from '../shared'
  import NotifyFields from './notify-fields.vue'

  const props = defineProps<{ rule?: Api.Monitor.AlertRule }>()
  const ctx = inject(ALERT_CENTER)!
  const emit = defineEmits<{ saved: [] }>()
  const visible = defineModel<boolean>({ default: false })

  const formRef = ref<FormInstance>()
  const saving = ref(false)
  const empty = (): Api.Monitor.AlertRuleForm => ({
    name: '',
    metric: 'cpu',
    threshold: 90,
    durationMinutes: 5,
    severity: 'warning',
    storeId: null,
    enabled: true,
    notification: emptyNotify()
  })
  const form = reactive<Api.Monitor.AlertRuleForm>(empty())

  const rules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
  }

  // 切换指标时给出该指标常用的阈值
  const DEFAULT_THRESHOLDS: Record<Api.Monitor.AlertMetric, number> = {
    cpu: 90,
    memory: 90,
    disk: 85,
    load: 2,
    offline: 0
  }
  watch(
    () => form.metric,
    (metric, previous) => {
      if (previous && form.threshold === DEFAULT_THRESHOLDS[previous]) {
        form.threshold = DEFAULT_THRESHOLDS[metric]
      }
      if (metric !== 'disk' && form.durationMinutes < 1) form.durationMinutes = 5
    }
  )

  watch(visible, (open) => {
    if (!open) return
    const { rule } = props
    Object.assign(
      form,
      rule
        ? {
            name: rule.name,
            metric: rule.metric,
            threshold: rule.threshold,
            durationMinutes: rule.durationMinutes,
            severity: rule.severity,
            storeId: rule.storeId,
            enabled: rule.enabled,
            notification: structuredClone(toRaw(rule.notification ?? emptyNotify()))
          }
        : empty()
    )
    nextTick(() => formRef.value?.clearValidate())
  })

  const submit = async () => {
    if (!(await formRef.value?.validate().catch(() => false))) return
    const { notification } = form
    if (
      notification.channels.length &&
      !notification.userIds.length &&
      !notification.groupIds.length
    ) {
      ElMessage.warning('请选择通知用户或通知组')
      return
    }
    const data: Api.Monitor.AlertRuleForm = {
      ...form,
      durationMinutes: form.metric === 'disk' ? 0 : form.durationMinutes,
      storeId: form.storeId || null
    }
    saving.value = true
    try {
      if (props.rule) await updateAlertRule(props.rule.id, data)
      else await createAlertRule(data)
      ElMessage.success('已保存，下一分钟按新规则评估')
      visible.value = false
      emit('saved')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .unit {
    margin-left: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .section-title {
    padding-left: 8px;
    margin: 4px 0 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    border-left: 3px solid var(--el-color-primary);
  }

  .preview {
    padding: 8px 12px;
    margin: 0 0 18px 90px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
  }
</style>
