import type { ProxyEntry, ProxyScheme } from './types.js'

const SCHEMES: ProxyScheme[] = ['http', 'https', 'socks4', 'socks5']

export function parseProxyLine(line: string): ProxyEntry | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`Invalid proxy URL: ${trimmed}`)
  }
  const scheme = url.protocol.replace(':', '') as ProxyScheme
  if (!SCHEMES.includes(scheme)) {
    throw new Error(`Unsupported proxy protocol "${scheme}". Use http, https, socks4, or socks5.`)
  }
  if (!url.hostname) throw new Error(`Proxy is missing a host: ${trimmed}`)
  const port = url.port || (scheme === 'https' ? '443' : scheme === 'http' ? '80' : '1080')
  return {
    type: scheme,
    host: url.hostname,
    port,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined
  }
}

export function formatProxy(entry: ProxyEntry | null | undefined): string {
  if (!entry) return ''
  const auth = entry.username
    ? `${encodeURIComponent(entry.username)}:${encodeURIComponent(entry.password || '')}@`
    : ''
  return `${entry.type}://${auth}${entry.host}:${entry.port}`
}

export function parseProxyList(text: string): ProxyEntry[] {
  return text
    .split(/\r?\n/)
    .map((line) => parseProxyLine(line))
    .filter((entry): entry is ProxyEntry => !!entry)
}
