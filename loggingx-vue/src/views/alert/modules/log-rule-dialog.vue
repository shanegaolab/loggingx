<!-- 新增 / 编辑日志告警规则：一段时间内匹配级别、关键字的日志超过阈值即告警 -->
<template>
  <ElDialog
    v-model="visible"
    :title="rule ? '编辑日志告警规则' : '新增日志告警规则'"
    width="620px"
    align-center
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <div class="section-title">触发条件</div>
      <ElFormItem label="名称" prop="name">
        <ElInput v-model="form.name" maxlength="64" placeholder="如 订单服务错误激增" />
      </ElFormItem>
      <ElFormItem label="日志库" prop="storeId">
        <ElSelect v-model="form.storeId" placeholder="选择日志库" filterable class="w-full">
          <ElOption
            v-for="store in ctx.stores.value"
            :key="store.id"
            :value="store.id"
            :label="store.name"
          >
            <span>{{ store.name }}</span>
            <span class="option-meta">{{ store.code }}</span>
          </ElOption>
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="日志级别" prop="levels">
        <div class="levels">
          <button
            v-for="level in LOG_LEVELS"
            :key="level"
            type="button"
            class="level-chip"
            :class="[levelClass(level), { 'is-active': form.levels.includes(level) }]"
            @click="toggleLevel(level)"
          >
            {{ level }}
          </button>
        </div>
        <span class="tip">{{ form.levels.length ? '' : '不选为所有级别' }}</span>
      </ElFormItem>
      <ElFormItem label="关键字" prop="keyword">
        <ElInput
          v-model="form.keyword"
          maxlength="200"
          clearable
          placeholder="日志内容包含的文字，不区分大小写，如 timeout"
        />
      </ElFormItem>
      <ElFormItem label="主机">
        <ElInput v-model="form.host" clearable placeholder="只统计某台主机的日志，留空为全部主机" />
      </ElFormItem>
      <ElFormItem label="统计窗口">
        <span class="inline-text">最近</span>
        <ElInputNumber
          v-model="form.windowMinutes"
          :min="1"
          :max="1440"
          controls-position="right"
          class="number"
        />
        <span class="inline-text">分钟内超过</span>
        <ElInputNumber
          v-model="form.threshold"
          :min="0"
          :max="100000000"
          controls-position="right"
          class="number"
        />
        <span class="inline-text">条</span>
      </ElFormItem>
      <ElFormItem label="级别">
        <ElRadioGroup v-model="form.severity">
          <ElRadio value="warning">警告</ElRadio>
          <ElRadio value="critical">严重</ElRadio>
        </ElRadioGroup>
      </ElFormItem>
      <ElFormItem label="启用">
        <ElSwitch v-model="form.enabled" />
      </ElFormItem>
      <div class="preview">
        规则：{{ describeLogRule(form) }}
        <template v-if="form.threshold === 0">（出现即告警）</template>
      </div>
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
  import { createLogRule, updateLogRule } from '@/api/alert-center'
  import { LOG_LEVELS, levelClass } from '@/views/log/shared'
  import { ALERT_CENTER, describeLogRule, emptyNotify } from '../shared'
  import NotifyFields from './notify-fields.vue'

  const props = defineProps<{ rule?: Api.AlertCenter.LogRule }>()
  const emit = defineEmits<{ saved: [] }>()
  const visible = defineModel<boolean>({ default: false })
  const ctx = inject(ALERT_CENTER)!

  const formRef = ref<FormInstance>()
  const saving = ref(false)

  interface Form extends Omit<Api.AlertCenter.LogRuleForm, 'storeId' | 'keyword' | 'host'> {
    storeId: number | undefined
    keyword: string
    host: string
  }

  const empty = (): Form => ({
    name: '',
    storeId: ctx.stores.value[0]?.id,
    levels: ['ERROR', 'FATAL'],
    keyword: '',
    host: '',
    windowMinutes: 5,
    threshold: 10,
    severity: 'warning',
    enabled: true,
    notification: emptyNotify()
  })
  const form = reactive<Form>(empty())

  const rules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    storeId: [{ required: true, message: '请选择日志库', trigger: 'change' }],
    keyword: [
      {
        validator: (_rule, _value, callback) =>
          !form.levels.length && !form.keyword.trim()
            ? callback(new Error('请至少选择日志级别或填写关键字'))
            : callback(),
        trigger: 'blur'
      }
    ]
  }

  const toggleLevel = (level: Api.Log.Level) => {
    const index = form.levels.indexOf(level)
    if (index >= 0) form.levels.splice(index, 1)
    else form.levels.push(level)
  }

  watch(visible, (open) => {
    if (!open) return
    const { rule } = props
    Object.assign(
      form,
      rule
        ? {
            name: rule.name,
            storeId: rule.storeId,
            levels: [...rule.levels],
            keyword: rule.keyword ?? '',
            host: rule.host ?? '',
            windowMinutes: rule.windowMinutes,
            threshold: rule.threshold,
            severity: rule.severity,
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
    const data: Api.AlertCenter.LogRuleForm = {
      ...form,
      storeId: form.storeId!,
      keyword: form.keyword.trim() || null,
      host: form.host.trim() || null
    }
    saving.value = true
    try {
      if (props.rule) await updateLogRule(props.rule.id, data)
      else await createLogRule(data)
      ElMessage.success('已保存，下一分钟按新规则评估')
      visible.value = false
      emit('saved')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .section-title {
    padding-left: 8px;
    margin: 4px 0 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    border-left: 3px solid var(--el-color-primary);
  }

  .option-meta {
    float: right;
    margin-left: 16px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .levels {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .level-chip {
    padding: 0 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 24px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    background: var(--el-fill-color-light);
    border: 1px solid transparent;
    border-radius: 4px;
    opacity: 0.7;
  }

  .level-chip.is-active {
    color: var(--lx-level);
    background: color-mix(in srgb, var(--lx-level) 12%, transparent);
    border-color: currentcolor;
    opacity: 1;
  }

  .tip {
    margin-left: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .inline-text {
    margin: 0 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .inline-text:first-child {
    margin-left: 0;
  }

  .number {
    width: 110px;
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
