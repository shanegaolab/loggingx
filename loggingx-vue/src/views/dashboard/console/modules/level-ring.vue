<!-- 日志级别分布：环形图，中心显示总量 -->
<template>
  <div class="level-ring">
    <div ref="chartRef" class="level-ring__chart"></div>
    <div class="level-ring__legend">
      <div v-for="item in items" :key="item.level" class="legend-item">
        <i class="legend-item__dot" :style="{ background: item.color }"></i>
        <span class="legend-item__name">{{ item.level }}</span>
        <span class="legend-item__count">{{ item.count.toLocaleString() }}</span>
        <span class="legend-item__share">{{ item.share }}</span>
      </div>
      <div v-if="!items.length" class="empty">暂无日志</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { echarts } from '@/plugins/echarts'
  import { LOG_LEVELS } from '@/views/log/shared'
  import { compactNumber, levelColor } from '../shared'

  const props = defineProps<{ levels: Api.Dashboard.Logs['levels'] }>()

  const chartRef = ref<HTMLElement>()
  let chart: echarts.ECharts | undefined
  let observer: ResizeObserver | undefined

  const total = computed(() =>
    Object.values(props.levels).reduce((sum, count) => sum + (count ?? 0), 0)
  )

  const items = computed(() =>
    [...LOG_LEVELS]
      .reverse()
      .filter((level) => props.levels[level])
      .map((level) => {
        const count = props.levels[level] ?? 0
        const percent = total.value ? (count * 100) / total.value : 0
        return {
          level,
          count,
          color: levelColor(level),
          share: percent >= 1 || percent === 0 ? `${percent.toFixed(0)}%` : '<1%'
        }
      })
  )

  const render = () => {
    if (!chart) return
    const text = getComputedStyle(document.documentElement)
      .getPropertyValue('--el-text-color-primary')
      .trim()
    const muted = getComputedStyle(document.documentElement)
      .getPropertyValue('--el-text-color-secondary')
      .trim()
    chart.setOption(
      {
        animationDuration: 400,
        title: {
          text: compactNumber(total.value),
          subtext: '条日志',
          left: 'center',
          top: '38%',
          textStyle: { fontSize: 20, fontWeight: 600, color: text },
          subtextStyle: { fontSize: 12, color: muted },
          itemGap: 4
        },
        tooltip: { trigger: 'item', formatter: '{b}：{c} 条（{d}%）', confine: true },
        series: [
          {
            type: 'pie',
            radius: ['62%', '86%'],
            avoidLabelOverlap: false,
            label: { show: false },
            itemStyle: { borderColor: 'transparent', borderWidth: 2 },
            data: items.value.length
              ? items.value.map((item) => ({
                  name: item.level,
                  value: item.count,
                  itemStyle: { color: item.color }
                }))
              : [
                  {
                    name: '无',
                    value: 1,
                    itemStyle: { color: 'rgba(148,163,184,0.2)' },
                    tooltip: { show: false }
                  }
                ]
          }
        ]
      },
      { notMerge: true }
    )
  }

  onMounted(() => {
    if (!chartRef.value) return
    chart = echarts.init(chartRef.value)
    render()
    observer = new ResizeObserver(() => chart?.resize())
    observer.observe(chartRef.value)
  })

  watch(() => props.levels, render, { deep: true })

  onBeforeUnmount(() => {
    observer?.disconnect()
    chart?.dispose()
  })
</script>

<style scoped>
  .level-ring {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .level-ring__chart {
    flex: none;
    width: 170px;
    height: 170px;
  }

  .level-ring__legend {
    flex: 1;
    min-width: 0;
  }

  .legend-item {
    display: grid;
    grid-template-columns: 10px 1fr auto 40px;
    gap: 8px;
    align-items: center;
    padding: 5px 0;
    font-size: 12px;
  }

  .legend-item + .legend-item {
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .legend-item__dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .legend-item__name {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .legend-item__count {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--el-text-color-regular);
  }

  .legend-item__share {
    color: var(--el-text-color-secondary);
    text-align: right;
  }

  .empty {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
</style>
