// First-time visitor: home on desktop + phone, onboarding overlay, bad code, offline banner.
import { BASE, DESKTOP, PHONE, SMALLPHONE, launch, openPlayer, shot, waitScreen, log, problems } from './lib.mjs'
const browser = await launch()
try {
  for (const [tag, opts] of [['desk', DESKTOP], ['phone', PHONE], ['small', SMALLPHONE]]) {
    const p = await openPlayer(browser, tag, opts)
    const t0 = Date.now()
    await p.goto(BASE, { waitUntil: 'load' })
    await waitScreen(p, 'home')
    log(tag, 'home visible after', Date.now() - t0, 'ms')
    await p.waitForTimeout(600)
    await shot(p, `ft-${tag}-01-home-before-overlay`)
    const dlg = p.getByRole('dialog')
    await dlg.waitFor({ timeout: 5000 }).catch(() => log('no onboarding dialog'))
    await p.waitForTimeout(1500)
    await shot(p, `ft-${tag}-02-howto`)
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    log(tag, 'h-overflow', overflow)
    await p.getByRole('button', { name: /Ho capito/ }).click().catch(() => log('no Ho capito'))
    await p.waitForTimeout(800)
    await shot(p, `ft-${tag}-03-home`)
    if (tag !== 'desk') {
      // scroll bottom
      await p.evaluate(() => document.querySelector('.h-dvh')?.scrollTo({ top: 9999 }))
      await p.waitForTimeout(300)
      await shot(p, `ft-${tag}-04-home-bottom`)
    }
    // bad code
    const first = p.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
    await first.click()
    await p.keyboard.type('zzzzq', { delay: 40 })
    await p.getByRole('button', { name: /^Entra/ }).click()
    const t1 = Date.now()
    await p.getByRole('alert').first().waitFor({ timeout: 40000 }).catch(() => log('no alert'))
    log(tag, 'bad-code error after', Date.now() - t1, 'ms', await p.getByRole('alert').first().textContent().catch(() => null))
    await p.waitForTimeout(500)
    await shot(p, `ft-${tag}-05-badcode`)
    if (tag === 'phone') {
      await p.context().setOffline(true)
      await p.waitForTimeout(500)
      await shot(p, `ft-${tag}-06-offline`)
      await p.getByRole('button', { name: 'Crea stanza', exact: true }).click()
      await p.waitForTimeout(8000)
      await shot(p, `ft-${tag}-07-offline-create`)
      log('offline create alerts:', await p.getByRole('alert').allTextContents())
      await p.context().setOffline(false)
    }
    await p.context().close()
  }
} finally {
  await browser.close()
  console.log('problems:', problems.join('\n') || '(none)')
}
