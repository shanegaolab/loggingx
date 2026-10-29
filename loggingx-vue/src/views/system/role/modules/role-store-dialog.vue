<!-- 角色可访问的日志库：全部，或勾选的部分日志库 -->
<template>
  <ElDialog
    v-model="visible"
    :title="`日志库权限 · ${roleData?.roleName ?? ''}`"
    width="560px"
    align-center
  >
    <div v-loading="loading" class="store-scope">
      <ElAlert
        v-if="roleData?.roleCode === 'R_SUPER'"
        type="info"
        :closable="false"
        show-icon
        title="超级管理员始终可以访问全部日志库"
      />
      <template v-else>
        <ElRadioGroup v-model="allStores" class="scope-mode">
          <ElRadio :value="true">全部日志库</ElRadio>
          <ElRadio :value="false">指定日志库</ElRadio>
        </ElRadioGroup>
        <p class="hint">
          {{
            allStores
              ? '包括以后新建的日志库。'
              : '该角色的用户只能在日志查询、实时日志、采集 Agent、主机监控、告警中心、备份管理和仪表盘中看到勾选的日志库；新建和删除日志库需要「全部日志库」。'
          }}
        </p>
        <div v-if="!allStores" class="store-list">
          <ElCheckboxGroup v-model="storeIds">
            <ElCheckbox
              v-for="store in options"
              :key="store.id"
              :value="store.id"
              class="store-item"
            >
              <span>{{ store.name }}</span>
              <span class="store-code">{{ store.code }}</span>
            </ElCheckbox>
          </ElCheckboxGroup>
          <ElEmpty v-if="!options.length" :image-size="60" description="没有可分配的日志库" />
        </div>
      </template>
    </div>
    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton
        type="primary"
        :loading="saving"
        :disabled="roleData?.roleCode === 'R_SUPER'"
        @click="save"
        >保存</ElButton
      >
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import {
    fetchGetRoleLogStores,
    fetchGetRoleStoreOptions,
    fetchSaveRoleLogStores
  } from '@/api/system-manage'

  const props = defineProps<{ roleData?: Api.SystemManage.RoleListItem }>()
  const emit = defineEmits<{ success: [] }>()
  const visible = defineModel<boolean>({ default: false })

  const loading = ref(false)
  const saving = ref(false)
  const allStores = ref(true)
  const storeIds = ref<number[]>([])
  const options = ref<{ id: number; code: string; name: string }[]>([])

  watch(visible, async (open) => {
    if (!open || !props.roleData) return
    loading.value = true
    try {
      const [scope, list] = await Promise.all([
        fetchGetRoleLogStores(props.roleData.roleId),
        fetchGetRoleStoreOptions()
      ])
      options.value = list
      allStores.value = scope.allStores
      storeIds.value = [...scope.storeIds]
    } finally {
      loading.value = false
    }
  })

  const save = async () => {
    if (!props.roleData) return
    if (!allStores.value && !storeIds.value.length) {
      ElMessage.warning('请至少勾选一个日志库，或选择「全部日志库」')
      return
    }
    saving.value = true
    try {
      await fetchSaveRoleLogStores(props.roleData.roleId, {
        allStores: allStores.value,
        storeIds: allStores.value ? [] : storeIds.value
      })
      ElMessage.success('已保存，该角色的用户刷新页面后生效')
      visible.value = false
      emit('success')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .store-scope {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 80px;
  }

  .hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .store-list {
    max-height: 320px;
    padding: 8px 12px;
    overflow: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .store-item {
    display: flex;
    width: 100%;
    margin-right: 0;
  }

  .store-code {
    margin-left: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
