// Shared helper: run a lab evaluate, retrying when another fixer's edit reloads the page mid-run (shared dev server).
export async function labEval(page, url, fn, arg, { ready = () => window.__fixAudio?.ready, tries = 4 } = {}) {
  for (let i = 0; ; i++) {
    try {
      if (page.url() !== url) await page.goto(url)
      await page.waitForFunction(ready, null, { timeout: 30000 })
      return await page.evaluate(fn, arg)
    } catch (e) {
      if (i >= tries || !/Execution context was destroyed|navigation|Target closed|net::ERR/.test(String(e))) throw e
      console.log(`  (page reloaded under us, retry ${i + 1})`)
      await page.waitForTimeout(1500)
      await page.goto(url).catch(() => {})
    }
  }
}
