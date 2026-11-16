import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { StudioEvent } from '@rpa/shared'

export function LivePanel({
  events,
  activeId
}: {
  events: StudioEvent[]
  activeId: string | null
}) {
  const [open, setOpen] = useState(false)
  const lines = events.filter((event) => event.type === 'log' || event.type === 'step' || event.type === 'status').slice(-80)
  const shots = events.filter((event) => event.type === 'screenshot').slice(-4)
  const vars = [...events].reverse().find((event) => event.type === 'vars')
  return (
    <section className="logbar">
      <button type="button" className="disclosure-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronDown className={`chevron ${open ? '' : 'is-shut'}`} size={16} />
        Log
        <span className="chip">{lines.length}</span>
        {activeId && <span className="hint">step {activeId.slice(0, 8)}</span>}
      </button>
      {open && <div className="log-body">
      <div className="log-pane">
        <p className="kicker">Live log {activeId ? `· ${activeId.slice(0, 8)}` : ''}</p>
        <div className="log-list">
          {lines.length === 0 && <p>No events yet. Press Play or Record.</p>}
          {lines.map((event, index) => (
            <p key={index} className={event.type === 'log' && event.level === 'error' ? 'log-error' : ''}>
              {event.type === 'log' && `${event.level}: ${event.message}`}
              {event.type === 'step' && `step ${event.status} ${event.blockId.slice(0, 8)} ${event.message || ''}`}
              {event.type === 'status' && `status ${event.status} ${event.message || ''}`}
            </p>
          ))}
        </div>
      </div>
      <div className="var-pane">
        <p className="kicker">Variables and screenshots</p>
        {vars && vars.type === 'vars' ? (
          <pre className="var-pre">{JSON.stringify({ loop: vars.loop, vars: vars.vars, csv: vars.csv }, null, 2)}</pre>
        ) : (
          <p className="hint">Values appear here after a run.</p>
        )}
        <div className="shots">
          {shots.map((shot) => shot.type === 'screenshot' ? (
            <img key={shot.url} src={shot.url} alt="Workflow screenshot" />
          ) : null)}
        </div>
      </div>
      </div>}
    </section>
  )
}
