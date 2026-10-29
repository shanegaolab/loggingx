import request from '@/utils/http'

/** 工作台概览；hours 为 1 / 6 / 24 / 168 */
export function fetchDashboardOverview(hours: number) {
  return request.get<Api.Dashboard.Overview>({
    url: '/api/dashboard/overview',
    params: { hours }
  })
}
