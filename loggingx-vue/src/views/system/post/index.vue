<!-- 岗位管理页面 -->
<template>
  <div class="logx-full-height">
    <PostSearch
      v-show="showSearchBar"
      v-model="searchForm"
      @search="handleSearch"
      @reset="resetSearchParams"
    />

    <ElCard class="logx-table-card" :style="{ 'margin-top': showSearchBar ? '12px' : '0' }">
      <LogxTableHeader
        v-model:columns="columnChecks"
        v-model:showSearchBar="showSearchBar"
        :loading="loading"
        @refresh="refreshData"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton @click="showDialog('add')" v-ripple>新增岗位</ElButton>
          </ElSpace>
        </template>
      </LogxTableHeader>

      <LogxTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <PostDialog
      v-model="dialogVisible"
      :dialog-type="dialogType"
      :post-data="currentPost"
      @success="refreshData"
    />
  </div>
</template>

<script setup lang="ts">
  import LogxButtonTable from '@/components/core/forms/logx-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchDeletePost, fetchGetPostList } from '@/api/system-manage'
  import PostSearch from './modules/post-search.vue'
  import PostDialog from './modules/post-dialog.vue'
  import { ElTag, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Post' })

  type PostListItem = Api.SystemManage.PostListItem

  const searchForm = ref<Api.SystemManage.PostSearchParams>({
    postCode: undefined,
    postName: undefined,
    enabled: undefined
  })

  const showSearchBar = ref(false)
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const currentPost = ref<PostListItem | undefined>(undefined)

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    replaceSearchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: fetchGetPostList,
      apiParams: {
        current: 1,
        size: 20
      },
      columnsFactory: () => [
        { prop: 'postId', label: '岗位ID', width: 100 },
        { prop: 'postCode', label: '岗位编码', minWidth: 120 },
        { prop: 'postName', label: '岗位名称', minWidth: 120 },
        { prop: 'sort', label: '排序', width: 80 },
        {
          prop: 'enabled',
          label: '状态',
          width: 100,
          formatter: (row) =>
            row.enabled
              ? h(ElTag, { type: 'success' }, () => '启用')
              : h(ElTag, { type: 'warning' }, () => '禁用')
        },
        {
          prop: 'deptNames',
          label: '适用部门',
          minWidth: 150,
          showOverflowTooltip: true,
          formatter: (row) => (row.deptNames?.length ? row.deptNames.join('、') : '全部部门')
        },
        { prop: 'remark', label: '备注', minWidth: 150, showOverflowTooltip: true },
        { prop: 'createTime', label: '创建日期', width: 180, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row) =>
            h('div', [
              h(LogxButtonTable, { type: 'edit', onClick: () => showDialog('edit', row) }),
              h(LogxButtonTable, { type: 'delete', onClick: () => deletePost(row) })
            ])
        }
      ]
    }
  })

  const showDialog = (type: 'add' | 'edit', row?: PostListItem) => {
    dialogType.value = type
    currentPost.value = row
    dialogVisible.value = true
  }

  const handleSearch = (params: Api.SystemManage.PostSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const deletePost = async (row: PostListItem) => {
    try {
      await ElMessageBox.confirm(`确定删除岗位"${row.postName}"吗？此操作不可恢复！`, '删除确认', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await fetchDeletePost(row.postId)
    ElMessage.success('删除成功')
    refreshData()
  }
</script>
