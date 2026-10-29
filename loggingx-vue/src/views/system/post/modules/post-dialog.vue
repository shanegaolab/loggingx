<template>
  <ElDialog
    v-model="visible"
    :title="dialogType === 'add' ? '新增岗位' : '编辑岗位'"
    width="480px"
    align-center
    @close="handleClose"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="岗位编码" prop="postCode">
        <ElInput v-model="form.postCode" placeholder="请输入岗位编码" maxlength="64" />
      </ElFormItem>
      <ElFormItem label="岗位名称" prop="postName">
        <ElInput v-model="form.postName" placeholder="请输入岗位名称" maxlength="50" />
      </ElFormItem>
      <ElFormItem label="适用部门" prop="deptIds">
        <ElTreeSelect
          v-model="form.deptIds"
          :data="deptTree"
          :props="{ label: 'deptName', children: 'children' }"
          node-key="deptId"
          multiple
          show-checkbox
          check-strictly
          default-expand-all
          clearable
          :render-after-expand="false"
          placeholder="不选表示适用全部部门"
        />
        <div class="mt-1 text-xs leading-4 text-g-500">选中部门的下级部门也可使用该岗位</div>
      </ElFormItem>
      <ElFormItem label="排序" prop="sort">
        <ElInputNumber v-model="form.sort" :min="0" :max="9999" controls-position="right" />
      </ElFormItem>
      <ElFormItem label="备注" prop="remark">
        <ElInput
          v-model="form.remark"
          type="textarea"
          :rows="3"
          maxlength="200"
          placeholder="请输入备注"
        />
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
  import { fetchCreatePost, fetchGetDeptOptions, fetchUpdatePost } from '@/api/system-manage'

  type PostListItem = Api.SystemManage.PostListItem

  interface Props {
    modelValue: boolean
    dialogType: 'add' | 'edit'
    postData?: PostListItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    dialogType: 'add',
    postData: undefined
  })

  const emit = defineEmits<Emits>()

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const deptTree = ref<Api.SystemManage.DeptItem[]>([])

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  const createEmptyForm = (): Api.SystemManage.PostForm => ({
    postCode: '',
    postName: '',
    sort: 0,
    enabled: true,
    remark: '',
    deptIds: []
  })

  const form = reactive<Api.SystemManage.PostForm>(createEmptyForm())

  const rules = reactive<FormRules>({
    postCode: [
      { required: true, message: '请输入岗位编码', trigger: 'blur' },
      { max: 64, message: '长度不能超过 64 个字符', trigger: 'blur' }
    ],
    postName: [
      { required: true, message: '请输入岗位名称', trigger: 'blur' },
      { max: 50, message: '长度不能超过 50 个字符', trigger: 'blur' }
    ]
  })

  watch(
    () => props.modelValue,
    (newVal) => {
      if (newVal) {
        initForm()
        fetchGetDeptOptions().then((depts) => (deptTree.value = depts))
      }
    }
  )

  const initForm = () => {
    if (props.dialogType === 'edit' && props.postData) {
      const { postCode, postName, sort, enabled, remark, deptIds } = props.postData
      Object.assign(form, {
        postCode,
        postName,
        sort,
        enabled,
        remark: remark ?? '',
        deptIds: [...(deptIds ?? [])]
      })
    } else {
      Object.assign(form, createEmptyForm())
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
        await fetchCreatePost(payload)
      } else if (props.postData) {
        await fetchUpdatePost(props.postData.postId, payload)
      }
      ElMessage.success(props.dialogType === 'add' ? '新增成功' : '修改成功')
      emit('success')
      handleClose()
    } finally {
      submitting.value = false
    }
  }
</script>
