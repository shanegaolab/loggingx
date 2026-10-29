/** AI 诊断各页签共用的文案 */

export const TRIGGER_NAMES: Record<Api.AiDiagnosis.Trigger, string> = {
  auto: '新错误',
  alert: '告警触发',
  manual: '手动'
}

export const REVIEW_NAMES: Record<Api.AiDiagnosis.ReviewState, string> = {
  open: '待处理',
  resolved: '已处理',
  ignored: '已忽略'
}

export const STATUS_NAMES: Record<Api.AiDiagnosis.Status, string> = {
  pending: '排队中',
  running: '分析中',
  success: '已完成',
  failed: '失败'
}

export const CONFIDENCE: Record<string, { label: string; type: 'success' | 'warning' | 'info' }> = {
  high: { label: '把握较大', type: 'success' },
  medium: { label: '有一定把握', type: 'warning' },
  low: { label: '仅供参考', type: 'info' }
}

export const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude'
}

/** 统一 diff 的每一行及其类型，用于着色 */
export function diffLines(
  diff: string
): { text: string; kind: 'add' | 'del' | 'hunk' | 'file' | 'ctx' }[] {
  return diff.split('\n').map((text) => ({
    text,
    kind:
      text.startsWith('+++') || text.startsWith('---')
        ? 'file'
        : text.startsWith('@@')
          ? 'hunk'
          : text.startsWith('+')
            ? 'add'
            : text.startsWith('-')
              ? 'del'
              : 'ctx'
  }))
}
