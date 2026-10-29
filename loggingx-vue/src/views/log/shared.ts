/**
 * 日志页面共用：级别配色、时间格式、日志库选择（记住上次选择，支持 ?storeId= 指定）
 */
import { fetchGetLogStoreOptions } from '@/api/log'
import './log-levels.css'

export const LOG_LEVELS: Api.Log.Level[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

/** 级别配色类名，配合 log-levels.css 通过 var(--lx-level) 取色 */
export const levelClass = (level: string) => `lx-lv-${level.toLowerCase()}`

/** 需要醒目标出的级别 */
export const isAlertLevel = (level: string) =>
  level === 'WARN' || level === 'ERROR' || level === 'FATAL'

/** 相对时间，如 刚刚 / 5 分钟前 / 3 天前；time 为 yyyy-MM-dd HH:mm:ss[.SSS] */
export const formatRelative = (time: string | null | undefined): string => {
  if (!time) return ''
  const then = new Date(time.replace(' ', 'T')).getTime()
  if (Number.isNaN(then)) return time
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return `${Math.floor(seconds / 86400)} 天前`
}

const STORE_KEY = 'logx-log-store-id'

/**
 * 加载日志库选项并确定当前日志库：URL 的 storeId 参数 > 上次选择 > 第一个启用的日志库。
 * 页面被缓存（keep-alive）时，每次重新进入都会刷新列表，以便看到在日志库管理中新建的日志库。
 */
export function useLogStoreSelection() {
  const route = useRoute()
  const router = useRouter()
  const stores = ref<Api.Log.StoreOption[]>([])
  const storeId = ref<number>()
  const loadingStores = ref(false)
  /** 是否已加载过列表，用于区分「加载中」和「确实没有日志库」 */
  const storesLoaded = ref(false)
  /** 当前用户能否进入日志库管理新建日志库 */
  const canManageStores = computed(() => router.hasRoute('LogStore'))

  const goCreateStore = () => router.push({ name: 'LogStore' })

  const pick = (candidate: unknown) => {
    const id = Number(candidate)
    return stores.value.some((store) => store.storeId === id) ? id : undefined
  }

  const loadStores = async () => {
    loadingStores.value = true
    try {
      stores.value = await fetchGetLogStoreOptions()
      storesLoaded.value = true
    } finally {
      loadingStores.value = false
    }
    let remembered: string | null = null
    try {
      remembered = localStorage.getItem(STORE_KEY)
    } catch {
      // 无法访问本地存储时忽略
    }
    storeId.value =
      pick(route.query.storeId) ??
      pick(storeId.value) ??
      pick(remembered) ??
      stores.value.find((store) => store.enabled)?.storeId ??
      stores.value[0]?.storeId
  }

  watch(storeId, (id) => {
    if (id === undefined) return
    try {
      localStorage.setItem(STORE_KEY, String(id))
    } catch {
      // 无法访问本地存储时忽略
    }
  })

  // 从日志库管理页带参数跳转过来时切换日志库
  watch(
    () => route.query.storeId,
    (id) => {
      const picked = pick(id)
      if (picked !== undefined) storeId.value = picked
    }
  )

  // keep-alive 页面重新进入时刷新（首次进入由页面的 onMounted 加载）
  onActivated(() => {
    if (storesLoaded.value) loadStores()
  })

  return {
    stores,
    storeId,
    loadingStores,
    storesLoaded,
    canManageStores,
    goCreateStore,
    loadStores
  }
}
