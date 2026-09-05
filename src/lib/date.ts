export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const DAY_NAMES_LONG = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** `YYYY-MM-DD` in local time — never use toISOString(), it shifts by timezone. */
export function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function fromISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = fromISO(iso)
  date.setDate(date.getDate() + days)
  return toISO(date)
}

export function addMonths(iso: string, months: number): string {
  const date = fromISO(iso)
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  return toISO(date)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso))
}

export function weekDates(mondayISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayISO, i))
}

/** Six rows of seven days covering the month that `iso` falls in. */
export function monthGrid(iso: string): string[] {
  const date = fromISO(iso)
  const first = toISO(new Date(date.getFullYear(), date.getMonth(), 1))
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

export function formatDay(iso: string): string {
  const date = fromISO(iso)
  return `${DAY_NAMES_LONG[weekdayIndex(iso)]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`
}

export function formatMonth(iso: string): string {
  const date = fromISO(iso)
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

export function formatShort(iso: string): string {
  const date = fromISO(iso)
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`
}

/** `"08:30"` -> 510 */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export function relativeLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  if (iso === addDays(today, -1)) return 'Yesterday'
  return formatShort(iso)
}
