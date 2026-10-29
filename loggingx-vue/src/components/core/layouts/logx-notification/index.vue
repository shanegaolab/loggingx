<!-- 通知面板：AI 诊断和正在告警的告警 -->
<template>
  <div
    class="logx-notification-panel logx-card-sm !shadow-xl"
    :style="{
      transform: show ? 'scaleY(1)' : 'scaleY(0.9)',
      opacity: show ? 1 : 0
    }"
    v-show="visible"
    @click.stop
  >
    <div class="flex-cb px-3.5 mt-3.5">
      <span class="text-base font-medium text-g-800">{{ $t('notice.title') }}</span>
      <button
        type="button"
        class="text-xs text-g-800 px-1.5 py-1 c-p select-none rounded hover:bg-g-200 read-button"
        :disabled="!unread"
        @click="markRead"
      >
        {{ $t('notice.btnRead') }}
      </button>
    </div>

    <ul class="box-border flex items-end w-full h-12.5 px-3.5 border-b-d">
      <li
        v-for="(bar, index) in bars"
        :key="bar.key"
        class="h-12 leading-12 mr-5 overflow-hidden text-[13px] text-g-700 c-p select-none"
        :class="{ 'bar-active': barActiveIndex === index }"
        @click="barActiveIndex = index"
      >
        {{ bar.name }} ({{ bar.list.length }})
      </li>
    </ul>

    <div class="w-full h-[calc(100%-95px)]">
      <div class="h-[calc(100%-60px)] overflow-y-scroll scrollbar-thin">
        <ul>
          <li
            v-for="item in currentList"
            :key="`${item.type}-${item.id}`"
            class="box-border flex-c px-3.5 py-3 c-p last:border-b-0 hover:bg-g-200/60"
            @click="open(item)"
          >
            <div
              class="notice-icon size-9 rounded-lg flex-cc"
              :class="`notice-icon--${iconOf(item).tone}`"
            >
              <LogxSvgIcon class="text-lg !bg-transparent" :icon="iconOf(item).icon" />
            </div>
            <div class="w-[calc(100%-45px)] ml-3.5 min-w-0">
              <h4 class="notice-title text-sm font-normal leading-5.5 text-g-900">
                <span v-if="item.unread" class="unread-dot" aria-label="未读"></span
                >{{ item.title }}
              </h4>
              <p class="notice-detail mt-0.5 text-xs text-g-600">{{ item.detail }}</p>
              <p class="mt-1 text-xs text-g-500">{{ item.timeText }}</p>
            </div>
          </li>
        </ul>

        <!-- 空状态 -->
        <div
          v-show="!currentList.length"
          class="relative top-25 h-full text-g-500 text-center !bg-transparent"
        >
          <LogxSvgIcon icon="system-uicons:inbox" class="text-5xl" />
          <p class="mt-3.5 text-xs !bg-transparent">{{ bars[barActiveIndex]?.empty }}</p>
        </div>
      </div>

      <div class="relative box-border w-full px-3.5">
        <ElButton
          class="w-full mt-3"
          :disabled="!bars[barActiveIndex]?.route"
          @click="viewAll"
          v-ripple
        >
          {{ $t('notice.viewAll') }}
        </ElButton>
      </div>
    </div>

    <div class="h-25"></div>
  </div>
</template>

<script setup lang="ts">
  import { useNotices } from '@/hooks/core/useNotices'

  defineOptions({ name: 'LogxNotification' })

  const props = defineProps<{
    value: boolean
  }>()

  const emit = defineEmits<{
    'update:value': [value: boolean]
  }>()

  const router = useRouter()
  const { items, unread, load, markRead } = useNotices()

  const show = ref(false)
  const visible = ref(false)
  const barActiveIndex = ref(0)

  const bars = computed(() => {
    const list: {
      key: string
      name: string
      list: Api.Notice.Item[]
      empty: string
      route?: string
    }[] = []
    if (router.hasRoute('AiDiagnosis')) {
      list.push({
        key: 'ai',
        name: 'AI 诊断',
        list: items.value.filter((item) => item.type === 'ai'),
        empty: '近 7 天没有待处理的 AI 诊断',
        route: 'AiDiagnosis'
      })
    }
    list.push({
      key: 'alert',
      name: '告警中',
      list: items.value.filter((item) => item.type !== 'ai'),
      empty: '当前没有告警',
      route: router.hasRoute('AlertEvent') ? 'AlertEvent' : undefined
    })
    return list
  })

  const currentList = computed(() => bars.value[barActiveIndex.value]?.list ?? [])

  const iconOf = (item: Api.Notice.Item) => {
    if (item.type === 'ai') return { icon: 'ri:robot-2-line', tone: 'ai' }
    if (item.type === 'log') return { icon: 'ri:file-warning-line', tone: item.level }
    return { icon: 'ri:server-line', tone: item.level }
  }

  const close = () => emit('update:value', false)

  const open = (item: Api.Notice.Item) => {
    close()
    if (item.type === 'ai') {
      router.push({ name: 'AiDiagnosis', query: { id: item.id } })
    } else if (router.hasRoute('AlertEvent')) {
      router.push({ name: 'AlertEvent' })
    } else if (router.hasRoute('HostMonitor')) {
      router.push({ name: 'HostMonitor' })
    }
  }

  const viewAll = () => {
    const route = bars.value[barActiveIndex.value]?.route
    if (!route) return
    close()
    router.push({ name: route })
  }

  const showNotice = (open: boolean) => {
    if (open) {
      load()
      visible.value = true
      setTimeout(() => {
        show.value = true
      }, 5)
    } else {
      show.value = false
      setTimeout(() => {
        visible.value = false
      }, 350)
    }
  }

  watch(
    () => props.value,
    (newValue) => {
      showNotice(newValue)
    }
  )
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  .logx-notification-panel {
    @apply absolute
    top-14.5
    right-5
    w-90
    h-125
    overflow-hidden
    transition-all
    duration-300
    origin-top
    will-change-[top,left]
    max-[640px]:top-[65px]
    max-[640px]:right-0
    max-[640px]:w-full
    max-[640px]:h-[80vh];
  }

  .bar-active {
    color: var(--theme-color) !important;
    border-bottom: 2px solid var(--theme-color);
  }

  .read-button {
    background: transparent;
    border: 0;
  }

  .read-button:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .notice-icon {
    flex: none;
  }

  .notice-icon--ai {
    color: #7c3aed;
    background: color-mix(in srgb, #7c3aed 12%, transparent);
  }

  .notice-icon--critical {
    color: var(--el-color-danger);
    background: color-mix(in srgb, var(--el-color-danger) 12%, transparent);
  }

  .notice-icon--warning,
  .notice-icon--info {
    color: var(--el-color-warning);
    background: color-mix(in srgb, var(--el-color-warning) 14%, transparent);
  }

  .notice-title,
  .notice-detail {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .unread-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    vertical-align: middle;
    background: var(--el-color-danger);
    border-radius: 50%;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 5px !important;
  }

  .dark .scrollbar-thin::-webkit-scrollbar-track {
    background-color: var(--default-box-color);
  }

  .dark .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: var(--logx-gray-400) !important;
  }
</style>
