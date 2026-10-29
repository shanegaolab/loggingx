<template>
  <LogxSearchBar
    v-model="formData"
    :items="formItems"
    :showExpand="false"
    @reset="emit('reset')"
    @search="emit('search', formData)"
  />
</template>

<script setup lang="ts">
  type PostSearchParams = Api.SystemManage.PostSearchParams

  interface Props {
    modelValue: PostSearchParams
  }

  interface Emits {
    (e: 'update:modelValue', value: PostSearchParams): void
    (e: 'search', params: PostSearchParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const formItems = computed(() => [
    {
      label: '岗位编码',
      key: 'postCode',
      type: 'input',
      placeholder: '请输入岗位编码',
      clearable: true
    },
    {
      label: '岗位名称',
      key: 'postName',
      type: 'input',
      placeholder: '请输入岗位名称',
      clearable: true
    },
    {
      label: '岗位状态',
      key: 'enabled',
      type: 'select',
      props: {
        placeholder: '请选择状态',
        clearable: true,
        options: [
          { label: '启用', value: true },
          { label: '禁用', value: false }
        ]
      }
    }
  ])
</script>
