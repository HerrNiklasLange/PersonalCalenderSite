import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export const NAV_ITEMS = [
  { to: '/blocks', label: 'This week', short: 'Week', glyph: '⏱️' },
  { to: '/calendar', label: 'Calendar', short: 'Calendar', glyph: '🗓️' },
  { to: '/habits', label: 'Habits', short: 'Habits', glyph: '🔥' },
  { to: '/notes', label: 'Notes', short: 'Notes', glyph: '📝' },
  { to: '/workflow', label: 'Workflow', short: 'Flow', glyph: '🗂️' },
]

export function Shell({
  theme,
  onToggleTheme,
  onLogout,
  children,
}: {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onLogout: () => void
  children: ReactNode
}) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="dot" />
          Planner
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className="navlink">
            <span className="glyph" aria-hidden="true">
              {item.glyph}
            </span>
            {item.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <button className="btn ghost" onClick={onToggleTheme} style={{ justifyContent: 'flex-start' }}>
            <span className="glyph" aria-hidden="true">
              {theme === 'dark' ? '☀️' : '🌙'}
            </span>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button className="btn ghost" onClick={onLogout} style={{ justifyContent: 'flex-start' }}>
            <span className="glyph" aria-hidden="true">
              ⏻
            </span>
            Log out
          </button>
        </div>
      </aside>

      <div className="main">{children}</div>

      <nav className="tabbar">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to}>
            <span className="glyph" aria-hidden="true">
              {item.glyph}
            </span>
            {item.short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="topbar no-print">
      <h1>{title}</h1>
      <div className="spacer" />
      {children}
    </div>
  )
}
