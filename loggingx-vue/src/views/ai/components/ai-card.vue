<!-- AI 运维各页面的外框：铺满内容区的卡片，内容自行滚动 -->
<template>
  <div class="logx-full-height">
    <ElCard shadow="never" class="ai-card" :class="{ 'ai-card--scroll': scroll }">
      <slot />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  defineProps<{ scroll?: boolean }>()
</script>

<style scoped>
  .ai-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .ai-card :deep(.el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 16px 20px;
  }

  .ai-card--scroll :deep(.el-card__body) {
    overflow: auto;
  }
</style>
