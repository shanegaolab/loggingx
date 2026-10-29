<!-- 规则对话框里的「通知」设置：渠道、接收人（用户 / 通知组）、恢复通知、重复提醒 -->
<template>
  <div class="notify-fields">
    <ElFormItem label="通知方式">
      <ElCheckboxGroup v-model="model.channels">
        <ElCheckbox value="email">邮件</ElCheckbox>
        <ElCheckbox value="sms">短信</ElCheckbox>
      </ElCheckboxGroup>
      <span v-if="!model.channels.length" class="tip">不勾选则只记录告警，不发通知</span>
    </ElFormItem>
    <template v-if="model.channels.length">
      <ElFormItem label="通知用户">
        <ElSelect
          v-model="model.userIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="3"
          placeholder="选择系统用户（使用其邮箱、手机号）"
          class="w-full"
        >
          <ElOption
            v-for="user in ctx.users.value"
            :key="user.id"
            :value="user.id"
            :label="userLabel(user)"
            :disabled="user.disabled"
          >
            <span>{{ userLabel(user) }}</span>
            <span class="option-meta">
              <span :class="{ missing: !user.email }">{{ user.email ?? '无邮箱' }}</span> ·
              <span :class="{ missing: !user.phone }">{{ user.phone ?? '无手机' }}</span>
            </span>
          </ElOption>
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="通知组">
        <ElSelect
          v-model="model.groupIds"
          multiple
          filterable
          placeholder="选择通知组"
          class="w-full"
          :no-data-text="'还没有通知组，请先在「通知组」页签新建'"
        >
          <ElOption
            v-for="group in ctx.groups.value"
            :key="group.id"
            :value="group.id"
            :label="group.name"
          >
            <span>{{ group.name }}</span>
            <span class="option-meta"
              >{{ group.userIds.length }} 个用户 · {{ group.contacts.length }} 个联系人</span
            >
          </ElOption>
        </ElSelect>
      </ElFormItem>
      <ElAlert
        v-for="warning in warnings"
        :key="warning"
        :title="warning"
        type="warning"
        :closable="false"
        show-icon
        class="notify-warning"
      />
      <ElFormItem label="恢复通知">
        <ElSwitch v-model="model.notifyResolved" />
        <span class="tip">告警恢复时再通知一次</span>
      </ElFormItem>
      <ElFormItem label="重复提醒">
        <ElSelect v-model="model.repeatMinutes" class="repeat-select">
          <ElOption :value="0" label="不重复" />
          <ElOption :value="30" label="每 30 分钟" />
          <ElOption :value="60" label="每 1 小时" />
          <ElOption :value="120" label="每 2 小时" />
          <ElOption :value="360" label="每 6 小时" />
          <ElOption :value="1440" label="每天" />
        </ElSelect>
        <span class="tip">告警一直未恢复时按此间隔再次通知</span>
      </ElFormItem>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ALERT_CENTER, userLabel } from '../shared'

  const model = defineModel<Api.AlertCenter.RuleNotify>({ required: true })
  const ctx = inject(ALERT_CENTER)!

  /** 选中的用户缺少所选渠道需要的邮箱 / 手机号时提示 */
  const warnings = computed(() => {
    const list: string[] = []
    const chosen = ctx.users.value.filter((user) => model.value.userIds.includes(user.id))
    if (model.value.channels.includes('email')) {
      const missing = chosen.filter((user) => !user.email).map(userLabel)
      if (missing.length) list.push(`${missing.join('、')} 没有邮箱，收不到邮件`)
    }
    if (model.value.channels.includes('sms')) {
      const missing = chosen.filter((user) => !user.phone).map(userLabel)
      if (missing.length) list.push(`${missing.join('、')} 没有手机号，收不到短信`)
    }
    if (!model.value.userIds.length && !model.value.groupIds.length) {
      list.push('请选择通知用户或通知组')
    }
    return list
  })
</script>

<style scoped>
  .tip {
    margin-left: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .option-meta {
    float: right;
    margin-left: 16px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .missing {
    color: var(--el-color-warning);
  }

  .notify-warning {
    width: auto;
    margin: -6px 0 12px 90px;
  }

  .repeat-select {
    width: 140px;
  }
</style>
