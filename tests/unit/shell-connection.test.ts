// Pure shell rules: connection dialog copy + pinned-chrome layout.
// Run: bun test tests/unit/shell-connection.test.ts
import { describe, expect, test } from 'bun:test'
import { exitNoticeCopy, exitReasonFor, isRoomGoneMessage, lostContextFor, lostDialogCopy } from '../../src/components/shell/connectionCopy'
import { HIDE_AFTER_PX, SHOW_BELOW_PX, hudBottomFrom, nextScrolledAway, stackTop } from '../../src/components/shell/layout'
import type { MessageKey } from '../../src/i18n'
import { REJECT_MESSAGES } from '../../src/net/protocol'

// Store errors are message keys (see src/i18n/locales/it/game.ts); the copy is Italian here.
const ROOM_NOT_FOUND: MessageKey = 'game.net.short.roomNotFound'

describe('lost dialog copy', () => {
  test('context from the phase', () => {
    expect(lostContextFor(null)).toBe('lobby')
    expect(lostContextFor({ kind: 'lobby' })).toBe('lobby')
    for (const kind of ['preparing', 'intro', 'playing', 'reveal'] as const) expect(lostContextFor({ kind })).toBe('game')
    expect(lostContextFor({ kind: 'final' })).toBe('final')
  })

  test('never promises a safe score in the lobby', () => {
    const c = lostDialogCopy('lobby', 'network', true)
    expect(c.canRetry).toBe(true)
    expect(`${c.description} ${c.hint}`).not.toMatch(/punteggio/)
    expect(c.description).toMatch(/forse ha chiuso la stanza/)
  })

  test('in game the promise is conditional on the host still being there', () => {
    const c = lostDialogCopy('game', 'network', true)
    expect(c.canRetry).toBe(true)
    expect(c.hint).toMatch(/^Se l’host è ancora in partita/)
    expect(c.hint).not.toMatch(/al sicuro/)
  })

  test('final: talks about the rematch', () => {
    expect(lostDialogCopy('final', 'network', true).hint).toMatch(/rivincita/)
  })

  test('host gone: no retry, home is the way out', () => {
    for (const ctx of ['lobby', 'game', 'final'] as const) {
      const c = lostDialogCopy(ctx, 'host-gone', true)
      expect(c.canRetry).toBe(false)
      expect(c.hint).not.toMatch(/punteggio/)
    }
    expect(lostDialogCopy('lobby', 'host-gone', true).title).toBe('L’host ha chiuso la stanza')
    expect(lostDialogCopy('game', 'host-gone', true).title).toBe('L’host ha lasciato la partita')
  })

  test('no retry available (e.g. host role)', () => {
    expect(lostDialogCopy('game', 'network', false).canRetry).toBe(false)
  })
})

describe('exit reasons and notices', () => {
  test('reasons', () => {
    expect(exitReasonFor(REJECT_MESSAGES.kicked, 'closed')).toBe('kicked')
    expect(exitReasonFor(REJECT_MESSAGES.closed, 'closed')).toBe('closed')
    expect(exitReasonFor(REJECT_MESSAGES.duplicate, 'closed')).toBe('duplicate')
    expect(exitReasonFor(ROOM_NOT_FOUND, 'error')).toBe('gone')
    expect(exitReasonFor('game.net.roomNotFound', 'error')).toBe('gone')
    expect(exitReasonFor('game.store.welcomeTimeout', 'error')).toBe('failed')
    expect(exitReasonFor(REJECT_MESSAGES.full, 'closed')).toBe('other')
    expect(exitReasonFor('game.store.hostGone', 'closed')).toBe('gone')
    expect(exitReasonFor(null, 'closed')).toBe('other')
  })

  test('room-not-found after a rejoin does not say "controlla il codice"', () => {
    expect(isRoomGoneMessage(ROOM_NOT_FOUND)).toBe(true)
    expect(isRoomGoneMessage('game.store.joinFailed')).toBe(false)
    const c = exitNoticeCopy('gone', ROOM_NOT_FOUND)
    expect(c.title).toBe('Stanza non più disponibile')
    expect(c.description).not.toMatch(/codice/)
    expect(c.canRetry).toBe(false)
  })

  test('other notices keep the store message', () => {
    expect(exitNoticeCopy('kicked', REJECT_MESSAGES.kicked)).toMatchObject({
      title: 'Fuori dalla stanza',
      description: 'L’host ti ha rimosso dalla stanza.',
      tone: 'coral',
    })
    expect(exitNoticeCopy('closed', REJECT_MESSAGES.closed)).toMatchObject({ title: 'Stanza chiusa', tone: 'violet' })
    expect(exitNoticeCopy('failed', 'game.store.joinFailed')).toMatchObject({ title: 'Impossibile rientrare', description: 'Impossibile entrare nella stanza. Riprova.' })
    expect(exitNoticeCopy('other', null)).toMatchObject({ title: 'Sei fuori dalla stanza', description: '' })
  })
})

describe('pinned chrome layout', () => {
  test('hud bottom', () => {
    expect(hudBottomFrom(null, 844)).toBeNull()
    expect(hudBottomFrom({ bottom: 105.6, height: 94 }, 844)).toBe(106)
    expect(hudBottomFrom({ bottom: 0, height: 0 }, 844)).toBeNull()
    // Not a pinned bar: it reaches past ~45% of the screen.
    expect(hudBottomFrom({ bottom: 500, height: 480 }, 844)).toBeNull()
  })

  test('toast stack top', () => {
    const banner = { bottom: 170, left: 44, right: 346 }
    expect(stackTop(null, null, 0)).toBeNull()
    expect(stackTop(106, null, 0)).toBe(106)
    // Phone: the full-width column always meets the banner.
    expect(stackTop(106, banner, 0)).toBe(170)
    expect(stackTop(null, banner, 0)).toBe(170)
    // Desktop: the right-hand column clears a centered banner.
    expect(stackTop(132, { bottom: 197, left: 569, right: 871 }, 1040)).toBe(132)
    expect(stackTop(null, { bottom: 197, left: 569, right: 871 }, 1040)).toBeNull()
  })

  test('scroll-away hysteresis', () => {
    expect(nextScrolledAway(false, 0)).toBe(false)
    expect(nextScrolledAway(false, HIDE_AFTER_PX)).toBe(false)
    expect(nextScrolledAway(false, HIDE_AFTER_PX + 1)).toBe(true)
    expect(nextScrolledAway(true, HIDE_AFTER_PX - 5)).toBe(true)
    expect(nextScrolledAway(true, SHOW_BELOW_PX)).toBe(false)
  })
})
