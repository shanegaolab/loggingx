import { AppRouteRecord } from '@/types/router'

/** AI 运维：智能问答、诊断、错误归类、知识库与设置 */
export const aiRoutes: AppRouteRecord = {
  path: '/ai',
  name: 'AiOps',
  component: '/index/index',
  meta: {
    title: 'menus.ai.title',
    icon: 'ri:robot-2-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'chat',
      name: 'AiChat',
      component: '/ai/chat',
      meta: { title: 'menus.ai.chat', keepAlive: true }
    },
    {
      path: 'diagnosis',
      name: 'AiDiagnosis',
      component: '/ai/diagnosis',
      meta: { title: 'menus.ai.diagnosis', keepAlive: true }
    },
    {
      path: 'error-groups',
      name: 'AiErrorGroup',
      component: '/ai/error-group',
      meta: { title: 'menus.ai.errorGroup', keepAlive: true }
    },
    {
      path: 'knowledge',
      name: 'AiKnowledge',
      component: '/ai/knowledge',
      meta: { title: 'menus.ai.knowledge', keepAlive: true }
    },
    {
      path: 'settings',
      name: 'AiSettings',
      component: '/ai/settings',
      meta: { title: 'menus.ai.settings', keepAlive: true }
    }
  ]
}
