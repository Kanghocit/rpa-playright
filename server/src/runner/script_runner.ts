import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Page } from 'playwright'
import type { Runtime } from '../runtime.js'

export async function runScript(page: Page, ctx: Runtime, source: string): Promise<void> {
  if (!source.trim()) throw new Error('Script is empty')
  const dir = await mkdtemp(path.join(tmpdir(), 'rpa-script-'))
  const file = path.join(dir, `workflow-${Date.now()}.mjs`)
  await writeFile(file, source)
  const imported = await import(pathToFileURL(file).href)
  if (typeof imported.runWorkflow !== 'function') {
    throw new Error('Script must export async function runWorkflow(page, ctx)')
  }
  await imported.runWorkflow(page, ctx)
}
