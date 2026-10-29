<!-- 备份存储（S3 兼容对象存储）配置：可先测试连接再保存 -->
<template>
  <ElDialog v-model="visible" title="备份存储" width="600px" align-center>
    <div class="providers">
      <button
        v-for="item in PROVIDERS"
        :key="item.key"
        type="button"
        class="provider"
        :class="{ 'is-active': provider === item.key }"
        @click="choose(item.key)"
      >
        {{ item.label }}
      </button>
    </div>
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="110px" class="storage-form">
      <ElFormItem label="服务地址" prop="endpoint">
        <ElInput v-model="form.endpoint" :placeholder="current.endpoint" class="mono-input" />
        <span class="form-hint">{{ current.hint }}</span>
      </ElFormItem>
      <ElFormItem label="区域" prop="region">
        <ElInput v-model="form.region" :placeholder="current.region" class="mono-input" />
      </ElFormItem>
      <ElFormItem label="存储桶" prop="bucket">
        <ElInput v-model="form.bucket" placeholder="loggingx-backup" class="mono-input" />
        <span class="form-hint">需事先在存储服务中创建</span>
      </ElFormItem>
      <ElFormItem label="路径前缀">
        <ElInput v-model="form.prefix" placeholder="loggingx" class="mono-input" />
        <span class="form-hint"
          >归档文件位于 {{ form.prefix || ''
          }}{{ form.prefix ? '/' : '' }}&lt;日志库&gt;/yyyy/MM/dd.ndjson.gz</span
        >
      </ElFormItem>
      <ElFormItem label="Access Key" prop="accessKey">
        <ElInput v-model="form.accessKey" autocomplete="off" class="mono-input" />
      </ElFormItem>
      <ElFormItem label="Secret Key" prop="secretKey">
        <ElInput
          v-model="form.secretKey"
          type="password"
          show-password
          autocomplete="new-password"
          :placeholder="storage?.secretSaved ? '已保存，留空则不修改' : ''"
          class="mono-input"
        />
        <span class="form-hint">加密保存，不会再显示。建议使用只能访问该存储桶的子账号密钥</span>
      </ElFormItem>
      <ElFormItem label="寻址方式">
        <ElRadioGroup v-model="form.pathStyle">
          <ElRadio :value="true">路径风格（endpoint/bucket）</ElRadio>
          <ElRadio :value="false">虚拟主机（bucket.endpoint）</ElRadio>
        </ElRadioGroup>
      </ElFormItem>
    </ElForm>
    <ElAlert
      v-if="testResult"
      :type="testResult.ok ? 'success' : 'error'"
      :closable="false"
      show-icon
    >
      {{ testResult.message }}
    </ElAlert>
    <template #footer>
      <ElButton :loading="testing" @click="test">测试连接</ElButton>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { saveBackupStorage, testBackupStorage } from '@/api/backup'

  const props = defineProps<{ storage: Api.Backup.Storage | null }>()
  const emit = defineEmits<{ saved: [] }>()
  const visible = defineModel<boolean>({ default: false })

  type Provider = 'minio' | 'oss' | 'cos' | 's3' | 'other'
  const PROVIDERS: {
    key: Provider
    label: string
    endpoint: string
    region: string
    pathStyle: boolean
    hint: string
  }[] = [
    {
      key: 'minio',
      label: 'MinIO',
      endpoint: 'http://minio.example.com:9000',
      region: 'us-east-1',
      pathStyle: true,
      hint: 'MinIO 的 API 地址（默认端口 9000），区域保持 us-east-1'
    },
    {
      key: 'oss',
      label: '阿里云 OSS',
      endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
      region: 'cn-hangzhou',
      pathStyle: false,
      hint: '地域 Endpoint，如 https://oss-cn-hangzhou.aliyuncs.com，区域填 cn-hangzhou'
    },
    {
      key: 'cos',
      label: '腾讯云 COS',
      endpoint: 'https://cos.ap-guangzhou.myqcloud.com',
      region: 'ap-guangzhou',
      pathStyle: false,
      hint: '地域 Endpoint，如 https://cos.ap-guangzhou.myqcloud.com；存储桶名含 APPID，如 logs-1250000000'
    },
    {
      key: 's3',
      label: 'AWS S3',
      endpoint: 'https://s3.us-east-1.amazonaws.com',
      region: 'us-east-1',
      pathStyle: false,
      hint: '区域 Endpoint，如 https://s3.ap-northeast-1.amazonaws.com'
    },
    {
      key: 'other',
      label: '其他 S3 兼容',
      endpoint: 'https://s3.example.com',
      region: 'us-east-1',
      pathStyle: true,
      hint: '任何兼容 S3 API（Signature V4）的对象存储'
    }
  ]

  const formRef = ref<FormInstance>()
  const provider = ref<Provider>('minio')
  const testing = ref(false)
  const saving = ref(false)
  const testResult = ref<{ ok: boolean; message: string }>()
  const form = reactive<Api.Backup.StorageForm>({
    endpoint: '',
    region: 'us-east-1',
    bucket: '',
    prefix: 'loggingx',
    accessKey: '',
    secretKey: '',
    pathStyle: true
  })

  const current = computed(() => PROVIDERS.find((item) => item.key === provider.value)!)

  const rules = computed<FormRules>(() => ({
    endpoint: [
      { required: true, message: '请填写服务地址', trigger: 'blur' },
      {
        pattern: /^https?:\/\/[^\s/]+$/,
        message: '如 https://oss-cn-hangzhou.aliyuncs.com，不带路径',
        trigger: 'blur'
      }
    ],
    region: [{ required: true, message: '请填写区域', trigger: 'blur' }],
    bucket: [
      { required: true, message: '请填写存储桶', trigger: 'blur' },
      {
        pattern: /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
        message: '3~63 位小写字母、数字、. 或 -',
        trigger: 'blur'
      }
    ],
    accessKey: [{ required: true, message: '请填写 Access Key', trigger: 'blur' }],
    secretKey: props.storage?.secretSaved
      ? []
      : [{ required: true, message: '请填写 Secret Key', trigger: 'blur' }]
  }))

  /** 按地址猜测服务商，用于回显 */
  const guess = (endpoint: string): Provider => {
    if (endpoint.includes('aliyuncs.com')) return 'oss'
    if (endpoint.includes('myqcloud.com')) return 'cos'
    if (endpoint.includes('amazonaws.com')) return 's3'
    if (endpoint.includes(':9000')) return 'minio'
    return 'other'
  }

  const choose = (key: Provider) => {
    const previous = current.value
    provider.value = key
    const next = current.value
    // 只替换还是默认值（或空）的项
    if (!form.endpoint || form.endpoint === previous.endpoint) form.endpoint = next.endpoint
    if (!form.region || form.region === previous.region) form.region = next.region
    form.pathStyle = next.pathStyle
    testResult.value = undefined
  }

  watch(visible, (open) => {
    if (!open) return
    testResult.value = undefined
    const storage = props.storage
    if (storage) {
      Object.assign(form, { ...storage, secretKey: '' })
      provider.value = guess(storage.endpoint)
    } else {
      provider.value = 'minio'
      Object.assign(form, {
        endpoint: '',
        region: 'us-east-1',
        bucket: '',
        prefix: 'loggingx',
        accessKey: '',
        secretKey: '',
        pathStyle: true
      })
    }
    nextTick(() => formRef.value?.clearValidate())
  })

  const valid = async () => !!(await formRef.value?.validate().catch(() => false))

  const test = async () => {
    if (!(await valid())) return
    testing.value = true
    testResult.value = undefined
    try {
      await testBackupStorage({ ...form })
      testResult.value = { ok: true, message: '连接成功：存储桶可访问，可以写入和删除对象' }
    } catch (error) {
      testResult.value = { ok: false, message: (error as Error).message || '连接失败' }
    } finally {
      testing.value = false
    }
  }

  const save = async () => {
    if (!(await valid())) return
    saving.value = true
    try {
      await saveBackupStorage({ ...form })
      ElMessage.success('备份存储已保存')
      visible.value = false
      emit('saved')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .providers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .provider {
    height: 30px;
    padding: 0 14px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: var(--el-fill-color-lighter);
    border: 1px solid transparent;
    border-radius: 15px;
  }

  .provider:hover {
    border-color: var(--el-border-color);
  }

  .provider.is-active {
    color: var(--el-text-color-primary);
    background: var(--el-bg-color);
    border-color: var(--el-text-color-primary);
  }

  .storage-form :deep(.el-form-item__content) {
    flex-direction: column;
    align-items: stretch;
  }

  .form-hint {
    margin-top: 2px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
  }

  .mono-input :deep(input) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }
</style>
