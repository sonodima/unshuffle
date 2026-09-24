// Small runtime toolkit for the transport: leak-proof timers/listeners (Scope),
// listener sets, cancellable waits and crypto randomness.

export const now = (): number => performance.now()

const noop = (): void => {}

/** Reports a listener exception without breaking the caller's loop. */
export function reportListenerError(err: unknown): void {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(err)
  else console.error(err)
}

/** Owns timers and DOM listeners; dispose() releases everything at once. */
export class Scope {
  private readonly cleanups = new Set<() => void>()
  private readonly sleepers = new Set<() => void>()
  private _disposed = false

  timeout(fn: () => void, ms: number): () => void {
    if (this._disposed) return noop
    const cancel = (): void => {
      if (!this.cleanups.delete(cancel)) return
      clearTimeout(id)
    }
    const id = setTimeout(() => {
      if (!this.cleanups.delete(cancel)) return
      fn()
    }, ms)
    this.cleanups.add(cancel)
    return cancel
  }

  interval(fn: () => void, ms: number): () => void {
    if (this._disposed) return noop
    const id = setInterval(fn, ms)
    const cancel = (): void => {
      if (!this.cleanups.delete(cancel)) return
      clearInterval(id)
    }
    this.cleanups.add(cancel)
    return cancel
  }

  listen(target: EventTarget | undefined, type: string, fn: (event: Event) => void): void {
    if (this._disposed || !target) return
    target.addEventListener(type, fn)
    const cancel = (): void => {
      if (!this.cleanups.delete(cancel)) return
      target.removeEventListener(type, fn)
    }
    this.cleanups.add(cancel)
  }

  /** Resolves true after `ms` (or early on `wake()`), false if the scope is disposed. */
  sleep(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this._disposed) return resolve(false)
      let settled = false
      const finish = (elapsed: boolean): void => {
        if (settled) return
        settled = true
        cancelTimer()
        this.cleanups.delete(onDispose)
        this.sleepers.delete(onWake)
        resolve(elapsed)
      }
      const onDispose = (): void => finish(false)
      const onWake = (): void => finish(true)
      const cancelTimer = this.timeout(() => finish(true), ms)
      this.cleanups.add(onDispose)
      this.sleepers.add(onWake)
    })
  }

  /** Ends every pending sleep() immediately (e.g. the tab came back online). */
  wake(): void {
    for (const fn of [...this.sleepers]) fn()
  }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    for (const fn of [...this.cleanups]) fn()
    this.cleanups.clear()
    this.sleepers.clear()
  }
}

/** A set of callbacks; a throwing callback never prevents the others from running. */
export class Listeners<A extends unknown[]> {
  private readonly set = new Set<(...args: A) => void>()

  add(cb: (...args: A) => void): () => void {
    // Wrap so the same function can be subscribed twice and unsubscribed independently.
    const entry = (...args: A): void => cb(...args)
    this.set.add(entry)
    return () => {
      this.set.delete(entry)
    }
  }

  emit(...args: A): void {
    for (const cb of [...this.set]) {
      // Removed (or cleared by close()) while emitting: skip.
      if (!this.set.has(cb)) continue
      try {
        cb(...args)
      } catch (err) {
        reportListenerError(err)
      }
    }
  }

  clear(): void {
    this.set.clear()
  }
}

/**
 * Waits for the first of: a value passed to `settle`, a timeout, an abort.
 * `setup` wires listeners and returns their teardown, which always runs.
 */
export function race<T>(
  opts: { timeoutMs: number; onTimeout: T; signal?: AbortSignal; onAbort?: T },
  setup: (settle: (value: T) => void) => () => void,
): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false
    let teardown: () => void = noop
    const { signal } = opts
    const abortValue = (opts.onAbort ?? opts.onTimeout) as T
    const onAbort = (): void => settle(abortValue)
    const timer = setTimeout(() => settle(opts.onTimeout), Math.max(0, opts.timeoutMs))
    function settle(value: T): void {
      if (done) return
      done = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      teardown()
      resolve(value)
    }
    if (signal?.aborted) return settle(abortValue)
    signal?.addEventListener('abort', onAbort)
    teardown = setup(settle)
    if (done) teardown()
  })
}

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return bytes
}

/** Uniform random string over `alphabet` (rejection sampling, crypto RNG). */
export function randomString(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length)
  let out = ''
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b >= limit) continue
      out += alphabet[b % alphabet.length]
      if (out.length === length) break
    }
  }
  return out
}

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function randomToken(length = 16): string {
  return randomString(TOKEN_ALPHABET, length)
}
