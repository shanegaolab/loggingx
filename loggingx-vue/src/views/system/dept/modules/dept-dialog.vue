<template>
  <ElDialog
    v-model="visible"
    :title="dialogType === 'add' ? '新增部门' : '编辑部门'"
    width="520px"
    align-center
    @close="handleClose"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="上级部门" prop="parentId">
        <ElTreeSelect
          v-model="form.parentId"
          :data="parentOptions"
          :props="{ label: 'deptName', children: 'children', disabled: 'disabled' }"
          node-key="deptId"
          check-strictly
          default-expand-all
          :render-after-expand="false"
          placeholder="请选择上级部门"
          style="width: 100%"
        />
      </ElFormItem>
      <ElFormItem label="部门名称" prop="deptName">
        <ElInput v-model="form.deptName" placeholder="请输入部门名称" maxlength="30" />
      </ElFormItem>
      <ElFormItem label="排序" prop="sort">
        <ElInputNumber v-model="form.sort" :min="0" :max="9999" controls-position="right" />
      </ElFormItem>
      <ElFormItem label="负责人" prop="leader">
        <ElInput v-model="form.leader" placeholder="请输入负责人" maxlength="20" />
      </ElFormItem>
      <ElFormItem label="联系电话" prop="phone">
        <ElInput v-model="form.phone" placeholder="请输入联系电话" maxlength="20" />
      </ElFormItem>
      <ElFormItem label="邮箱" prop="email">
        <ElInput v-model="form.email" placeholder="请输入邮箱" maxlength="50" />
      </ElFormItem>
      <ElFormItem label="启用">
        <ElSwitch v-model="form.enabled" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">提交</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { fetchCreateDept, fetchGetDeptTree, fetchUpdateDept } from '@/api/system-manage'

  type DeptItem = Api.SystemManage.DeptItem
  type DeptOption = {
    deptId: number
    deptName: string
    disabled?: boolean
    children?: DeptOption[]
  }

  interface Props {
    modelValue: boolean
    dialogType: 'add' | 'edit'
    deptData?: DeptItem
    /** 新增时预选的上级部门 */
    parentId?: number
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    dialogType: 'add',
    deptData: undefined,
    parentId: 0
  })

  const emit = defineEmits<Emits>()

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  const createEmptyForm = (): Api.SystemManage.DeptForm => ({
    parentId: 0,
    deptName: '',
    sort: 0,
    leader: '',
    phone: '',
    email: '',
    enabled: true
  })

  const form = reactive<Api.SystemManage.DeptForm>(createEmptyForm())

  // 完整部门树（不受列表筛选影响），打开弹窗时加载
  const deptTree = ref<DeptItem[]>([])

  /**
   * 上级部门选项：顶部加入"顶级部门"，编辑时禁用自身及其下级，防止形成循环
   */
  const parentOptions = computed<DeptOption[]>(() => {
    const editingId = props.dialogType === 'edit' ? props.deptData?.deptId : undefined
    const convert = (items: DeptItem[], disabled: boolean): DeptOption[] =>
      items.map((item) => {
        const selfDisabled = disabled || item.deptId === editingId
        return {
          deptId: item.deptId,
          deptName: item.deptName,
          disabled: selfDisabled,
          children: item.children?.length ? convert(item.children, selfDisabled) : undefined
        }
      })
    return [{ deptId: 0, deptName: '顶级部门', children: convert(deptTree.value, false) }]
  })

  const rules = reactive<FormRules>({
    parentId: [{ required: true, message: '请选择上级部门', trigger: 'change' }],
    deptName: [
      { required: true, message: '请输入部门名称', trigger: 'blur' },
      { max: 30, message: '长度不能超过 30 个字符', trigger: 'blur' }
    ],
    phone: [{ pattern: /^[0-9+\-\s]*$/, message: '请输入正确的联系电话', trigger: 'blur' }],
    email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }]
  })

  watch(
    () => props.modelValue,
    (newVal) => {
      if (newVal) {
        initForm()
        loadDeptTree()
      }
    }
  )

  const loadDeptTree = async () => {
    deptTree.value = await fetchGetDeptTree()
  }

  const initForm = () => {
    if (props.dialogType === 'edit' && props.deptData) {
      const { parentId, deptName, sort, leader, phone, email, enabled } = props.deptData
      Object.assign(form, {
        parentId,
        deptName,
        sort,
        leader: leader ?? '',
        phone: phone ?? '',
        email: email ?? '',
        enabled
      })
    } else {
      Object.assign(form, createEmptyForm(), { parentId: props.parentId })
    }
    nextTick(() => formRef.value?.clearValidate())
  }

  const handleClose = () => {
    visible.value = false
    formRef.value?.resetFields()
  }

  const handleSubmit = async () => {
    if (!formRef.value) return
    try {
      await formRef.value.validate()
    } catch {
      return
    }

    submitting.value = true
    try {
      const payload = { ...form }
      if (props.dialogType === 'add') {
        await fetchCreateDept(payload)
      } else if (props.deptData) {
        await fetchUpdateDept(props.deptData.deptId, payload)
      }
      ElMessage.success(props.dialogType === 'add' ? '新增成功' : '修改成功')
      emit('success')
      handleClose()
    } finally {
      submitting.value = false
    }
  }
</script>
