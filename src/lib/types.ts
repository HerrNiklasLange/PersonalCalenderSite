export type Collection = 'calendar' | 'habits' | 'timeblocks' | 'notes' | 'workflow'

export const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#64748b',
] as const

/* ---------- Calendar ---------- */

export interface CalendarEvent {
  id: string
  date: string // YYYY-MM-DD
  start?: string // HH:MM — absent means an all-day item
  end?: string
  title: string
  notes?: string
  color: string
  done?: boolean
}

export interface CalendarDoc {
  events: CalendarEvent[]
}

export const emptyCalendar: CalendarDoc = { events: [] }

/* ---------- Habits ---------- */

export type HabitKind = 'binary' | 'count'
/** `atLeast` — more is better (deep work). `atMost` — less is better (time online). */
export type HabitGoal = 'atLeast' | 'atMost'

export interface Habit {
  id: string
  name: string
  kind: HabitKind
  goal: HabitGoal
  target: number
  unit: string
  color: string
  archived?: boolean
}

export interface HabitsDoc {
  habits: Habit[]
  /** date -> habitId -> value (binary habits store 0 or 1) */
  log: Record<string, Record<string, number>>
}

export const emptyHabits: HabitsDoc = {
  habits: [
    { id: 'deep-work', name: 'Deep work', kind: 'count', goal: 'atLeast', target: 4, unit: 'h', color: '#6366f1' },
    { id: 'time-online', name: 'Time spent online', kind: 'count', goal: 'atMost', target: 2, unit: 'h', color: '#ef4444' },
    { id: 'exercise', name: 'Exercised', kind: 'binary', goal: 'atLeast', target: 1, unit: '', color: '#10b981' },
    { id: 'eat-healthy', name: 'Ate healthy', kind: 'binary', goal: 'atLeast', target: 1, unit: '', color: '#f59e0b' },
  ],
  log: {},
}

/* ---------- Time blocks ---------- */

export type BlockStatus = 'done' | 'partial' | 'missed'

export interface TimeBlock {
  id: string
  day: number // 0 = Monday … 6 = Sunday
  start: string // HH:MM
  end: string // HH:MM
  title: string
  color: string
}

export interface BlockReview {
  status: BlockStatus
  note?: string
}

export interface TimeBlocksDoc {
  template: TimeBlock[]
  /** date -> blockId -> review */
  log: Record<string, Record<string, BlockReview>>
  dayStart: number // first hour shown in the grid
  dayEnd: number // last hour shown in the grid
  /** Monday-of-week ISO date -> this week's freeform priorities. */
  focus: Record<string, string>
}

export const emptyTimeBlocks: TimeBlocksDoc = { template: [], log: {}, dayStart: 6, dayEnd: 22, focus: {} }

/* ---------- Notes ---------- */

export interface Note {
  id: string
  title: string
  body: string
  tags: string[]
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export interface NotesDoc {
  notes: Note[]
}

export const emptyNotes: NotesDoc = { notes: [] }

/* ---------- Workflow ---------- */

export type BoardId = 'personal' | 'career'

export interface WorkflowColumn {
  id: string
  title: string
}

export interface WorkflowItem {
  id: string
  columnId: string
  title: string
  notes: string
  area: string
  createdAt: number
}

export interface Board {
  columns: WorkflowColumn[]
  items: WorkflowItem[]
  /** Guiding values / principles shown above the board. */
  values: string[]
}

export interface WorkflowDoc {
  boards: Record<BoardId, Board>
}

function defaultBoard(values: string[]): Board {
  return {
    columns: [
      { id: 'not-started', title: 'Not started' },
      { id: 'in-progress', title: 'In progress' },
      { id: 'done', title: 'Done' },
    ],
    items: [],
    values,
  }
}

export const emptyWorkflow: WorkflowDoc = {
  boards: {
    personal: defaultBoard(['Health first', 'Presence over productivity']),
    career: defaultBoard(['Depth over breadth', 'Ship, then refine']),
  },
}

export const BOARDS: { id: BoardId; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'career', label: 'Career' },
]

/* ---------- helpers ---------- */

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
