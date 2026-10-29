<!-- AI 设置：模型与通知，以及每个日志库的代码仓库和自动分析 -->
<template>
  <AiCard scroll>
    <AiSettings :stores="stores" @stores-changed="loadStores" />
  </AiCard>
</template>

<script setup lang="ts">
  import { fetchAiStores } from '@/api/ai-diagnosis'
  import { fetchNotifyGroups, fetchNotifyUsers } from '@/api/alert-center'
  import { ALERT_CENTER } from '@/views/alert/shared'
  import AiCard from '../components/ai-card.vue'
  import AiSettings from './ai-settings.vue'

  defineOptions({ name: 'AiSettings' })

  const stores = ref<Api.AiDiagnosis.StoreConfig[]>([])

  // 通知设置复用告警中心的接收人选择
  const users = ref<Api.AlertCenter.UserOption[]>([])
  const groups = ref<Api.AlertCenter.Group[]>([])
  provide(ALERT_CENTER, {
    stores: ref([]),
    users,
    groups,
    logRules: ref([]),
    reloadGroups: async () => {
      groups.value = await fetchNotifyGroups()
    },
    reloadLogRules: async () => {}
  })

  const loadStores = async () => {
    stores.value = await fetchAiStores()
  }

  onMounted(() => {
    loadStores()
    fetchNotifyUsers()
      .then((list) => (users.value = list))
      .catch(() => {})
    fetchNotifyGroups()
      .then((list) => (groups.value = list))
      .catch(() => {})
  })
</script>
