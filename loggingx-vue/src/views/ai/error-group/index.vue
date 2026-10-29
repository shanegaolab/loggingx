<!-- 错误归类：同一类错误合并计数，可直接交给 AI 分析 -->
<template>
  <AiCard>
    <ErrorGroups :stores="stores" @open="(id: number) => (openId = id)" />
    <DiagnosisDrawer
      :diagnosis-id="openId"
      @close="openId = undefined"
      @open="(id: number) => (openId = id)"
    />
  </AiCard>
</template>

<script setup lang="ts">
  import { fetchAiStores } from '@/api/ai-diagnosis'
  import AiCard from '../components/ai-card.vue'
  import DiagnosisDrawer from '../components/diagnosis-drawer.vue'
  import ErrorGroups from './error-groups.vue'

  defineOptions({ name: 'AiErrorGroup' })

  const stores = ref<Api.AiDiagnosis.StoreConfig[]>([])
  const openId = ref<number>()

  onMounted(async () => {
    stores.value = await fetchAiStores()
  })
</script>
