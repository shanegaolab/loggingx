<!-- 采集 Agent：按日志库查看已安装的 Agent、修改采集配置（自动下发）、一键部署 -->
<template>
  <div class="log-agent-page logx-full-height">
    <ElCard shadow="never" class="agent-toolbar">
      <div class="agent-toolbar__inner">
        <ElSelect
          v-model="storeId"
          :loading="loadingStores"
          placeholder="选择日志库"
          no-data-text="暂无日志库，请先在日志库管理中新建"
          filterable
          class="agent-toolbar__store"
          @change="pickDefaultTab"
        >
          <ElOption
            v-for="store in stores"
            :key="store.storeId"
            :value="store.storeId"
            :label="`${store.name}（${store.code}）`"
          >
            <span>{{ store.name }}</span>
            <span class="option-meta">
              {{ store.code }}
              <template v-if="store.agentCount">
                · {{ store.onlineAgentCount }}/{{ store.agentCount }} 在线</template
              >
              <template v-if="!store.enabled"> · 已停用</template>
            </span>
          </ElOption>
        </ElSelect>
        <div v-if="currentStore" class="agent-toolbar__stats">
          <span
            ><b>{{ currentStore.agentCount ?? 0 }}</b> 个 Agent</span
          >
          <span class="online"
            ><i class="dot"></i><b>{{ currentStore.onlineAgentCount ?? 0 }}</b> 在线</span
          >
          <ElTag v-if="!currentStore.enabled" type="info" size="small">日志库已停用</ElTag>
        </div>
        <span v-if="meta" class="agent-toolbar__version">Vector {{ meta.version }}</span>
      </div>
    </ElCard>

    <ElCard v-if="currentStore" shadow="never" class="agent-body">
      <AgentWorkspace
        v-model:tab="tab"
        :store="currentStore"
        :meta="meta"
        @agents-changed="onAgentsChanged"
      />
    </ElCard>
    <ElCard v-else-if="!loadingStores" shadow="never" class="agent-body">
      <ElEmpty description="先选择一个日志库" :image-size="80">
        <ElButton v-if="!stores.length" type="primary" @click="router.push({ name: 'LogStore' })"
          >去新建日志库</ElButton
        >
      </ElEmpty>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { fetchGetLogStoreList } from '@/api/log'
  import { fetchAgentMeta } from '@/api/agent'
  import AgentWorkspace from './modules/agent-workspace.vue'
  import type { AgentTab } from './modules/agent-workspace.vue'

  defineOptions({ name: 'LogAgent' })

  const TABS: AgentTab[] = ['agents', 'collect', 'deploy']

  const route = useRoute()
  const router = useRouter()
  const stores = ref<Api.Log.Store[]>([])
  const storeId = ref<number>()
  const loadingStores = ref(false)
  const meta = ref<Api.Agent.Meta>()
  const tab = ref<AgentTab>('agents')

  const currentStore = computed(() => stores.value.find((store) => store.storeId === storeId.value))

  /** 有 Agent 时先看列表，没有时直接去部署 */
  const pickDefaultTab = () => {
    tab.value = currentStore.value?.agentCount ? 'agents' : 'deploy'
  }

  const applyRoute = () => {
    const fromRoute = stores.value.find((store) => store.storeId === Number(route.query.storeId))
    if (fromRoute && fromRoute.storeId !== storeId.value) {
      storeId.value = fromRoute.storeId
      pickDefaultTab()
    }
    const routeTab = route.query.tab as AgentTab
    if (TABS.includes(routeTab)) tab.value = routeTab
  }

  const loadStores = async () => {
    loadingStores.value = true
    try {
      stores.value = await fetchGetLogStoreList()
    } finally {
      loadingStores.value = false
    }
    if (!stores.value.some((store) => store.storeId === storeId.value)) {
      storeId.value = (stores.value.find((store) => store.enabled) ?? stores.value[0])?.storeId
      pickDefaultTab()
    }
    applyRoute()
  }

  /** Agent 列表刷新时同步更新下拉框和顶部的数量 */
  const onAgentsChanged = (agents: Api.Agent.Instance[]) => {
    const store = currentStore.value
    if (!store) return
    store.agentCount = agents.length
    store.onlineAgentCount = agents.filter((agent) => agent.online).length
  }

  watch(() => [route.query.storeId, route.query.tab], applyRoute)

  onMounted(async () => {
    const [, agentMeta] = await Promise.all([loadStores(), fetchAgentMeta()])
    meta.value = agentMeta
  })

  // 页面被缓存时，回来后刷新日志库（可能刚新建或重置了 Token）；首次进入由 onMounted 加载
  let activatedOnce = false
  onActivated(() => {
    if (activatedOnce) loadStores()
    activatedOnce = true
  })
</script>

<style scoped>
  .log-agent-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* 页面固定一屏高：工具栏不被压缩，下方卡片占满剩余高度并在内部滚动 */
  .agent-toolbar {
    flex: none;
  }

  .agent-toolbar :deep(.el-card__body) {
    padding: 14px 20px;
  }

  .agent-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .agent-toolbar__inner {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
    align-items: center;
  }

  .agent-toolbar__store {
    width: 320px;
    max-width: 100%;
  }

  .option-meta {
    float: right;
    margin-left: 16px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .agent-toolbar__stats {
    display: flex;
    gap: 16px;
    align-items: center;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .agent-toolbar__stats b {
    margin-right: 2px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 5px;
    vertical-align: 1px;
    background: var(--el-color-success);
    border-radius: 50%;
    box-shadow: 0 0 0 3px rgb(22 163 74 / 15%);
  }

  .agent-toolbar__version {
    margin-left: auto;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .agent-body :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    padding: 6px 20px 18px;
    overflow-y: auto;
  }

  .agent-body :deep(.agent-workspace > .el-tabs__header) {
    position: sticky;
    top: -6px;
    z-index: 2;
    padding-top: 6px;
    margin-top: -6px;
    background: var(--el-card-bg-color, var(--el-bg-color));
  }

  /* 窄屏下页面高度自适应，由页面整体滚动 */
  @media (width <= 640px) {
    .agent-body :deep(.el-card__body) {
      overflow: visible;
    }
  }
</style>
