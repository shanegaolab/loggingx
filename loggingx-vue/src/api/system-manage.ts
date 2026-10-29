import request from '@/utils/http'
import { AppRouteRecord } from '@/types/router'

// ---------------- 用户管理 ----------------

// 获取用户列表
export function fetchGetUserList(params: Api.SystemManage.UserSearchParams) {
  return request.get<Api.SystemManage.UserList>({
    url: '/api/user/list',
    params
  })
}

// 新增用户
export function fetchCreateUser(data: Api.SystemManage.UserForm) {
  return request.post<Api.SystemManage.UserListItem>({
    url: '/api/user',
    data
  })
}

// 编辑用户
export function fetchUpdateUser(id: number, data: Api.SystemManage.UserForm) {
  return request.put<Api.SystemManage.UserListItem>({
    url: `/api/user/${id}`,
    data
  })
}

// 删除用户
export function fetchDeleteUser(id: number) {
  return request.del<void>({
    url: `/api/user/${id}`
  })
}

// ---------------- 角色管理 ----------------

// 获取角色列表
export function fetchGetRoleList(params: Api.SystemManage.RoleSearchParams) {
  return request.get<Api.SystemManage.RoleList>({
    url: '/api/role/list',
    params
  })
}

// 获取所有启用的角色（用于下拉选择）
export function fetchGetRoleOptions() {
  return request.get<Api.SystemManage.RoleListItem[]>({
    url: '/api/role/options'
  })
}

// 新增角色
export function fetchCreateRole(data: Api.SystemManage.RoleForm) {
  return request.post<Api.SystemManage.RoleListItem>({
    url: '/api/role',
    data
  })
}

// 编辑角色
export function fetchUpdateRole(id: number, data: Api.SystemManage.RoleForm) {
  return request.put<Api.SystemManage.RoleListItem>({
    url: `/api/role/${id}`,
    data
  })
}

// 删除角色
export function fetchDeleteRole(id: number) {
  return request.del<void>({
    url: `/api/role/${id}`
  })
}

// 获取角色已分配的菜单和按钮 ID
export function fetchGetRoleMenuIds(id: number) {
  return request.get<number[]>({
    url: `/api/role/${id}/menus`
  })
}

// 保存角色的菜单权限
export function fetchSaveRoleMenuIds(id: number, menuIds: number[]) {
  return request.put<void>({
    url: `/api/role/${id}/menus`,
    data: { menuIds }
  })
}

// 角色可访问的日志库
export function fetchGetRoleLogStores(id: number) {
  return request.get<Api.SystemManage.RoleStoreScope>({
    url: `/api/role/${id}/log-stores`
  })
}

// 保存角色可访问的日志库
export function fetchSaveRoleLogStores(id: number, data: Api.SystemManage.RoleStoreScope) {
  return request.put<Api.SystemManage.RoleStoreScope>({
    url: `/api/role/${id}/log-stores`,
    data
  })
}

// 当前用户可分配的日志库（只能分配自己能访问的）
export function fetchGetRoleStoreOptions() {
  return request.get<{ id: number; code: string; name: string }[]>({
    url: '/api/role/log-store-options'
  })
}

// ---------------- 部门管理 ----------------

// 获取部门树（按名称、状态筛选时保留匹配部门的上级部门）
export function fetchGetDeptTree(params?: Api.SystemManage.DeptSearchParams) {
  return request.get<Api.SystemManage.DeptItem[]>({
    url: '/api/dept/tree',
    params
  })
}

// 获取完整部门树（含停用部门），供用户弹窗等选择器使用，用户管理权限即可访问
export function fetchGetDeptOptions() {
  return request.get<Api.SystemManage.DeptItem[]>({
    url: '/api/dept/options'
  })
}

// 新增部门
export function fetchCreateDept(data: Api.SystemManage.DeptForm) {
  return request.post<Api.SystemManage.DeptItem>({
    url: '/api/dept',
    data
  })
}

// 编辑部门
export function fetchUpdateDept(id: number, data: Api.SystemManage.DeptForm) {
  return request.put<Api.SystemManage.DeptItem>({
    url: `/api/dept/${id}`,
    data
  })
}

// 删除部门（存在下级部门或用户时不可删除）
export function fetchDeleteDept(id: number) {
  return request.del<void>({
    url: `/api/dept/${id}`
  })
}

// ---------------- 岗位管理 ----------------

// 获取岗位列表
export function fetchGetPostList(params: Api.SystemManage.PostSearchParams) {
  return request.get<Api.SystemManage.PostList>({
    url: '/api/post/list',
    params
  })
}

// 获取全部岗位（含停用岗位），供用户弹窗等选择器使用，用户管理权限即可访问
export function fetchGetPostOptions() {
  return request.get<Api.SystemManage.PostListItem[]>({
    url: '/api/post/options'
  })
}

// 新增岗位
export function fetchCreatePost(data: Api.SystemManage.PostForm) {
  return request.post<Api.SystemManage.PostListItem>({
    url: '/api/post',
    data
  })
}

// 编辑岗位
export function fetchUpdatePost(id: number, data: Api.SystemManage.PostForm) {
  return request.put<Api.SystemManage.PostListItem>({
    url: `/api/post/${id}`,
    data
  })
}

// 删除岗位
export function fetchDeletePost(id: number) {
  return request.del<void>({
    url: `/api/post/${id}`
  })
}

// ---------------- 菜单管理 ----------------

// 获取当前用户的菜单（后端权限模式下用于生成路由）
export function fetchGetMenuList() {
  return request.get<AppRouteRecord[]>({
    url: '/api/menu/routes'
  })
}

// 获取完整菜单树（含禁用菜单和全部按钮，用于菜单管理和角色授权）
export function fetchGetMenuTree() {
  return request.get<AppRouteRecord[]>({
    url: '/api/menu/tree'
  })
}

// 新增菜单或按钮，返回新记录 ID
export function fetchCreateMenu(data: Api.SystemManage.MenuForm) {
  return request.post<number>({
    url: '/api/menu',
    data
  })
}

// 编辑菜单或按钮
export function fetchUpdateMenu(id: number, data: Api.SystemManage.MenuForm) {
  return request.put<void>({
    url: `/api/menu/${id}`,
    data
  })
}

// 删除菜单（连同子菜单和按钮）或按钮
export function fetchDeleteMenu(id: number) {
  return request.del<void>({
    url: `/api/menu/${id}`
  })
}
