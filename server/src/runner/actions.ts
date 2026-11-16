import type { Page } from 'playwright'
import type { ActionBlock } from '@rpa/shared'
import type { Runtime } from '../runtime.js'

function num(ctx: Runtime, value: unknown, fallback: number): number {
  const parsed = Number(ctx.text(String(value ?? fallback)))
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function performLeaf(page: Page, ctx: Runtime, block: ActionBlock): Promise<void> {
  const params = block.params || {}
  await ctx.step(block.id, block.type, async () => {
    switch (block.type) {
      case 'openUrl':
        await page.goto(ctx.text(String(params.url || 'about:blank')), { waitUntil: 'domcontentloaded' })
        return
      case 'click':
        await page.locator(ctx.text(String(params.selector || 'body'))).click()
        return
      case 'fill':
        await page.locator(ctx.text(String(params.selector || 'input'))).fill(ctx.text(String(params.value ?? '')))
        return
      case 'pressKey':
        if (params.selector) {
          await page.locator(ctx.text(String(params.selector))).press(ctx.text(String(params.key || 'Enter')))
        } else {
          await page.keyboard.press(ctx.text(String(params.key || 'Enter')))
        }
        return
      case 'selectOption':
        await page.locator(ctx.text(String(params.selector || 'select'))).selectOption(ctx.text(String(params.value ?? '')))
        return
      case 'hover':
        await page.locator(ctx.text(String(params.selector || 'body'))).hover()
        return
      case 'scroll':
        if (params.selector) {
          await page.locator(ctx.text(String(params.selector))).scrollIntoViewIfNeeded()
        } else {
          await page.mouse.wheel(0, num(ctx, params.deltaY, 400))
        }
        return
      case 'waitForSelector': {
        const state = ctx.text(String(params.state || 'visible')) as 'visible' | 'hidden' | 'attached'
        await page.locator(ctx.text(String(params.selector || 'body'))).waitFor({
          state,
          timeout: num(ctx, params.timeoutMs, 10000)
        })
        return
      }
      case 'sleep':
        await page.waitForTimeout(num(ctx, params.ms, 0))
        return
      case 'extractText': {
        const text = (await page.locator(ctx.text(String(params.selector || 'body'))).innerText()).trim()
        ctx.vars[String(params.varName || 'text')] = text
        return
      }
      case 'screenshot':
        await ctx.screenshot(ctx.text(String(params.name || 'shot')))
        return
      case 'setVariable':
        ctx.vars[String(params.name || 'value')] = ctx.text(String(params.value ?? ''))
        return
      case 'evaluateJs': {
        const code = String(params.code || '')
        const result = params.target === 'vars'
          ? ctx.evalVars(code)
          : await page.evaluate((source) => {
              // Evaluates inside the automated page. Local studio only.
              return (0, eval)(source as string)
            }, code)
        if (params.saveAs) ctx.vars[String(params.saveAs)] = result
        return
      }
      default:
        throw new Error(`Not a leaf action: ${block.type}`)
    }
  })
}
