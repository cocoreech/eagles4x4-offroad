import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3000'
const browser = await chromium.launch()
const page = await browser.newPage()
const log = (...a) => console.log('[drive]', ...a)

page.on('console', m => { if (m.type() === 'error') log('PAGE-ERR>', m.text()) })
page.on('pageerror', e => log('PAGEERROR>', e.message))
page.on('requestfailed', r => log('REQ-FAIL>', r.url(), r.failure()?.errorText))

await page.goto(`${BASE}/bookings/new`, { waitUntil: 'networkidle' })
log('loaded', page.url())

// 1) Service
await page.locator('section:has-text("Choose") button[type="button"]').first().click()
log('service selected')

// 2) Vehicle (native selects). Pick make → wait for models to populate → model.
const makeSel = page.locator('select').nth(0)
await makeSel.selectOption('Toyota')
await page.waitForTimeout(300)
const modelSel = page.locator('select').nth(1)
const modelValues = await modelSel.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean))
log('model options for Toyota:', modelValues.slice(0, 8))
await modelSel.selectOption(modelValues[0])
const yearSel = page.locator('select').nth(2)
await yearSel.selectOption('2020')
const transSel = page.locator('select').nth(3)
await transSel.selectOption('automatic')
log('vehicle filled')

// 3) Time slot — first available button
await page.locator('section:has-text("Slot") button').first().click()
log('time slot picked')

// 4) Phone + email
await page.locator('input[placeholder="0917 123 4567"]').fill('9171234567')
await page.locator('input[name="contactEmail"]').fill('guesttest@example.com')
log('contact filled')

await page.screenshot({ path: 'e2e/booking-3-filled.png', fullPage: true })

// 5) Submit
await page.locator('button[type="submit"]').click()
log('submitted — waiting for navigation')

try {
  await page.waitForURL(/\/bookings\/.+\/success/, { timeout: 15000 })
  log('REDIRECTED to success:', page.url())
} catch {
  log('No success redirect. Current URL:', page.url())
  const err = await page.locator('p').filter({ hasText: /./ }).allTextContents()
  log('visible messages:', err.filter(t => t.length < 200))
}

await page.waitForTimeout(1000)
await page.screenshot({ path: 'e2e/booking-4-result.png', fullPage: true })
log('final URL:', page.url())

await browser.close()
log('done')
