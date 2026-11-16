import { BLOCK_LABELS, defaultCondition, findBlock, type ActionBlock, type ConditionExpr, type ConditionOp } from '@rpa/shared'

const OPS: ConditionOp[] = [
  'elementVisible', 'elementHidden', 'elementExists', 'textContains', 'urlContains',
  'varEquals', 'varNotEquals', 'varGreaterThan', 'jsExpression'
]

export function Inspector({
  blocks,
  selectedId,
  onChange,
  onDelete,
  onDuplicate,
  onToggle,
  onPick
}: {
  blocks: ActionBlock[]
  selectedId: string | null
  onChange: (block: ActionBlock) => void
  onDelete: () => void
  onDuplicate: () => void
  onToggle: () => void
  onPick: (field: string) => void
}) {
  const block = selectedId ? findBlock(blocks, selectedId) : null
  if (!block) {
    return (
      <aside className="inspector">
        <p className="kicker">Inspector</p>
        <h2 className="panel-title">No block selected</h2>
        <p className="hint">Choose a block to edit its selector, value, loop, or condition.</p>
      </aside>
    )
  }
  const setParam = (key: string, value: unknown) => onChange({ ...block, params: { ...block.params, [key]: value } })
  const condition = (block.params.condition as ConditionExpr) || defaultCondition()
  return (
    <aside className="inspector">
      <div>
        <p className="kicker">{block.type}</p>
        <h2 className="panel-title">{BLOCK_LABELS[block.type]}</h2>
      </div>
      <label className="field">
        Label
        <input value={block.label || ''} onChange={(event) => onChange({ ...block, label: event.target.value })} />
      </label>
      <Field block={block} name="url" label="URL" onChange={setParam} />
      <SelectorField block={block} onChange={setParam} onPick={() => onPick('selector')} />
      <Field block={block} name="value" label={block.type === 'fill' || block.type === 'selectOption' || block.type === 'setVariable' ? 'Value' : ''} onChange={setParam} />
      <Field block={block} name="key" label="Key" onChange={setParam} />
      <Field block={block} name="varName" label="Variable" onChange={setParam} />
      <Field block={block} name="name" label={block.type === 'setVariable' || block.type === 'screenshot' ? 'Name' : ''} onChange={setParam} />
      <Field block={block} name="saveAs" label={block.type === 'evaluateJs' ? 'Save result as' : ''} onChange={setParam} />
      <Field block={block} name="times" label="Times" onChange={setParam} />
      <Field block={block} name="ms" label="Milliseconds" onChange={setParam} />
      <Field block={block} name="timeoutMs" label={block.type === 'waitForSelector' ? 'Timeout ms' : ''} onChange={setParam} />
      <Field block={block} name="deltaY" label={block.type === 'scroll' ? 'Delta Y' : ''} onChange={setParam} />
      <Field block={block} name="file" label={block.type === 'loopCsv' ? 'CSV file' : ''} onChange={setParam} />
      <Field block={block} name="listVar" label={block.type === 'forEach' ? 'List variable' : ''} onChange={setParam} />
      <Field block={block} name="itemVar" label={block.type === 'forEach' ? 'Item variable' : ''} onChange={setParam} />
      <Field block={block} name="delimiter" label={block.type === 'forEach' ? 'Delimiter' : ''} onChange={setParam} />
      <Field block={block} name="maxIterations" label={block.type === 'loopWhile' ? 'Max iterations' : ''} onChange={setParam} />
      {block.type === 'waitForSelector' && (
        <label className="field">
          State
          <select value={String(block.params.state || 'visible')} onChange={(event) => setParam('state', event.target.value)}>
            <option value="visible">visible</option>
            <option value="hidden">hidden</option>
            <option value="attached">attached</option>
          </select>
        </label>
      )}
      {block.type === 'evaluateJs' && (
        <>
          <label className="field">
            Target
            <select value={String(block.params.target || 'page')} onChange={(event) => setParam('target', event.target.value)}>
              <option value="page">Page</option>
              <option value="vars">Variables</option>
            </select>
          </label>
          <label className="field">
            Code
            <textarea value={String(block.params.code || '')} onChange={(event) => setParam('code', event.target.value)} />
          </label>
        </>
      )}
      {(block.type === 'ifCondition' || block.type === 'loopWhile') && (
        <ConditionEditor condition={condition} onChange={(next) => setParam('condition', next)} />
      )}
      <p className="callout">Values can use {'${var}'}, {'${loop}'}, and {'${csv.column}'}.</p>
      <div className="row-actions">
        <button type="button" className="btn btn-ghost" onClick={onDuplicate}>Duplicate</button>
        <button type="button" className="btn btn-ghost" onClick={onToggle}>{block.disabled ? 'Enable' : 'Disable'}</button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>
      </div>
    </aside>
  )
}

function Field({ block, name, label, onChange }: { block: ActionBlock; name: string; label: string; onChange: (key: string, value: string) => void }) {
  if (!label || !(name in block.params)) return null
  return (
    <label className="field">
      {label}
      <input value={String(block.params[name] ?? '')} onChange={(event) => onChange(name, event.target.value)} />
    </label>
  )
}

function SelectorField({ block, onChange, onPick }: { block: ActionBlock; onChange: (key: string, value: string) => void; onPick: () => void }) {
  if (!('selector' in block.params)) return null
  return (
    <label className="field">
      Selector
      <div className="selector-row">
        <input value={String(block.params.selector ?? '')} onChange={(event) => onChange('selector', event.target.value)} />
        <button type="button" className="btn btn-soft" onClick={onPick}>Pick</button>
      </div>
    </label>
  )
}

function ConditionEditor({ condition, onChange }: { condition: ConditionExpr; onChange: (next: ConditionExpr) => void }) {
  const set = (patch: Partial<ConditionExpr>) => onChange({ ...condition, ...patch })
  const needsSelector = condition.op === 'elementVisible' || condition.op === 'elementHidden' || condition.op === 'elementExists' || condition.op === 'textContains'
  const needsExpected = condition.op === 'textContains' || condition.op === 'urlContains' || condition.op === 'varEquals' || condition.op === 'varNotEquals' || condition.op === 'varGreaterThan'
  const needsVar = condition.op.startsWith('var')
  return (
    <div className="inspector-card">
      <label className="field">
        Condition
        <select value={condition.op} onChange={(event) => set({ op: event.target.value as ConditionOp })}>
          {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
        </select>
      </label>
      {needsSelector && <label className="field">Selector<input value={condition.selector || ''} onChange={(event) => set({ selector: event.target.value })} /></label>}
      {needsVar && <label className="field">Variable<input value={condition.varName || ''} onChange={(event) => set({ varName: event.target.value })} /></label>}
      {needsExpected && <label className="field">Expected<input value={condition.expected || ''} onChange={(event) => set({ expected: event.target.value })} /></label>}
      {condition.op === 'jsExpression' && <label className="field">Expression<input value={condition.expression || ''} onChange={(event) => set({ expression: event.target.value })} /></label>}
      {needsSelector && <label className="field">Timeout ms<input value={String(condition.timeoutMs ?? 1500)} onChange={(event) => set({ timeoutMs: Number(event.target.value) })} /></label>}
    </div>
  )
}
