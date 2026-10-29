<template>
  <ElDialog
    v-model="visible"
    :title="dialogType === 'add' ? '新增日志库' : '编辑日志库'"
    width="520px"
    align-center
    @close="handleClose"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="编码" prop="code">
        <ElInput
          v-model="form.code"
          :disabled="dialogType === 'edit'"
          placeholder="如 order-service"
          maxlength="64"
        />
        <div class="mt-1 text-xs leading-4 text-g-500">
          小写字母、数字、- 或 _，上报日志时用于指定日志库，创建后不可修改
        </div>
      </ElFormItem>
      <ElFormItem label="名称" prop="name">
        <ElInput v-model="form.name" placeholder="如 订单服务" maxlength="64" />
      </ElFormItem>
      <ElFormItem label="保留天数" prop="retentionDays">
        <ElInputNumber v-model="form.retentionDays" :min="1" :max="365" controls-position="right" />
        <span class="ml-2 text-xs text-g-500">过期日志自动删除</span>
      </ElFormItem>
      <ElFormItem label="描述" prop="description">
        <ElInput
          v-model="form.description"
          type="textarea"
          :rows="3"
          maxlength="255"
          placeholder="请输入描述"
        />
      </ElFormItem>
      <ElFormItem label="启用">
        <ElSwitch v-model="form.enabled" />
        <span class="ml-2 text-xs text-g-500">停用后拒绝写入新日志，已有日志仍可查询</span>
        <ElAlert
          v-if="disablingAgents"
          type="warning"
          :closable="false"
          show-icon
          class="mt-2"
          :title="`该日志库有 ${storeData?.agentCount} 个 Agent（${storeData?.onlineAgentCount} 个在线），停用期间它们上报的日志会被拒绝；Agent 继续运行，重新启用后自动恢复上报。`"
        />
      </ElFormItem>

      <template v-if="canBackup">
        <div class="section-title">归档备份</div>
        <ElFormItem label="归档">
          <ElSwitch v-model="backup.enabled" />
          <span class="ml-2 text-xs text-g-500">{{
            backup.enabled
              ? '先归档再删除：到期的日志在归档成功后才会删除'
              : '未开启：日志超过保留天数后直接删除'
          }}</span>
        </ElFormItem>
        <template v-if="backup.enabled">
          <ElFormItem label="归档时机">
            <span class="inline-text">超过</span>
            <ElInputNumber
              v-model="backup.archiveAfterDays"
              :min="1"
              :max="Math.max(1, form.retentionDays - 1)"
              controls-position="right"
              class="days-input"
            />
            <span class="inline-text">天的日志按天压缩上传</span>
          </ElFormItem>
          <ElFormItem label="归档保留">
            <ElInputNumber
              v-model="backup.keepDays"
              :min="backup.archiveAfterDays + 1"
              :max="3650"
              :step="30"
              controls-position="right"
              class="days-input"
            />
            <span class="inline-text">天，到期自动从备份存储删除</span>
          </ElFormItem>
          <ElAlert v-if="form.retentionDays < 2" type="warning" :closable="false" show-icon>
            保留天数至少 2 天才能开启归档（需要先归档再删除）
          </ElAlert>
          <ElAlert v-else-if="storageMissing" type="warning" :closable="false" show-icon>
            还没有配置备份存储：开启后到期日志会暂缓删除（最多 30 天），直到配置存储并归档成功。
            <ElButton link type="primary" @click="goBackup">去配置</ElButton>
          </ElAlert>
        </template>
      </template>
    </ElForm>
    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">提交</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { fetchCreateLogStore, fetchUpdateLogStore } from '@/api/log'
  import { fetchBackupStorage } from '@/api/backup'

  interface Props {
    modelValue: boolean
    dialogType: 'add' | 'edit'
    storeData?: Api.Log.Store
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success', store: Api.Log.Store, type: 'add' | 'edit'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    dialogType: 'add',
    storeData: undefined
  })

  const emit = defineEmits<Emits>()

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const router = useRouter()

  // 归档设置：有备份管理权限时与日志库一起设置
  const canBackup = computed(() => router.hasRoute('LogBackup'))
  const storageMissing = ref(false)
  const backup = reactive({ enabled: false, archiveAfterDays: 3, keepDays: 180 })
  /** 打开时是否已有归档策略（编辑时用于决定是否提交） */
  let hadPolicy = false

  const initBackup = async () => {
    const current = props.dialogType === 'edit' ? props.storeData?.backup : null
    hadPolicy = !!current?.archiveAfterDays
    const after = current?.archiveAfterDays ?? Math.max(1, Math.min(3, form.retentionDays - 1))
    Object.assign(backup, {
      enabled: current?.enabled ?? false,
      archiveAfterDays: after,
      keepDays: current?.keepDays ?? 180
    })
    if (canBackup.value) {
      try {
        storageMissing.value = !(await fetchBackupStorage())
      } catch {
        storageMissing.value = false
      }
    }
  }

  // 保留天数调小时，归档时机随之调整（须小于保留天数）
  watch(
    () => form.retentionDays,
    (days) => {
      if (backup.archiveAfterDays >= days) backup.archiveAfterDays = Math.max(1, days - 1)
    }
  )
  watch(
    () => backup.archiveAfterDays,
    (days) => {
      if (backup.keepDays <= days) backup.keepDays = days + 1
    }
  )

  const goBackup = () => {
    visible.value = false
    router.push({ name: 'LogBackup' })
  }

  /** 正在停用一个有 Agent 的日志库 */
  const disablingAgents = computed(
    () =>
      props.dialogType === 'edit' &&
      !!props.storeData?.enabled &&
      !form.enabled &&
      !!props.storeData?.agentCount
  )

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  const createEmptyForm = (): Api.Log.StoreForm => ({
    code: '',
    name: '',
    description: '',
    retentionDays: 7,
    enabled: true
  })

  const form = reactive<Api.Log.StoreForm>(createEmptyForm())

  const rules = reactive<FormRules>({
    code: [
      { required: true, message: '请输入编码', trigger: 'blur' },
      {
        pattern: /^[a-z0-9][a-z0-9_-]{1,63}$/,
        message: '2-64 个小写字母、数字、- 或 _，以字母或数字开头',
        trigger: 'blur'
      }
    ],
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    retentionDays: [{ required: true, message: '请输入保留天数', trigger: 'change' }]
  })

  watch(
    () => props.modelValue,
    (open) => {
      if (open) initForm()
    }
  )

  const initForm = () => {
    if (props.dialogType === 'edit' && props.storeData) {
      const { code, name, description, retentionDays, enabled } = props.storeData
      Object.assign(form, { code, name, description: description ?? '', retentionDays, enabled })
    } else {
      Object.assign(form, createEmptyForm())
    }
    initBackup()
    nextTick(() => formRef.value?.clearValidate())
  }

  const handleClose = () => {
    visible.value = false
    formRef.value?.resetFields()
  }

  const handleSubmit = async () => {
    if (!formRef.value) return
    try {
      await formRef.value.validate()
    } catch {
      return
    }

    submitting.value = true
    try {
      if (canBackup.value && backup.enabled && form.retentionDays < 2) {
        ElMessage.warning('保留天数至少 2 天才能开启归档')
        return
      }
      const payload: Api.Log.StoreForm = { ...form, description: form.description || undefined }
      // 开启归档，或修改已有的策略（含暂停）时一起提交
      if (canBackup.value && (backup.enabled || hadPolicy)) payload.backup = { ...backup }
      const saved =
        props.dialogType === 'add'
          ? await fetchCreateLogStore(payload)
          : await fetchUpdateLogStore(props.storeData!.storeId, payload)
      ElMessage.success(props.dialogType === 'add' ? '新增成功' : '修改成功')
      emit('success', saved, props.dialogType)
      handleClose()
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped>
  .section-title {
    padding-top: 14px;
    margin: 0 0 14px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .inline-text {
    margin: 0 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .inline-text:first-child {
    margin-left: 0;
  }

  .days-input {
    width: 110px;
  }
</style>
