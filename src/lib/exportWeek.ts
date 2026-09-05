import { DAY_NAMES_LONG, toMinutes } from './date'
import type { TimeBlock } from './types'

const WIDTH = 1512
const GUTTER = 68
const HEADER_H = 46
const TITLE_H = 58
const HOUR_H = 54
const PADDING = 24

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
  ctx.fill()
}

function clipText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

/** Renders the weekly template to a PNG and triggers a download. */
export function exportWeekPNG(template: TimeBlock[], dayStart: number, dayEnd: number, title: string): void {
  const hours = Math.max(1, dayEnd - dayStart)
  const gridH = hours * HOUR_H
  const height = TITLE_H + HEADER_H + gridH + PADDING * 2
  const scale = 2

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)

  const font = 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  const colW = (WIDTH - PADDING * 2 - GUTTER) / 7
  const originX = PADDING + GUTTER
  const originY = PADDING + TITLE_H + HEADER_H

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.fillStyle = '#111827'
  ctx.font = `600 22px ${font}`
  ctx.textBaseline = 'middle'
  ctx.fillText(title, PADDING, PADDING + 20)

  // Day headers
  ctx.font = `600 13px ${font}`
  ctx.textAlign = 'center'
  for (let day = 0; day < 7; day += 1) {
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(originX + day * colW, originY - HEADER_H, colW, HEADER_H)
    ctx.fillStyle = '#374151'
    ctx.fillText(DAY_NAMES_LONG[day], originX + day * colW + colW / 2, originY - HEADER_H / 2)
  }

  // Hour lines and labels
  ctx.textAlign = 'right'
  ctx.font = `500 11px ${font}`
  for (let i = 0; i <= hours; i += 1) {
    const y = originY + i * HOUR_H
    ctx.strokeStyle = i === 0 || i === hours ? '#9ca3af' : '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(originX, y + 0.5)
    ctx.lineTo(originX + colW * 7, y + 0.5)
    ctx.stroke()
    if (i < hours) {
      ctx.fillStyle = '#6b7280'
      ctx.fillText(`${String(dayStart + i).padStart(2, '0')}:00`, originX - 10, y + 10)
    }
  }

  ctx.strokeStyle = '#e5e7eb'
  for (let day = 0; day <= 7; day += 1) {
    const x = originX + day * colW
    ctx.beginPath()
    ctx.moveTo(x + 0.5, originY - HEADER_H)
    ctx.lineTo(x + 0.5, originY + gridH)
    ctx.stroke()
  }

  // Blocks
  ctx.textAlign = 'left'
  for (const block of template) {
    const start = toMinutes(block.start)
    const end = toMinutes(block.end)
    const top = originY + ((start - dayStart * 60) / 60) * HOUR_H
    const bottom = originY + ((end - dayStart * 60) / 60) * HOUR_H
    const y = Math.max(originY, top)
    const h = Math.min(originY + gridH, bottom) - y
    if (h <= 1) continue

    const x = originX + block.day * colW + 3
    const w = colW - 6
    ctx.fillStyle = block.color
    roundRect(ctx, x, y, w, h, 6)

    ctx.fillStyle = '#ffffff'
    ctx.font = `600 12px ${font}`
    ctx.textBaseline = 'top'
    ctx.fillText(clipText(ctx, block.title, w - 14), x + 7, y + 5)
    if (h > 30) {
      ctx.font = `500 11px ${font}`
      ctx.globalAlpha = 0.9
      ctx.fillText(`${block.start}–${block.end}`, x + 7, y + 21)
      ctx.globalAlpha = 1
    }
    ctx.textBaseline = 'middle'
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'weekly-timetable.png'
    link.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
