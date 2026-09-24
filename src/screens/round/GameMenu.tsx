// In-game exit menu (preparing · playing · reveal). Guests leave the match (the
// host marks them away at once and keeps their score for a rejoin); the host
// ends it for everyone: back to the lobby with the same players, or closes the room.
// RoundView owns one sheet for the whole round; any view below it drops in a
// <GameMenuButton /> that opens it (renders nothing without a provider).
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Icon, IconButton, Modal, cn, playSfx } from '../../components/ui'
import type { IconName } from '../../components/ui'
import type { PlayerId, RoomState } from '../../game/types'
import { RoundMenuContext, useRoundMenu } from './menuContext'
import type { RoundMenuApi } from './menuContext'

interface RoundMenuProviderProps {
  room: RoomState
  me: PlayerId
  /** Leave the room (host: closes it for everyone). Without it there is no menu. */
  onLeave?(): void
  /** Host only: stop the match and bring everyone back to the lobby. */
  onEndGame?(): void
  children: ReactNode
}

export function RoundMenuProvider({ room, me, onLeave, onEndGame, children }: RoundMenuProviderProps) {
  const [open, setOpen] = useState(false)
  const isHost = room.hostId === me
  const available = !!onLeave
  const show = useCallback(() => setOpen(true), [])
  const api = useMemo<RoundMenuApi | null>(() => (available ? { open: show, isOpen: open, isHost } : null), [available, show, open, isHost])
  const others = room.players.filter((p) => p.id !== me && p.connected).length

  // One action per opening: a double tap must not end the game and then leave the next room.
  const done = useRef(false)
  const act = (fn?: () => void) => {
    if (done.current || !fn) return
    done.current = true
    setOpen(false)
    fn()
    setTimeout(() => (done.current = false), 600)
  }

  return (
    <RoundMenuContext.Provider value={api}>
      {children}
      {available && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          size="sm"
          title={isHost ? 'Terminare la partita?' : 'Uscire dalla partita?'}
          description={
            isHost
              ? others > 0
                ? 'Sei l’host: la partita si ferma per tutti.'
                : 'La partita si ferma qui.'
              : 'La partita continua senza di te. Finché è in corso puoi rientrare e ritrovare il tuo punteggio.'
          }
          footer={
            isHost ? (
              <Button variant="glass" onClick={() => setOpen(false)}>
                Continua a giocare
              </Button>
            ) : (
              <>
                <Button variant="glass" onClick={() => setOpen(false)}>
                  Resta
                </Button>
                <Button variant="danger" leftIcon="logout" onClick={() => act(onLeave)}>
                  Esci dalla partita
                </Button>
              </>
            )
          }
        >
          {isHost ? (
            <div className="flex flex-col gap-2.5">
              {onEndGame && (
                <MenuOption
                  icon="home"
                  tone="violet"
                  title="Torna alla lobby"
                  body={others > 0 ? 'Punteggi azzerati, stessi giocatori: cambiate playlist e ripartite.' : 'Punteggio azzerato: cambia playlist e riparti.'}
                  onClick={() => act(onEndGame)}
                />
              )}
              <MenuOption
                icon="logout"
                tone="coral"
                title="Chiudi la stanza"
                body={others > 0 ? `${others === 1 ? 'L’altro giocatore viene disconnesso' : 'Tutti gli altri giocatori vengono disconnessi'}.` : 'Torni alla home.'}
                onClick={() => act(onLeave)}
              />
            </div>
          ) : (
            <div className="glass-subtle flex items-center gap-3 rounded-[18px] px-3.5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan/12 text-cyan shadow-[inset_0_0_0_1px_rgb(46_230_255/0.3)]">
                <Icon name="link" size={17} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug font-semibold text-ink-300">Codice per rientrare</span>
              <span className="num text-[18px] font-bold tracking-[0.18em] text-ink-50">{room.code}</span>
            </div>
          )}
        </Modal>
      )}
    </RoundMenuContext.Provider>
  )
}

const OPTION_TONES = {
  violet: { disc: 'bg-violet/20 text-violet-bright shadow-[inset_0_0_0_1px_rgb(123_92_255/0.4)]', hover: 'hover:border-violet/45 hover:bg-violet/[0.08]' },
  coral: { disc: 'bg-coral/15 text-coral shadow-[inset_0_0_0_1px_rgb(255_84_112/0.4)]', hover: 'hover:border-coral/45 hover:bg-coral/[0.08]' },
} as const

function MenuOption({ icon, tone, title, body, onClick }: { icon: IconName; tone: keyof typeof OPTION_TONES; title: string; body: string; onClick(): void }) {
  const t = OPTION_TONES[tone]
  return (
    <button
      type="button"
      onClick={() => {
        playSfx('click')
        onClick()
      }}
      className={cn(
        'group glass-subtle flex min-h-[72px] w-full items-center gap-3.5 rounded-[20px] px-3.5 py-3 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.985]',
        t.hover,
      )}
    >
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-full', t.disc)}>
        <Icon name={icon} size={21} strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-tight font-extrabold text-ink-50">{title}</span>
        <span className="mt-1 block text-[13px] leading-snug font-semibold text-ink-300">{body}</span>
      </span>
      <Icon name="chevron-right" size={18} strokeWidth={2.6} className="text-ink-400 transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  )
}

interface GameMenuButtonProps {
  size?: 'sm' | 'md'
  className?: string
}

/** Round glass button that opens the exit menu. Nothing without a RoundMenuProvider. */
export function GameMenuButton({ size = 'sm', className }: GameMenuButtonProps) {
  const menu = useRoundMenu()
  if (!menu) return null
  return (
    <IconButton
      icon="logout"
      label={menu.isHost ? 'Termina partita' : 'Esci dalla partita'}
      size={size}
      variant="glass"
      onClick={menu.open}
      tooltip={size === 'md'}
      tooltipSide="bottom"
      className={className}
    />
  )
}
