<!-- 通知管理：邮件 / 短信渠道、通知组，以及每一次发送的记录 -->
<template>
  <LogxPageCard tabs>
    <ElTabs v-model="tab">
      <ElTabPane label="通知渠道" name="channels">
        <div class="scroll">
          <NotifyChannels />
        </div>
      </ElTabPane>
      <ElTabPane label="通知组" name="groups" lazy>
        <NotifyGroups />
      </ElTabPane>
      <ElTabPane label="通知记录" name="records" lazy>
        <NotifyRecords />
      </ElTabPane>
    </ElTabs>
  </LogxPageCard>
</template>

<script setup lang="ts">
  import LogxPageCard from '@/components/core/cards/logx-page-card/index.vue'
  import { provideAlertCenter } from '../shared'
  import NotifyChannels from '../modules/notify-channels.vue'
  import NotifyGroups from '../modules/notify-groups.vue'
  import NotifyRecords from '../modules/notify-records.vue'

  defineOptions({ name: 'AlertNotify' })

  type Tab = 'channels' | 'groups' | 'records'
  const TABS: Tab[] = ['channels', 'groups', 'records']

  const route = useRoute()
  const tab = ref<Tab>('channels')

  // 通知组的成员从用户中选择
  provideAlertCenter({ users: true, groups: true })

  // 支持 ?tab=records 等直接打开某个页签
  const applyRoute = () => {
    const wanted = route.query.tab as Tab
    if (route.name === 'AlertNotify' && TABS.includes(wanted)) tab.value = wanted
  }
  watch(() => route.query.tab, applyRoute)
  onMounted(applyRoute)
</script>

<style scoped>
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
