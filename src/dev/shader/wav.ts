// Synthesizes a short 4-on-the-floor loop as a WAV blob URL, so the lab can drive
// the shader through the REAL audio engine (analyser → getLevels) without network.

export function makeClubLoopUrl(bpm = 120, seconds = 24, sampleRate = 44100): string {
  const n = Math.floor(seconds * sampleRate)
  const out = new Float32Array(n)
  const beat = 60 / bpm
  let seed = 12345
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return (seed / 0x7fffffff) * 2 - 1
  }
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const inBeat = t % beat
    const beatIdx = Math.floor(t / beat)
    const bar = Math.floor(beatIdx / 4)
    const breakdown = bar % 4 === 3 && beatIdx % 4 >= 2
    let s = 0
    if (!breakdown) {
      // Kick: pitch sweep 120 → 45 Hz (integrated phase) with a fast decay.
      const phase = 2 * Math.PI * (45 * inBeat + (75 / 28) * (1 - Math.exp(-inBeat * 28)))
      s += Math.sin(phase) * Math.exp(-inBeat * 7) * 0.9
    }
    // Off-beat open hat.
    const hatT = (t + beat / 2) % beat
    s += noise() * Math.exp(-hatT * 38) * 0.18
    // Rolling bass on 8ths + a soft pad.
    const eighth = t % (beat / 2)
    s += Math.sin(2 * Math.PI * 55 * t) * Math.exp(-eighth * 6) * 0.22 * (breakdown ? 0.3 : 1)
    s += (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277.2 * t) + Math.sin(2 * Math.PI * 329.6 * t)) * 0.035
    out[i] = Math.max(-1, Math.min(1, s * 0.8))
  }
  // 16-bit PCM mono WAV.
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const str = (o: number, x: string) => {
    for (let k = 0; k < x.length; k++) v.setUint8(o + k, x.charCodeAt(k))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + n * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(out[i] * 32767), true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}
