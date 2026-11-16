import type { Page } from 'playwright'
import type { ActionBlock, ConditionExpr } from '@rpa/shared'
import { performLeaf } from './actions.js'
import { FlowControl, type Runtime } from '../runtime.js'

const LEAVES = new Set<ActionBlock['type']>([
  'openUrl', 'click', 'fill', 'pressKey', 'selectOption', 'hover', 'scroll',
  'waitForSelector', 'sleep', 'extractText', 'screenshot', 'setVariable', 'evaluateJs'
])

async function runList(blocks: ActionBlock[] | undefined, page: Page, ctx: Runtime): Promise<void> {
  for (const block of blocks || []) {
    await runBlock(block, page, ctx)
  }
}

async function runLoopBody(blocks: ActionBlock[] | undefined, page: Page, ctx: Runtime): Promise<'break' | 'continue' | 'ok'> {
  try {
    await runList(blocks, page, ctx)
    return 'ok'
  } catch (error) {
    if (error instanceof FlowControl) return error.control
    throw error
  }
}

function emitSkip(ctx: Runtime, block: ActionBlock): void {
  ctx.log('info', `Skipped ${block.type}`)
}

export async function runBlocks(blocks: ActionBlock[], page: Page, ctx: Runtime): Promise<void> {
  await runList(blocks, page, ctx)
}

async function runBlock(block: ActionBlock, page: Page, ctx: Runtime): Promise<void> {
  if (block.disabled) {
    emitSkip(ctx, block)
    return
  }
  if (LEAVES.has(block.type)) {
    await performLeaf(page, ctx, block)
    return
  }

  if (block.type === 'breakLoop') throw new FlowControl('break')
  if (block.type === 'continueLoop') throw new FlowControl('continue')

  if (block.type === 'ifCondition') {
    const condition = (block.params.condition || { op: 'elementVisible', selector: 'body' }) as ConditionExpr
    const passed = await ctx.testCondition(condition)
    await runList(passed ? block.thenChildren : block.elseChildren, page, ctx)
    return
  }

  if (block.type === 'loopTimes') {
    const times = Number(ctx.text(String(block.params.times ?? 1)))
    if (times > 10000) throw new Error('loopTimes refuses more than 10000 iterations')
    const varName = String(block.params.varName || 'i')
    for (let index = 1; index <= times; index++) {
      ctx.vars[varName] = index
      ctx.vars.loopIndex = index
      const signal = await runLoopBody(block.children, page, ctx)
      if (signal === 'break') break
    }
    return
  }

  if (block.type === 'loopWhile') {
    const max = Number(ctx.text(String(block.params.maxIterations ?? 50))) || 50
    const condition = (block.params.condition || { op: 'elementVisible' }) as ConditionExpr
    let guard = 0
    while (await ctx.testCondition(condition)) {
      guard += 1
      if (guard > max) throw new Error(`loopWhile exceeded maxIterations (${max})`)
      const signal = await runLoopBody(block.children, page, ctx)
      if (signal === 'break') break
    }
    return
  }

  if (block.type === 'loopCsv') {
    const rows = await ctx.readCsv(String(block.params.file || 'users.csv'))
    const previous = ctx.csv
    try {
      for (let index = 0; index < rows.length; index++) {
        ctx.csv = rows[index]
        ctx.vars.loopIndex = index + 1
        const signal = await runLoopBody(block.children, page, ctx)
        if (signal === 'break') break
      }
    } finally {
      ctx.csv = previous
    }
    return
  }

  if (block.type === 'forEach') {
    const listVar = String(block.params.listVar || 'items')
    const itemVar = String(block.params.itemVar || 'item')
    const delimiter = String(block.params.delimiter ?? ',')
    const parts = String(ctx.vars[listVar] ?? '').split(delimiter)
    for (const part of parts) {
      const item = part.trim()
      if (!item) continue
      ctx.vars[itemVar] = item
      const signal = await runLoopBody(block.children, page, ctx)
      if (signal === 'break') break
    }
    return
  }

  throw new Error(`Unsupported block ${block.type}`)
}
