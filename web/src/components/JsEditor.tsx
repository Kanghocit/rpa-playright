import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'

export function JsEditor({
  value,
  detached,
  onChange,
  onDetach,
  onReset
}: {
  value: string
  detached: boolean
  onChange: (value: string) => void
  onDetach: () => void
  onReset: () => void
}) {
  return (
    <div className="js-shell">
      <div className="js-bar">
        <p>
          {detached
            ? 'Detached JS. Block saves keep this file until you reset it.'
            : 'Generated from the block tree. Detach it to edit by hand.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {!detached && <button type="button" className="btn btn-primary" onClick={onDetach}>Detach and edit</button>}
          {detached && <button type="button" className="btn btn-ghost" onClick={onReset}>Reset to generated</button>}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CodeMirror
          value={value}
          height="100%"
          extensions={[javascript()]}
          editable={detached}
          onChange={onChange}
          basicSetup={{ lineNumbers: true }}
        />
      </div>
    </div>
  )
}
