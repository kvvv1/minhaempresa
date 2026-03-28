import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'muted' | 'slate'

interface ChatRichTextProps {
  content: string
  tone?: Tone
  compact?: boolean
  className?: string
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'blockquote'; text: string }
  | { type: 'code'; code: string; language?: string }
  | { type: 'divider' }

const TONES = {
  default: {
    text: 'text-foreground/95',
    heading: 'text-foreground',
    border: 'border-border/60',
    surface: 'bg-muted/35',
    header: 'bg-muted/70 text-foreground',
    code: 'bg-background/80 text-foreground',
    quote: 'bg-muted/35 text-muted-foreground',
    quoteBorder: 'border-primary/20',
    link: 'text-primary hover:text-primary/80',
    inlineCode: 'bg-muted px-1.5 py-0.5 text-[0.92em] text-foreground',
  },
  muted: {
    text: 'text-muted-foreground',
    heading: 'text-foreground/90',
    border: 'border-border/50',
    surface: 'bg-muted/25',
    header: 'bg-muted/55 text-foreground/90',
    code: 'bg-background/70 text-foreground/90',
    quote: 'bg-muted/25 text-muted-foreground',
    quoteBorder: 'border-border/70',
    link: 'text-foreground hover:text-primary',
    inlineCode: 'bg-background/80 px-1.5 py-0.5 text-[0.92em] text-foreground/90',
  },
  slate: {
    text: 'text-slate-300',
    heading: 'text-white',
    border: 'border-white/10',
    surface: 'bg-white/5',
    header: 'bg-white/8 text-slate-100',
    code: 'bg-black/30 text-slate-100',
    quote: 'bg-white/5 text-slate-400',
    quoteBorder: 'border-indigo-400/30',
    link: 'text-indigo-300 hover:text-indigo-200',
    inlineCode: 'bg-black/30 px-1.5 py-0.5 text-[0.92em] text-slate-100',
  },
} satisfies Record<
  Tone,
  {
    text: string
    heading: string
    border: string
    surface: string
    header: string
    code: string
    quote: string
    quoteBorder: string
    link: string
    inlineCode: string
  }
>

function splitTableRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

function isTableRow(line: string) {
  if (!line.includes('|')) return false
  return splitTableRow(line).length >= 2
}

function isTableDivider(line: string) {
  return splitTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))
}

function startsNewBlock(line: string, nextLine?: string) {
  return (
    /^#{1,3}\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^```/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line) ||
    (isTableRow(line) && Boolean(nextLine) && isTableDivider(nextLine ?? ''))
  )
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n?/g, '\n').trim().split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (!line) {
      index += 1
      continue
    }

    if (/^```/.test(line)) {
      const language = line.slice(3).trim() || undefined
      const codeLines: string[] = []
      index += 1

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) index += 1
      blocks.push({ type: 'code', code: codeLines.join('\n'), language })
      continue
    }

    if (/^#{1,3}\s+/.test(line)) {
      const [, hashes, text] = line.match(/^(#{1,3})\s+(.*)$/) ?? []
      blocks.push({
        type: 'heading',
        level: (hashes?.length ?? 2) as 1 | 2 | 3,
        text: text?.trim() ?? line,
      })
      index += 1
      continue
    }

    if (isTableRow(line) && index + 1 < lines.length && isTableDivider(lines[index + 1].trim())) {
      const headers = splitTableRow(line)
      const rows: string[][] = []
      index += 2

      while (index < lines.length && isTableRow(lines[index].trim())) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }

      blocks.push({ type: 'table', headers, rows })
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') })
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'unordered-list', items })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'ordered-list', items })
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: 'divider' })
      index += 1
      continue
    }

    const paragraphLines = [rawLine]
    index += 1

    while (index < lines.length) {
      const nextRawLine = lines[index]
      const nextLine = nextRawLine.trim()

      if (!nextLine) {
        index += 1
        break
      }

      if (startsNewBlock(nextLine, lines[index + 1]?.trim())) break

      paragraphLines.push(nextRawLine)
      index += 1
    }

    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n').trim() })
  }

  return blocks
}

function renderInline(line: string, tone: Tone, keyPrefix: string) {
  const styles = TONES[tone]
  const nodes: ReactNode[] = []
  const tokenRegex = /\*\*([^*]+)\*\*|`([^`\n]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let cursor = 0
  let tokenIndex = 0

  for (let match = tokenRegex.exec(line); match; match = tokenRegex.exec(line)) {
    if (match.index > cursor) {
      nodes.push(
        <Fragment key={`${keyPrefix}-plain-${tokenIndex}`}>{line.slice(cursor, match.index)}</Fragment>
      )
    }

    if (match[1]) {
      nodes.push(
        <strong key={`${keyPrefix}-bold-${tokenIndex}`} className="font-semibold">
          {match[1]}
        </strong>
      )
    } else if (match[2]) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${tokenIndex}`}
          className={cn('rounded-md font-mono', styles.inlineCode)}
        >
          {match[2]}
        </code>
      )
    } else if (match[3] && match[4]) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${tokenIndex}`}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className={cn('underline underline-offset-4 transition-colors', styles.link)}
        >
          {match[3]}
        </a>
      )
    }

    cursor = match.index + match[0].length
    tokenIndex += 1
  }

  if (cursor < line.length) {
    nodes.push(<Fragment key={`${keyPrefix}-tail`}>{line.slice(cursor)}</Fragment>)
  }

  return nodes.length ? nodes : [line]
}

function renderText(text: string, tone: Tone, keyPrefix: string) {
  return text.split('\n').map((line, index, arr) => (
    <Fragment key={`${keyPrefix}-line-${index}`}>
      {renderInline(line, tone, `${keyPrefix}-${index}`)}
      {index < arr.length - 1 ? <br /> : null}
    </Fragment>
  ))
}

export function ChatRichText({
  content,
  tone = 'default',
  compact = false,
  className,
}: ChatRichTextProps) {
  const blocks = parseBlocks(content)
  const styles = TONES[tone]

  if (!blocks.length) return null

  return (
    <div
      className={cn(
        'space-y-3 text-sm leading-relaxed',
        styles.text,
        compact && 'space-y-2 text-[13px] leading-6',
        className
      )}
    >
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
          return (
            <Tag
              key={`heading-${index}`}
              className={cn(
                'scroll-m-20 font-semibold tracking-tight',
                styles.heading,
                block.level === 1 && 'text-base',
                block.level === 2 && 'text-sm',
                block.level === 3 && 'text-xs uppercase tracking-[0.16em]'
              )}
            >
              {renderText(block.text, tone, `heading-${index}`)}
            </Tag>
          )
        }

        if (block.type === 'paragraph') {
          return (
            <p key={`paragraph-${index}`} className="leading-relaxed">
              {renderText(block.text, tone, `paragraph-${index}`)}
            </p>
          )
        }

        if (block.type === 'unordered-list') {
          return (
            <ul key={`ul-${index}`} className="ml-5 list-disc space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`ul-${index}-${itemIndex}`}>{renderText(item, tone, `ul-${index}-${itemIndex}`)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={`ol-${index}`} className="ml-5 list-decimal space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`ol-${index}-${itemIndex}`}>{renderText(item, tone, `ol-${index}-${itemIndex}`)}</li>
              ))}
            </ol>
          )
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={`quote-${index}`}
              className={cn(
                'rounded-r-xl border-l-2 px-4 py-2 italic',
                styles.quote,
                styles.quoteBorder
              )}
            >
              {renderText(block.text, tone, `quote-${index}`)}
            </blockquote>
          )
        }

        if (block.type === 'code') {
          return (
            <div key={`code-${index}`} className="space-y-1">
              {block.language ? (
                <p className={cn('text-[11px] uppercase tracking-[0.2em]', styles.heading)}>
                  {block.language}
                </p>
              ) : null}
              <pre
                className={cn(
                  'overflow-x-auto rounded-xl border px-3 py-3 text-[12px] leading-6',
                  styles.code,
                  styles.border
                )}
              >
                <code>{block.code}</code>
              </pre>
            </div>
          )
        }

        if (block.type === 'table') {
          return (
            <div key={`table-${index}`} className="overflow-x-auto">
              <table
                className={cn(
                  'w-full min-w-[320px] table-fixed border-collapse text-left text-xs',
                  styles.border
                )}
              >
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={`table-${index}-head-${headerIndex}`}
                        className={cn(
                          'border px-3 py-2 align-top font-semibold break-words',
                          styles.border,
                          styles.header
                        )}
                      >
                        {renderText(header, tone, `table-${index}-head-${headerIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`table-${index}-row-${rowIndex}`} className={styles.surface}>
                      {block.headers.map((_, cellIndex) => (
                        <td
                          key={`table-${index}-cell-${rowIndex}-${cellIndex}`}
                          className={cn('border px-3 py-2 align-top break-words', styles.border)}
                        >
                          {renderText(row[cellIndex] ?? '', tone, `table-${index}-cell-${rowIndex}-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return <hr key={`divider-${index}`} className={cn('border-t', styles.border)} />
      })}
    </div>
  )
}
