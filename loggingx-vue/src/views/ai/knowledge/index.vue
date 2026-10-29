<!-- 知识库：运维手册、故障复盘、常见问题，供智能问答检索引用 -->
<template>
  <AiCard>
    <KnowledgeBase ref="baseRef" :stores="stores" />
  </AiCard>
</template>

<script setup lang="ts">
  import { fetchAiStores } from '@/api/ai-diagnosis'
  import AiCard from '../components/ai-card.vue'
  import KnowledgeBase from './knowledge-base.vue'

  defineOptions({ name: 'AiKnowledge' })

  const route = useRoute()
  const stores = ref<Api.AiDiagnosis.StoreConfig[]>([])
  const baseRef = ref<InstanceType<typeof KnowledgeBase>>()

  // 从智能问答的引用资料带 ?id= 打开某篇文档
  const applyRoute = () => {
    const id = Number(route.query.id)
    if (route.name === 'AiKnowledge' && id) baseRef.value?.edit({ id })
  }
  watch(() => route.fullPath, applyRoute)

  onMounted(async () => {
    stores.value = await fetchAiStores()
    applyRoute()
  })
</script>
