import { useEffect, type ReactNode } from 'react'
import { PALETTE } from '../lib/types'
import type { SaveState } from '../lib/useDoc'

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="btn ghost sm icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="color-picker">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Colour ${color}`}
          aria-pressed={value === color}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
}

export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span className="save-pill" data-state={state} aria-live="polite">
      {SAVE_LABEL[state]}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
