<!-- 日志量趋势：按级别堆叠的柱状图，错误级别在最上方，一眼看出错误突增的时段 -->
<template>
  <div ref="chartRef" class="log-trend"></div>
</template>

<script setup lang="ts">
  import { echarts } from '@/plugins/echarts'
  import type { EChartsOption } from '@/plugins/echarts'
  import { LOG_LEVELS } from '@/views/log/shared'
  import { levelColor } from '../shared'

  const props = defineProps<{
    series: Api.Dashboard.Logs['series']
    bucketMillis: number
  }>()
  const emit = defineEmits<{ pick: [from: number, to: number] }>()

  const chartRef = ref<HTMLElement>()
  let chart: echarts.ECharts | undefined
  let observer: ResizeObserver | undefined

  const cssVar = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

  const pad = (n: number) => String(n).padStart(2, '0')
  const label = (time: number) => {
    const date = new Date(time)
    const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
    return props.bucketMillis >= 6 * 3_600_000
      ? `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hm}`
      : hm
  }

  const option = (): EChartsOption => {
    const text = cssVar('--el-text-color-secondary', '#999')
    const split = cssVar('--el-border-color-lighter', '#eee')
    // 只画出现过的级别，INFO 在下、FATAL 在上
    const levels = LOG_LEVELS.filter((level) => props.series.some((point) => point.levels[level]))
    return {
      animationDuration: 400,
      grid: { left: 8, right: 8, top: 36, bottom: 4, containLabel: true },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        icon: 'roundRect',
        textStyle: { color: text, fontSize: 12 }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        backgroundColor: cssVar('--el-bg-color-overlay', '#fff'),
        borderColor: split,
        textStyle: { color: cssVar('--el-text-color-primary', '#333'), fontSize: 12 },
        formatter: (params: any) => {
          const items = (Array.isArray(params) ? params : [params]).filter(
            (item: any) => item.value
          )
          const total = items.reduce((sum: number, item: any) => sum + item.value, 0)
          const time =
            props.series[items[0]?.dataIndex ?? (Array.isArray(params) ? params[0]?.dataIndex : 0)]
              ?.time
          const rows = [...items]
            .reverse()
            .map(
              (item: any) =>
                `<div style="display:flex;gap:16px;justify-content:space-between"><span>${item.marker}${item.seriesName}</span><b>${item.value.toLocaleString()}</b></div>`
            )
            .join('')
          return `<div style="margin-bottom:4px;color:${text}">${time ? label(time) : ''} · 共 ${total.toLocaleString()} 条</div>${rows}<div style="margin-top:4px;color:${text};font-size:11px">点击查看该时段日志</div>`
        }
      },
      xAxis: {
        type: 'category',
        data: props.series.map((point) => label(point.time)),
        axisLine: { lineStyle: { color: split } },
        axisTick: { show: false },
        axisLabel: { color: text, fontSize: 11, hideOverlap: true }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitNumber: 4,
        axisLabel: { color: text, fontSize: 11 },
        splitLine: { lineStyle: { color: split, type: 'dashed' } }
      },
      series: levels.map((level) => ({
        name: level,
        type: 'bar',
        stack: 'logs',
        barMaxWidth: 28,
        itemStyle: { color: levelColor(level) },
        emphasis: { focus: 'series' },
        data: props.series.map((point) => point.levels[level] ?? 0)
      }))
    }
  }

  const render = () => chart?.setOption(option(), { notMerge: true })

  onMounted(() => {
    if (!chartRef.value) return
    chart = echarts.init(chartRef.value)
    render()
    chart.on('click', (params: any) => {
      const point = props.series[params.dataIndex]
      if (point) emit('pick', point.time, point.time + props.bucketMillis)
    })
    observer = new ResizeObserver(() => chart?.resize())
    observer.observe(chartRef.value)
  })

  watch(() => [props.series, props.bucketMillis], render, { deep: true })

  onBeforeUnmount(() => {
    observer?.disconnect()
    chart?.dispose()
  })
</script>

<style scoped>
  .log-trend {
    width: 100%;
    height: 280px;
  }
</style>
