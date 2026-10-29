/**
 * 顶栏通知：AI 诊断与告警中的告警。全局共享一份数据，页面可见时每分钟刷新一次。
 */
import { fetchNotices, readNotices } from '@/api/ai-diagnosis'

const items = ref<Api.Notice.Item[]>([])
const unread = ref(0)
const loading = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
let users = 0

const load = async () => {
  loading.value = true
  try {
    const result = await fetchNotices()
    items.value = result.items
    unread.value = result.unread
  } catch {
    // 通知只是辅助信息，拉取失败时保留上一次的结果
  } finally {
    loading.value = false
  }
}

const markRead = async () => {
  await readNotices()
  unread.value = 0
  items.value = items.value.map((item) => ({ ...item, unread: false }))
}

export function useNotices() {
  onMounted(() => {
    users++
    if (users === 1) {
      load()
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') load()
      }, 60_000)
    }
  })
  onBeforeUnmount(() => {
    users--
    if (users === 0) clearInterval(timer)
  })
  return { items, unread, loading, load, markRead }
}
