import express, { type NextFunction, type Request, type Response } from 'express'
import { defaultRunConfig, type BlockSlot, type WorkflowDocument } from '@rpa/shared'
import type { FileStore } from './store.js'
import type { Studio } from './studio.js'

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }
}

function slug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return base || 'workflow'
}

export function createApp(store: FileStore, studio: Studio) {
  const app = express()
  app.use(express.json({ limit: '2mb' }))
  app.use('/fixture', express.static(store.fixturesDir))
  app.use('/artifacts', express.static(store.runsDir))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, status: studio.getStatus() })
  })

  app.get('/api/workflows', asyncRoute(async (_req, res) => {
    res.json(await store.listWorkflows())
  }))

  app.post('/api/workflows', asyncRoute(async (req, res) => {
    const name = String(req.body?.name || 'Untitled workflow')
    let id = slug(name)
    const existing = await store.listWorkflows()
    if (existing.some((item) => item.id === id)) id = `${id}-${Date.now().toString(36)}`
    const doc: WorkflowDocument = {
      id,
      name,
      blocks: [],
      run: defaultRunConfig(),
      updatedAt: new Date().toISOString()
    }
    res.status(201).json(await store.writeWorkflow(doc, true))
  }))

  app.get('/api/workflows/:id', asyncRoute(async (req, res) => {
    res.json(await store.readWorkflow(req.params.id))
  }))

  app.put('/api/workflows/:id', asyncRoute(async (req, res) => {
    const syncScript = req.body?.syncScript !== false
    const doc = req.body as WorkflowDocument
    delete (doc as WorkflowDocument & { syncScript?: boolean }).syncScript
    if (!doc || doc.id !== req.params.id) {
      res.status(400).json({ error: 'Workflow id does not match the URL' })
      return
    }
    res.json(await store.writeWorkflow(doc, syncScript))
  }))

  app.delete('/api/workflows/:id', asyncRoute(async (req, res) => {
    await store.deleteWorkflow(req.params.id)
    res.json({ ok: true })
  }))

  app.get('/api/workflows/:id/script', asyncRoute(async (req, res) => {
    res.json({ source: await store.readScript(req.params.id) })
  }))

  app.put('/api/workflows/:id/script', asyncRoute(async (req, res) => {
    const source = String(req.body?.source ?? '')
    await store.writeScript(req.params.id, source)
    res.json({ ok: true })
  }))

  app.get('/api/csv', asyncRoute(async (_req, res) => {
    res.json(await store.listCsv())
  }))

  app.post('/api/run', asyncRoute(async (req, res) => {
    const workflowId = String(req.body?.workflowId || '')
    const mode = req.body?.mode === 'script' ? 'script' : 'blocks'
    const result = await studio.run(workflowId, mode)
    res.json(result)
  }))

  app.post('/api/stop', asyncRoute(async (_req, res) => {
    await studio.stop()
    res.json({ ok: true })
  }))

  app.post('/api/record/start', asyncRoute(async (req, res) => {
    await studio.startRecording({
      workflowId: String(req.body?.workflowId || ''),
      parentId: req.body?.parentId ?? null,
      slot: (req.body?.slot || 'children') as BlockSlot,
      headed: req.body?.headed !== false
    })
    res.json({ ok: true })
  }))

  app.post('/api/record/target', asyncRoute(async (req, res) => {
    studio.setRecordTarget(req.body?.parentId ?? null, (req.body?.slot || 'children') as BlockSlot)
    res.json({ ok: true })
  }))

  app.post('/api/record/stop', asyncRoute(async (_req, res) => {
    await studio.stopRecording()
    res.json({ ok: true })
  }))

  app.post('/api/pick', asyncRoute(async (req, res) => {
    const selector = await studio.pick(String(req.body?.workflowId || ''))
    res.json(selector)
  }))

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : String(error)
    const missing = /ENOENT/.test(message)
    res.status(missing ? 404 : 400).json({ error: message })
  })

  return app
}
