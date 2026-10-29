<!-- 日志库接入指引：上报 Token、HTTP 上报和 Kafka 消息格式 -->
<template>
  <ElDialog v-model="visible" title="接入指引" width="720px" align-center>
    <template v-if="store">
      <ElDescriptions :column="1" border size="small">
        <ElDescriptionsItem label="日志库">{{ store.name }}（{{ store.code }}）</ElDescriptionsItem>
        <ElDescriptionsItem label="上报 Token">
          <div class="flex items-center gap-2">
            <code class="font-mono text-xs break-all">{{ store.ingestToken }}</code>
            <ElButton link type="primary" @click="copy(store.ingestToken, 'Token')">复制</ElButton>
          </div>
        </ElDescriptionsItem>
      </ElDescriptions>

      <ElAlert type="success" :closable="false" class="mt-4">
        <template #title>
          <span>从服务器采集日志文件或容器日志？用「采集 Agent」一条命令完成安装和配置。</span>
          <ElButton link type="primary" class="ml-1" @click="openAgentPage">去部署 Agent</ElButton>
        </template>
      </ElAlert>

      <ElTabs v-model="activeTab" class="mt-4">
        <ElTabPane label="HTTP 上报" name="http">
          <p class="guide-text">
            POST 到下面的地址，请求头 <code>X-Log-Token</code> 填上报 Token。每次最多 1000
            条；请求体可以是日志数组、<code>{"logs": [...]}</code> 或单条日志。
          </p>
          <div class="code-block">
            <ElButton class="copy-btn" size="small" @click="copy(curlExample, '示例')"
              >复制</ElButton
            >
            <pre>{{ curlExample }}</pre>
          </div>
        </ElTabPane>
        <ElTabPane label="Kafka 采集" name="kafka">
          <p class="guide-text">
            采集 Agent 把日志发到 Kafka 主题（默认
            <code>loggingx-logs</code>，后端开启
            <code>LOGGINGX_KAFKA_ENABLED=true</code> 后消费）。消息体为 JSON，依次用
            <code>logstore</code> 字段、<code>logstore</code> 消息头或消息 Key 指定日志库编码，无需
            Token。
          </p>
          <p class="guide-text">
            <b>日志顺序：</b>Kafka
            只保证同一分区内有序。请把同一来源（同一主机的同一个文件）的日志发到同一分区， 例如消息
            Key 设为「主机:文件路径」，日志库放在消息头或消息体里；并带上行序号 <code>seq</code>（或
            Filebeat 自带的
            <code>log.offset</code>），这样同一时间的多行日志（如异常堆栈、秒级时间戳）
            即使跨分区也能按原始顺序显示。
          </p>
          <div class="code-block">
            <ElButton class="copy-btn" size="small" @click="copy(kafkaExample, '示例')"
              >复制</ElButton
            >
            <pre>{{ kafkaExample }}</pre>
          </div>
        </ElTabPane>
        <ElTabPane label="字段说明" name="fields">
          <ElTable :data="fieldDocs" size="small" border>
            <ElTableColumn prop="name" label="字段" width="200" />
            <ElTableColumn prop="desc" label="说明" />
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  interface Props {
    modelValue: boolean
    store?: Api.Log.Store
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  const activeTab = ref('http')
  const router = useRouter()

  const openAgentPage = () => {
    visible.value = false
    router.push({ name: 'LogAgent', query: { storeId: props.store?.storeId, tab: 'deploy' } })
  }

  /** 前端与后端同源部署（或经代理）时，上报地址即当前站点的 /api/logs/ingest */
  const ingestUrl = computed(() => {
    const base = (import.meta.env.VITE_API_URL || '/').replace(/\/+$/, '')
    const origin = /^https?:\/\//.test(base) ? base : `${window.location.origin}${base}`
    return `${origin}/api/logs/ingest`
  })

  const curlExample = computed(
    () => `curl -X POST '${ingestUrl.value}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Log-Token: ${props.store?.ingestToken ?? ''}' \\
  -d '[
    {
      "time": "2026-10-23T08:00:00.123Z",
      "level": "ERROR",
      "host": "web-01",
      "source": "com.demo.OrderService",
      "traceId": "a1b2c3",
      "message": "Payment failed for order 10001",
      "orderId": 10001
    }
  ]'`
  )

  const kafkaExample = computed(
    () => `{
  "logstore": "${props.store?.code ?? ''}",
  "logs": [
    { "@timestamp": "2026-10-23T08:00:01.456Z", "level": "error", "host": "web-01", "source": "/var/log/app.log", "seq": 4096, "message": "payment failed" },
    { "@timestamp": "2026-10-23T08:00:01.456Z", "level": "error", "host": "web-01", "source": "/var/log/app.log", "seq": 4150, "message": "\\tat com.demo.PayClient.charge(PayClient.java:88)" }
  ]
}`
  )

  const fieldDocs = [
    {
      name: 'message / msg / log',
      desc: '日志内容，必填；为空的日志会被丢弃'
    },
    {
      name: 'time / timestamp / @timestamp',
      desc: 'ISO-8601 时间、yyyy-MM-dd HH:mm:ss[.SSS]（服务器时区）或秒/毫秒时间戳；缺省为接收时间'
    },
    {
      name: 'level / severity',
      desc: 'TRACE、DEBUG、INFO、WARN、ERROR、FATAL，支持 warning、err 等常见写法；缺省为 INFO'
    },
    { name: 'host / hostname', desc: '主机或容器名' },
    { name: 'source / logger / file', desc: '来源，如 Logger 名或文件路径' },
    { name: 'traceId / trace_id', desc: '链路 ID，可在日志查询中精确筛选' },
    {
      name: 'seq / offset（Filebeat 的 log.offset）',
      desc: '行在来源中的序号，如文件偏移；同一时间的多行日志按它保持原始顺序，建议采集端提供'
    },
    { name: 'fields 及其他字段', desc: '作为附加字段保存，在日志详情中查看' }
  ]

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success(`${label}已复制`)
    } catch {
      ElMessage.error('复制失败，请手动选择复制')
    }
  }
</script>

<style scoped>
  .guide-text {
    margin-bottom: 8px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  .guide-text code {
    padding: 0 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  .code-block {
    position: relative;
    padding: 12px;
    overflow-x: auto;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }

  .code-block pre {
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre;
  }

  .copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
  }
</style>
