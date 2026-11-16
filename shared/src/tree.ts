import type { ActionBlock, BlockSlot } from './types.js'
import { cloneBlock } from './blocks.js'

export interface BlockLocation {
  list: ActionBlock[]
  index: number
  parent: ActionBlock | null
  slot: BlockSlot
}

function listsOf(block: ActionBlock): { slot: BlockSlot; list: ActionBlock[] }[] {
  const lists: { slot: BlockSlot; list: ActionBlock[] }[] = []
  if (block.children) lists.push({ slot: 'children', list: block.children })
  if (block.thenChildren) lists.push({ slot: 'thenChildren', list: block.thenChildren })
  if (block.elseChildren) lists.push({ slot: 'elseChildren', list: block.elseChildren })
  return lists
}

export function locate(blocks: ActionBlock[], id: string, parent: ActionBlock | null = null, slot: BlockSlot = 'children'): BlockLocation | null {
  const index = blocks.findIndex((block) => block.id === id)
  if (index !== -1) return { list: blocks, index, parent, slot }
  for (const block of blocks) {
    for (const child of listsOf(block)) {
      const found = locate(child.list, id, block, child.slot)
      if (found) return found
    }
  }
  return null
}

export function findBlock(blocks: ActionBlock[], id: string): ActionBlock | null {
  const loc = locate(blocks, id)
  return loc ? loc.list[loc.index] : null
}

export function containsId(block: ActionBlock, id: string): boolean {
  if (block.id === id) return true
  return listsOf(block).some((entry) => entry.list.some((child) => containsId(child, id)))
}

function listFor(blocks: ActionBlock[], parentId: string | null, slot: BlockSlot): ActionBlock[] | null {
  if (!parentId) return slot === 'children' ? blocks : null
  const parent = findBlock(blocks, parentId)
  if (!parent) return null
  if (slot === 'children') return parent.children || null
  if (slot === 'thenChildren') return parent.thenChildren || null
  return parent.elseChildren || null
}

export function insertBlock(
  blocks: ActionBlock[],
  parentId: string | null,
  slot: BlockSlot,
  index: number,
  block: ActionBlock
): ActionBlock[] {
  const next = structuredClone(blocks) as ActionBlock[]
  const list = listFor(next, parentId, slot)
  if (!list) return next
  const at = Math.max(0, Math.min(index, list.length))
  list.splice(at, 0, block)
  return next
}

export function removeBlock(blocks: ActionBlock[], id: string): { blocks: ActionBlock[]; removed: ActionBlock | null } {
  const next = structuredClone(blocks) as ActionBlock[]
  const loc = locate(next, id)
  if (!loc) return { blocks: next, removed: null }
  const [removed] = loc.list.splice(loc.index, 1)
  return { blocks: next, removed }
}

export function moveBlock(
  blocks: ActionBlock[],
  blockId: string,
  parentId: string | null,
  slot: BlockSlot,
  index: number
): ActionBlock[] {
  const source = findBlock(blocks, blockId)
  if (!source) return blocks
  if (parentId && (parentId === blockId || containsId(source, parentId))) return blocks
  const removed = removeBlock(blocks, blockId)
  if (!removed.removed) return blocks
  let targetIndex = index
  const oldLoc = locate(blocks, blockId)
  if (oldLoc && (oldLoc.parent?.id ?? null) === parentId && oldLoc.slot === slot && oldLoc.index < index) {
    targetIndex = index - 1
  }
  return insertBlock(removed.blocks, parentId, slot, targetIndex, removed.removed)
}

export function updateBlock(blocks: ActionBlock[], id: string, patch: Partial<ActionBlock>): ActionBlock[] {
  const next = structuredClone(blocks) as ActionBlock[]
  const loc = locate(next, id)
  if (!loc) return next
  const current = loc.list[loc.index]
  loc.list[loc.index] = {
    ...current,
    ...patch,
    params: patch.params ? patch.params : current.params,
    id: current.id,
    type: current.type
  }
  return next
}

export function appendBlock(blocks: ActionBlock[], parentId: string | null, slot: BlockSlot, block: ActionBlock): ActionBlock[] {
  const list = listFor(blocks, parentId, slot)
  const index = list ? list.length : blocks.length
  return insertBlock(blocks, parentId, slot, index, block)
}

export function duplicateBlock(blocks: ActionBlock[], id: string): ActionBlock[] {
  const loc = locate(blocks, id)
  if (!loc) return blocks
  const copy = cloneBlock(loc.list[loc.index])
  return insertBlock(blocks, loc.parent?.id ?? null, loc.slot, loc.index + 1, copy)
}
