import type { ReactNode } from 'react'

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g

/** Renders inline markdown. Everything is built as React nodes, so no HTML is ever injected. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
    if (link && /^https?:\/\//.test(link[2])) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      )
    }
    return <span key={key}>{part}</span>
  })
}

/** A deliberately small markdown subset: headings, lists, task lists, and inline marks. */
export function renderMarkdown(source: string): ReactNode[] {
  const out: ReactNode[] = []
  let list: ReactNode[] = []

  const flushList = () => {
    if (!list.length) return
    out.push(<ul key={`ul-${out.length}`}>{list}</ul>)
    list = []
  }

  source.split('\n').forEach((raw, index) => {
    const line = raw.trimEnd()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      flushList()
      const Tag = (['h1', 'h2', 'h3'] as const)[heading[1].length - 1]
      out.push(<Tag key={index}>{inline(heading[2], String(index))}</Tag>)
      return
    }

    const task = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    if (task) {
      list.push(
        <li key={index} className="task">
          <input type="checkbox" readOnly checked={task[1].toLowerCase() === 'x'} style={{ width: 14, height: 14, minHeight: 0, marginRight: 6 }} />
          {inline(task[2], String(index))}
        </li>,
      )
      return
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      list.push(<li key={index}>{inline(bullet[1], String(index))}</li>)
      return
    }

    flushList()
    if (!line.trim()) return
    out.push(<p key={index}>{inline(line, String(index))}</p>)
  })

  flushList()
  return out
}
