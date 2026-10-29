<template>
  <ElDialog
    v-model="visible"
    title="菜单权限"
    width="520px"
    align-center
    class="el-dialog-border"
    @close="handleClose"
  >
    <ElScrollbar height="70vh" v-loading="loading">
      <ElTree
        ref="treeRef"
        :data="processedMenuList"
        show-checkbox
        node-key="id"
        :default-expand-all="isExpandAll"
        :props="defaultProps"
        @check="handleTreeCheck"
      >
        <template #default="{ data }">
          <div style="display: flex; align-items: center">
            <span v-if="data.isAuth">
              {{ data.label }}
            </span>
            <span v-else>{{ defaultProps.label(data) }}</span>
          </div>
        </template>
      </ElTree>
    </ElScrollbar>
    <template #footer>
      <ElButton @click="outputSelectedData" style="margin-left: 8px">获取选中数据</ElButton>

      <ElButton @click="toggleExpandAll">{{ isExpandAll ? '全部收起' : '全部展开' }}</ElButton>
      <ElButton @click="toggleSelectAll" style="margin-left: 8px">{{
        isSelectAll ? '取消全选' : '全部选择'
      }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="savePermission">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchGetMenuTree, fetchGetRoleMenuIds, fetchSaveRoleMenuIds } from '@/api/system-manage'
  import type { AppRouteRecord } from '@/types/router'
  import { formatMenuTitle } from '@/utils/router'

  type RoleListItem = Api.SystemManage.RoleListItem

  interface Props {
    modelValue: boolean
    roleData?: RoleListItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    roleData: undefined
  })

  const emit = defineEmits<Emits>()

  const menuTree = ref<AppRouteRecord[]>([])
  const treeRef = ref()
  const loading = ref(false)
  const saving = ref(false)
  const isExpandAll = ref(true)
  const isSelectAll = ref(false)

  /**
   * 弹窗显示状态双向绑定
   */
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  /**
   * 菜单节点类型
   */
  interface MenuNode {
    id?: number
    name?: string
    label?: string
    isAuth?: boolean
    meta?: {
      title?: string
      authList?: Array<{
        id: number
        authMark: string
        title: string
      }>
    }
    children?: MenuNode[]
    [key: string]: any
  }

  /**
   * 处理菜单数据，将 authList 转换为树形子节点
   * 菜单和按钮在后端共用同一 ID 序列，因此直接用 id 作为树节点 key
   */
  const processedMenuList = computed(() => {
    const processNode = (node: MenuNode): MenuNode => {
      const processed: MenuNode = { ...node }
      const children = (node.children ?? []).map(processNode)

      // 如果有 authList，将其转换为子节点
      const authNodes: MenuNode[] = (node.meta?.authList ?? []).map((auth) => ({
        id: auth.id,
        label: auth.title,
        authMark: auth.authMark,
        isAuth: true
      }))

      const allChildren = [...children, ...authNodes]
      processed.children = allChildren.length ? allChildren : undefined
      return processed
    }

    return (menuTree.value as MenuNode[]).map(processNode)
  })

  /**
   * 树形组件配置
   */
  const defaultProps = {
    children: 'children',
    label: (data: any) => formatMenuTitle(data.meta?.title) || data.label || ''
  }

  /**
   * 监听弹窗打开，加载菜单树和角色已有权限
   */
  watch(
    () => props.modelValue,
    (newVal) => {
      if (newVal && props.roleData) {
        loadPermission(props.roleData.roleId)
      }
    }
  )

  /**
   * 加载菜单树和角色已分配的菜单
   * 只勾选叶子节点：父节点的勾选/半勾选状态由 ElTree 根据子节点自动推导，
   * 否则勾选父节点会把它下面的所有子节点一起勾上
   */
  const loadPermission = async (roleId: number) => {
    loading.value = true
    try {
      const [tree, menuIds] = await Promise.all([fetchGetMenuTree(), fetchGetRoleMenuIds(roleId)])
      menuTree.value = tree
      await nextTick()

      const leafIds = new Set(getLeafNodeKeys(processedMenuList.value))
      treeRef.value?.setCheckedKeys(menuIds.filter((id) => leafIds.has(id)))
      handleTreeCheck()
    } finally {
      loading.value = false
    }
  }

  /**
   * 关闭弹窗并清空选中状态
   */
  const handleClose = () => {
    visible.value = false
    treeRef.value?.setCheckedKeys([])
  }

  /**
   * 保存权限配置
   * 同时提交半选中的父级菜单，保证子菜单在后端路由中有可挂载的父级
   */
  const savePermission = async () => {
    const tree = treeRef.value
    if (!tree || !props.roleData) return

    const menuIds: number[] = [...tree.getCheckedKeys(), ...tree.getHalfCheckedKeys()]
    saving.value = true
    try {
      await fetchSaveRoleMenuIds(props.roleData.roleId, menuIds)
      ElMessage.success('权限保存成功')
      emit('success')
      handleClose()
    } finally {
      saving.value = false
    }
  }

  /**
   * 切换全部展开/收起状态
   */
  const toggleExpandAll = () => {
    const tree = treeRef.value
    if (!tree) return

    const nodes = tree.store.nodesMap
    // 这里保留 any，因为 Element Plus 的内部节点类型较复杂
    Object.values(nodes).forEach((node: any) => {
      node.expanded = !isExpandAll.value
    })

    isExpandAll.value = !isExpandAll.value
  }

  /**
   * 切换全选/取消全选状态
   */
  const toggleSelectAll = () => {
    const tree = treeRef.value
    if (!tree) return

    if (!isSelectAll.value) {
      tree.setCheckedKeys(getAllNodeKeys(processedMenuList.value))
    } else {
      tree.setCheckedKeys([])
    }

    isSelectAll.value = !isSelectAll.value
  }

  /**
   * 递归获取所有节点的 key
   * @param nodes 节点列表
   * @returns 所有节点的 key 数组
   */
  const getAllNodeKeys = (nodes: MenuNode[]): number[] => {
    const keys: number[] = []
    const traverse = (nodeList: MenuNode[]): void => {
      nodeList.forEach((node) => {
        if (node.id !== undefined) keys.push(node.id)
        if (node.children?.length) traverse(node.children)
      })
    }
    traverse(nodes)
    return keys
  }

  /**
   * 递归获取所有叶子节点的 key
   */
  const getLeafNodeKeys = (nodes: MenuNode[]): number[] => {
    const keys: number[] = []
    const traverse = (nodeList: MenuNode[]): void => {
      nodeList.forEach((node) => {
        if (node.children?.length) traverse(node.children)
        else if (node.id !== undefined) keys.push(node.id)
      })
    }
    traverse(nodes)
    return keys
  }

  /**
   * 处理树节点选中状态变化
   * 同步更新全选按钮状态
   */
  const handleTreeCheck = () => {
    const tree = treeRef.value
    if (!tree) return

    const checkedKeys = tree.getCheckedKeys()
    const allKeys = getAllNodeKeys(processedMenuList.value)

    isSelectAll.value = checkedKeys.length === allKeys.length && allKeys.length > 0
  }

  /**
   * 输出选中的权限数据到控制台
   * 用于调试和查看当前选中的权限配置
   */
  const outputSelectedData = () => {
    const tree = treeRef.value
    if (!tree) return

    const selectedData = {
      checkedKeys: tree.getCheckedKeys(),
      halfCheckedKeys: tree.getHalfCheckedKeys(),
      checkedNodes: tree.getCheckedNodes(),
      halfCheckedNodes: tree.getHalfCheckedNodes(),
      totalChecked: tree.getCheckedKeys().length,
      totalHalfChecked: tree.getHalfCheckedKeys().length
    }

    console.log('=== 选中的权限数据 ===', selectedData)
    ElMessage.success(`已输出选中数据到控制台，共选中 ${selectedData.totalChecked} 个节点`)
  }
</script>
