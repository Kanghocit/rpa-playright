import { createBlock, defaultRunConfig } from './blocks.js'
import type { WorkflowDocument } from './types.js'

export function demoWorkflow(): WorkflowDocument {
  return {
    id: 'demo-loop',
    name: 'Demo loop and condition',
    updatedAt: new Date().toISOString(),
    run: {
      ...defaultRunConfig(),
      commandIntervalMs: 0,
      randomJitterMs: 0,
      toLoop: 1,
      headed: true,
      startUrl: 'http://127.0.0.1:3789/fixture/demo.html'
    },
    blocks: [
      createBlock('openUrl', {
        id: 'open-demo',
        params: { url: 'http://127.0.0.1:3789/fixture/demo.html' }
      }),
      createBlock('loopTimes', {
        id: 'loop-3',
        label: 'Click while Next is visible',
        params: { times: 3, varName: 'i' },
        children: [
          createBlock('ifCondition', {
            id: 'if-next',
            params: {
              condition: { op: 'elementVisible', selector: '#next', timeoutMs: 800 }
            },
            thenChildren: [
              createBlock('click', { id: 'click-next', params: { selector: '#next' } }),
              createBlock('extractText', {
                id: 'read-count',
                params: { selector: '#count', varName: 'count' }
              })
            ],
            elseChildren: [
              createBlock('breakLoop', { id: 'break-when-gone' })
            ]
          })
        ]
      })
    ]
  }
}
