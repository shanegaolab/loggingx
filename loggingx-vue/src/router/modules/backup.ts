import { AppRouteRecord } from '@/types/router'

/** 备份管理：归档策略、归档记录 */
export const backupRoutes: AppRouteRecord = {
  path: '/backup',
  name: 'Backup',
  component: '/index/index',
  meta: {
    title: 'menus.backup.title',
    icon: 'ri:archive-drawer-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'policies',
      name: 'LogBackup',
      component: '/backup/policies',
      meta: { title: 'menus.backup.policies', keepAlive: true }
    },
    {
      path: 'archives',
      name: 'BackupArchive',
      component: '/backup/archives',
      meta: { title: 'menus.backup.archives', keepAlive: true }
    }
  ]
}
