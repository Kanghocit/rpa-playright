import { createBlock } from './blocks.js'
import type { ActionBlock, RecordedPayload } from './types.js'

export function payloadToBlock(payload: RecordedPayload): ActionBlock {
  switch (payload.kind) {
    case 'openUrl':
      return createBlock('openUrl', { params: { url: payload.url || 'about:blank' }, label: 'Recorded navigation' })
    case 'fill':
      return createBlock('fill', {
        params: { selector: payload.selector || 'input', value: payload.value || '' },
        label: 'Recorded fill'
      })
    case 'select':
      return createBlock('selectOption', {
        params: { selector: payload.selector || 'select', value: payload.value || '' },
        label: 'Recorded select'
      })
    case 'press':
      return createBlock('pressKey', {
        params: { key: payload.key || 'Enter', selector: payload.selector || '' },
        label: 'Recorded key'
      })
    case 'click':
    default:
      return createBlock('click', {
        params: { selector: payload.selector || 'body' },
        label: 'Recorded click'
      })
  }
}
