import type { ActionBlock, WorkflowDocument } from './types.js'

function jsString(value: string): string {
  return JSON.stringify(value)
}

function indent(level: number): string {
  return '  '.repeat(level)
}

function conditionArg(params: Record<string, unknown>): string {
  return JSON.stringify(params.condition ?? { op: 'elementVisible', selector: 'body' })
}

function comment(level: number, block: ActionBlock): string {
  const title = block.label || block.type
  return `${indent(level)}// ${title}${block.disabled ? ' (disabled)' : ''}`
}

function step(level: number, block: ActionBlock, body: string[]): string[] {
  return [
    comment(level, block),
    `${indent(level)}await ctx.step(${jsString(block.id)}, ${jsString(block.type)}, async () => {`,
    ...body.map((line) => indent(level + 1) + line),
    `${indent(level)}});`
  ]
}

function compileList(blocks: ActionBlock[] | undefined, level: number): string[] {
  if (!blocks || blocks.length === 0) return [`${indent(level)}// empty`]
  return blocks.flatMap((block) => compileBlock(block, level))
}

function compileBlock(block: ActionBlock, level: number): string[] {
  if (block.disabled) return [`${indent(level)}// skipped ${block.type} (${block.id})`]
  const p = block.params || {}
  const str = (key: string, fallback = '') => jsString(String(p[key] ?? fallback))

  switch (block.type) {
    case 'openUrl':
      return step(level, block, [
        `await page.goto(ctx.text(${str('url')}), { waitUntil: 'domcontentloaded' });`
      ])
    case 'click':
      return step(level, block, [`await page.locator(ctx.text(${str('selector')})).click();`])
    case 'fill':
      return step(level, block, [
        `await page.locator(ctx.text(${str('selector')})).fill(ctx.text(${str('value')}));`
      ])
    case 'pressKey':
      return step(level, block, [
        p.selector
          ? `await page.locator(ctx.text(${str('selector')})).press(ctx.text(${str('key', 'Enter')}));`
          : `await page.keyboard.press(ctx.text(${str('key', 'Enter')}));`
      ])
    case 'selectOption':
      return step(level, block, [
        `await page.locator(ctx.text(${str('selector')})).selectOption(ctx.text(${str('value')}));`
      ])
    case 'hover':
      return step(level, block, [`await page.locator(ctx.text(${str('selector')})).hover();`])
    case 'scroll':
      return step(level, block, [
        p.selector
          ? `await page.locator(ctx.text(${str('selector')})).scrollIntoViewIfNeeded();`
          : `await page.mouse.wheel(0, Number(ctx.text(${str('deltaY', '400')})));`
      ])
    case 'waitForSelector':
      return step(level, block, [
        `await page.locator(ctx.text(${str('selector')})).waitFor({ state: ctx.text(${str('state', 'visible')}), timeout: Number(ctx.text(${str('timeoutMs', '10000')})) });`
      ])
    case 'sleep':
      return step(level, block, [`await page.waitForTimeout(Number(ctx.text(${str('ms', '0')})));`])
    case 'extractText':
      return step(level, block, [
        `const text = (await page.locator(ctx.text(${str('selector')})).innerText()).trim();`,
        `ctx.vars[${str('varName', 'text')}] = text;`
      ])
    case 'screenshot':
      return step(level, block, [`await ctx.screenshot(ctx.text(${str('name', 'shot')}));`])
    case 'setVariable':
      return step(level, block, [`ctx.vars[${str('name', 'value')}] = ctx.text(${str('value')});`])
    case 'evaluateJs':
      if (p.target === 'vars') {
        return step(level, block, [
          `const result = ctx.evalVars(${str('code')});`,
          p.saveAs ? `if (result !== undefined) ctx.vars[${str('saveAs')}] = result;` : `void result;`
        ])
      }
      return step(level, block, [
        `const result = await page.evaluate((code) => eval(code), ${str('code')});`,
        p.saveAs ? `if (result !== undefined) ctx.vars[${str('saveAs')}] = result;` : `void result;`
      ])
    case 'breakLoop':
      return [comment(level, block), `${indent(level)}break;`]
    case 'continueLoop':
      return [comment(level, block), `${indent(level)}continue;`]
    case 'ifCondition': {
      const lines = [
        comment(level, block),
        `${indent(level)}if (await ctx.testCondition(${conditionArg(p)})) {`,
        ...compileList(block.thenChildren, level + 1)
      ]
      if (block.elseChildren && block.elseChildren.length > 0) {
        lines.push(`${indent(level)}} else {`, ...compileList(block.elseChildren, level + 1))
      }
      lines.push(`${indent(level)}}`)
      return lines
    }
    case 'loopTimes':
      return [
        comment(level, block),
        `${indent(level)}{`,
        `${indent(level + 1)}const __times = Number(ctx.text(${str('times', '1')}));`,
        `${indent(level + 1)}if (__times > 10000) throw new Error('loopTimes refuses more than 10000 iterations');`,
        `${indent(level + 1)}for (let __i = 1; __i <= __times; __i++) {`,
        `${indent(level + 2)}ctx.vars[${str('varName', 'i')}] = __i;`,
        `${indent(level + 2)}ctx.vars.loopIndex = __i;`,
        ...compileList(block.children, level + 2),
        `${indent(level + 1)}}`,
        `${indent(level)}}`
      ]
    case 'loopWhile':
      return [
        comment(level, block),
        `${indent(level)}{`,
        `${indent(level + 1)}let __guard = 0;`,
        `${indent(level + 1)}const __max = Number(ctx.text(${str('maxIterations', '50')})) || 50;`,
        `${indent(level + 1)}while (await ctx.testCondition(${conditionArg(p)})) {`,
        `${indent(level + 2)}__guard++;`,
        `${indent(level + 2)}if (__guard > __max) throw new Error('loopWhile exceeded maxIterations (' + __max + ')');`,
        ...compileList(block.children, level + 2),
        `${indent(level + 1)}}`,
        `${indent(level)}}`
      ]
    case 'loopCsv':
      return [
        comment(level, block),
        `${indent(level)}{`,
        `${indent(level + 1)}const __rows = await ctx.readCsv(${str('file', 'users.csv')});`,
        `${indent(level + 1)}const __prevCsv = ctx.csv;`,
        `${indent(level + 1)}try {`,
        `${indent(level + 2)}for (let __r = 0; __r < __rows.length; __r++) {`,
        `${indent(level + 3)}ctx.csv = __rows[__r];`,
        `${indent(level + 3)}ctx.vars.loopIndex = __r + 1;`,
        ...compileList(block.children, level + 3),
        `${indent(level + 2)}}`,
        `${indent(level + 1)}} finally {`,
        `${indent(level + 2)}ctx.csv = __prevCsv;`,
        `${indent(level + 1)}}`,
        `${indent(level)}}`
      ]
    case 'forEach':
      return [
        comment(level, block),
        `${indent(level)}{`,
        `${indent(level + 1)}const __parts = String(ctx.vars[${str('listVar', 'items')}] ?? '').split(${str('delimiter', ',')});`,
        `${indent(level + 1)}for (const __raw of __parts) {`,
        `${indent(level + 2)}const __item = __raw.trim();`,
        `${indent(level + 2)}if (!__item) continue;`,
        `${indent(level + 2)}ctx.vars[${str('itemVar', 'item')}] = __item;`,
        ...compileList(block.children, level + 2),
        `${indent(level + 1)}}`,
        `${indent(level)}}`
      ]
    default:
      return [`${indent(level)}// unsupported block ${block.type}`]
  }
}

export function compileBlocksToPlaywrightJs(workflow: WorkflowDocument): string {
  const body = compileList(workflow.blocks, 1)
  return [
    `// Generated from workflow ${JSON.stringify(workflow.name)} (${workflow.id}).`,
    '// Block edits overwrite this file. You can still edit it and run JS mode',
    '// until the next block save. ctx provides text, step, pace, vars, csv, loop,',
    '// testCondition, readCsv, screenshot, log, and evalVars.',
    '',
    'export async function runWorkflow(page, ctx) {',
    ...body,
    '}',
    ''
  ].join('\n')
}
