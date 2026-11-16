import { useDraggable } from '@dnd-kit/core'
import {
  Compass,
  FormInput,
  GitBranch,
  Hourglass,
  Keyboard,
  MousePointerClick,
  Repeat,
  type LucideIcon
} from 'lucide-react'
import { BLOCK_GROUPS, BLOCK_LABELS, type BlockType } from '@rpa/shared'

const ICONS: Record<string, LucideIcon> = {
  Navigation: Compass,
  'Mouse & Keyboard': MousePointerClick,
  'Waits & Data': Hourglass,
  'Loops & Conditions': GitBranch
}

const TYPE_ICON: Partial<Record<BlockType, LucideIcon>> = {
  openUrl: Compass,
  click: MousePointerClick,
  fill: FormInput,
  pressKey: Keyboard,
  loopTimes: Repeat,
  loopWhile: Repeat,
  loopCsv: Repeat,
  forEach: Repeat,
  ifCondition: GitBranch
}

export function Palette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <aside className="side">
      <p className="kicker">Blocks</p>
      <h2 className="panel-title">Action palette</h2>
      <p className="hint">Drag a block into the canvas, or double-click to append it.</p>
      {BLOCK_GROUPS.map((group) => {
        const GroupIcon = ICONS[group.name] || MousePointerClick
        return (
          <section key={group.name}>
            <h3 className="group-label"><GroupIcon size={12} style={{ display: 'inline', marginRight: 6 }} />{group.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.types.map((type) => (
                <PaletteItem key={type} type={type} onAdd={onAdd} />
              ))}
            </div>
          </section>
        )
      })}
    </aside>
  )
}

function PaletteItem({ type, onAdd }: { type: BlockType; onAdd: (type: BlockType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { fromPalette: true, type }
  })
  const Icon = TYPE_ICON[type] || MousePointerClick
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="palette-item"
      style={{ opacity: isDragging ? 0.45 : 1 }}
      onDoubleClick={() => onAdd(type)}
      {...listeners}
      {...attributes}
    >
      <Icon size={16} strokeWidth={1.75} />
      {BLOCK_LABELS[type]}
    </button>
  )
}
