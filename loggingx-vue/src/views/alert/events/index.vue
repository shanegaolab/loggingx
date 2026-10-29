<!-- 告警事件：日志告警与监控告警合并展示，进行中的在前 -->
<template>
  <LogxPageCard>
    <EventList />
  </LogxPageCard>
</template>

<script setup lang="ts">
  import LogxPageCard from '@/components/core/cards/logx-page-card/index.vue'
  import { provideAlertCenter } from '../shared'
  import EventList from '../modules/event-list.vue'

  defineOptions({ name: 'AlertEvent' })

  // 日志库筛选，以及按日志告警规则打开对应日志
  provideAlertCenter({ stores: true, logRules: true })
</script>
