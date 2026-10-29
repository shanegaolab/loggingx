<!-- 智能问答：用自然语言问运维问题，AI 检索资料后回答并标注出处 -->
<template>
  <AiCard>
    <OpsChat
      :stores="stores"
      @open-diagnosis="(id: number) => (openId = id)"
      @open-knowledge="(id: number) => router.push({ name: 'AiKnowledge', query: { id } })"
    />
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
  import OpsChat from './ops-chat.vue'

  defineOptions({ name: 'AiChat' })

  const router = useRouter()
  const stores = ref<Api.AiDiagnosis.StoreConfig[]>([])
  const openId = ref<number>()

  onMounted(async () => {
    stores.value = await fetchAiStores()
  })
</script>
