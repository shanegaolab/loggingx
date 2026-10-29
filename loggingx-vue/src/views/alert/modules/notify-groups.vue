<!-- 通知组：一组系统用户与外部联系人，供告警规则选择 -->
<template>
  <div class="groups">
    <div class="toolbar">
      <ElButton type="primary" size="small" @click="edit()">
        <LogxSvgIcon icon="ri:add-line" class="mr-1" />新增通知组
      </ElButton>
      <span class="hint"
        >系统用户使用其个人资料中的邮箱、手机号；外部联系人（如值班手机、邮件列表）无需账号</span
      >
    </div>
    <ElTable :data="ctx.groups.value" size="small" class="table" height="100%">
      <template #empty>
        <ElEmpty :image-size="72" description="还没有通知组" />
      </template>
      <ElTableColumn label="名称" min-width="140">
        <template #default="{ row }">
          <div class="name">{{ row.name }}</div>
          <div v-if="row.description" class="muted">{{ row.description }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="用户" min-width="220">
        <template #default="{ row }">
          <template v-if="row.userIds.length">
            <ElTag
              v-for="name in userNames(row.userIds)"
              :key="name"
              size="small"
              type="info"
              class="chip"
              >{{ name }}</ElTag
            >
          </template>
          <span v-else class="muted">-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="外部联系人" min-width="260">
        <template #default="{ row }">
          <div v-for="(contact, i) in row.contacts" :key="i" class="contact">
            <span class="contact__name">{{ contact.name || '未命名' }}</span>
            <span v-if="contact.email" class="muted">{{ contact.email }}</span>
            <span v-if="contact.phone" class="muted">{{ contact.phone }}</span>
          </div>
          <span v-if="!row.contacts.length" class="muted">-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="更新时间" width="170" prop="updateTime" />
      <ElTableColumn label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" size="small" @click="edit(row)">编辑</ElButton>
          <ElButton link type="danger" size="small" @click="remove(row)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog
      v-model="visible"
      :title="editing ? '编辑通知组' : '新增通知组'"
      width="640px"
      align-center
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="form.name" maxlength="64" placeholder="如 订单服务值班" />
        </ElFormItem>
        <ElFormItem label="说明">
          <ElInput v-model="form.description" maxlength="200" />
        </ElFormItem>
        <ElFormItem label="系统用户">
          <ElSelect
            v-model="form.userIds"
            multiple
            filterable
            placeholder="选择用户"
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
                {{ user.email ?? '无邮箱' }} · {{ user.phone ?? '无手机' }}
              </span>
            </ElOption>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="外部联系人">
          <div class="contacts">
            <div v-for="(contact, i) in form.contacts" :key="i" class="contact-row">
              <ElInput v-model="contact.name" placeholder="姓名" class="contact-row__name" />
              <ElInput v-model="contact.email" placeholder="邮箱" />
              <ElInput v-model="contact.phone" placeholder="手机号" class="contact-row__phone" />
              <ElButton link type="danger" @click="form.contacts.splice(i, 1)">
                <LogxSvgIcon icon="ri:delete-bin-line" />
              </ElButton>
            </div>
            <ElButton size="small" @click="form.contacts.push({ name: '', email: '', phone: '' })">
              <LogxSvgIcon icon="ri:add-line" class="mr-1" />添加联系人
            </ElButton>
          </div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submit">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import LogxSvgIcon from '@/components/core/base/logx-svg-icon/index.vue'
  import { ElMessageBox } from 'element-plus'
  import { createNotifyGroup, deleteNotifyGroup, updateNotifyGroup } from '@/api/alert-center'
  import { ALERT_CENTER, userLabel } from '../shared'

  const ctx = inject(ALERT_CENTER)!

  const visible = ref(false)
  const saving = ref(false)
  const editing = ref<Api.AlertCenter.Group>()
  const formRef = ref<FormInstance>()
  const form = reactive<{
    name: string
    description: string
    userIds: number[]
    contacts: Api.AlertCenter.Contact[]
  }>({ name: '', description: '', userIds: [], contacts: [] })

  const emailAddress = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
  const phoneNumber = /^\+?[\d\s()-]{6,20}$/
  const rules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
  }

  const userNames = (ids: number[]) =>
    ids.map((id) => {
      const user = ctx.users.value.find((u) => u.id === id)
      return user ? userLabel(user) : `#${id}`
    })

  const edit = (group?: Api.AlertCenter.Group) => {
    editing.value = group
    Object.assign(form, {
      name: group?.name ?? '',
      description: group?.description ?? '',
      userIds: [...(group?.userIds ?? [])],
      contacts: (group?.contacts ?? []).map((c) => ({ ...c }))
    })
    visible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  const submit = async () => {
    if (!(await formRef.value?.validate().catch(() => false))) return
    const contacts = form.contacts
      .map((c) => ({ name: c.name.trim(), email: c.email.trim(), phone: c.phone.trim() }))
      .filter((c) => c.email || c.phone)
    const invalid = contacts.find(
      (c) => (c.email && !emailAddress.test(c.email)) || (c.phone && !phoneNumber.test(c.phone))
    )
    if (invalid) {
      ElMessage.warning(
        `联系人「${invalid.name || invalid.email || invalid.phone}」的邮箱或手机号格式不正确`
      )
      return
    }
    if (!form.userIds.length && !contacts.length) {
      ElMessage.warning('请至少添加一个用户或联系人')
      return
    }
    const data: Api.AlertCenter.GroupForm = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      userIds: form.userIds,
      contacts
    }
    saving.value = true
    try {
      if (editing.value) await updateNotifyGroup(editing.value.id, data)
      else await createNotifyGroup(data)
      ElMessage.success('已保存')
      visible.value = false
      await ctx.reloadGroups()
    } finally {
      saving.value = false
    }
  }

  const remove = async (group: Api.AlertCenter.Group) => {
    try {
      await ElMessageBox.confirm(
        `删除通知组「${group.name}」？使用它的规则将不再通知该组成员。`,
        '删除通知组',
        { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await deleteNotifyGroup(group.id)
    ElMessage.success('已删除')
    await ctx.reloadGroups()
  }
</script>

<style scoped>
  .groups {
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

  .hint,
  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .hint {
    color: var(--el-text-color-placeholder);
  }

  .name {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .chip {
    margin: 2px 4px 2px 0;
  }

  .contact {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    line-height: 20px;
  }

  .contact__name {
    color: var(--el-text-color-regular);
  }

  .option-meta {
    float: right;
    margin-left: 16px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .contacts {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
    width: 100%;
  }

  .contact-row {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
  }

  .contact-row__name {
    flex: none;
    width: 100px;
  }

  .contact-row__phone {
    flex: none;
    width: 150px;
  }
</style>
