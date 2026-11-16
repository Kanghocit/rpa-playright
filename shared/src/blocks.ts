import type { ActionBlock, BlockSlot, BlockType, ConditionExpr, RunConfig } from './types.js'

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function defaultRunConfig(): RunConfig {
  return {
    fromLoop: 1,
    toLoop: 1,
    commandIntervalMs: 300,
    randomJitterMs: 200,
    onErrorInLoop: 'stop',
    headed: true,
    persistentProfile: false,
    proxyMode: 'off',
    proxy: null,
    proxies: [],
    csvFile: 'users.csv',
    startUrl: 'http://127.0.0.1:3789/fixture/demo.html'
  }
}

export function defaultCondition(): ConditionExpr {
  return { op: 'elementVisible', selector: 'body', timeoutMs: 3000 }
}

export function defaultParams(type: BlockType): Record<string, unknown> {
  switch (type) {
    case 'openUrl':
      return { url: 'https://example.com' }
    case 'click':
    case 'hover':
      return { selector: 'button' }
    case 'fill':
      return { selector: 'input', value: '' }
    case 'pressKey':
      return { key: 'Enter', selector: '' }
    case 'selectOption':
      return { selector: 'select', value: '' }
    case 'scroll':
      return { selector: '', deltaY: 400 }
    case 'waitForSelector':
      return { selector: 'body', state: 'visible', timeoutMs: 10000 }
    case 'sleep':
      return { ms: 500 }
    case 'extractText':
      return { selector: 'h1', varName: 'text' }
    case 'screenshot':
      return { name: 'shot' }
    case 'setVariable':
      return { name: 'value', value: '' }
    case 'evaluateJs':
      return { target: 'page', code: 'document.title', saveAs: 'lastEval' }
    case 'ifCondition':
    case 'loopWhile':
      return {
        condition: defaultCondition(),
        maxIterations: type === 'loopWhile' ? 50 : undefined
      }
    case 'loopTimes':
      return { times: 3, varName: 'i' }
    case 'loopCsv':
      return { file: 'users.csv' }
    case 'forEach':
      return { listVar: 'items', itemVar: 'item', delimiter: ',' }
    case 'breakLoop':
    case 'continueLoop':
      return {}
    default:
      return {}
  }
}

export function blockUsesSlot(type: BlockType, slot: BlockSlot): boolean {
  if (slot === 'children') return type === 'loopTimes' || type === 'loopWhile' || type === 'loopCsv' || type === 'forEach'
  if (slot === 'thenChildren' || slot === 'elseChildren') return type === 'ifCondition'
  return false
}

export function isContainer(type: BlockType): boolean {
  return type === 'loopTimes' || type === 'loopWhile' || type === 'loopCsv' || type === 'forEach' || type === 'ifCondition'
}

export function createBlock(type: BlockType, partial: Partial<ActionBlock> = {}): ActionBlock {
  const block: ActionBlock = {
    id: partial.id || createId(),
    type,
    disabled: partial.disabled,
    label: partial.label,
    params: { ...defaultParams(type), ...(partial.params || {}) }
  }
  if (blockUsesSlot(type, 'children')) block.children = partial.children ?? []
  if (type === 'ifCondition') {
    block.thenChildren = partial.thenChildren ?? []
    block.elseChildren = partial.elseChildren ?? []
  }
  return block
}

export function cloneBlock(block: ActionBlock): ActionBlock {
  return {
    id: createId(),
    type: block.type,
    disabled: block.disabled,
    label: block.label,
    params: structuredClone(block.params),
    children: block.children?.map(cloneBlock),
    thenChildren: block.thenChildren?.map(cloneBlock),
    elseChildren: block.elseChildren?.map(cloneBlock)
  }
}

export const BLOCK_GROUPS: { name: string; types: BlockType[] }[] = [
  { name: 'Navigation', types: ['openUrl', 'scroll', 'waitForSelector'] },
  { name: 'Mouse & Keyboard', types: ['click', 'fill', 'pressKey', 'selectOption', 'hover'] },
  { name: 'Waits & Data', types: ['sleep', 'extractText', 'screenshot', 'setVariable', 'evaluateJs'] },
  { name: 'Loops & Conditions', types: ['ifCondition', 'loopTimes', 'loopWhile', 'loopCsv', 'forEach', 'breakLoop', 'continueLoop'] }
]

export const BLOCK_LABELS: Record<BlockType, string> = {
  openUrl: 'Open URL',
  click: 'Click',
  fill: 'Fill',
  pressKey: 'Press key',
  selectOption: 'Select option',
  hover: 'Hover',
  scroll: 'Scroll',
  waitForSelector: 'Wait for element',
  sleep: 'Sleep',
  extractText: 'Extract text',
  screenshot: 'Screenshot',
  setVariable: 'Set variable',
  evaluateJs: 'Evaluate JS',
  ifCondition: 'If / Else',
  loopTimes: 'Loop N times',
  loopWhile: 'Loop while',
  loopCsv: 'Loop CSV rows',
  forEach: 'For each',
  breakLoop: 'Break',
  continueLoop: 'Continue'
}

export function blockSummary(block: ActionBlock): string {
  const p = block.params || {}
  const text = (key: string) => (p[key] == null ? '' : String(p[key]))
  switch (block.type) {
    case 'openUrl':
      return text('url')
    case 'click':
    case 'hover':
    case 'waitForSelector':
      return text('selector')
    case 'fill':
      return `${text('selector')} = ${text('value')}`
    case 'pressKey':
      return text('selector') ? `${text('key')} on ${text('selector')}` : text('key')
    case 'selectOption':
      return `${text('selector')} -> ${text('value')}`
    case 'scroll':
      return text('selector') || `wheel ${text('deltaY') || 400}`
    case 'sleep':
      return `${text('ms') || 0} ms`
    case 'extractText':
      return `${text('selector')} -> \${${text('varName')}}`
    case 'screenshot':
      return text('name') || 'shot'
    case 'setVariable':
      return `${text('name')} = ${text('value')}`
    case 'evaluateJs':
      return text('code').slice(0, 80)
    case 'loopTimes':
      return `${text('times') || 1} ×  \${${text('varName') || 'i'}}`
    case 'loopCsv':
      return text('file') || 'users.csv'
    case 'forEach':
      return `\${${text('listVar')}} as \${${text('itemVar')}}`
    case 'ifCondition':
    case 'loopWhile': {
      const cond = p.condition as ConditionExpr | undefined
      if (!cond) return ''
      if (cond.op === 'jsExpression') return cond.expression || 'js'
      if (cond.op === 'urlContains') return `url contains ${cond.expected || ''}`
      if (cond.op.startsWith('var')) return `${cond.varName || ''} ${cond.op} ${cond.expected || ''}`
      return `${cond.op} ${cond.selector || ''}`
    }
    default:
      return ''
  }
}
