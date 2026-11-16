// Shared harness for the hidden Vue acceptance tests. It boots the app through the project's own
// src/main.ts (so services, directives and theme options the agent registered there are live),
// on a fresh module graph per test, in jsdom with the browser APIs jsdom lacks stubbed.
import fs from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'

type AnyApp = { unmount(): void; config: { globalProperties: Record<string, unknown> } }
type AnyRouter = { push(to: string): Promise<unknown>; isReady(): Promise<void>; currentRoute: { value: { fullPath: string } } }

export interface MountedApp {
  app: AnyApp
  router: AnyRouter
  root: HTMLElement
}

let current: MountedApp | null = null

/** Settles pending promises and lets Vue flush. */
export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Retries `fn` until it returns without throwing (and not `false`/`null`/`undefined`). */
export async function waitFor<T>(fn: () => T, timeoutMs = 8000): Promise<NonNullable<T>> {
  const start = Date.now()
  let lastError: unknown = new Error('waitFor timed out')
  while (Date.now() - start < timeoutMs) {
    try {
      const value = fn()
      if (value !== false && value !== null && value !== undefined) return value as NonNullable<T>
      lastError = new Error(`waitFor: condition returned ${String(value)}`)
    } catch (error) {
      lastError = error
    }
    await sleep(20)
  }
  throw lastError
}

/** State the browser stubs read; tests change it before mounting. */
export const env = {
  prefersDark: false,
  mediaListeners: new Set<(event: { matches: boolean; media: string }) => void>(),
  observers: [] as StubIntersectionObserver[],
  clipboardWrites: [] as string[],
  /** Calls to document.startViewTransition and Element.animate since the last mount. */
  viewTransitions: 0,
  animations: 0,
}

class StubIntersectionObserver {
  readonly targets = new Set<Element>()
  constructor(
    readonly callback: (entries: Partial<IntersectionObserverEntry>[], observer: unknown) => void,
    readonly options?: IntersectionObserverInit,
  ) {
    env.observers.push(this)
  }
  observe(target: Element) {
    this.targets.add(target)
  }
  unobserve(target: Element) {
    this.targets.delete(target)
  }
  disconnect() {
    this.targets.clear()
  }
  takeRecords() {
    return []
  }
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = [0]
  /** Reports every observed target as (not) intersecting. */
  fire(isIntersecting: boolean) {
    const entries = [...this.targets].map((target) => {
      const rect = target.getBoundingClientRect()
      const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, left: rect.left, right: rect.right }
      return {
        target,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: { ...box, top: isIntersecting ? 0 : -200, bottom: isIntersecting ? 1 : -199 } as DOMRectReadOnly,
        intersectionRect: rect,
        rootBounds: null,
        time: Date.now(),
      }
    })
    if (entries.length) this.callback(entries, this)
  }
}

function mediaQueryList(query: string) {
  const matches = () => (/prefers-color-scheme:\s*dark/.test(query) ? env.prefersDark : /prefers-color-scheme:\s*light/.test(query) ? !env.prefersDark : false)
  const list = {
    media: query,
    get matches() {
      return matches()
    },
    onchange: null,
    addEventListener: (_type: string, listener: (event: { matches: boolean; media: string }) => void) => env.mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: (event: { matches: boolean; media: string }) => void) => env.mediaListeners.delete(listener),
    addListener: (listener: (event: { matches: boolean; media: string }) => void) => env.mediaListeners.add(listener),
    removeListener: (listener: (event: { matches: boolean; media: string }) => void) => env.mediaListeners.delete(listener),
    dispatchEvent: () => true,
  }
  return list
}

const POPOVER_OPEN = 'data-harness-popover-open'
const swapPopoverPseudo = (selector: string) => selector.replaceAll(':popover-open', `[${POPOVER_OPEN}]`)

function toggleEvent(type: string, oldState: string, newState: string) {
  return Object.assign(new Event(type, { cancelable: type === 'beforetoggle' }), { oldState, newState })
}

/**
 * Minimal native <dialog> and Popover API behaviour (jsdom 29 has neither): open state, toggle and
 * close events, `popovertarget` buttons, Escape on modal dialogs and auto popovers, and the
 * `:popover-open` pseudo-class in matches/querySelector.
 */
function installDialogAndPopover() {
  const proto = HTMLElement.prototype as HTMLElement & { __harnessPopover?: boolean }
  if (proto.__harnessPopover) return
  proto.__harnessPopover = true

  const setPopover = (element: HTMLElement, open: boolean) => {
    if (element.hasAttribute(POPOVER_OPEN) === open) return
    if (!element.dispatchEvent(toggleEvent('beforetoggle', open ? 'closed' : 'open', open ? 'open' : 'closed')) && open) return
    element.toggleAttribute(POPOVER_OPEN, open)
    element.dispatchEvent(toggleEvent('toggle', open ? 'closed' : 'open', open ? 'open' : 'closed'))
  }
  Object.assign(HTMLElement.prototype, {
    showPopover(this: HTMLElement) {
      setPopover(this, true)
    },
    hidePopover(this: HTMLElement) {
      setPopover(this, false)
    },
    togglePopover(this: HTMLElement, force?: boolean) {
      const next = force ?? !this.hasAttribute(POPOVER_OPEN)
      setPopover(this, next)
      return next
    },
  })
  for (const target of [Element.prototype, Document.prototype, DocumentFragment.prototype] as unknown as Record<string, (selector: string) => unknown>[]) {
    for (const method of ['matches', 'closest', 'querySelector', 'querySelectorAll']) {
      const original = target[method]
      if (!original) continue
      target[method] = function patched(this: unknown, selector: string) {
        return original.call(this, swapPopoverPseudo(selector))
      }
    }
  }

  const dialogProto = HTMLDialogElement.prototype as HTMLDialogElement & { __modal?: boolean }
  Object.assign(dialogProto, {
    show(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
    showModal(this: HTMLDialogElement & { __modal?: boolean }) {
      this.setAttribute('open', '')
      this.__modal = true
    },
    close(this: HTMLDialogElement & { __modal?: boolean }, returnValue?: string) {
      if (!this.hasAttribute('open')) return
      if (returnValue !== undefined) this.returnValue = returnValue
      this.removeAttribute('open')
      this.__modal = false
      this.dispatchEvent(new Event('close'))
    },
    requestClose(this: HTMLDialogElement) {
      if (this.dispatchEvent(new Event('cancel', { cancelable: true }))) this.close()
    },
  })

  document.addEventListener('click', (event) => {
    const invoker = (event.target as Element | null)?.closest?.('[popovertarget]')
    if (!invoker) return
    const target = document.getElementById(invoker.getAttribute('popovertarget') ?? '')
    if (!target) return
    const action = invoker.getAttribute('popovertargetaction') ?? 'toggle'
    setPopover(target, action === 'show' ? true : action === 'hide' ? false : !target.hasAttribute(POPOVER_OPEN))
  })
  // Exclusive accordions: opening a <details name="x"> closes the others with that name.
  document.addEventListener(
    'toggle',
    (event) => {
      const details = event.target
      if (!(details instanceof HTMLDetailsElement) || !details.open || !details.getAttribute('name')) return
      for (const other of document.querySelectorAll<HTMLDetailsElement>('details[name]')) {
        if (other !== details && other.open && other.getAttribute('name') === details.getAttribute('name')) other.open = false
      }
    },
    true,
  )
  // A <summary> activates on Enter (keydown) and Space (keyup) in browsers; jsdom and user-event skip it.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.defaultPrevented && (event.target as Element | null)?.tagName === 'SUMMARY') (event.target as HTMLElement).click()
  })
  document.addEventListener('keyup', (event) => {
    if (event.key === ' ' && !event.defaultPrevented && (event.target as Element | null)?.tagName === 'SUMMARY') (event.target as HTMLElement).click()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    const modal = [...document.querySelectorAll<HTMLDialogElement & { __modal?: boolean }>('dialog[open]')].findLast((dialog) => dialog.__modal)
    if (modal) {
      ;(modal as HTMLDialogElement & { requestClose(): void }).requestClose()
      return
    }
    for (const popover of document.querySelectorAll<HTMLElement>(`[${POPOVER_OPEN}]`)) {
      const kind = popover.getAttribute('popover')
      if (kind === '' || kind === 'auto') setPopover(popover, false)
    }
  })
}

/** Installs the browser APIs jsdom lacks. Called by mountApp; safe to call repeatedly. */
export function installBrowserStubs() {
  installDialogAndPopover()
  env.observers.length = 0
  env.mediaListeners.clear()
  env.clipboardWrites.length = 0
  // Set on both: inline scripts and modules may read the bare global rather than window.
  const matchMedia = ((query: string) => mediaQueryList(query)) as unknown as typeof window.matchMedia
  window.matchMedia = matchMedia
  globalThis.matchMedia = matchMedia
  globalThis.IntersectionObserver = StubIntersectionObserver as unknown as typeof IntersectionObserver
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  window.scrollTo = (() => {}) as typeof window.scrollTo
  Element.prototype.scrollIntoView = function scrollIntoView() {}
  env.viewTransitions = 0
  env.animations = 0
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value(update?: (() => unknown) | { update?: () => unknown }) {
      env.viewTransitions += 1
      const callback = typeof update === 'function' ? update : update?.update
      const done = Promise.resolve().then(() => callback?.())
      return { updateCallbackDone: done, ready: done, finished: done, skipTransition() {}, types: new Set() }
    },
  })
  {
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value() {
        env.animations += 1
        const animation = { finished: Promise.resolve(), cancel() {}, finish() {}, play() {}, pause() {}, onfinish: null as null | (() => void), addEventListener() {} }
        setTimeout(() => animation.onfinish?.(), 0)
        return animation
      },
    })
  }
  const clipboard = {
    writeText: vi.fn(async (text: string) => {
      env.clipboardWrites.push(text)
    }),
    readText: vi.fn(async () => env.clipboardWrites.at(-1) ?? ''),
    write: vi.fn(async () => {}),
  }
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: clipboard })
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  return { clipboard }
}

type ApiModule = typeof import('../services/api')

export interface MountOptions {
  /** Replaces exports of src/services/api.ts (the template's data seam) for this mount. */
  api?: (actual: ApiModule) => Partial<ApiModule>
}

/**
 * Copies the project's index.html <html> attributes and <head> into the test document and runs its
 * inline classic scripts (pre-paint theme scripts, for example), as the browser would before main.ts.
 */
function loadIndexHtml() {
  const file = path.resolve(process.cwd(), 'index.html')
  const page = new DOMParser().parseFromString(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '', 'text/html')
  for (const attribute of [...page.documentElement.attributes]) document.documentElement.setAttribute(attribute.name, attribute.value)
  document.head.innerHTML = ''
  const inline: string[] = []
  for (const node of [...page.head.children]) {
    if (node.tagName === 'SCRIPT') {
      const type = node.getAttribute('type')
      if (!node.hasAttribute('src') && (!type || type === 'text/javascript')) inline.push(node.textContent ?? '')
      continue
    }
    document.head.append(document.importNode(node, true))
  }
  for (const code of inline) {
    try {
      ;(0, eval)(code)
    } catch {
      // A failing pre-paint script fails in the browser too; main.ts still runs.
    }
  }
}

/** Boots src/main.ts at `path` on a fresh module graph and waits for the first route. */
export async function mountApp(path = '/', options: MountOptions = {}): Promise<MountedApp> {
  unmountApp()
  installBrowserStubs()
  loadIndexHtml()
  document.body.innerHTML = '<div id="app"></div>'
  window.history.replaceState({}, '', path)
  vi.resetModules()
  vi.doUnmock('../services/api')
  const { api } = options
  if (api) {
    vi.doMock('../services/api', async (importOriginal) => {
      const actual = await importOriginal<ApiModule>()
      return { ...actual, ...api(actual) }
    })
  }
  await import('../main')
  const root = document.querySelector<HTMLElement>('#app')
  const app = (root as unknown as { __vue_app__?: AnyApp } | null)?.__vue_app__
  if (!root || !app) throw new Error('src/main.ts did not mount an app on #app')
  const router = app.config.globalProperties.$router as AnyRouter
  await router.isReady()
  await flush()
  current = { app, router, root }
  return current
}

export function unmountApp() {
  if (current) {
    try {
      current.app.unmount()
    } catch {
      // A failing unmount must not hide the test's own result.
    }
  }
  current = null
  document.body.innerHTML = ''
  document.documentElement.className = ''
  for (const attribute of [...document.documentElement.attributes]) {
    if (attribute.name !== 'lang') document.documentElement.removeAttribute(attribute.name)
  }
}

/**
 * Simulates scrolling the page to `y`: sets the scroll offsets, fires `scroll` on window and document,
 * and reports every observed IntersectionObserver target as intersecting only at the top.
 */
export async function scrollPageTo(y: number) {
  for (const target of [window, document.documentElement, document.body, document.scrollingElement]) {
    if (!target) continue
    for (const key of target === window ? ['scrollY', 'pageYOffset'] : ['scrollTop']) {
      Object.defineProperty(target, key, { configurable: true, value: y })
    }
  }
  window.dispatchEvent(new Event('scroll'))
  document.dispatchEvent(new Event('scroll'))
  for (const observer of env.observers) observer.fire(y < 8)
  await sleep(250)
}

/** Visible text of an element with whitespace collapsed. */
export const text = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** Like `text`, but only from text nodes that are shown (see isShown). */
export function shownText(element: Element | null | undefined) {
  if (!element) return ''
  const parts: string[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement && isShown(node.parentElement)) parts.push(node.textContent ?? '')
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** True when the element and its ancestors are rendered and not hidden by attribute or inline style. */
export function isShown(element: Element | null | undefined): boolean {
  for (let node = element ?? null; node && node !== document.documentElement; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue
    if (node.hidden) return false
    // No stylesheet loads in jsdom, so Tailwind's hiding utilities are read from the class list.
    if (node.classList.contains('hidden') || node.classList.contains('invisible')) return false
    if (node.hasAttribute('popover') && !node.hasAttribute(POPOVER_OPEN)) return false
    if (node instanceof HTMLDialogElement && !node.open) return false
    const style = window.getComputedStyle(node)
    // jsdom's UA sheet hides [popover] via the real :popover-open, which the stub cannot set.
    if (style.display === 'none' && !node.hasAttribute('popover')) return false
    if (style.visibility === 'hidden') return false
    if (node instanceof HTMLDetailsElement && node !== element && !node.open && !node.querySelector(':scope > summary')?.contains(element ?? null)) return false
  }
  return Boolean(element?.isConnected)
}
