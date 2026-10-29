<!-- 页面外框：铺满内容区的卡片；tabs 时页签区域自适应高度，scroll 时内容整体滚动 -->
<template>
  <div class="logx-full-height">
    <ElCard
      shadow="never"
      class="page-card"
      :class="{ 'page-card--tabs': tabs, 'page-card--scroll': scroll }"
    >
      <slot />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  defineOptions({ name: 'LogxPageCard' })

  defineProps<{
    /** 内容是 ElTabs：页签内容区铺满剩余高度 */
    tabs?: boolean
    /** 内容超出时整体滚动 */
    scroll?: boolean
  }>()
</script>

<style scoped>
  .page-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .page-card :deep(.el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 16px 20px;
  }

  .page-card--scroll :deep(.el-card__body) {
    overflow: auto;
  }

  .page-card--tabs :deep(.el-card__body) {
    padding-top: 6px;
  }

  .page-card--tabs :deep(.el-card__body > .el-tabs) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .page-card--tabs :deep(.el-card__body > .el-tabs > .el-tabs__content) {
    flex: 1;
    min-height: 0;
  }

  .page-card--tabs :deep(.el-card__body > .el-tabs > .el-tabs__content > .el-tab-pane) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>
