/**
 * 快速入口配置
 * 包含：应用列表、快速链接等配置
 */
import { WEB_LINKS } from '@/utils/constants'
import type { FastEnterConfig } from '@/types/config'

const fastEnterConfig: FastEnterConfig = {
  // 显示条件（屏幕宽度）
  minWidth: 1200,
  // 应用列表
  applications: [
    {
      name: '工作台',
      description: '系统概览与数据统计',
      icon: 'ri:pie-chart-line',
      iconColor: '#111111',
      enabled: true,
      order: 1,
      routeName: 'Console'
    },
    {
      name: '分析页',
      description: '数据分析与可视化',
      icon: 'ri:game-line',
      iconColor: '#27272A',
      enabled: true,
      order: 2,
      routeName: 'Analysis'
    },
    {
      name: '礼花效果',
      description: '动画特效展示',
      icon: 'ri:loader-line',
      iconColor: '#3F3F46',
      enabled: true,
      order: 3,
      routeName: 'Fireworks'
    },
    {
      name: '聊天',
      description: '即时通讯功能',
      icon: 'ri:user-line',
      iconColor: '#52525B',
      enabled: true,
      order: 4,
      routeName: 'Chat'
    },
    {
      name: '官方文档',
      description: '使用指南与开发文档',
      icon: 'ri:bill-line',
      iconColor: '#71717A',
      enabled: true,
      order: 5,
      link: WEB_LINKS.DOCS
    },
    {
      name: '问题反馈',
      description: '技术支持与问题反馈',
      icon: 'ri:user-location-line',
      iconColor: '#A1A1AA',
      enabled: true,
      order: 6,
      link: WEB_LINKS.COMMUNITY
    },
    {
      name: '更新日志',
      description: '版本更新与变更记录',
      icon: 'ri:gamepad-line',
      iconColor: '#D4D4D8',
      enabled: true,
      order: 7,
      routeName: 'ChangeLog'
    },
    {
      name: 'GitHub',
      description: '源码、问题反馈与更新',
      icon: 'ri:github-line',
      iconColor: '#E4E4E7',
      enabled: true,
      order: 8,
      link: WEB_LINKS.GITHUB
    }
  ],
  // 快速链接
  quickLinks: [
    {
      name: '登录',
      enabled: true,
      order: 1,
      routeName: 'Login'
    },
    {
      name: '注册',
      enabled: true,
      order: 2,
      routeName: 'Register'
    },
    {
      name: '忘记密码',
      enabled: true,
      order: 3,
      routeName: 'ForgetPassword'
    },
    {
      name: '定价',
      enabled: true,
      order: 4,
      routeName: 'Pricing'
    },
    {
      name: '个人中心',
      enabled: true,
      order: 5,
      routeName: 'UserCenter'
    },
    {
      name: '留言管理',
      enabled: true,
      order: 6,
      routeName: 'ArticleComment'
    }
  ]
}

export default Object.freeze(fastEnterConfig)
