export interface InterpScope {
  vars: Record<string, unknown>
  loop?: number
  csv?: Record<string, string>
}

export function interpolate(template: string, scope: InterpScope): string {
  return String(template ?? '').replace(/\$\{([^}]+)\}/g, (_match, raw: string) => {
    const key = raw.trim()
    if (key === 'loop' || key === 'loopIndex') {
      const value = scope.loop ?? scope.vars.loop ?? scope.vars.loopIndex
      return value == null ? '' : String(value)
    }
    if (key.startsWith('csv.')) {
      const column = key.slice(4)
      return scope.csv?.[column] ?? ''
    }
    const value = scope.vars[key]
    return value == null ? '' : String(value)
  })
}
