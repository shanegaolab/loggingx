/**
 * 轻量 Markdown 渲染：用于 AI 回答。先转义全部 HTML，再处理代码块、标题、列表、粗体、行内代码和链接，
 * 不会把模型输出的 HTML 原样插入页面。引用标记 [n] 渲染为可点击的上标。
 *
 * @module utils/markdown
 */

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(\d{1,2})\](?!\()/g, '<sup class="md-cite" data-ref="$1">[$1]</sup>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let list: 'ul' | 'ol' | null = null
  let code: string[] | null = null
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`)
    paragraph = []
  }
  const closeList = () => {
    if (list) html.push(`</${list}>`)
    list = null
  }

  for (const line of lines) {
    if (code) {
      if (line.trim().startsWith('```')) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
        code = null
      } else {
        code.push(line)
      }
      continue
    }
    if (line.trim().startsWith('```')) {
      flushParagraph()
      closeList()
      code = []
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      closeList()
      const level = Math.min(heading[1].length + 2, 6)
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
    } else if (bullet || numbered) {
      flushParagraph()
      const kind = bullet ? 'ul' : 'ol'
      if (list !== kind) {
        closeList()
        html.push(`<${kind}>`)
        list = kind
      }
      html.push(`<li>${inline((bullet ?? numbered)![1])}</li>`)
    } else if (!line.trim()) {
      flushParagraph()
      closeList()
    } else {
      closeList()
      paragraph.push(line)
    }
  }
  if (code) html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  flushParagraph()
  closeList()
  return html.join('')
}
