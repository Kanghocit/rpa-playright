import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'
import type { ProxyEntry } from '@rpa/shared'

export interface OpenOptions {
  headed: boolean
  persistent: boolean
  profileDir: string
  proxy?: ProxyEntry | null
  recordScript?: string
  onRecord?: (payload: unknown) => void
}

function toPlaywrightProxy(proxy?: ProxyEntry | null) {
  if (!proxy) return undefined
  return {
    server: `${proxy.type}://${proxy.host}:${proxy.port}`,
    username: proxy.username || undefined,
    password: proxy.password || undefined
  }
}

export class ContextManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private pageRef: Page | null = null

  get page(): Page | null {
    return this.pageRef
  }

  async open(opts: OpenOptions): Promise<Page> {
    await this.close()
    const proxy = toPlaywrightProxy(opts.proxy)
    const args = ['--disable-blink-features=AutomationControlled']
    if (opts.persistent) {
      this.context = await chromium.launchPersistentContext(opts.profileDir, {
        headless: !opts.headed,
        args,
        proxy,
        viewport: { width: 1280, height: 800 }
      })
    } else {
      this.browser = await chromium.launch({ headless: !opts.headed, args })
      this.context = await this.browser.newContext({
        proxy,
        viewport: { width: 1280, height: 800 }
      })
    }

    await this.context.addInitScript(() => {
      try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      } catch {
        // Ignore if the browser already locked the property.
      }
    })
    if (opts.recordScript) await this.context.addInitScript(opts.recordScript)
    if (opts.onRecord) {
      await this.context.exposeBinding('__rpaEmit', async (_source, payload: unknown) => {
        opts.onRecord?.(payload)
      })
    }
    this.pageRef = this.context.pages()[0] || await this.context.newPage()
    return this.pageRef
  }

  async close(): Promise<void> {
    const context = this.context
    const browser = this.browser
    this.pageRef = null
    this.context = null
    this.browser = null
    await context?.close().catch(() => undefined)
    await browser?.close().catch(() => undefined)
  }
}
