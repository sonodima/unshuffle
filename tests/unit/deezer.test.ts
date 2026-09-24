// Headless tests for the pure parts of src/lib/deezer.ts and src/lib/coverColor.ts.
// Run: bun test tests/unit/deezer.test.ts
import { describe, expect, test } from 'bun:test'
import { isDeezerShortLink, normalizeTitle, parsePlaylistInput, pickGameTracks, previewExpiresAt, songKey } from '../../src/lib/deezer'
import { colorsFromPixels } from '../../src/lib/coverColor'
import type { TrackInfo } from '../../src/game/types'

describe('parsePlaylistInput', () => {
  const cases: [string, number | null][] = [
    ['https://www.deezer.com/it/playlist/1116187241', 1116187241],
    ['https://www.deezer.com/playlist/1116187241', 1116187241],
    ['deezer.com/playlist/908622995?utm_source=deezer&utm_content=playlist-908622995', 908622995],
    ['www.deezer.com/en/playlist/3155776842/', 3155776842],
    ['https://www.deezer.com/pt-br/playlist/1111141961#x', 1111141961],
    ['  3155776842  ', 3155776842],
    ['Ascolta Top Italy su Deezer: https://www.deezer.com/it/playlist/1116187241?utm_campaign=x', 1116187241],
    ['https://widget.deezer.com/widget/dark/playlist/1116187241', 1116187241],
    ['deezer://www.deezer.com/playlist/1116187241', 1116187241],
    ['http://m.deezer.com/playlist/42', 42],
    ['https://link.deezer.com/s/31qOmXyz', null],
    ['https://deezer.page.link/AbCdEf123', null],
    ['https://www.deezer.com/it/album/302127', null],
    ['https://www.deezer.com/it/playlist/12ab', null],
    ['https://notdeezer.com/playlist/123', null],
    ['https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', null],
    ['hits 2000', null],
    ['0', null],
    ['', null],
    ['99999999999999999999', null],
  ]
  for (const [input, expected] of cases) {
    test(JSON.stringify(input), () => expect(parsePlaylistInput(input)).toBe(expected))
  }
  test('short link detection', () => {
    expect(isDeezerShortLink('https://link.deezer.com/s/31qOm')).toBe(true)
    expect(isDeezerShortLink('deezer.page.link/xyz')).toBe(true)
    expect(isDeezerShortLink('https://www.deezer.com/playlist/1')).toBe(false)
  })
})

describe('normalization', () => {
  test('strips version qualifiers', () => {
    expect(normalizeTitle('Bohemian Rhapsody - Remastered 2011')).toBe('bohemianrhapsody')
    expect(normalizeTitle('Bohemian Rhapsody (Remastered 2011)')).toBe('bohemianrhapsody')
    expect(normalizeTitle('Despacito (feat. Daddy Yankee)')).toBe('despacito')
    expect(normalizeTitle('Despacito feat. Justin Bieber')).toBe('despacito')
    expect(normalizeTitle('Hotel California [Live]')).toBe('hotelcalifornia')
    expect(normalizeTitle('Let It Go (From "Frozen")')).toBe('letitgo')
    expect(normalizeTitle('Perché (Versione 2020)')).toBe('perche')
    expect(normalizeTitle('Mr. Brightside')).toBe('mrbrightside')
  })
  test('keeps meaningful brackets and non-latin titles', () => {
    expect(normalizeTitle('(I Can’t Get No) Satisfaction')).toBe('icantgetnosatisfaction')
    expect(normalizeTitle('Song (Part 2)')).not.toBe(normalizeTitle('Song (Part 1)'))
    expect(normalizeTitle('강남스타일')).toBe('강남스타일')
  })
  test('songKey', () => {
    expect(songKey({ artist: 'Queen', title: 'Bohemian Rhapsody - Remastered 2011' })).toBe(
      songKey({ artist: 'Queen', title: 'Bohemian Rhapsody' }),
    )
    expect(songKey({ artist: 'Beyoncé', title: 'Halo' })).toBe(songKey({ artist: 'Beyonce', title: 'Halo' }))
  })
})

test('previewExpiresAt', () => {
  const url =
    'https://cdnt-preview.dzcdn.net/api/1/1/c/1/0/0/c1088d.mp3?hdnea=exp=1790200337~acl=/api/1/1/c/1/0/0/c1088d.mp3*~data=user_id=0,application_id=42~hmac=ec0e'
  expect(previewExpiresAt(url)).toBe(1790200337000)
  expect(previewExpiresAt('https://x/y.mp3')).toBeNull()
})

function fakeTracks(n: number, artists: number): TrackInfo[] {
  return Array.from({ length: n }, (_, i) => ({
    id: 1000 + i,
    title: `Song ${i}`,
    artist: `Artist ${i % artists}`,
    album: 'A',
    cover: '',
    coverSmall: '',
    preview: 'x',
    link: '',
    rank: 1_000_000 - i * 1000,
    durationSec: 200,
  }))
}

describe('pickGameTracks', () => {
  test('edge cases', () => {
    expect(pickGameTracks([], 5)).toEqual([])
    expect(pickGameTracks(fakeTracks(10, 10), 0)).toEqual([])
    expect(pickGameTracks(fakeTracks(3, 3), 9)).toHaveLength(3)
  })
  test('distribution over 1000 runs (100 tracks, 9 picks)', () => {
    const tracks = fakeTracks(100, 100)
    const hits = new Array<number>(100).fill(0)
    for (let run = 0; run < 1000; run++) {
      const picks = pickGameTracks(tracks, 9)
      expect(new Set(picks.map((t) => t.id)).size).toBe(9)
      for (const t of picks) hits[t.id - 1000]++
    }
    const top = hits.slice(0, 50).reduce((a, b) => a + b, 0)
    const bottom = hits.slice(50).reduce((a, b) => a + b, 0)
    expect(bottom).toBe(0) // only the top half is ever used
    expect(top).toBe(9000)
    const first10 = hits.slice(0, 10).reduce((a, b) => a + b, 0)
    const last10 = hits.slice(40, 50).reduce((a, b) => a + b, 0)
    expect(first10).toBeGreaterThan(last10 * 1.6) // rank bias
    expect(Math.min(...hits.slice(0, 50))).toBeGreaterThan(20) // but every pool track shows up
  })
  test('songs the room has heard come after the ones nobody heard', () => {
    const tracks = fakeTracks(100, 100)
    const heard = new Set(tracks.slice(0, 40).map((t) => t.id)) // the 40 most popular
    for (let run = 0; run < 300; run++) {
      const picks = pickGameTracks(tracks, 9, (id) => (heard.has(id) ? 2 : 0))
      // 10 unheard pool tracks are left (pool = top 50): they come first, then the unheard
      // less known ones — never the famous songs everyone knows by now.
      expect(picks.filter((t) => heard.has(t.id))).toHaveLength(0)
    }
  })
  test('a famous song heard once ties with an unheard less known one; heard twice loses', () => {
    const tracks = fakeTracks(100, 100)
    const top = tracks.slice(0, 50)
    let fromTop = 0
    for (let run = 0; run < 300; run++) {
      const once = pickGameTracks(tracks, 9, (id) => (top.some((t) => t.id === id) ? 1 : 0))
      fromTop += once.filter((t) => top.includes(t)).length
      const twice = pickGameTracks(tracks, 9, (id) => (top.some((t) => t.id === id) ? 2 : 0))
      expect(twice.filter((t) => top.includes(t))).toHaveLength(0)
    }
    // Same tier: popular tracks still weigh more, but both halves get picked.
    expect(fromTop).toBeGreaterThan(300 * 9 * 0.4)
    expect(fromTop).toBeLessThan(300 * 9 * 0.9)
  })
  test('faded plays: a song heard long ago is fresh again', () => {
    const tracks = fakeTracks(60, 60)
    const hits = new Array<number>(60).fill(0)
    for (let run = 0; run < 300; run++) for (const t of pickGameTracks(tracks, 9, () => 0.3)) hits[t.id - 1000]++
    expect(hits.slice(0, 20).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  })
  test('distinct artists when possible', () => {
    const tracks = fakeTracks(60, 12) // 12 artists, 5 songs each
    for (let run = 0; run < 200; run++) {
      const picks = pickGameTracks(tracks, 12)
      expect(new Set(picks.map((t) => t.artist)).size).toBe(12)
    }
    const single = fakeTracks(30, 1)
    expect(pickGameTracks(single, 8)).toHaveLength(8)
  })
})

describe('colorsFromPixels', () => {
  const image = (fill: (x: number, y: number) => [number, number, number]) => {
    const px = new Uint8ClampedArray(48 * 48 * 4)
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) {
        const [r, g, b] = fill(x, y)
        px.set([r, g, b, 255], (y * 48 + x) * 4)
      }
    return px
  }
  const hueOfHex = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min
    if (d === 0) return 0
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (h * 60 + 360) % 360
  }
  test('greyscale → brand defaults', () => {
    const c = colorsFromPixels(image((x) => [x * 5, x * 5, x * 5]))
    expect(c.primary).toBe('#7b5cff')
    expect(c.secondary).toBe('#ff3fd1')
  })
  test('red + blue cover → red-ish primary, blue-ish secondary, dark', () => {
    const c = colorsFromPixels(image((x, y) => (y < 8 ? [200, 30, 40] : y < 14 ? [30, 60, 200] : [10, 10, 14])))
    const hp = hueOfHex(c.primary)
    const hs = hueOfHex(c.secondary)
    expect(hp < 20 || hp > 340).toBe(true)
    expect(hs > 190 && hs < 250).toBe(true)
    expect(c.isDark).toBe(true)
  })
  test('bright yellow cover is light', () => {
    const c = colorsFromPixels(image(() => [250, 220, 40]))
    expect(c.isDark).toBe(false)
    expect(c.primary).not.toBe(c.secondary)
  })
})
