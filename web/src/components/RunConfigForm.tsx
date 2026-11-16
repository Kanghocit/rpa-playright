import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatProxy, parseProxyLine, parseProxyList, type RunConfig } from '@rpa/shared'

export function RunConfigForm({
  run,
  mode,
  csvFiles,
  onChange,
  onMode
}: {
  run: RunConfig
  mode: 'blocks' | 'script'
  csvFiles: string[]
  onChange: (run: RunConfig) => void
  onMode: (mode: 'blocks' | 'script') => void
}) {
  const set = (patch: Partial<RunConfig>) => onChange({ ...run, ...patch })
  const [open, setOpen] = useState(false)
  return (
    <section className="disclosure">
      <button type="button" className="disclosure-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronDown className={`chevron ${open ? '' : 'is-shut'}`} size={16} />
        Run settings
        <span className="hint">loops {run.fromLoop}–{run.toLoop} · {mode === 'script' ? 'JavaScript' : 'blocks'} · {run.proxyMode === 'off' ? 'no proxy' : run.proxyMode}</span>
      </button>
      {open && <div className="runbar">
      <label className="field">Run with
        <select value={mode} onChange={(event) => onMode(event.target.value as 'blocks' | 'script')}>
          <option value="blocks">Visual blocks</option>
          <option value="script">Edited JS file</option>
        </select>
      </label>
      <label className="field">From loop
        <input type="number" min={1} value={run.fromLoop} onChange={(event) => set({ fromLoop: Number(event.target.value) })} />
      </label>
      <label className="field">To loop
        <input type="number" min={1} value={run.toLoop} onChange={(event) => set({ toLoop: Number(event.target.value) })} />
      </label>
      <label className="field">On error in loop
        <select value={run.onErrorInLoop} onChange={(event) => set({ onErrorInLoop: event.target.value as RunConfig['onErrorInLoop'] })}>
          <option value="stop">Stop</option>
          <option value="continue_next_loop">Continue next loop</option>
        </select>
      </label>
      <label className="field">Interval ms
        <input type="number" min={0} value={run.commandIntervalMs} onChange={(event) => set({ commandIntervalMs: Number(event.target.value) })} />
      </label>
      <label className="field">Random jitter ms
        <input type="number" min={0} value={run.randomJitterMs} onChange={(event) => set({ randomJitterMs: Number(event.target.value) })} />
      </label>
      <label className="field">CSV file
        <select value={run.csvFile || ''} onChange={(event) => set({ csvFile: event.target.value })}>
          <option value="">None</option>
          {csvFiles.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label className="field">Start URL
        <input value={run.startUrl || ''} onChange={(event) => set({ startUrl: event.target.value })} />
      </label>
      <label className="check"><input type="checkbox" checked={run.headed} onChange={(event) => set({ headed: event.target.checked })} /> Headed browser</label>
      <label className="check"><input type="checkbox" checked={run.persistentProfile} onChange={(event) => set({ persistentProfile: event.target.checked })} /> Persistent profile</label>
      <label className="field">Proxy
        <select value={run.proxyMode} onChange={(event) => set({ proxyMode: event.target.value as RunConfig['proxyMode'] })}>
          <option value="off">Off</option>
          <option value="single">Single proxy</option>
          <option value="rotate_per_loop">Rotate per loop</option>
        </select>
      </label>
      {run.proxyMode === 'single' && (
        <label className="field span-2">Proxy URL
          <input
            defaultValue={formatProxy(run.proxy)}
            key={formatProxy(run.proxy)}
            placeholder="http://user:pass@host:port"
            onBlur={(event) => {
              const value = event.target.value.trim()
              if (!value) { set({ proxy: null }); return }
              try { set({ proxy: parseProxyLine(value) }) } catch (error) { window.alert(error instanceof Error ? error.message : String(error)) }
            }}
          />
        </label>
      )}
      {run.proxyMode === 'rotate_per_loop' && (
        <label className="field span-2">Proxy pool, one URL per line
          <textarea
            defaultValue={run.proxies.map(formatProxy).join('\n')}
            key={run.proxies.map(formatProxy).join('|')}
            onBlur={(event) => {
              try { set({ proxies: parseProxyList(event.target.value) }) } catch (error) { window.alert(error instanceof Error ? error.message : String(error)) }
            }}
          />
        </label>
      )}
    </div>}
    </section>
  )
}
