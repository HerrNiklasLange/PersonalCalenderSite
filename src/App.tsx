import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { checkSession, logout as apiLogout } from './lib/api'
import { Shell } from './components/Shell'
import LoginPage from './pages/Login'
import CalendarPage from './pages/Calendar'
import HabitsPage from './pages/Habits'
import TimeBlocksPage from './pages/TimeBlocks'
import NotesPage from './pages/Notes'
import WorkflowPage from './pages/Workflow'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const stored = localStorage.getItem('planner-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('planner-theme', theme)
  }, [theme])

  useEffect(() => {
    checkSession()
      .then(setAuthed)
      .catch(() => setAuthed(false))
  }, [])

  const handleLogout = useCallback(async () => {
    await apiLogout()
    setAuthed(false)
    navigate('/login', { replace: true })
  }, [navigate])

  if (authed === null) {
    return <div className="login-wrap muted">Loading…</div>
  }

  if (!authed) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onSuccess={() => setAuthed(true)} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname }} />} />
      </Routes>
    )
  }

  return (
    <Shell theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} onLogout={handleLogout}>
      <Routes>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/habits" element={<HabitsPage />} />
        <Route path="/blocks" element={<TimeBlocksPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="*" element={<Navigate to="/calendar" replace />} />
      </Routes>
    </Shell>
  )
}
