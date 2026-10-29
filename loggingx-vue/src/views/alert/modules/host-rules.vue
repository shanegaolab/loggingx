<!-- 监控告警规则：主机 CPU、内存、磁盘、负载与离线 -->
<template>
  <div class="rules">
    <div class="toolbar">
      <ElButton type="primary" size="small" @click="edit()">
        <LogxSvgIcon icon="ri:add-line" class="mr-1" />新增规则
      </ElButton>
      <span class="hint"
        >规则作用于开启了主机监控的 Agent 所在主机；「主机离线」按 Agent 最近一次同步判断</span
      >
    </div>
    <ElTable v-loading="loading" :data="list" size="small" class="table" height="100%">
      <ElTableColumn label="名称" min-width="150" prop="name" />
      <ElTableColumn label="条件" min-width="240">
        <template #default="{ row }">{{ describeRule(row) }}</template>
      </ElTableColumn>
      <ElTableColumn label="级别" width="80">
        <template #default="{ row }">
          <ElTag :type="row.severity === 'critical' ? 'danger' : 'warning'" size="small">
            {{ SEVERITY_NAMES[row.severity as Api.Monitor.Severity] }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="适用范围" min-width="120">
        <template #default="{ row }">{{
          row.storeId ? (row.storeName ?? '-') : '全部日志库'
        }}</template>
      </ElTableColumn>
      <ElTableColumn label="通知" min-width="180">
        <template #default="{ row }">
          <span :class="{ muted: !row.notification?.channels.length }">{{
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

    <RuleDialog v-model="visible" :rule="editing" @saved="load" />
  </div>
</template>

<script setup lang="ts">
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { ElMessageBox } from 'element-plus'
  import { deleteAlertRule, fetchAlertRules, updateAlertRule } from '@/api/monitor'
  import { SEVERITY_NAMES, describeRule } from '@/views/monitor/shared'
  import { ALERT_CENTER, describeNotify } from '../shared'
  import RuleDialog from './rule-dialog.vue'

  const ctx = inject(ALERT_CENTER)!
  const list = ref<Api.Monitor.AlertRule[]>([])
  const loading = ref(false)
  const visible = ref(false)
  const editing = ref<Api.Monitor.AlertRule>()

  const load = async () => {
    loading.value = true
    try {
      list.value = await fetchAlertRules()
    } finally {
      loading.value = false
    }
  }

  const edit = (rule?: Api.Monitor.AlertRule) => {
    editing.value = rule
    visible.value = true
  }

  const toggle = async (rule: Api.Monitor.AlertRule, enabled: boolean) => {
    await updateAlertRule(rule.id, {
      name: rule.name,
      metric: rule.metric,
      threshold: rule.threshold,
      durationMinutes: rule.durationMinutes,
      severity: rule.severity,
      storeId: rule.storeId,
      enabled,
      notification: rule.notification
    })
    rule.enabled = enabled
    ElMessage.success(enabled ? '已启用' : '已停用，进行中的告警已恢复')
  }

  const remove = async (rule: Api.Monitor.AlertRule) => {
    try {
      await ElMessageBox.confirm(
        `删除规则「${rule.name}」？它进行中的告警会被标记为已恢复。`,
        '删除规则',
        { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await deleteAlertRule(rule.id)
    ElMessage.success('已删除')
    load()
  }

  onMounted(load)
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
</style>
