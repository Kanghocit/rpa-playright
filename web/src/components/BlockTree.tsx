import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical } from 'lucide-react'
import { BLOCK_LABELS, blockSummary, isContainer, type ActionBlock, type BlockSlot } from '@rpa/shared'

export function containerId(parentId: string | null, slot: BlockSlot): string {
  return `drop:${parentId || 'root'}:${slot}`
}

export function BlockTree(props: {
  blocks: ActionBlock[]
  selectedId: string | null
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setCollapsed((current) => ({ ...current, [id]: !current[id] }))
  return <BlockList {...props} parentId={null} slot="children" root collapsed={collapsed} onToggle={toggle} />
}

export function BlockList({
  blocks,
  parentId,
  slot,
  selectedId,
  activeId,
  onSelect,
  root,
  collapsed,
  onToggle
}: {
  blocks: ActionBlock[]
  parentId: string | null
  slot: BlockSlot
  selectedId: string | null
  activeId: string | null
  onSelect: (id: string) => void
  root?: boolean
  collapsed: Record<string, boolean>
  onToggle: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: containerId(parentId, slot),
    data: { container: true, parentId, slot }
  })
  return (
    <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`dropzone ${isOver ? 'is-over' : ''}`}>
        {blocks.length === 0 && (
          <p className="empty-drop">{root ? 'Drag an action here to start the workflow.' : 'Drop actions here'}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              selected={block.id === selectedId}
              running={block.id === activeId}
              selectedId={selectedId}
              activeId={activeId}
              onSelect={onSelect}
              collapsed={!!collapsed[block.id]}
              onToggle={() => onToggle(block.id)}
              treeCollapsed={collapsed}
              onTreeToggle={onToggle}
            />
          ))}
        </div>
      </div>
    </SortableContext>
  )
}

function BlockCard({
  block,
  selected,
  running,
  selectedId,
  activeId,
  onSelect,
  collapsed,
  onToggle,
  treeCollapsed,
  onTreeToggle
}: {
  block: ActionBlock
  selected: boolean
  running: boolean
  selectedId: string | null
  activeId: string | null
  onSelect: (id: string) => void
  collapsed: boolean
  onToggle: () => void
  treeCollapsed: Record<string, boolean>
  onTreeToggle: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { fromPalette: false, blockId: block.id }
  })
  const summary = blockSummary(block)
  const classes = [
    'block',
    selected ? 'is-selected' : '',
    running ? 'is-running' : '',
    block.disabled ? 'is-off' : ''
  ].filter(Boolean).join(' ')
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : undefined }}
      className={classes}
    >
      <div className="block-head">
        <button type="button" className="grip" aria-expanded={!collapsed} aria-label={collapsed ? 'Expand block' : 'Collapse block'} onClick={onToggle}>
          <ChevronDown className={`chevron ${collapsed ? 'is-shut' : ''}`} size={16} />
        </button>
        <button type="button" className="grip" {...attributes} {...listeners} aria-label="Drag block">
          <GripVertical size={16} strokeWidth={1.75} />
        </button>
        <button type="button" className="block-select" onClick={() => onSelect(block.id)}>
          <div className="block-name">
            <span>{block.label || BLOCK_LABELS[block.type]}</span>
            <span className="block-type">{block.type}</span>
          </div>
          {!collapsed && summary && <p className="block-summary">{summary}</p>}
        </button>
      </div>
      {!collapsed && isContainer(block.type) && block.type !== 'ifCondition' && (
        <div className="nest">
          <p className="nest-label">Loop body</p>
          <BlockList blocks={block.children || []} parentId={block.id} slot="children" selectedId={selectedId} activeId={activeId} onSelect={onSelect} collapsed={treeCollapsed} onToggle={onTreeToggle} />
        </div>
      )}
      {!collapsed && block.type === 'ifCondition' && (
        <div className="nest">
          <div className="nest-grid">
            <div>
              <p className="nest-label then">Then</p>
              <BlockList blocks={block.thenChildren || []} parentId={block.id} slot="thenChildren" selectedId={selectedId} activeId={activeId} onSelect={onSelect} collapsed={treeCollapsed} onToggle={onTreeToggle} />
            </div>
            <div>
              <p className="nest-label else">Else</p>
              <BlockList blocks={block.elseChildren || []} parentId={block.id} slot="elseChildren" selectedId={selectedId} activeId={activeId} onSelect={onSelect} collapsed={treeCollapsed} onToggle={onTreeToggle} />
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
