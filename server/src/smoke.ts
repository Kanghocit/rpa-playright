import { chromium } from 'playwright'
import { compileBlocksToPlaywrightJs, demoWorkflow, parseProxyLine, payloadToBlock, type RecordedPayload } from '@rpa/shared'
import { INJECTED_RECORDER } from './recorder/injected.js'
import { startServer } from './index.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function waitFor(label: string, fn: () => boolean | Promise<boolean>, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function testCodegen() {
  const workflow = demoWorkflow()
  const source = compileBlocksToPlaywrightJs(workflow)
  assert(source.includes('export async function runWorkflow'), 'missing export')
  assert(source.includes('for (let __i = 1; __i <= __times; __i++)'), 'missing times loop')
  assert(source.includes('await ctx.testCondition'), 'missing condition')
  assert(source.includes('break;'), 'missing break')
  assert(source.includes('#next'), 'missing recorded selector in demo')
  const proxy = parseProxyLine('http://ada:secret@127.0.0.1:8080')
  assert(proxy?.username === 'ada' && proxy.port === '8080' && proxy.type === 'http', 'proxy parse failed')
  const block = payloadToBlock({ kind: 'fill', selector: '#name', value: 'Ada' })
  assert(block.type === 'fill' && block.params.value === 'Ada', 'payload mapping failed')
}

async function testRecorderInjection() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const events: RecordedPayload[] = []
  await context.exposeBinding('__rpaEmit', async (_source, payload: RecordedPayload) => {
    events.push(payload)
  })
  await context.addInitScript(INJECTED_RECORDER)
  const page = await context.newPage()
  const html = `<!doctype html><button id="next">Next</button><input id="name" /><select id="color"><option value="red">Red</option><option value="blue">Blue</option></select>`
  await page.goto(`data:text/html,${encodeURIComponent(html)}`)
  await page.click('#next')
  await page.fill('#name', 'Ada')
  await page.selectOption('#color', 'blue')
  await waitFor('fill event', () => events.some((event) => event.kind === 'fill' && event.value === 'Ada'))
  await browser.close()
  const click = events.find((event) => event.kind === 'click')
  const selected = events.find((event) => event.kind === 'select')
  assert(click?.selector === '#next', `expected #next click, got ${JSON.stringify(events)}`)
  assert(selected?.value === 'blue', 'expected select blue')
  assert(payloadToBlock(click!).type === 'click', 'click did not become a block')
  assert(payloadToBlock({ kind: 'fill', selector: '#name', value: 'Ada' }).params.selector === '#name', 'fill block mismatch')
}

async function testServerRun() {
  const started = await startServer(0)
  const base = `http://127.0.0.1:${started.port}`
  const events: { type: string; status?: string; vars?: Record<string, unknown>; message?: string }[] = []
  const socket = new WebSocket(`ws://127.0.0.1:${started.port}/ws`)
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve()
    socket.onerror = () => reject(new Error('WebSocket failed'))
  })
  socket.onmessage = (event) => {
    events.push(JSON.parse(String(event.data)))
  }

  const workflow = demoWorkflow()
  workflow.id = 'smoke-demo'
  workflow.name = 'Smoke demo'
  workflow.run = {
    ...workflow.run,
    headed: false,
    persistentProfile: false,
    commandIntervalMs: 0,
    randomJitterMs: 0,
    fromLoop: 1,
    toLoop: 1,
    proxyMode: 'off',
    startUrl: `${base}/fixture/demo.html`
  }
  workflow.blocks = structuredClone(workflow.blocks)
  const open = workflow.blocks[0]
  open.params = { ...open.params, url: `${base}/fixture/demo.html` }

  const saved = await fetch(`${base}/api/workflows/smoke-demo`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(workflow)
  })
  if (saved.status === 404 || saved.status === 400) {
    await fetch(`${base}/api/workflows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'smoke demo' })
    })
  }
  const put = await fetch(`${base}/api/workflows/${workflow.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(workflow)
  })
  assert(put.ok, `save workflow failed ${(await put.text())}`)

  const script = compileBlocksToPlaywrightJs(workflow)
  assert((await (await fetch(`${base}/api/workflows/smoke-demo/script`)).json()).source.includes('runWorkflow'), 'script was not saved')

  for (const mode of ['blocks', 'script'] as const) {
    events.length = 0
    const response = await fetch(`${base}/api/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflowId: 'smoke-demo', mode })
    })
    const body = await response.json()
    assert(response.ok, `${mode} run failed ${JSON.stringify(body)}`)
    await waitFor(`${mode} vars`, () => events.some((event) => event.type === 'vars' && event.vars?.count === '2'))
    assert(events.some((event) => event.type === 'status' && event.status === 'idle'), `${mode} did not return to idle`)
  }

  const created = await (await fetch(`${base}/api/workflows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Record smoke' })
  })).json() as { id: string }
  const recordWorkflow = await (await fetch(`${base}/api/workflows/${created.id}`)).json() as typeof workflow
  recordWorkflow.run.startUrl = `${base}/fixture/demo.html`
  recordWorkflow.run.headed = false
  recordWorkflow.run.persistentProfile = false
  await fetch(`${base}/api/workflows/${created.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(recordWorkflow)
  })
  const recording = await fetch(`${base}/api/record/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workflowId: created.id, headed: false })
  })
  assert(recording.ok, `record start failed ${await recording.text()}`)
  const page = started.studio.getPage()
  assert(page, 'recorder did not open a page')
  await page.click('#next')
  await page.fill('#name', 'Ada')
  await waitFor('recorded click', async () => {
    const doc = await started.store.readWorkflow(created.id)
    return doc.blocks.some((block) => block.type === 'click' && block.params.selector === '#next')
      && doc.blocks.some((block) => block.type === 'fill' && block.params.value === 'Ada')
  })
  await fetch(`${base}/api/record/stop`, { method: 'POST' })
  await started.store.deleteWorkflow(created.id)
  await started.store.deleteWorkflow('smoke-demo')

  socket.close()
  await new Promise<void>((resolve) => started.server.close(() => resolve()))
}

async function main() {
  await testCodegen()
  await testRecorderInjection()
  await testServerRun()
  console.log('Smoke test passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
