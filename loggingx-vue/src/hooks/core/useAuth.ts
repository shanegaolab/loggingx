/**
 * useAuth - 权限验证管理
 *
 * 提供统一的权限验证功能，支持前端和后端两种权限模式。
 * 用于控制页面按钮、操作等功能的显示和访问权限。
 *
 * ## 主要功能
 *
 * 1. 权限检查 - 检查用户是否拥有指定的权限标识
 * 2. 双模式支持 - 自动适配前端模式和后端模式的权限验证
 * 3. 前端模式 - 从用户信息中获取按钮权限列表（如 ['add', 'edit', 'delete']）
 * 4. 后端模式 - 从路由 meta 配置中获取权限列表（如 [{ authMark: 'add' }]）
 *
 * ## 使用示例
 *
 * ```typescript
 * const { hasAuth } = useAuth()
 *
 * // 检查是否有新增权限
 * if (hasAuth('add')) {
 *   // 显示新增按钮
 * }
 *
 * // 在模板中使用
 * <el-button v-if="hasAuth('edit')">编辑</el-button>
 * <el-button v-if="hasAuth('delete')">删除</el-button>
 * ```
 *
 * @module useAuth
 * @author LoggingX Team
 */

import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { useAppMode } from '@/hooks/core/useAppMode'
import type { AppRouteRecord } from '@/types/router'

type AuthItem = NonNullable<AppRouteRecord['meta']['authList']>[number]

/**
 * 权限判断
 * - 前端模式：读取用户信息中的按钮权限 info.buttons
 * - 后端模式：读取路由 meta.authList
 *
 * 每次调用都实时读取 store / 路由，在模板或 computed 中使用时会自动随权限变化更新
 * @param auth 权限标识
 * @param routeAuthList 当前路由 meta.authList
 */
export function checkAuth(auth: string, routeAuthList: unknown): boolean {
  const { isFrontendMode } = useAppMode()

  // 前端模式
  if (isFrontendMode.value) {
    const buttons = useUserStore().info?.buttons ?? []
    return buttons.includes(auth)
  }

  // 后端模式
  if (!Array.isArray(routeAuthList)) return false
  return (routeAuthList as AuthItem[]).some((item) => item?.authMark === auth)
}

export const useAuth = () => {
  const route = useRoute()

  /**
   * 检查是否拥有某权限
   * @param auth 权限标识
   */
  const hasAuth = (auth: string): boolean => checkAuth(auth, route.meta.authList)

  return {
    hasAuth
  }
}
