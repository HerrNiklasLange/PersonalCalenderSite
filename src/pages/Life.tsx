import { useMemo, useState } from 'react'
import { TopBar } from '../components/Shell'
import { Empty, SaveIndicator, Segmented } from '../components/ui'
import { useDoc } from '../lib/useDoc'
import { emptyLife, type LifeDoc } from '../lib/types'

type Granularity = 'days' | 'weeks' | 'months' | 'years'

const DAY_MS = 86400000
const TARGET_AGE = 100

const CELL_SIZE: Record<Granularity, number> = { days: 4, weeks: 7, months: 11, years: 18 }
const UNIT_LABEL: Record<Granularity, string> = { days: 'days', weeks: 'weeks', months: 'months', years: 'years' }

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate())
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS)
}

function monthsBetween(a: Date, b: Date): number {
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months -= 1
  return months
}

function yearsBetween(a: Date, b: Date): number {
  let years = b.getFullYear() - a.getFullYear()
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) years -= 1
  return years
}

function unitsBetween(granularity: Granularity, a: Date, b: Date): number {
  if (granularity === 'days') return daysBetween(a, b)
  if (granularity === 'weeks') return Math.floor(daysBetween(a, b) / 7)
  if (granularity === 'months') return monthsBetween(a, b)
  return yearsBetween(a, b)
}

export default function LifePage() {
  const { data, update, error, saveState } = useDoc<LifeDoc>('life', emptyLife)
  const [granularity, setGranularity] = useState<Granularity>('months')
  const [editingBirth, setEditingBirth] = useState(false)
  const [draftBirth, setDraftBirth] = useState('')

  const today = useMemo(() => startOfDay(new Date()), [])
  const birth = data?.birthDate ? parseLocalDate(data.birthDate) : null
  const target = birth ? addYears(birth, TARGET_AGE) : null

  const countdown = useMemo(() => {
    if (!target) return null
    const days = Math.max(0, daysBetween(today, target))
    return {
      days,
      weeks: Math.floor(days / 7),
      months: Math.max(0, monthsBetween(today, target)),
      years: Math.max(0, yearsBetween(today, target)),
    }
  }, [today, target])

  const grid = useMemo(() => {
    if (!birth || !target) return null
    const total = Math.max(0, unitsBetween(granularity, birth, target))
    const elapsed = Math.min(total, Math.max(0, unitsBetween(granularity, birth, today)))
    return { total, elapsed, remaining: total - elapsed }
  }, [birth, target, today, granularity])

  function startEdit() {
    setDraftBirth(data?.birthDate ?? '')
    setEditingBirth(true)
  }

  function saveBirthDate() {
    if (!draftBirth) return
    update((doc) => ({ ...doc, birthDate: draftBirth }))
    setEditingBirth(false)
  }

  const showForm = !birth || editingBirth

  return (
    <>
      <TopBar title="Life">
        <SaveIndicator state={saveState} />
      </TopBar>

      <div className="page stack">
        {error && <div className="banner">{error}</div>}
        {!data ? (
          <Empty>Loading…</Empty>
        ) : showForm ? (
          <div className="card stack">
            <div className="faint">Enter your birth date to see a countdown to your 100th birthday.</div>
            <div className="row wrap">
              <input type="date" value={draftBirth} onChange={(e) => setDraftBirth(e.target.value)} />
              <button className="btn primary" onClick={saveBirthDate} disabled={!draftBirth}>
                Save
              </button>
              {birth && (
                <button className="btn ghost" onClick={() => setEditingBirth(false)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          countdown &&
          grid && (
            <>
              <div className="card stack">
                <div className="spread">
                  <div className="faint">Time left until you turn {TARGET_AGE}</div>
                  <button className="btn ghost sm" onClick={startEdit}>
                    Change birth date
                  </button>
                </div>
                <div className="habit-stats">
                  <div className="stat">
                    <div className="value">{countdown.days.toLocaleString()}</div>
                    <div className="label">Days</div>
                  </div>
                  <div className="stat">
                    <div className="value">{countdown.weeks.toLocaleString()}</div>
                    <div className="label">Weeks</div>
                  </div>
                  <div className="stat">
                    <div className="value">{countdown.months.toLocaleString()}</div>
                    <div className="label">Months</div>
                  </div>
                  <div className="stat">
                    <div className="value">{countdown.years.toLocaleString()}</div>
                    <div className="label">Years</div>
                  </div>
                </div>
              </div>

              <div className="card stack">
                <div className="spread">
                  <div className="faint">
                    {grid.elapsed.toLocaleString()} {UNIT_LABEL[granularity]} lived · {grid.remaining.toLocaleString()}{' '}
                    left
                  </div>
                  <Segmented<Granularity>
                    value={granularity}
                    onChange={setGranularity}
                    options={[
                      { value: 'days', label: 'Days' },
                      { value: 'weeks', label: 'Weeks' },
                      { value: 'months', label: 'Months' },
                      { value: 'years', label: 'Years' },
                    ]}
                  />
                </div>
                <div
                  className="life-grid"
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CELL_SIZE[granularity]}px, 1fr))` }}
                >
                  {Array.from({ length: grid.total }, (_, i) => (
                    <div
                      key={i}
                      className={`life-cell${i < grid.elapsed ? ' passed' : i === grid.elapsed ? ' current' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </>
          )
        )}
      </div>
    </>
  )
}
