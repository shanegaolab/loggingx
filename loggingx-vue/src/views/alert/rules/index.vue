<!-- 告警规则：日志告警（按级别数量、关键字）与监控告警（主机指标、离线），以及各自的通知对象 -->
<template>
  <LogxPageCard tabs>
    <ElTabs v-model="tab">
      <ElTabPane label="日志告警" name="log">
        <LogRules />
      </ElTabPane>
      <ElTabPane label="监控告警" name="host" lazy>
        <HostRules />
      </ElTabPane>
    </ElTabs>
  </LogxPageCard>
</template>

<script setup lang="ts">
  import LogxPageCard from '@/components/core/cards/logx-page-card/index.vue'
  import { provideAlertCenter } from '../shared'
  import HostRules from '../modules/host-rules.vue'
  import LogRules from '../modules/log-rules.vue'

  defineOptions({ name: 'HostAlert' })

  type Tab = 'log' | 'host'

  const route = useRoute()
  const tab = ref<Tab>('log')

  provideAlertCenter({ stores: true, users: true, groups: true, logRules: true })

  // 支持 ?tab=host 直接打开监控告警
  const applyRoute = () => {
    const wanted = route.query.tab as Tab
    if (route.name === 'HostAlert' && (wanted === 'log' || wanted === 'host')) tab.value = wanted
  }
  watch(() => route.query.tab, applyRoute)
  onMounted(applyRoute)
</script>
