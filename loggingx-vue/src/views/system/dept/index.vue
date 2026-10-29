<!-- 部门管理页面 -->
<template>
  <div class="dept-page logx-full-height">
    <!-- 搜索栏 -->
    <LogxSearchBar
      v-model="formFilters"
      :items="formItems"
      :showExpand="false"
      @reset="handleReset"
      @search="handleSearch"
    />

    <ElCard class="logx-table-card">
      <LogxTableHeader
        :showZebra="false"
        :loading="loading"
        v-model:columns="columnChecks"
        @refresh="getDeptTree"
      >
        <template #left>
          <ElButton @click="showDialog('add')" v-ripple>新增部门</ElButton>
          <ElButton @click="toggleExpand" v-ripple>
            {{ isExpanded ? '收起' : '展开' }}
          </ElButton>
        </template>
      </LogxTableHeader>

      <LogxTable
        ref="tableRef"
        rowKey="deptId"
        :loading="loading"
        :columns="columns"
        :data="tableData"
        :stripe="false"
        :tree-props="{ children: 'children' }"
        :default-expand-all="true"
      />
    </ElCard>

    <!-- 部门弹窗 -->
    <DeptDialog
      v-model="dialogVisible"
      :dialog-type="dialogType"
      :dept-data="currentDept"
      :parent-id="dialogParentId"
      @success="getDeptTree"
    />
  </div>
</template>

<script setup lang="ts">
  import LogxButtonTable from '@/components/core/forms/logx-button-table/index.vue'
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { fetchDeleteDept, fetchGetDeptTree } from '@/api/system-manage'
  import DeptDialog from './modules/dept-dialog.vue'
  import { ElTag, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Dept' })

  type DeptItem = Api.SystemManage.DeptItem

  const loading = ref(false)
  const isExpanded = ref(true)
  const tableRef = ref()
  const tableData = ref<DeptItem[]>([])

  // 搜索相关
  const initialSearchState: Api.SystemManage.DeptSearchParams = {
    deptName: undefined,
    enabled: undefined
  }
  const formFilters = reactive({ ...initialSearchState })
  const appliedFilters = reactive({ ...initialSearchState })

  const formItems = computed(() => [
    {
      label: '部门名称',
      key: 'deptName',
      type: 'input',
      props: { clearable: true, placeholder: '请输入部门名称' }
    },
    {
      label: '部门状态',
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

  // 弹窗相关
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const currentDept = ref<DeptItem | undefined>(undefined)
  // 新增时的上级部门 ID，0 表示一级部门
  const dialogParentId = ref(0)

  const { columnChecks, columns } = useTableColumns(() => [
    {
      prop: 'deptName',
      label: '部门名称',
      minWidth: 200
    },
    {
      prop: 'sort',
      label: '排序',
      width: 80
    },
    {
      prop: 'leader',
      label: '负责人',
      minWidth: 100
    },
    {
      prop: 'phone',
      label: '联系电话',
      minWidth: 130
    },
    {
      prop: 'email',
      label: '邮箱',
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'enabled',
      label: '状态',
      width: 90,
      formatter: (row: DeptItem) =>
        row.enabled
          ? h(ElTag, { type: 'success' }, () => '启用')
          : h(ElTag, { type: 'info' }, () => '禁用')
    },
    {
      prop: 'createTime',
      label: '创建时间',
      width: 180
    },
    {
      prop: 'operation',
      label: '操作',
      width: 160,
      align: 'right',
      formatter: (row: DeptItem) =>
        h('div', { style: 'text-align: right' }, [
          h(LogxButtonTable, {
            type: 'add',
            title: '新增下级部门',
            onClick: () => showDialog('add', undefined, row.deptId)
          }),
          h(LogxButtonTable, {
            type: 'edit',
            onClick: () => showDialog('edit', row)
          }),
          h(LogxButtonTable, {
            type: 'delete',
            onClick: () => deleteDept(row)
          })
        ])
    }
  ])

  onMounted(() => {
    getDeptTree()
  })

  /**
   * 获取部门树
   */
  const getDeptTree = async (): Promise<void> => {
    loading.value = true
    try {
      tableData.value = await fetchGetDeptTree({ ...appliedFilters })
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (): void => {
    Object.assign(appliedFilters, { ...formFilters })
    getDeptTree()
  }

  const handleReset = (): void => {
    Object.assign(formFilters, { ...initialSearchState })
    Object.assign(appliedFilters, { ...initialSearchState })
    getDeptTree()
  }

  /**
   * 打开新增或编辑弹窗
   * @param type 弹窗类型
   * @param row 编辑的部门
   * @param parentId 新增时的上级部门
   */
  const showDialog = (type: 'add' | 'edit', row?: DeptItem, parentId = 0): void => {
    dialogType.value = type
    currentDept.value = row
    dialogParentId.value = parentId
    dialogVisible.value = true
  }

  const deleteDept = async (row: DeptItem): Promise<void> => {
    if (row.children?.length) {
      ElMessage.warning('请先删除该部门的下级部门')
      return
    }
    try {
      await ElMessageBox.confirm(`确定删除部门"${row.deptName}"吗？此操作不可恢复！`, '删除确认', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    // 接口失败时 http 模块会统一提示错误
    await fetchDeleteDept(row.deptId)
    ElMessage.success('删除成功')
    getDeptTree()
  }

  /**
   * 切换展开/收起所有部门
   */
  const toggleExpand = (): void => {
    isExpanded.value = !isExpanded.value
    nextTick(() => {
      const elTable = tableRef.value?.elTableRef
      if (!elTable) return
      const processRows = (rows: DeptItem[]) => {
        rows.forEach((row) => {
          if (row.children?.length) {
            elTable.toggleRowExpansion(row, isExpanded.value)
            processRows(row.children)
          }
        })
      }
      processRows(tableData.value)
    })
  }
</script>
