<!-- 一个日志库的采集 Agent：Agent 列表、采集配置、一键部署。日志库管理和采集 Agent 页面共用 -->
<template>
  <ElTabs v-model="tab" class="agent-workspace">
    <ElTabPane name="agents">
      <template #label>
        Agent 列表<ElBadge
          v-if="agentCount !== undefined"
          :value="agentCount"
          :type="agentCount ? 'primary' : 'info'"
          class="tab-badge"
        />
      </template>
      <AgentList
        ref="agentListRef"
        :store-id="store.storeId"
        :meta="meta"
        @deploy="tab = 'deploy'"
        @changed="onAgentsChanged"
      />
    </ElTabPane>
    <ElTabPane label="采集配置" name="collect">
      <CollectConfigForm :store-id="store.storeId" :meta="meta" @saved="onCollectSaved" />
    </ElTabPane>
    <ElTabPane label="部署" name="deploy">
      <DeployPanel :store="store" :meta="meta" :collect="collect" @edit-collect="tab = 'collect'" />
    </ElTabPane>
  </ElTabs>
</template>

<script setup lang="ts">
  import { fetchCollectConfig } from '@/api/agent'
  import AgentList from './agent-list.vue'
  import CollectConfigForm from './collect-config-form.vue'
  import DeployPanel from './deploy-panel.vue'

  export type AgentTab = 'agents' | 'collect' | 'deploy'

  const props = defineProps<{ store: Api.Log.Store; meta?: Api.Agent.Meta }>()
  const emit = defineEmits<{ 'agents-changed': [agents: Api.Agent.Instance[]] }>()
  const tab = defineModel<AgentTab>('tab', { default: 'agents' })

  const collect = ref<Api.Agent.CollectConfigView>()
  const agentCount = ref<number>()
  const agentListRef = ref<InstanceType<typeof AgentList>>()

  const loadCollect = async () => {
    collect.value = undefined
    collect.value = await fetchCollectConfig(props.store.storeId)
  }

  // 采集配置或 Token 变了，Agent 的同步状态随之变化，立即刷新列表
  const onCollectSaved = (config: Api.Agent.CollectConfigView) => {
    collect.value = config
    agentListRef.value?.load(true)
  }

  watch(
    () => props.store.ingestToken,
    (token, previous) => {
      if (previous && token !== previous) agentListRef.value?.load(true)
    }
  )

  const onAgentsChanged = (agents: Api.Agent.Instance[]) => {
    agentCount.value = agents.length
    emit('agents-changed', agents)
  }

  watch(
    () => props.store.storeId,
    () => {
      agentCount.value = undefined
      loadCollect()
    },
    { immediate: true }
  )
</script>

<style scoped>
  .tab-badge {
    margin-left: 6px;
  }

  .tab-badge :deep(.el-badge__content) {
    position: static;
    transform: none;
  }
</style>
