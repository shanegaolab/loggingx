<!-- 布局容器 -->
<template>
  <div class="app-layout">
    <aside id="app-sidebar">
      <LogxSidebarMenu />
    </aside>

    <main id="app-main">
      <div id="app-header">
        <LogxHeaderBar />
      </div>
      <div id="app-content">
        <LogxPageContent />
      </div>
    </main>

    <div id="app-global">
      <LogxGlobalComponent />
    </div>
  </div>
</template>

<script setup lang="ts">
  defineOptions({ name: 'AppLayout' })
</script>

<style lang="scss" scoped>
  @use './style';
</style>
