<!-- 日志库的采集配置：该日志库的所有 Agent 按它采集，保存后 Agent 在下次同步时自动生效 -->
<template>
  <div v-loading="loading" class="collect-form">
    <ElAlert type="info" :closable="false" show-icon class="mb-4">
      已安装的 Agent 每 30 秒（Windows 每分钟）向 LoggingX 同步一次，保存后无需重新部署，约 1
      分钟内自动生效。
    </ElAlert>
    <ElForm label-position="top" class="agent-form">
      <div class="form-grid">
        <ElFormItem label="Linux / Docker 宿主机日志文件">
          <ElInput
            v-model="pathsText"
            type="textarea"
            :rows="4"
            placeholder="/var/log/app/*.log"
            class="mono-input"
          />
          <span class="form-hint"
            >每行一个绝对路径，支持通配符 *；建议写成 app.log* 以便 Agent
            停机期间轮转出的文件也能读完</span
          >
        </ElFormItem>
        <ElFormItem label="Windows 日志文件">
          <ElInput
            v-model="windowsPathsText"
            type="textarea"
            :rows="4"
            placeholder="C:\logs\app\*.log"
            class="mono-input"
          />
          <span class="form-hint"
            >每行一个绝对路径，建议用 *.log* 覆盖轮转文件；不部署 Windows 时可留空</span
          >
        </ElFormItem>
      </div>
      <ElFormItem label="Docker 容器标准输出">
        <ElSwitch v-model="form.containers" />
        <span class="form-hint"
          >Docker 环境下同时采集本机所有容器的 stdout / stderr；Kubernetes 总是采集所有 Pod
          的日志</span
        >
      </ElFormItem>
      <ElFormItem label="多行合并">
        <ElRadioGroup v-model="form.multiline">
          <ElRadio value="none">不合并</ElRadio>
          <ElRadio value="stacktrace">异常堆栈</ElRadio>
          <ElRadio value="timestamp">以日期开头为新日志</ElRadio>
          <ElRadio value="custom">自定义</ElRadio>
        </ElRadioGroup>
        <span class="form-hint">{{ MULTILINE_HINTS[form.multiline] }}</span>
        <ElInput
          v-if="form.multiline === 'custom'"
          v-model="form.multilinePattern"
          placeholder="匹配每条日志第一行的正则，如 ^\[\d{4}-"
          class="mono-input mt-2"
        />
      </ElFormItem>
      <ElFormItem label="传输方式">
        <ElRadioGroup v-model="form.transport">
          <ElRadio value="http">HTTP 直传（推荐）</ElRadio>
          <ElRadio value="kafka">Kafka</ElRadio>
        </ElRadioGroup>
      </ElFormItem>
      <template v-if="form.transport === 'kafka'">
        <ElAlert
          v-if="meta && !meta.kafka.enabled"
          type="warning"
          :closable="false"
          show-icon
          class="mb-3"
        >
          LoggingX 后端尚未开启 Kafka 消费（LOGGINGX_KAFKA_ENABLED=true），发到 Kafka
          的日志暂时不会入库。
        </ElAlert>
        <div class="form-grid">
          <ElFormItem label="Kafka 地址">
            <ElInput
              v-model="form.kafkaServers"
              placeholder="kafka-1:9092,kafka-2:9092"
              class="mono-input"
            />
          </ElFormItem>
          <ElFormItem label="Topic">
            <ElInput v-model="form.kafkaTopic" placeholder="loggingx-logs" class="mono-input" />
          </ElFormItem>
        </div>
      </template>

      <div class="section-title">
        <LogxSvgIcon icon="ri:pulse-line" />主机监控
        <span class="form-hint"
          >同时采集宿主机的 CPU、内存、磁盘、网络和负载，在「监控中心 → 主机监控」查看</span
        >
      </div>
      <ElFormItem label="启用">
        <ElSwitch v-model="monitor.enabled" />
      </ElFormItem>
      <template v-if="monitor.enabled">
        <ElFormItem label="采集间隔">
          <ElRadioGroup v-model="monitor.intervalSeconds">
            <ElRadioButton v-for="seconds in INTERVALS" :key="seconds" :value="seconds">
              {{ seconds < 60 ? `${seconds} 秒` : `${seconds / 60} 分钟` }}
            </ElRadioButton>
          </ElRadioGroup>
          <span class="form-hint"
            >间隔越短曲线越细，数据量也越大；告警规则的持续时间应明显长于间隔</span
          >
        </ElFormItem>
        <div class="form-grid">
          <ElFormItem label="进程 Top">
            <ElSwitch v-model="monitor.processes" />
            <span class="form-hint">每 30 秒上报 CPU ≥ 0.5% 或内存 ≥ 50 MB 的进程</span>
          </ElFormItem>
          <ElFormItem label="容器与服务">
            <ElSwitch v-model="monitor.containers" />
            <span class="form-hint"
              >Docker 容器、K8s 容器和 systemd 服务的资源（仅 Linux，cgroups v2）</span
            >
          </ElFormItem>
        </div>
      </template>
    </ElForm>

    <div class="collect-form__foot">
      <span class="form-hint">
        {{ updateTime ? `上次保存：${updateTime}` : '当前为默认配置，尚未保存' }}
      </span>
      <ElButton :disabled="!dirty" @click="reset">撤销修改</ElButton>
      <ElButton type="primary" :loading="saving" :disabled="!dirty && !!updateTime" @click="save">
        保存并下发
      </ElButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { fetchCollectConfig, saveCollectConfig } from '@/api/agent'

  const props = defineProps<{ storeId: number; meta?: Api.Agent.Meta }>()
  const emit = defineEmits<{ saved: [config: Api.Agent.CollectConfigView] }>()

  const MULTILINE_HINTS: Record<Api.Agent.Multiline, string> = {
    none: '每一行都是一条日志',
    stacktrace: '缩进行、Caused by:、异常类名行并入上一条日志，适合 Java / Python / .NET 异常堆栈',
    timestamp: '以 2026-10-23 这样的日期开头的行才是新日志，其余行并入上一条',
    custom: '匹配正则的行是新日志的第一行，其余行并入上一条'
  }

  const loading = ref(false)
  const saving = ref(false)
  const updateTime = ref<string | null>(null)
  const pathsText = ref('')
  const windowsPathsText = ref('')
  const form = reactive({
    containers: true,
    multiline: 'stacktrace' as Api.Agent.Multiline,
    multilinePattern: '',
    transport: 'http' as Api.Agent.Transport,
    kafkaServers: '',
    kafkaTopic: ''
  })
  const INTERVALS = [10, 15, 30, 60]
  const monitor = reactive<Api.Agent.MonitorConfig>({
    enabled: true,
    intervalSeconds: 15,
    processes: true,
    containers: true
  })
  let saved = ''

  const lines = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  const payload = computed<Api.Agent.CollectConfig>(() => ({
    ...form,
    paths: lines(pathsText.value),
    windowsPaths: lines(windowsPathsText.value),
    multilinePattern: form.multiline === 'custom' ? form.multilinePattern : null,
    kafkaServers: form.transport === 'kafka' ? form.kafkaServers : null,
    kafkaTopic: form.transport === 'kafka' ? form.kafkaTopic : null,
    monitor: { ...monitor }
  }))

  const dirty = computed(() => JSON.stringify(payload.value) !== saved)

  const apply = (config: Api.Agent.CollectConfigView) => {
    pathsText.value = config.paths.join('\n')
    windowsPathsText.value = config.windowsPaths.join('\n')
    form.containers = config.containers
    form.multiline = config.multiline
    form.multilinePattern = config.multilinePattern ?? ''
    form.transport = config.transport
    form.kafkaServers = config.kafkaServers ?? ''
    form.kafkaTopic = config.kafkaTopic ?? ''
    if (config.monitor) Object.assign(monitor, config.monitor)
    fillKafkaDefaults()
    updateTime.value = config.updateTime
    saved = JSON.stringify(payload.value)
  }

  let current: Api.Agent.CollectConfigView | undefined
  const load = async () => {
    loading.value = true
    try {
      current = await fetchCollectConfig(props.storeId)
      apply(current)
    } finally {
      loading.value = false
    }
  }

  const reset = () => current && apply(current)

  // 切换到 Kafka 时用 LoggingX 消费的 Kafka 配置补全空白项（meta 可能晚于配置加载）
  const fillKafkaDefaults = () => {
    if (form.transport !== 'kafka' || !props.meta) return
    if (!form.kafkaServers) form.kafkaServers = props.meta.kafka.servers
    if (!form.kafkaTopic) form.kafkaTopic = props.meta.kafka.topic || 'loggingx-logs'
  }
  watch(() => [form.transport, props.meta], fillKafkaDefaults)

  // 与后端校验一致的前置检查
  const validate = () => {
    const { paths, windowsPaths, multiline, multilinePattern, transport, kafkaServers } =
      payload.value
    const safe = /^[\w\-./:\\*?[\]{}, ]+$/
    const badUnix = paths.find((path) => !path.startsWith('/') || !safe.test(path))
    if (badUnix) return `路径「${badUnix}」需为 / 开头的绝对路径，且只能包含常见字符`
    const badWindows = windowsPaths.find((path) => !/^[A-Za-z]:\\/.test(path) || !safe.test(path))
    if (badWindows) return `Windows 路径「${badWindows}」需为 C:\\ 这样的绝对路径`
    if (multiline === 'custom' && !multilinePattern?.trim()) return '请填写多行合并的正则'
    if (transport === 'kafka' && !/^[\w.-]+:\d+(,[\w.-]+:\d+)*$/.test(kafkaServers ?? '')) {
      return 'Kafka 地址格式如 kafka-1:9092,kafka-2:9092'
    }
    return ''
  }

  const save = async () => {
    const error = validate()
    if (error) {
      ElMessage.warning(error)
      return
    }
    saving.value = true
    try {
      current = await saveCollectConfig(props.storeId, payload.value)
      apply(current)
      ElMessage.success('已保存，Agent 将在下次同步时应用')
      emit('saved', current)
    } finally {
      saving.value = false
    }
  }

  watch(() => props.storeId, load, { immediate: true })

  defineExpose({ dirty })
</script>

<style scoped>
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }

  .agent-form :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  .agent-form :deep(.el-form-item__content) {
    flex-direction: column;
    align-items: stretch;
  }

  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
  }

  .mono-input :deep(input),
  .mono-input :deep(textarea) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  .section-title {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
    padding-top: 16px;
    margin: 4px 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .section-title .form-hint {
    margin: 0;
    font-weight: 400;
  }

  .collect-form__foot {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    padding-top: 12px;
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .collect-form__foot .form-hint {
    margin: 0 auto 0 0;
  }

  @media (width <= 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
