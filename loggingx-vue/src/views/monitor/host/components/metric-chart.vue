<!-- 主机指标趋势图：多条折线共用时间轴，点击图表选中时间点（用于查看当时的进程和日志） -->
<template>
  <div class="metric-chart">
    <div class="metric-chart__head">
      <span class="metric-chart__title">{{ title }}</span>
      <span v-if="latestText" class="metric-chart__latest">{{ latestText }}</span>
    </div>
    <div ref="chartRef" class="metric-chart__body"></div>
    <div v-if="empty" class="metric-chart__empty">{{ emptyText }}</div>
  </div>
</template>

<script setup lang="ts">
  import { echarts } from '@/plugins/echarts'
  import type { EChartsOption } from '@/plugins/echarts'
  import { formatAxisTime, formatBytes, formatDateTime, formatPercent } from '../../shared'

  export interface ChartLine {
    name: string
    color: string
    data: [number, number | null][]
    /** 填充面积 */
    area?: boolean
  }

  const props = withDefaults(
    defineProps<{
      title: string
      lines: ChartLine[]
      /** percent：0~100%；rate：字节/秒；number：普通数值 */
      unit: 'percent' | 'rate' | 'number'
      /** 选中的时间点（毫秒），画竖线标记 */
      marked?: number | null
      /** 横轴范围（毫秒），无数据的区段留空 */
      range: [number, number]
      /** 阈值参考线（同单位） */
      threshold?: number | null
      emptyText?: string
    }>(),
    { marked: null, threshold: null, emptyText: '暂无数据' }
  )

  const emit = defineEmits<{ pick: [time: number] }>()

  const chartRef = ref<HTMLElement>()
  let chart: echarts.ECharts | undefined
  let observer: ResizeObserver | undefined

  const empty = computed(() =>
    props.lines.every((line) => line.data.every(([, value]) => value === null))
  )

  const format = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    if (props.unit === 'percent') return formatPercent(value)
    if (props.unit === 'rate') return `${formatBytes(value)}/s`
    return value.toFixed(2)
  }

  /** 每条线的最新值，显示在标题右侧 */
  const latestText = computed(() => {
    const parts = props.lines
      .map((line) => {
        const last = [...line.data].reverse().find(([, value]) => value !== null)
        return last
          ? props.lines.length > 1
            ? `${line.name} ${format(last[1])}`
            : format(last[1])
          : ''
      })
      .filter(Boolean)
    return parts.join('  ')
  })

  const cssVar = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

  const option = (): EChartsOption => {
    const [from, to] = props.range
    const multiDay = to - from > 86_400_000
    const text = cssVar('--el-text-color-secondary', '#999')
    const split = cssVar('--el-border-color-lighter', '#eee')
    return {
      animation: false,
      grid: { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: cssVar('--el-bg-color-overlay', '#fff'),
        borderColor: split,
        textStyle: { color: cssVar('--el-text-color-primary', '#333'), fontSize: 12 },
        formatter: (params: any) => {
          const items = Array.isArray(params) ? params : [params]
          const time = items[0]?.value?.[0]
          const rows = items
            .map(
              (item: any) =>
                `<div style="display:flex;gap:12px;justify-content:space-between"><span>${item.marker}${item.seriesName}</span><b>${format(item.value?.[1])}</b></div>`
            )
            .join('')
          return `<div style="margin-bottom:4px;color:${text}">${time ? formatDateTime(time) : ''}</div>${rows}`
        }
      },
      xAxis: {
        type: 'time',
        min: from,
        max: to,
        axisLine: { lineStyle: { color: split } },
        axisTick: { show: false },
        axisLabel: {
          color: text,
          fontSize: 11,
          hideOverlap: true,
          formatter: (value: number) => formatAxisTime(value, multiDay)
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: props.unit === 'percent' ? 100 : undefined,
        // 百分比固定 0/25/50/75/100，避免顶部刻度重叠
        interval: props.unit === 'percent' ? 25 : undefined,
        splitNumber: 3,
        axisLabel: {
          color: text,
          fontSize: 11,
          formatter: (value: number) =>
            props.unit === 'percent'
              ? `${value}%`
              : props.unit === 'rate'
                ? formatBytes(value, 0)
                : String(value)
        },
        splitLine: { lineStyle: { color: split, type: 'dashed' } }
      },
      series: props.lines.map((line, index) => ({
        name: line.name,
        type: 'line',
        data: line.data,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.5, color: line.color },
        itemStyle: { color: line.color },
        areaStyle: line.area ? { color: line.color, opacity: 0.12 } : undefined,
        markLine:
          index === 0 && (props.marked || props.threshold !== null)
            ? {
                silent: true,
                symbol: 'none',
                label: { show: false },
                data: [
                  ...(props.marked
                    ? [{ xAxis: props.marked, lineStyle: { color: text, type: 'solid' as const } }]
                    : []),
                  ...(props.threshold !== null
                    ? [
                        {
                          yAxis: props.threshold,
                          lineStyle: { color: '#dc2626', type: 'dashed' as const }
                        }
                      ]
                    : [])
                ]
              }
            : undefined
      }))
    }
  }

  const render = () => {
    if (!chart) return
    chart.setOption(option(), { notMerge: true })
  }

  onMounted(() => {
    if (!chartRef.value) return
    chart = echarts.init(chartRef.value)
    render()
    // 点击图表任意位置：按横坐标选中时间点
    chart.getZr().on('click', (event: any) => {
      if (!chart) return
      const point = [event.offsetX, event.offsetY]
      if (!chart.containPixel('grid', point)) return
      const [time] = chart.convertFromPixel('grid', point) as number[]
      if (Number.isFinite(time)) emit('pick', Math.round(time))
    })
    observer = new ResizeObserver(() => chart?.resize())
    observer.observe(chartRef.value)
  })

  watch(() => [props.lines, props.marked, props.range, props.threshold], render, { deep: true })

  onBeforeUnmount(() => {
    observer?.disconnect()
    chart?.dispose()
    chart = undefined
  })
</script>

<style scoped>
  .metric-chart {
    position: relative;
    padding: 12px 14px 8px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .metric-chart__head {
    display: flex;
    gap: 8px;
    align-items: baseline;
    justify-content: space-between;
  }

  .metric-chart__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .metric-chart__latest {
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metric-chart__body {
    height: 170px;
    cursor: crosshair;
  }

  .metric-chart__empty {
    position: absolute;
    inset: 36px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    pointer-events: none;
  }
</style>
