import { AppRouteRecord } from '@/types/router'

export const logRoutes: AppRouteRecord = {
  path: '/log',
  name: 'Log',
  component: '/index/index',
  meta: {
    title: 'menus.log.title',
    icon: 'ri:file-list-3-line',
    roles: ['R_SUPER', 'R_ADMIN', 'R_USER']
  },
  children: [
    {
      path: 'store',
      name: 'LogStore',
      component: '/log/store',
      meta: {
        title: 'menus.log.store',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'query',
      name: 'LogQuery',
      component: '/log/query',
      meta: {
        title: 'menus.log.query',
        keepAlive: true
      }
    },
    {
      // 不缓存：离开页面即断开实时连接
      path: 'tail',
      name: 'LogTail',
      component: '/log/tail',
      meta: {
        title: 'menus.log.tail',
        keepAlive: false
      }
    },
    {
      path: 'agent',
      name: 'LogAgent',
      component: '/log/agent',
      meta: {
        title: 'menus.log.agent',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    }
  ]
}
