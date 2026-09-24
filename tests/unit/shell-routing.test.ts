import { describe, expect, test } from 'bun:test'
import { isValidRoomCode, normalizePath, parseHash, roomHash, roomPath } from '../../src/lib/router'
import { screenTitle, selectScreen } from '../../src/components/shell/routing'
import { splitMessage, toastForEvent } from '../../src/components/shell/toastCopy'
import type { ToastCopyContext } from '../../src/components/shell/toastCopy'
import { fxFinal, fxLobby, fxPlaying, fxPreparing, fxReveal, fxIntro } from '../fixtures/room'

describe('router', () => {
  test('normalizes paths', () => {
    expect(normalizePath('')).toBe('/')
    expect(normalizePath('#')).toBe('/')
    expect(normalizePath('#/')).toBe('/')
    expect(normalizePath('#/r/abcde/')).toBe('/r/abcde')
    expect(normalizePath('#//r/abcde?x=1')).toBe('/r/abcde')
  })
  test('parses routes', () => {
    expect(parseHash('').name).toBe('home')
    const r = parseHash('#/r/kxqpm')
    expect(r).toMatchObject({ name: 'room', path: '/r/KXQPM', code: 'KXQPM', params: { code: 'KXQPM' } })
    expect(parseHash('#/r/KXQPO').code).toBeNull() // O is not in the alphabet
    expect(parseHash('#/r/KXQ').code).toBeNull()
    expect(parseHash('#/nope').name).toBe('unknown')
  })
  test('codes and helpers', () => {
    expect(isValidRoomCode('abcde')).toBe(true)
    expect(isValidRoomCode('ABCDI')).toBe(false)
    expect(roomPath('kxqpm')).toBe('/r/KXQPM')
    expect(roomHash('KXQPM')).toBe('#/r/KXQPM')
  })
})

describe('screen selection', () => {
  test('role and phase decide the screen', () => {
    expect(selectScreen({ role: 'none', room: fxLobby })).toBe('home')
    expect(selectScreen({ role: 'client', room: null })).toBe('home')
    expect(selectScreen({ role: 'client', room: fxLobby })).toBe('lobby')
    for (const r of [fxPreparing, fxIntro, fxPlaying, fxReveal]) expect(selectScreen({ role: 'host', room: r })).toBe('round')
    expect(selectScreen({ role: 'host', room: fxFinal })).toBe('final')
  })
  test('titles', () => {
    expect(screenTitle('home', null)).toBe('UNSHUFFLE')
    expect(screenTitle('lobby', fxLobby)).toBe('UNSHUFFLE · Lobby KXQPM')
    expect(screenTitle('round', fxPlaying)).toBe('UNSHUFFLE · Round 3/5')
    expect(screenTitle('round', fxReveal)).toBe('UNSHUFFLE · Round 3/5 · Risultati')
    expect(screenTitle('round', fxPreparing)).toBe('UNSHUFFLE · Round 3/5 · Preparazione')
    expect(screenTitle('final', fxFinal)).toBe('UNSHUFFLE · Classifica finale')
    expect(screenTitle('lobby', fxLobby, true)).toBe('UNSHUFFLE · Connessione persa')
  })
})

describe('toast copy', () => {
  const ctx: ToastCopyContext = {
    player: (id) => fxLobby.players.find((p) => p.id === id),
    playerCount: 5,
    clockOffset: 0,
  }
  const at = 1_000_000
  test('events', () => {
    expect(toastForEvent({ id: 1, at, event: { type: 'player-joined', playerId: 'p-2', name: 'Giulia' } }, ctx)).toMatchObject({
      tone: 'success',
      icon: '🦄',
      title: 'Giulia è in stanza',
      body: 'Ora siete in 5',
    })
    expect(toastForEvent({ id: 2, at, event: { type: 'player-left', playerId: 'x', name: 'Ugo' } }, ctx)).toMatchObject({ tone: 'neutral', icon: 'logout', title: 'Ugo ha lasciato la stanza' })
    expect(toastForEvent({ id: 3, at, event: { type: 'submitted', playerId: 'p-3', name: 'DJ Pinguino' } }, ctx)?.title).toBe('DJ Pinguino ha confermato')
    expect(toastForEvent({ id: 4, at, event: { type: 'first-submit', playerId: 'p-2', name: 'Giulia', endsAt: at + 14_200 } }, ctx)).toMatchObject({
      tone: 'warning',
      body: 'Ultimi 15 secondi per tutti!',
    })
    expect(toastForEvent({ id: 5, at, event: { type: 'kicked', playerId: 'p-4' } }, ctx)?.title).toBe('L’host ha rimosso Marco')
    expect(toastForEvent({ id: 6, at, event: { type: 'kicked', playerId: 'zz' } }, ctx)?.title).toBe('L’host ha rimosso un giocatore')
    expect(toastForEvent({ id: 7, at, event: { type: 'reaction', playerId: 'p-2', emoji: '🔥' } }, ctx)).toBeNull()
    // Info toasts carry message keys: the UI's own notices confirm, unless their key says "…Failed";
    // host / store / network messages are warnings.
    expect(toastForEvent({ id: 8, at, event: { type: 'info', message: 'lobby.invite.linkCopied' } }, ctx)).toMatchObject({
      tone: 'success',
      icon: 'check',
      title: 'Link della stanza copiato!',
    })
    expect(toastForEvent({ id: 11, at, event: { type: 'info', message: 'lobby.invite.copyFailed' } }, ctx)).toMatchObject({
      tone: 'warning',
      title: 'Copia non riuscita',
      body: 'Usa il pulsante QR per vedere il link.',
    })
    expect(toastForEvent({ id: 9, at, event: { type: 'info', message: 'game.store.actionFailed' } }, ctx)).toMatchObject({
      tone: 'warning',
      icon: 'alert',
      title: 'Azione non riuscita.',
    })
    expect(
      toastForEvent({ id: 10, at, event: { type: 'info', message: { key: 'game.store.audioUnavailableTitled', params: { title: 'Harder, Better, Faster, Stronger' } } } }, ctx),
    ).toMatchObject({ tone: 'warning', title: 'Audio di “Harder, Better, Faster, Stronger” non disponibile.' })
  })
  test('splitMessage', () => {
    expect(splitMessage('Link copiato')).toEqual({ title: 'Link copiato' })
    expect(splitMessage('Audio di “Harder, Better, Faster, Stronger” non disponibile: puoi comunque giocare.')).toEqual({
      title: 'Audio di “Harder, Better, Faster, Stronger” non disponibile',
      body: 'Puoi comunque giocare.',
    })
    const long = 'Questo è un messaggio molto lungo senza separatori che continua ancora e ancora'
    expect(splitMessage(long)).toEqual({ title: long })
  })
})
