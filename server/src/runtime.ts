import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Page } from 'playwright'
import {
  interpolate,
  type ConditionExpr,
  type StudioEvent
} from '@rpa/shared'
import type { FileStore } from './store.js'

export class FlowControl extends Error {
  constructor(public control: 'break' | 'continue') {
    super(control)
    this.name = 'FlowControl'
  }
}

export class StoppedError extends Error {
  constructor() {
    super('Stopped by user')
    this.name = 'StoppedError'
  }
}

export interface Runtime {
  vars: Record<string, unknown>
  csv: Record<string, string>
  loop: number
  text(template: string): string
  step(id: string, label: string, fn: () => Promise<void>): Promise<void>
  pace(): Promise<void>
  log(level: 'info' | 'warn' | 'error', message: string): void
  screenshot(name?: string): Promise<string>
  testCondition(expr: ConditionExpr): Promise<boolean>
  readCsv(file: string): Promise<Record<string, string>[]>
  evalVars(code: string): unknown
}

export function createRuntime(opts: {
  page: Page
  store: FileStore
  emit: (event: StudioEvent) => void
  intervalMs: number
  jitterMs: number
  isStopped: () => boolean
  loop: number
  csv: Record<string, string>
}): Runtime {
  const ctx: Runtime = {
    vars: {},
    csv: { ...opts.csv },
    loop: opts.loop,
    text(template: string) {
      return interpolate(String(template ?? ''), { vars: ctx.vars, loop: ctx.loop, csv: ctx.csv })
    },
    log(level, message) {
      opts.emit({ type: 'log', level, message, ts: Date.now() })
    },
    async pace() {
      if (opts.isStopped()) throw new StoppedError()
      const wait = Math.max(0, opts.intervalMs) + Math.random() * Math.max(0, opts.jitterMs)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    },
    async step(id, label, fn) {
      if (opts.isStopped()) throw new StoppedError()
      opts.emit({ type: 'step', blockId: id, status: 'start', message: label, ts: Date.now() })
      try {
        await fn()
        await ctx.pace()
        opts.emit({ type: 'step', blockId: id, status: 'ok', message: label, ts: Date.now() })
      } catch (error) {
        if (opts.isStopped() || error instanceof StoppedError) throw new StoppedError()
        const message = error instanceof Error ? error.message : String(error)
        opts.emit({ type: 'step', blockId: id, status: 'error', message, ts: Date.now() })
        throw error
      }
    },
    async screenshot(name = 'shot') {
      await mkdir(opts.store.shotsDir, { recursive: true })
      const safe = String(name).replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'shot'
      const file = `${Date.now()}-${safe}.png`
      await opts.page.screenshot({ path: path.join(opts.store.shotsDir, file) })
      const url = `/artifacts/screenshots/${file}`
      opts.emit({ type: 'screenshot', url, ts: Date.now() })
      return url
    },
    async readCsv(file: string) {
      return opts.store.readCsv(file)
    },
    evalVars(code: string) {
      try {
        const expression = new Function('vars', 'loop', 'csv', `"use strict"; return (${code});`)
        return expression(ctx.vars, ctx.loop, ctx.csv)
      } catch {
        const statements = new Function('vars', 'loop', 'csv', `"use strict"; ${code}`)
        return statements(ctx.vars, ctx.loop, ctx.csv)
      }
    },
    async testCondition(expr: ConditionExpr) {
      const selector = ctx.text(expr.selector || '')
      const expected = ctx.text(expr.expected || '')
      const timeout = Number(expr.timeoutMs ?? 1500)
      const locator = selector ? opts.page.locator(selector) : null
      switch (expr.op) {
        case 'elementVisible':
          try {
            await locator!.waitFor({ state: 'visible', timeout })
            return true
          } catch {
            return false
          }
        case 'elementHidden':
          try {
            await locator!.waitFor({ state: 'hidden', timeout })
            return true
          } catch {
            return false
          }
        case 'elementExists':
          return (await locator!.count()) > 0
        case 'textContains': {
          try {
            const text = await locator!.innerText({ timeout })
            return text.includes(expected)
          } catch {
            return false
          }
        }
        case 'urlContains':
          return opts.page.url().includes(expected)
        case 'varEquals':
          return String(ctx.vars[expr.varName || ''] ?? '') === expected
        case 'varNotEquals':
          return String(ctx.vars[expr.varName || ''] ?? '') !== expected
        case 'varGreaterThan':
          return Number(ctx.vars[expr.varName || '']) > Number(expected)
        case 'jsExpression':
          return !!ctx.evalVars(expr.expression || 'false')
        default:
          return false
      }
    }
  }
  return ctx
}
