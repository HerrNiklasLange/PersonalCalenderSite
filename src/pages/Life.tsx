import { useMemo, useState } from 'react'
import { TopBar } from '../components/Shell'
import { Empty, SaveIndicator, Segmented } from '../components/ui'
import { useDoc } from '../lib/useDoc'
import { emptyLife, type LifeDoc } from '../lib/types'

type Granularity = 'days' | 'weeks' | 'months' | 'years'

const DAY_MS = 86400000
const YEAR_DAYS = 365.2425
const TARGET_AGE = 100

const CELL_SIZE: Record<Granularity, number> = { days: 4, weeks: 7, months: 11, years: 18 }
const UNIT_LABEL: Record<Granularity, string> = { days: 'days', weeks: 'weeks', months: 'months', years: 'years' }

// Life expectancy at birth, male, most recent national figures (years).
const LIFE_EXPECTANCY = [
  { label: 'Germany', years: 78.7 },
  { label: 'UK', years: 79.0 },
]

// A few examples of what was achieved at a given age — not a schedule, just proof it happens at every age.
const MILESTONES = [
  { age: 20, text: 'Alexander the Great became King of Macedon.' },
  { age: 23, text: "Isaac Newton laid the groundwork for calculus in his 'year of wonders'." },
  { age: 26, text: "Einstein published four papers that reshaped physics — his 'miracle year'." },
  { age: 32, text: 'Oprah Winfrey launched her nationally syndicated talk show.' },
  { age: 40, text: 'Vera Wang entered the fashion industry and built her bridal label.' },
  { age: 45, text: 'Samuel L. Jackson landed his breakout role in Pulp Fiction.' },
  { age: 49, text: 'Julia Child published Mastering the Art of French Cooking.' },
  { age: 62, text: 'Colonel Harland Sanders started franchising KFC.' },
  { age: 78, text: 'Grandma Moses began her painting career.' },
]

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

function addFractionalYears(date: Date, years: number): Date {
  return new Date(date.getTime() + years * YEAR_DAYS * DAY_MS)
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

function statsBetween(a: Date, b: Date) {
  const days = Math.max(0, daysBetween(a, b))
  return {
    days,
    weeks: Math.floor(days / 7),
    months: Math.max(0, monthsBetween(a, b)),
    years: Math.max(0, yearsBetween(a, b)),
  }
}

export default function LifePage() {
  const { data, update, error, saveState } = useDoc<LifeDoc>('life', emptyLife)
  const [granularity, setGranularity] = useState<Granularity>('months')
  const [editingBirth, setEditingBirth] = useState(false)
  const [draftBirth, setDraftBirth] = useState('')

  const today = useMemo(() => startOfDay(new Date()), [])
  const birth = data?.birthDate ? parseLocalDate(data.birthDate) : null
  const target = birth ? addYears(birth, TARGET_AGE) : null

  const lived = useMemo(() => (birth ? statsBetween(birth, today) : null), [birth, today])
  const countdown = useMemo(() => (target ? statsBetween(today, target) : null), [today, target])

  const grid = useMemo(() => {
    if (!birth || !target) return null
    const total = Math.max(0, unitsBetween(granularity, birth, target))
    const elapsed = Math.min(total, Math.max(0, unitsBetween(granularity, birth, today)))
    return { total, elapsed, remaining: total - elapsed }
  }, [birth, target, today, granularity])

  const expectancy = useMemo(() => {
    if (!birth) return null
    return LIFE_EXPECTANCY.map((entry) => {
      const date = addFractionalYears(birth, entry.years)
      return { ...entry, daysLeft: daysBetween(today, date) }
    })
  }, [birth, today])

  const avgIndex = useMemo(() => {
    if (!birth || !grid) return null
    const avgYears = LIFE_EXPECTANCY.reduce((sum, e) => sum + e.years, 0) / LIFE_EXPECTANCY.length
    const date = addFractionalYears(birth, avgYears)
    return Math.min(grid.total - 1, Math.max(0, unitsBetween(granularity, birth, date)))
  }, [birth, grid, granularity])

  const nextMilestone = useMemo(() => {
    const ageYears = lived?.years ?? 0
    return MILESTONES.find((m) => m.age >= ageYears) ?? MILESTONES[MILESTONES.length - 1]
  }, [lived])

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
          lived &&
          countdown &&
          grid && (
            <>
              <div className="card stack">
                <div className="spread">
                  <div className="faint">Since you were born</div>
                  <button className="btn ghost sm" onClick={startEdit}>
                    Change birth date
                  </button>
                </div>
                <div className="habit-stats">
                  <div className="stat">
                    <div className="value">{lived.days.toLocaleString()}</div>
                    <div className="label">Days</div>
                  </div>
                  <div className="stat">
                    <div className="value">{lived.weeks.toLocaleString()}</div>
                    <div className="label">Weeks</div>
                  </div>
                  <div className="stat">
                    <div className="value">{lived.months.toLocaleString()}</div>
                    <div className="label">Months</div>
                  </div>
                  <div className="stat">
                    <div className="value">{lived.years.toLocaleString()}</div>
                    <div className="label">Years</div>
                  </div>
                </div>

                <div className="faint" style={{ marginTop: 4 }}>
                  Until you turn {TARGET_AGE}
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

              {expectancy && (
                <div className="card stack">
                  <div className="faint">Average male life expectancy at birth</div>
                  <div className="row wrap">
                    {expectancy.map((e) => (
                      <div key={e.label} className="chip">
                        {e.label} · {e.years} yrs ·{' '}
                        {e.daysLeft > 0
                          ? `${e.daysLeft.toLocaleString()} days to go`
                          : `${Math.abs(e.daysLeft).toLocaleString()} days past`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card stack">
                <div className="faint">
                  {lived.years < nextMilestone.age
                    ? `In ${nextMilestone.age - lived.years} year${nextMilestone.age - lived.years === 1 ? '' : 's'}, you'll be the age when:`
                    : lived.years === nextMilestone.age
                      ? "You're that age right now:"
                      : "You've outlived every example below — time to set the next one:"}
                </div>
                <div className="milestone-highlight">{nextMilestone.text}</div>
                <div className="milestone-list">
                  {MILESTONES.map((m) => (
                    <div key={m.age} className={`milestone-row${m.age === nextMilestone.age ? ' current' : ''}`}>
                      <span className="milestone-age">{m.age}</span>
                      <span>{m.text}</span>
                    </div>
                  ))}
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
                      className={`life-cell${i < grid.elapsed ? ' passed' : ''}${i === grid.elapsed ? ' current' : ''}${i === avgIndex ? ' avg' : ''}`}
                    />
                  ))}
                </div>
                <div className="row wrap life-legend faint">
                  <span>
                    <i className="legend-dot passed" /> Lived
                  </span>
                  <span>
                    <i className="legend-dot current" /> Today
                  </span>
                  <span>
                    <i className="legend-dot avg" /> Avg. male lifespan (DE/UK)
                  </span>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </>
  )
}
