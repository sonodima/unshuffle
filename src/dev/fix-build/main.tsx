// Share-card lab (fix-build): renders the 1200×630 link-preview image
// (public/og-image.png) from the real brand components, to be screenshotted by
// scripts/fix-build/og.mjs. ?grid=1 overlays the centre square that chat apps crop to.
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ShaderBackground } from '../../components/background'
import { Logo } from '../../components/brand'
import { DemoBlock } from '../../screens/home/ShuffleDemo'
import { DEMO_HUES, DEMO_LETTERS, songEnvelope } from '../../screens/home/demoScript'

const params = new URLSearchParams(location.search)
const COUNT = 8
const ORDER = [5, 2, 7, 0, 3, 6, 1, 4]
const BARS = songEnvelope(COUNT, 9)

/** The lifted block's touch marker belongs to the live demo, not a still: hidden. */
function Card() {
  return (
    <div
      data-card
      className="relative mx-auto flex flex-col items-center justify-center overflow-hidden text-center [&_.hm-touch]:hidden"
      style={{ width: 1200, height: 630 }}
    >
      <ShaderBackground grain={false} reducedMotion />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(70% 80% at 50% 45%, transparent 35%, rgb(6 4 15 / 0.7) 100%)' }}
      />
      <p className="eyebrow relative mb-5 flex items-center gap-3 text-ink-200" style={{ fontSize: 20, letterSpacing: '0.32em' }}>
        <span className="h-px w-12 bg-ink-300/60" />
        Party game musicale
        <span className="h-px w-12 bg-ink-300/60" />
      </p>
      <div className="relative">
        <Logo size="hero" animate={false} className="text-[length:128px]!" />
      </div>
      <p className="relative mt-6 font-sans font-medium text-ink-100" style={{ fontSize: 34 }}>
        La hit è stata fatta a pezzi. <span className="font-extrabold text-white">Rimettila in ordine.</span>
      </p>
      <div className="relative mt-11 flex gap-4">
        {ORDER.map((i, pos) => (
          <div key={i} style={{ width: 96, height: 112 }}>
            <DemoBlock hue={DEMO_HUES[i]} letter={DEMO_LETTERS[i]} bars={BARS[i]} lifted={pos === 2} />
          </div>
        ))}
      </div>
      {params.get('grid') ? (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-x-2 border-coral" style={{ width: 630 }} />
      ) : null}
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <MotionConfig reducedMotion="always">
        <Card />
      </MotionConfig>
    </StrictMode>,
  )
}
