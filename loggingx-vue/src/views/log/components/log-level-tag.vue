<!-- 日志级别标签：固定配色，不随主题色变化 -->
<template>
  <span class="log-level-tag" :class="levelClass(level)">{{ level }}</span>
</template>

<script setup lang="ts">
  import { levelClass } from '../shared'

  defineProps<{ level: string }>()
</script>

<style scoped>
  .log-level-tag {
    display: inline-block;
    min-width: 46px;
    padding: 1px 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    color: var(--lx-level);
    text-align: center;
    background: color-mix(in srgb, var(--lx-level) 12%, transparent);
    border-radius: 4px;
  }
</style>
