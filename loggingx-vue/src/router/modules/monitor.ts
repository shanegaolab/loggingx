import { AppRouteRecord } from '@/types/router'

export const monitorRoutes: AppRouteRecord = {
  path: '/monitor',
  name: 'Monitor',
  component: '/index/index',
  meta: {
    title: 'menus.monitor.title',
    icon: 'ri:pulse-line',
    roles: ['R_SUPER', 'R_ADMIN', 'R_USER']
  },
  children: [
    {
      path: 'host',
      name: 'HostMonitor',
      component: '/monitor/host',
      meta: {
        title: 'menus.monitor.host',
        keepAlive: true
      }
    }
  ]
}
