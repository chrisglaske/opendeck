import { useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { isSafeHref } from '../../model/sanitize'
import { resolveColor, textStyleOf } from '../../model/theme'
import type { Theme } from '../../model/theme'
import type { Paragraph, Run, TextEl } from '../../model/types'
import { useAutoFit } from '../useAutoFit'
import { boxStyle, effectStyle } from './box'
import s from '../SlideView.module.css'

/** Font size scaled by the auto-fit multiplier set on the text box. */
const fitSize = (px: number) => `calc(${px}px * var(--fit, 1))`

/** Box and base typography of a text element; shared with the text editor. */
export function textBoxStyle(el: TextEl, theme: Theme): CSSProperties {
  const t = textStyleOf(el, theme)
  return {
    ...boxStyle(el),
    fontFamily: t.fontFamily,
    fontSize: fitSize(t.size),
    fontWeight: t.weight,
    lineHeight: t.lineHeight,
    letterSpacing: `${t.letterSpacing}em`,
    color: t.color,
  }
}

export function runStyle(run: Run, baseWeight: number): CSSProperties {
  return {
    fontWeight: run.bold ? Math.max(700, baseWeight) : undefined,
    fontStyle: run.italic ? 'italic' : undefined,
    textDecoration: run.underline ? 'underline' : undefined,
    color: run.color ? resolveColor(run.color) : undefined,
    fontSize: run.size ? fitSize(run.size) : undefined,
  }
}

function Runs({ p, baseWeight }: { p: Paragraph; baseWeight: number }) {
  const hasText = p.runs.some((r) => r.text.length > 0)
  if (!hasText) return <br />
  return p.runs.map((r, i) => {
    const span = <span key={i} data-r={i} style={runStyle(r, baseWeight)}>{r.text}</span>
    // Links were checked on the way in; checking again here keeps a bad href from ever rendering.
    return r.href && isSafeHref(r.href) ? (
      <a key={i} className={s.link} href={r.href} rel="noopener noreferrer" target="_blank">{span}</a>
    ) : span
  })
}

/**
 * Paragraphs as <p>, with each run of consecutive bullet paragraphs grouped into one <ul>.
 * `data-p` holds the paragraph index and `data-r` the run index, which the text editor uses to map the caret.
 */
export function renderParagraphs(paragraphs: Paragraph[], baseWeight: number): ReactNode[] {
  const out: ReactNode[] = []
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (p.list === 'bullet') {
      const start = i
      const items: ReactNode[] = []
      while (i < paragraphs.length && paragraphs[i].list === 'bullet') {
        const q = paragraphs[i]
        items.push(<li key={i} data-p={i} style={{ textAlign: q.align }}><Runs p={q} baseWeight={baseWeight} /></li>)
        i++
      }
      i--
      out.push(<ul key={`u${start}`} className={s.list}>{items}</ul>)
    } else {
      out.push(<p key={i} data-p={i} className={s.para} style={{ textAlign: p.align }}><Runs p={p} baseWeight={baseWeight} /></p>)
    }
  }
  return out
}

export function TextView({ el, theme }: { el: TextEl; theme: Theme }) {
  const ref = useRef<HTMLDivElement>(null)
  const t = textStyleOf(el, theme)
  const fit = useAutoFit(ref, [el.paragraphs, el.w, el.h, t.fontFamily, t.size, t.lineHeight, t.letterSpacing, theme.fonts], el.autoFit)
  return (
    <div
      ref={ref}
      className={`${s.el} ${s.text}`}
      data-el-id={el.id}
      style={{ ...textBoxStyle(el, theme), ...effectStyle(el), ['--fit' as string]: String(fit) }}
    >
      {renderParagraphs(el.paragraphs, t.weight)}
    </div>
  )
}
