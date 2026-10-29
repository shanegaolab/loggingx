<!-- 日志告警规则：按级别数量与关键字匹配 -->
<template>
  <div class="rules">
    <div class="toolbar">
      <ElButton type="primary" size="small" @click="edit()">
        <LogxSvgIcon icon="ri:add-line" class="mr-1" />新增规则
      </ElButton>
      <span class="hint"
        >每分钟统计一次：时间窗口内匹配级别与关键字的日志条数超过阈值即告警，回落到阈值以内自动恢复</span
      >
    </div>
    <ElTable
      v-loading="loading"
      :data="ctx.logRules.value"
      size="small"
      class="table"
      height="100%"
    >
      <template #empty>
        <ElEmpty :image-size="72" description="还没有日志告警规则">
          <ElButton type="primary" size="small" @click="edit()">新增规则</ElButton>
        </ElEmpty>
      </template>
      <ElTableColumn label="名称" min-width="150" prop="name" />
      <ElTableColumn label="日志库" min-width="120">
        <template #default="{ row }">{{ row.storeName ?? '-' }}</template>
      </ElTableColumn>
      <ElTableColumn label="条件" min-width="280">
        <template #default="{ row }">
          <span v-for="level in row.levels" :key="level" class="level" :class="levelClass(level)">{{
            level
          }}</span>
          <span v-if="row.keyword" class="keyword">“{{ row.keyword }}”</span>
          <span v-if="row.host" class="muted"> 主机 {{ row.host }}</span>
          <div class="muted">最近 {{ row.windowMinutes }} 分钟 &gt; {{ row.threshold }} 条</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="级别" width="80">
        <template #default="{ row }">
          <ElTag :type="row.severity === 'critical' ? 'danger' : 'warning'" size="small">
            {{ SEVERITY_NAMES[row.severity as Api.Monitor.Severity] }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="通知" min-width="180">
        <template #default="{ row }">
          <span :class="{ muted: !row.notification.channels.length }">{{
            describeNotify(row.notification, ctx.groups.value)
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="启用" width="70">
        <template #default="{ row }">
          <ElSwitch
            :model-value="row.enabled"
            size="small"
            @change="(value: string | number | boolean) => toggle(row, !!value)"
          />
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" size="small" @click="edit(row)">编辑</ElButton>
          <ElButton link type="danger" size="small" @click="remove(row)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <LogRuleDialog v-model="visible" :rule="editing" @saved="reload" />
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { ElMessageBox } from 'element-plus'
  import { deleteLogRule, updateLogRule } from '@/api/alert-center'
  import { levelClass } from '@/views/log/shared'
  import { SEVERITY_NAMES } from '@/views/monitor/shared'
  import { ALERT_CENTER, describeNotify } from '../shared'
  import LogRuleDialog from './log-rule-dialog.vue'

  const ctx = inject(ALERT_CENTER)!
  const loading = ref(false)
  const visible = ref(false)
  const editing = ref<Api.AlertCenter.LogRule>()

  const reload = async () => {
    loading.value = true
    try {
      await ctx.reloadLogRules()
    } finally {
      loading.value = false
    }
  }

  const edit = (rule?: Api.AlertCenter.LogRule) => {
    if (!ctx.stores.value.length) {
      ElMessage.warning('还没有日志库，请先创建日志库')
      return
    }
    editing.value = rule
    visible.value = true
  }

  const toggle = async (rule: Api.AlertCenter.LogRule, enabled: boolean) => {
    await updateLogRule(rule.id, {
      name: rule.name,
      storeId: rule.storeId,
      levels: rule.levels,
      keyword: rule.keyword,
      host: rule.host,
      windowMinutes: rule.windowMinutes,
      threshold: rule.threshold,
      severity: rule.severity,
      enabled,
      notification: rule.notification
    })
    rule.enabled = enabled
    ElMessage.success(enabled ? '已启用' : '已停用，进行中的告警已恢复')
  }

  const remove = async (rule: Api.AlertCenter.LogRule) => {
    try {
      await ElMessageBox.confirm(
        `删除规则「${rule.name}」？它进行中的告警会被标记为已恢复。`,
        '删除规则',
        { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await deleteLogRule(rule.id)
    ElMessage.success('已删除')
    reload()
  }
</script>

<style scoped>
  .rules {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .table {
    flex: 1;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 10px;
    align-items: center;
    margin-bottom: 10px;
  }

  .hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .level {
    display: inline-block;
    padding: 0 5px;
    margin-right: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 18px;
    color: var(--lx-level);
    background: color-mix(in srgb, var(--lx-level) 12%, transparent);
    border-radius: 3px;
  }

  .keyword {
    margin-right: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-primary);
  }
</style>
