import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  BLOCK_LABELS,
  compileBlocksToPlaywrightJs,
  createBlock,
  duplicateBlock,
  findBlock,
  insertBlock,
  isContainer,
  locate,
  moveBlock,
  removeBlock,
  updateBlock,
  type ActionBlock,
  type BlockSlot,
  type BlockType,
  type StudioEvent,
  type WorkflowDocument
} from '@rpa/shared'
import { Circle, Play, Plus, Square, Workflow } from 'lucide-react'
import { api } from './api'
import { BlockTree } from './components/BlockTree'
import { Inspector } from './components/Inspector'
import { JsEditor } from './components/JsEditor'
import { LivePanel } from './components/LivePanel'
import { Palette } from './components/Palette'
import { RunConfigForm } from './components/RunConfigForm'

const collision: CollisionDetection = (args) => {
  const hit = pointerWithin(args)
  return hit.length ? hit : closestCenter(args)
}

function dropTarget(blocks: ActionBlock[], over: DragEndEvent['over']) {
  if (!over) return null
  const data = over.data.current
  if (data?.container) {
    const parentId = (data.parentId ?? null) as string | null
    const slot = data.slot as BlockSlot
    const list = parentId ? (findBlock(blocks, parentId)?.[slot] ?? []) : blocks
    return { parentId, slot, index: list.length }
  }
  const loc = locate(blocks, String(over.id))
  if (!loc) return null
  return { parentId: loc.parent?.id ?? null, slot: loc.slot, index: loc.index }
}

export function App() {
  const [summaries, setSummaries] = useState<{ id: string; name: string }[]>([])
  const [workflow, setWorkflow] = useState<WorkflowDocument | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'blocks' | 'js'>('blocks')
  const [mode, setMode] = useState<'blocks' | 'script'>('blocks')
  const [detached, setDetached] = useState(false)
  const [script, setScript] = useState('')
  const [events, setEvents] = useState<StudioEvent[]>([])
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [status, setStatus] = useState('idle')
  const [csvFiles, setCsvFiles] = useState<string[]>([])
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const skipSave = useRef(true)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const generated = workflow ? compileBlocksToPlaywrightJs(workflow) : ''

  async function refreshList(selectId?: string) {
    const list = await api.workflows()
    setSummaries(list)
    const id = selectId || workflow?.id || list[0]?.id
    if (id) await openWorkflow(id)
  }

  async function openWorkflow(id: string) {
    const doc = await api.workflow(id)
    skipSave.current = true
    setWorkflow(doc)
    setSelectedId(null)
    setDetached(false)
    try { setScript((await api.script(id)).source) } catch { setScript(compileBlocksToPlaywrightJs(doc)) }
  }

  useEffect(() => {
    refreshList().catch((err: Error) => setError(err.message))
    api.csv().then((rows) => setCsvFiles(rows.map((row) => row.name))).catch(() => setCsvFiles([]))
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as StudioEvent
      setEvents((prev) => [...prev.slice(-200), event])
      if (event.type === 'status') setStatus(event.status)
      if (event.type === 'step' && event.status === 'start') setActiveStep(event.blockId)
      if (event.type === 'workflow') {
        skipSave.current = true
        setWorkflow(event.workflow)
        setScript(compileBlocksToPlaywrightJs(event.workflow))
      }
    }
    return () => socket.close()
    // The socket stays up for the life of the studio page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!workflow) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    const timer = window.setTimeout(() => {
      api.save(workflow, !detached).catch((err: Error) => setError(err.message))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [workflow, detached])

  function append(type: BlockType) {
    if (!workflow) return
    const block = createBlock(type)
    const selected = selectedId ? findBlock(workflow.blocks, selectedId) : null
    const parentId = selected && isContainer(selected.type) ? selected.id : null
    const slot: BlockSlot = selected?.type === 'ifCondition' ? 'thenChildren' : 'children'
    setSelectedId(block.id)
    setWorkflow({ ...workflow, blocks: insertBlock(workflow.blocks, parentId, parentId ? slot : 'children', parentId ? (selected?.[slot]?.length || 0) : workflow.blocks.length, block) })
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null)
    if (!workflow || !event.over) return
    const dest = dropTarget(workflow.blocks, event.over)
    if (!dest) return
    if (event.active.data.current?.fromPalette) {
      const type = event.active.data.current.type as BlockType
      const block = createBlock(type)
      setSelectedId(block.id)
      setWorkflow({ ...workflow, blocks: insertBlock(workflow.blocks, dest.parentId, dest.slot, dest.index, block) })
      return
    }
    if (String(event.active.id) === String(event.over.id)) return
    setWorkflow({ ...workflow, blocks: moveBlock(workflow.blocks, String(event.active.id), dest.parentId, dest.slot, dest.index) })
  }

  async function run() {
    if (!workflow) return
    setError('')
    try {
      await api.save(workflow, !detached)
      if (detached) await api.saveScript(workflow.id, script)
      await api.run(workflow.id, mode)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function toggleRecord() {
    if (!workflow) return
    setError('')
    try {
      if (status === 'recording') {
        await api.recordStop()
        return
      }
      await api.save(workflow, !detached)
      const selected = selectedId ? findBlock(workflow.blocks, selectedId) : null
      const parentId = selected && isContainer(selected.type) ? selected.id : null
      const slot: BlockSlot = selected?.type === 'ifCondition' ? 'thenChildren' : 'children'
      await api.recordStart(workflow.id, parentId, slot)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function pick(field: string) {
    if (!workflow || !selectedId) return
    setError('')
    try {
      const result = await api.pick(workflow.id)
      const current = findBlock(workflow.blocks, selectedId)
      if (!current) return
      setWorkflow({
        ...workflow,
        blocks: updateBlock(workflow.blocks, selectedId, { params: { ...current.params, [field]: result.selector } })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(event) => setDragging(String(event.active.data.current?.type || event.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex h-screen flex-col">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark"><Workflow size={18} strokeWidth={1.75} /></span>
            <div>
              <h1>Playwright RPA</h1>
              <p>Visual studio</p>
            </div>
          </div>
          <label className="field field-inline">
            Workflow
            <select value={workflow?.id || ''} onChange={(event) => openWorkflow(event.target.value).catch((err: Error) => setError(err.message))}>
              {summaries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="field field-inline">
            Name
            <input value={workflow?.name || ''} onChange={(event) => workflow && setWorkflow({ ...workflow, name: event.target.value })} />
          </label>
          <div className="topbar-actions">
            <button type="button" className="btn btn-primary" onClick={run} disabled={status !== 'idle'}><Play size={16} /> Play</button>
            <button type="button" className="btn btn-ghost" onClick={() => api.stop().catch((err: Error) => setError(err.message))}><Square size={16} /> Stop</button>
            <button type="button" className={status === 'recording' ? 'btn btn-danger' : 'btn btn-warn'} onClick={toggleRecord}>
              <Circle size={16} /> {status === 'recording' ? 'Stop recording' : 'Record'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => api.create('New workflow').then((doc) => refreshList(doc.id)).catch((err: Error) => setError(err.message))}><Plus size={16} /> New</button>
            <span className={`chip ${status === 'running' ? 'chip-run' : status === 'recording' ? 'chip-rec' : 'chip-ok'}`}><span className="dot" />{status}</span>
          </div>
        </header>
        {error && <p className="alert">{error}</p>}
        {workflow && (
          <RunConfigForm
            run={workflow.run}
            mode={mode}
            csvFiles={csvFiles}
            onMode={setMode}
            onChange={(run) => setWorkflow({ ...workflow, run })}
          />
        )}
        <div className="workspace">
          <Palette onAdd={append} />
          <main className="canvas">
            <div className="tabs">
              <button type="button" className={`tab ${tab === 'blocks' ? 'is-active' : ''}`} onClick={() => setTab('blocks')}>Blocks</button>
              <button type="button" className={`tab ${tab === 'js' ? 'is-active' : ''}`} onClick={() => setTab('js')}>JavaScript</button>
            </div>
            <div className="canvas-scroll">
              {tab === 'blocks' && workflow && (
                <BlockTree blocks={workflow.blocks} selectedId={selectedId} activeId={activeStep} onSelect={setSelectedId} />
              )}
              {tab === 'js' && (
                <div className="h-full">
                  <JsEditor
                    value={detached ? script : generated}
                    detached={detached}
                    onChange={(value) => {
                      setScript(value)
                      if (workflow) api.saveScript(workflow.id, value).catch((err: Error) => setError(err.message))
                    }}
                    onDetach={() => {
                      setScript(generated)
                      setDetached(true)
                      if (workflow) api.saveScript(workflow.id, generated).catch((err: Error) => setError(err.message))
                    }}
                    onReset={() => {
                      setDetached(false)
                      setScript(generated)
                      if (workflow) api.save(workflow, true).catch((err: Error) => setError(err.message))
                    }}
                  />
                </div>
              )}
            </div>
          </main>
          {workflow && (
            <Inspector
              blocks={workflow.blocks}
              selectedId={selectedId}
              onChange={(block) => setWorkflow({ ...workflow, blocks: updateBlock(workflow.blocks, block.id, block) })}
              onDelete={() => {
                if (!selectedId) return
                setWorkflow({ ...workflow, blocks: removeBlock(workflow.blocks, selectedId).blocks })
                setSelectedId(null)
              }}
              onDuplicate={() => selectedId && setWorkflow({ ...workflow, blocks: duplicateBlock(workflow.blocks, selectedId) })}
              onToggle={() => {
                const current = selectedId ? findBlock(workflow.blocks, selectedId) : null
                if (!current || !selectedId) return
                setWorkflow({ ...workflow, blocks: updateBlock(workflow.blocks, selectedId, { disabled: !current.disabled }) })
              }}
              onPick={pick}
            />
          )}
        </div>
        <LivePanel events={events} activeId={activeStep} />
      </div>
      <DragOverlay>
        {dragging && <div className="drag-preview">{BLOCK_LABELS[dragging as BlockType] || 'Block'}</div>}
      </DragOverlay>
    </DndContext>
  )
}
