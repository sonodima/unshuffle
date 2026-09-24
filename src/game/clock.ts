// Host clock estimation for clients. All phase timestamps are host Date.now();
// clients keep an offset (host − local) estimated from ping/pong round trips.

import { useEffect, useState } from 'react'

interface Sample {
  offset: number
  rtt: number
}

const MAX_SAMPLES = 12
let samples: Sample[] = []
let offset = 0

/** Feed a ping/pong sample (client send time, host time, client receive time). */
export function addClockSample(clientSent: number, hostTime: number, clientReceived: number): void {
  const rtt = Math.max(0, clientReceived - clientSent)
  samples.push({ offset: hostTime - (clientSent + rtt / 2), rtt })
  if (samples.length > MAX_SAMPLES) samples.shift()
  // Trust the fastest round trips most: average the offsets of the best third.
  const best = [...samples].sort((a, b) => a.rtt - b.rtt).slice(0, Math.max(1, Math.ceil(samples.length / 3)))
  offset = best.reduce((sum, s) => sum + s.offset, 0) / best.length
}

/** Set offset directly (the host itself uses 0). */
export function resetClock(offsetMs = 0): void {
  samples = []
  offset = offsetMs
}

/** Current host time estimate in ms. */
export function hostNow(): number {
  return Date.now() + offset
}

/** React hook: host time, re-rendering every `intervalMs` (default 250). */
export function useHostNow(intervalMs = 250): number {
  const [now, setNow] = useState(hostNow)
  useEffect(() => {
    const id = setInterval(() => setNow(hostNow()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
