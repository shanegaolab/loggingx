<!-- AI 诊断：每条错误结合代码给出的原因和修改建议 -->
<template>
  <AiCard>
    <DiagnosisList ref="listRef" :stores="stores" @open="(id: number) => (openId = id)" />
    <DiagnosisDrawer
      :diagnosis-id="openId"
      @close="openId = undefined"
      @changed="listRef?.load()"
      @open="(id: number) => (openId = id)"
    />
  </AiCard>
</template>

<script setup lang="ts">
  import { fetchAiStores } from '@/api/ai-diagnosis'
  import AiCard from '../components/ai-card.vue'
  import DiagnosisDrawer from '../components/diagnosis-drawer.vue'
  import DiagnosisList from './diagnosis-list.vue'

  defineOptions({ name: 'AiDiagnosis' })

  const route = useRoute()
  const stores = ref<Api.AiDiagnosis.StoreConfig[]>([])
  const listRef = ref<InstanceType<typeof DiagnosisList>>()
  const openId = ref<number>()

  // 从通知铃铛、日志查询等处带 ?id= 打开某条诊断
  const applyRoute = () => {
    const id = Number(route.query.id)
    if (route.name === 'AiDiagnosis' && id) openId.value = id
  }
  watch(() => route.fullPath, applyRoute)

  onMounted(async () => {
    applyRoute()
    stores.value = await fetchAiStores()
  })
</script>
