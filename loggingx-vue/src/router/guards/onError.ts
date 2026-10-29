/**
 * 路由导航错误处理
 *
 * 页面组件是按需加载的。新版本部署后旧标签页请求的文件已不存在，或开发服务器异常（如依赖重装后未重启）时，
 * 加载页面代码会失败，路由随之中止，表现为点击菜单页面不切换且没有任何提示。
 * 这里在页面代码加载失败时整页刷新到目标页面以加载最新代码；短时间内再次失败则提示用户，避免反复刷新。
 *
 * @module router/guards/onError
 */
import type { Router } from 'vue-router'
import NProgress from 'nprogress'
import { ElMessage } from 'element-plus'
import { loadingService } from '@/utils/ui'
import { getPendingLoading, resetPendingLoading } from './beforeEach'

const RELOAD_KEY = 'logx-chunk-reload-at'
/** 两次自动刷新的最小间隔，防止刷新后仍失败时陷入循环 */
const RELOAD_INTERVAL = 10_000

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk .+ failed/i

function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR.test(error.message)
}

/** 距上次自动刷新超过间隔时记录本次并返回 true */
function claimReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    if (Date.now() - last < RELOAD_INTERVAL) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // 无法访问会话存储时仍允许刷新
  }
  return true
}

/** 页面代码加载失败：刷新到目标地址，否则提示 */
function reloadOrNotify(href?: string) {
  if (claimReload()) {
    if (href) window.location.replace(href)
    window.location.reload()
    return
  }
  ElMessage.error('页面加载失败，请检查网络或刷新页面后重试')
}

export function setupErrorHandler(router: Router): void {
  router.onError((error, to) => {
    NProgress.done()
    if (getPendingLoading()) {
      loadingService.hideLoading()
      resetPendingLoading()
    }

    if (isChunkLoadError(error)) {
      console.warn('[Router] 页面代码加载失败，刷新页面以加载最新代码:', error)
      reloadOrNotify(router.resolve(to.fullPath).href)
      return
    }
    console.error('[Router] 路由导航失败:', error)
  })

  // 预加载的依赖（如页面样式）加载失败时 Vite 触发此事件
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    console.warn('[Router] 预加载资源失败，刷新页面以加载最新代码:', event)
    reloadOrNotify()
  })
}
