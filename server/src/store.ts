import path from 'node:path'
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import {
  compileBlocksToPlaywrightJs,
  defaultRunConfig,
  demoWorkflow,
  type WorkflowDocument
} from '@rpa/shared'

export class FileStore {
  readonly workflowsDir: string
  readonly scriptsDir: string
  readonly dataDir: string
  readonly runsDir: string
  readonly shotsDir: string
  readonly fixturesDir: string

  constructor(readonly root: string) {
    this.workflowsDir = path.join(root, 'workflows')
    this.scriptsDir = path.join(root, 'scripts')
    this.dataDir = path.join(root, 'data')
    this.runsDir = path.join(root, 'runs')
    this.shotsDir = path.join(root, 'runs', 'screenshots')
    this.fixturesDir = path.join(root, 'server', 'fixtures')
  }

  async init(): Promise<void> {
    await Promise.all([
      mkdir(this.workflowsDir, { recursive: true }),
      mkdir(this.scriptsDir, { recursive: true }),
      mkdir(this.dataDir, { recursive: true }),
      mkdir(this.shotsDir, { recursive: true })
    ])
    const demoPath = path.join(this.workflowsDir, 'demo-loop.json')
    try {
      await readFile(demoPath, 'utf8')
    } catch {
      await this.writeWorkflow(demoWorkflow(), true)
    }
  }

  private assertId(id: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid workflow id')
  }

  async listWorkflows(): Promise<{ id: string; name: string; updatedAt: string }[]> {
    const files = await readdir(this.workflowsDir)
    const docs = await Promise.all(
      files.filter((file) => file.endsWith('.json')).map(async (file) => {
        const doc = JSON.parse(await readFile(path.join(this.workflowsDir, file), 'utf8')) as WorkflowDocument
        return { id: doc.id, name: doc.name, updatedAt: doc.updatedAt }
      })
    )
    return docs.sort((a, b) => a.name.localeCompare(b.name))
  }

  async readWorkflow(id: string): Promise<WorkflowDocument> {
    this.assertId(id)
    const raw = await readFile(path.join(this.workflowsDir, `${id}.json`), 'utf8')
    const doc = JSON.parse(raw) as WorkflowDocument
    doc.run = { ...defaultRunConfig(), ...doc.run, proxies: doc.run?.proxies || [] }
    return doc
  }

  async writeWorkflow(doc: WorkflowDocument, syncScript: boolean): Promise<WorkflowDocument> {
    this.assertId(doc.id)
    doc.updatedAt = new Date().toISOString()
    doc.run = { ...defaultRunConfig(), ...doc.run, proxies: doc.run?.proxies || [] }
    await writeFile(path.join(this.workflowsDir, `${doc.id}.json`), JSON.stringify(doc, null, 2))
    if (syncScript) await this.writeScript(doc.id, compileBlocksToPlaywrightJs(doc))
    return doc
  }

  async deleteWorkflow(id: string): Promise<void> {
    this.assertId(id)
    await rm(path.join(this.workflowsDir, `${id}.json`), { force: true })
    await rm(path.join(this.scriptsDir, `${id}.js`), { force: true })
  }

  scriptPath(id: string): string {
    this.assertId(id)
    return path.join(this.scriptsDir, `${id}.js`)
  }

  async readScript(id: string): Promise<string> {
    return readFile(this.scriptPath(id), 'utf8')
  }

  async writeScript(id: string, source: string): Promise<void> {
    await writeFile(this.scriptPath(id), source)
  }

  private csvPath(name: string): string {
    if (!/^[a-zA-Z0-9_.-]+\.csv$/.test(name) || name.includes('..')) {
      throw new Error('Invalid CSV name')
    }
    return path.join(this.dataDir, name)
  }

  async listCsv(): Promise<{ name: string; rows: number; columns: string[] }[]> {
    const files = (await readdir(this.dataDir)).filter((file) => file.endsWith('.csv'))
    return Promise.all(files.map(async (name) => {
      const rows = await this.readCsv(name)
      return { name, rows: rows.length, columns: Object.keys(rows[0] || {}) }
    }))
  }

  async readCsv(name: string): Promise<Record<string, string>[]> {
    const raw = await readFile(this.csvPath(name), 'utf8')
    const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]
    return rows
  }
}
