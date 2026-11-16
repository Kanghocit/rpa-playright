import type { BlockSlot, RunConfig, WorkflowDocument } from '@rpa/shared'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || response.statusText)
  return body as T
}

export const api = {
  workflows: () => request<{ id: string; name: string; updatedAt: string }[]>('/api/workflows'),
  workflow: (id: string) => request<WorkflowDocument>(`/api/workflows/${id}`),
  create: (name: string) => request<WorkflowDocument>('/api/workflows', { method: 'POST', body: JSON.stringify({ name }) }),
  save: (workflow: WorkflowDocument, syncScript: boolean) => request<WorkflowDocument>(`/api/workflows/${workflow.id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...workflow, syncScript })
  }),
  remove: (id: string) => request<{ ok: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
  script: (id: string) => request<{ source: string }>(`/api/workflows/${id}/script`),
  saveScript: (id: string, source: string) => request<{ ok: boolean }>(`/api/workflows/${id}/script`, {
    method: 'PUT',
    body: JSON.stringify({ source })
  }),
  csv: () => request<{ name: string; rows: number; columns: string[] }[]>('/api/csv'),
  run: (workflowId: string, mode: 'blocks' | 'script') => request<{ ok: boolean; message: string }>('/api/run', {
    method: 'POST',
    body: JSON.stringify({ workflowId, mode })
  }),
  stop: () => request<{ ok: boolean }>('/api/stop', { method: 'POST', body: '{}' }),
  recordStart: (workflowId: string, parentId: string | null, slot: BlockSlot) => request<{ ok: boolean }>('/api/record/start', {
    method: 'POST',
    body: JSON.stringify({ workflowId, parentId, slot, headed: true })
  }),
  recordTarget: (parentId: string | null, slot: BlockSlot) => request<{ ok: boolean }>('/api/record/target', {
    method: 'POST',
    body: JSON.stringify({ parentId, slot })
  }),
  recordStop: () => request<{ ok: boolean }>('/api/record/stop', { method: 'POST', body: '{}' }),
  pick: (workflowId: string) => request<{ selector: string }>('/api/pick', {
    method: 'POST',
    body: JSON.stringify({ workflowId })
  })
}

export type { RunConfig }
