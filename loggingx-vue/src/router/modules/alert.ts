import { AppRouteRecord } from '@/types/router'

/** 告警中心：告警事件、告警规则、通知管理 */
export const alertRoutes: AppRouteRecord = {
  path: '/alert',
  name: 'AlertCenter',
  component: '/index/index',
  meta: {
    title: 'menus.alert.title',
    icon: 'ri:alarm-warning-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'events',
      name: 'AlertEvent',
      component: '/alert/events',
      meta: { title: 'menus.alert.events', keepAlive: true }
    },
    {
      path: 'rules',
      name: 'HostAlert',
      component: '/alert/rules',
      meta: { title: 'menus.alert.rules', keepAlive: true }
    },
    {
      path: 'notify',
      name: 'AlertNotify',
      component: '/alert/notify',
      meta: { title: 'menus.alert.notify', keepAlive: true }
    }
  ]
}
