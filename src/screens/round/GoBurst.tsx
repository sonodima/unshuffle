// Full-screen "VIA!" slam between the intro countdown and the board.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export function GoBurst({ burstKey }: { burstKey: string | null }) {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40 grid place-items-center overflow-hidden">
      <AnimatePresence>
        {burstKey && (
          <motion.div key={burstKey} className="absolute inset-0 grid place-items-center" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
            {/* Scrim: the board fades in from behind the slam */}
            <motion.span
              className="absolute inset-0"
              style={{ background: 'radial-gradient(90% 70% at 50% 50%, rgb(6 4 15 / 0.82), rgb(6 4 15 / 0.55) 70%, rgb(6 4 15 / 0.35))' }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.75, delay: 0.3, ease: 'easeOut' }}
            />
            {!reduce && (
              <>
                <motion.span
                  className="absolute size-[70vmin] rounded-full"
                  style={{ background: 'radial-gradient(closest-side, rgb(166 255 63 / 0.55), rgb(166 255 63 / 0.12) 60%, transparent 75%)' }}
                  initial={{ scale: 0.2, opacity: 0.9 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.span
                  className="absolute size-[40vmin] rounded-full border-[6px] border-lime"
                  style={{ boxShadow: '0 0 40px rgb(166 255 63 / 0.7), inset 0 0 40px rgb(166 255 63 / 0.5)' }}
                  initial={{ scale: 0.3, opacity: 1 }}
                  animate={{ scale: 2.4, opacity: 0 }}
                  transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                />
              </>
            )}
            <motion.span
              className="relative block"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.6 }}
              animate={reduce ? { opacity: [0, 1, 1, 0] } : { opacity: [0, 1, 1, 0], scale: [2.6, 0.94, 1, 1.35] }}
              transition={{ duration: 0.95, times: [0, 0.28, 0.62, 1], ease: 'easeOut' }}
            >
              <span
                className="display display-skew text-gradient-lime block pr-[0.08em] leading-none"
                style={{ fontSize: 'clamp(84px, 26vw, 260px)', filter: 'drop-shadow(0 0 40px rgb(166 255 63 / 0.55)) drop-shadow(0 10px 0 rgb(40 80 10 / 0.55))' }}
              >
                Via!
              </span>
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
