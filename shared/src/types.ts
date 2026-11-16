export type BlockType =
  | 'openUrl'
  | 'click'
  | 'fill'
  | 'pressKey'
  | 'selectOption'
  | 'hover'
  | 'scroll'
  | 'waitForSelector'
  | 'sleep'
  | 'extractText'
  | 'screenshot'
  | 'setVariable'
  | 'evaluateJs'
  | 'ifCondition'
  | 'loopTimes'
  | 'loopWhile'
  | 'loopCsv'
  | 'forEach'
  | 'breakLoop'
  | 'continueLoop'

export type ConditionOp =
  | 'elementVisible'
  | 'elementHidden'
  | 'elementExists'
  | 'textContains'
  | 'urlContains'
  | 'varEquals'
  | 'varNotEquals'
  | 'varGreaterThan'
  | 'jsExpression'

export interface ConditionExpr {
  op: ConditionOp
  selector?: string
  expected?: string
  varName?: string
  timeoutMs?: number
  expression?: string
}

export type BlockSlot = 'children' | 'thenChildren' | 'elseChildren'

export interface ActionBlock {
  id: string
  type: BlockType
  disabled?: boolean
  label?: string
  params: Record<string, unknown>
  children?: ActionBlock[]
  thenChildren?: ActionBlock[]
  elseChildren?: ActionBlock[]
}

export type ProxyScheme = 'http' | 'https' | 'socks4' | 'socks5'

export interface ProxyEntry {
  type: ProxyScheme
  host: string
  port: string
  username?: string
  password?: string
}

export type ProxyMode = 'off' | 'single' | 'rotate_per_loop'
export type LoopErrorPolicy = 'stop' | 'continue_next_loop'

export interface RunConfig {
  fromLoop: number
  toLoop: number
  commandIntervalMs: number
  randomJitterMs: number
  onErrorInLoop: LoopErrorPolicy
  headed: boolean
  persistentProfile: boolean
  proxyMode: ProxyMode
  proxy?: ProxyEntry | null
  proxies: ProxyEntry[]
  csvFile?: string
  startUrl?: string
}

export interface WorkflowDocument {
  id: string
  name: string
  blocks: ActionBlock[]
  run: RunConfig
  updatedAt: string
}

export type RecordedKind = 'click' | 'fill' | 'select' | 'press' | 'openUrl'

export interface RecordedPayload {
  kind: RecordedKind
  selector?: string
  value?: string
  url?: string
  key?: string
}

export type StudioStatus = 'idle' | 'running' | 'recording'

export type StudioEvent =
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string; ts: number }
  | { type: 'step'; blockId: string; status: 'start' | 'ok' | 'error' | 'skip'; message?: string; ts: number }
  | { type: 'screenshot'; url: string; blockId?: string; ts: number }
  | { type: 'vars'; vars: Record<string, unknown>; loop: number; csv: Record<string, string>; ts: number }
  | { type: 'status'; status: StudioStatus; message?: string; ts: number }
  | { type: 'workflow'; workflow: WorkflowDocument; ts: number }
  | { type: 'recorded'; block: ActionBlock; ts: number }

export interface RuntimeCsvRow {
  [column: string]: string
}
