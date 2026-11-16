import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import {
  appendBlock,
  blockSummary,
  blockUsesSlot,
  findBlock,
  payloadToBlock,
  type BlockSlot,
  type ProxyEntry,
  type RecordedPayload,
  type RunConfig,
  type StudioStatus,
  type WorkflowDocument
} from '@rpa/shared'
import { ContextManager } from './context.js'
import { Hub } from './hub.js'
import { INJECTED_RECORDER } from './recorder/injected.js'
import { runBlocks } from './runner/block_runner.js'
import { runScript } from './runner/script_runner.js'
import { createRuntime, StoppedError } from './runtime.js'
import type { FileStore } from './store.js'

function proxyFor(run: RunConfig, loop: number): ProxyEntry | null {
  if (run.proxyMode === 'off') return null
  if (run.proxyMode === 'single') return run.proxy || null
  if (!run.proxies?.length) return null
  return run.proxies[(loop - 1) % run.proxies.length] || null
}

function isPayload(value: unknown): value is RecordedPayload {
  if (!value || typeof value !== 'object') return false
  const kind = (value as RecordedPayload).kind
  return kind === 'click' || kind === 'fill' || kind === 'select' || kind === 'press' || kind === 'openUrl'
}

export class Studio {
  private manager = new ContextManager()
  private status: StudioStatus = 'idle'
  private stopRequested = false
  private recordChain: Promise<void> = Promise.resolve()
  private recordTarget: { workflowId: string; parentId: string | null; slot: BlockSlot } | null = null
  private picker: { resolve: (value: { selector: string }) => void; reject: (error: Error) => void } | null = null

  constructor(
    private store: FileStore,
    private hub: Hub,
    private root: string
  ) {}

  getPage() {
    return this.manager.page
  }

  getStatus(): StudioStatus {
    return this.status
  }

  private emitStatus(status: StudioStatus, message?: string): void {
    this.status = status
    this.hub.broadcast({ type: 'status', status, message, ts: Date.now() })
  }

  private profileDir(): string {
    return path.join(this.root, '.profiles', 'default')
  }

  async run(workflowId: string, mode: 'blocks' | 'script'): Promise<{ ok: true; message: string }> {
    if (this.status !== 'idle') throw new Error('Studio is busy. Stop the current run or recording first.')
    this.stopRequested = false
    this.emitStatus('running', 'Running')
    let message = 'Run completed'
    try {
      await this.execute(workflowId, mode)
    } catch (error) {
      if (error instanceof StoppedError || this.stopRequested) {
        message = 'Stopped'
      } else {
        message = error instanceof Error ? error.message : String(error)
        this.hub.broadcast({ type: 'log', level: 'error', message, ts: Date.now() })
        throw error
      }
    } finally {
      await this.manager.close()
      this.emitStatus('idle', message)
    }
    if (message !== 'Stopped') {
      this.hub.broadcast({ type: 'log', level: 'info', message, ts: Date.now() })
    }
    return { ok: true, message }
  }

  private async execute(workflowId: string, mode: 'blocks' | 'script'): Promise<void> {
    const workflow = await this.store.readWorkflow(workflowId)
    const run = workflow.run
    const from = Math.max(1, Number(run.fromLoop) || 1)
    const to = Math.max(from, Number(run.toLoop) || from)
    let rows: Record<string, string>[] = []
    if (run.csvFile) {
      try {
        rows = await this.store.readCsv(run.csvFile)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.hub.broadcast({ type: 'log', level: 'warn', message: `CSV not loaded: ${message}`, ts: Date.now() })
      }
    }
    const source = mode === 'script' ? await this.store.readScript(workflowId) : ''
    await mkdir(this.profileDir(), { recursive: true })

    for (let loop = from; loop <= to; loop++) {
      if (this.stopRequested) throw new StoppedError()
      const proxy = proxyFor(run, loop)
      if (loop === from || run.proxyMode === 'rotate_per_loop') {
        if (run.proxyMode === 'rotate_per_loop' && run.persistentProfile) {
          this.hub.broadcast({
            type: 'log',
            level: 'warn',
            message: 'Persistent profile is ignored while proxies rotate per loop.',
            ts: Date.now()
          })
        }
        await this.manager.open({
          headed: !!run.headed,
          persistent: !!run.persistentProfile && run.proxyMode !== 'rotate_per_loop',
          profileDir: this.profileDir(),
          proxy,
          recordScript: undefined
        })
      }
      const page = this.manager.page
      if (!page) throw new Error('Browser page was not created')
      if (run.startUrl) await page.goto(run.startUrl, { waitUntil: 'domcontentloaded' })
      const csv = rows.length ? rows[Math.min(loop - 1, rows.length - 1)] : {}
      if (rows.length && loop - 1 >= rows.length) {
        this.hub.broadcast({
          type: 'log',
          level: 'warn',
          message: `Loop ${loop} is past the last CSV row. Reusing the last row.`,
          ts: Date.now()
        })
      }
      const ctx = createRuntime({
        page,
        store: this.store,
        emit: (event) => this.hub.broadcast(event),
        intervalMs: Number(run.commandIntervalMs) || 0,
        jitterMs: Number(run.randomJitterMs) || 0,
        isStopped: () => this.stopRequested,
        loop,
        csv
      })
      ctx.vars.loop = loop
      ctx.vars.LOOP = loop
      ctx.log('info', `Loop ${loop}/${to} started${proxy ? ` via ${proxy.type}://${proxy.host}:${proxy.port}` : ''}`)
      try {
        if (mode === 'script') await runScript(page, ctx, source)
        else await runBlocks(workflow.blocks, page, ctx)
        this.hub.broadcast({ type: 'vars', vars: ctx.vars, loop: ctx.loop, csv: ctx.csv, ts: Date.now() })
        ctx.log('info', `Loop ${loop} completed`)
      } catch (error) {
        if (this.stopRequested || error instanceof StoppedError) throw new StoppedError()
        const message = error instanceof Error ? error.message : String(error)
        ctx.log('error', `Loop ${loop} failed: ${message}`)
        if (run.onErrorInLoop === 'continue_next_loop' && loop < to) continue
        throw error
      }
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true
    if (this.picker) {
      this.picker.reject(new Error('Pick cancelled'))
      this.picker = null
    }
    this.recordTarget = null
    const wasRunning = this.status === 'running'
    await this.manager.close()
    if (!wasRunning) this.emitStatus('idle', 'Stopped')
  }

  async startRecording(input: {
    workflowId: string
    parentId?: string | null
    slot?: BlockSlot
    headed?: boolean
  }): Promise<void> {
    if (this.status !== 'idle') throw new Error('Studio is busy')
    const workflow = await this.store.readWorkflow(input.workflowId)
    this.recordTarget = {
      workflowId: workflow.id,
      parentId: input.parentId || null,
      slot: input.slot || 'children'
    }
    this.stopRequested = false
    this.emitStatus('recording', 'Recording')
    try {
      await mkdir(this.profileDir(), { recursive: true })
      const page = await this.manager.open({
        headed: input.headed !== false,
        persistent: !!workflow.run.persistentProfile && workflow.run.proxyMode !== 'rotate_per_loop',
        profileDir: this.profileDir(),
        proxy: workflow.run.proxyMode === 'single' ? workflow.run.proxy : null,
        recordScript: INJECTED_RECORDER,
        onRecord: (payload) => {
          this.recordChain = this.recordChain
            .then(() => this.handleRecord(payload))
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : String(error)
              this.hub.broadcast({ type: 'log', level: 'error', message, ts: Date.now() })
            })
        }
      })
      if (workflow.run.startUrl) await page.goto(workflow.run.startUrl, { waitUntil: 'domcontentloaded' })
      this.hub.broadcast({ type: 'log', level: 'info', message: 'Recorder attached. Actions append to the workflow.', ts: Date.now() })
    } catch (error) {
      this.recordTarget = null
      await this.manager.close()
      this.emitStatus('idle', 'Recording failed')
      throw error
    }
  }

  setRecordTarget(parentId: string | null, slot: BlockSlot): void {
    if (!this.recordTarget) throw new Error('Not recording')
    this.recordTarget = { ...this.recordTarget, parentId, slot }
  }

  async stopRecording(): Promise<void> {
    if (this.status !== 'recording') return
    await this.recordChain
    this.recordTarget = null
    await this.manager.close()
    this.emitStatus('idle', 'Recording stopped')
  }

  async pick(workflowId: string): Promise<{ selector: string }> {
    if (this.status === 'running') throw new Error('Cannot pick an element while a run is active')
    if (!this.manager.page) {
      const workflow = await this.store.readWorkflow(workflowId)
      const opened = await this.manager.open({
        headed: true,
        persistent: false,
        profileDir: this.profileDir(),
        proxy: null,
        recordScript: INJECTED_RECORDER,
        onRecord: (payload) => {
          this.recordChain = this.recordChain.then(() => this.handleRecord(payload))
        }
      })
      if (workflow.run.startUrl) {
        await opened.goto(workflow.run.startUrl, { waitUntil: 'domcontentloaded' })
      }
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.picker) {
          this.picker = null
          reject(new Error('Timed out waiting for an element click'))
        }
      }, 20000)
      this.picker = {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        }
      }
    })
  }

  private async handleRecord(payload: unknown): Promise<void> {
    if (!isPayload(payload)) return
    if (this.picker && payload.kind === 'click' && payload.selector) {
      const pending = this.picker
      this.picker = null
      pending.resolve({ selector: payload.selector })
      return
    }
    if (this.status !== 'recording' || !this.recordTarget) return
    const workflow = await this.store.readWorkflow(this.recordTarget.workflowId)
    const parent = this.recordTarget.parentId ? findBlock(workflow.blocks, this.recordTarget.parentId) : null
    const slot = parent && blockUsesSlot(parent.type, this.recordTarget.slot) ? this.recordTarget.slot : 'children'
    const parentId = parent && blockUsesSlot(parent.type, slot) ? parent.id : null
    const block = payloadToBlock(payload)
    const next: WorkflowDocument = {
      ...workflow,
      blocks: appendBlock(workflow.blocks, parentId, parentId ? slot : 'children', block)
    }
    const saved = await this.store.writeWorkflow(next, true)
    this.hub.broadcast({ type: 'recorded', block, ts: Date.now() })
    this.hub.broadcast({ type: 'workflow', workflow: saved, ts: Date.now() })
    this.hub.broadcast({
      type: 'log',
      level: 'info',
      message: `Recorded ${block.type}${blockSummary(block) ? `: ${blockSummary(block)}` : ''}`,
      ts: Date.now()
    })
  }
}
