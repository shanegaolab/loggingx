import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { logRoutes } from './log'
import { monitorRoutes } from './monitor'
import { alertRoutes } from './alert'
import { aiRoutes } from './ai'
import { backupRoutes } from './backup'
import { systemRoutes } from './system'
import { exceptionRoutes } from './exception'

/**
 * 导出所有模块化路由
 */
export const routeModules: AppRouteRecord[] = [
  dashboardRoutes,
  logRoutes,
  monitorRoutes,
  alertRoutes,
  aiRoutes,
  backupRoutes,
  systemRoutes,
  exceptionRoutes
]
