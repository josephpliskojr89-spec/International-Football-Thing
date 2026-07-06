import { chromium } from 'playwright-core'
const SHOT = '/tmp/claude-0/-home-user-International-Football-Thing/9ec05242-7814-582c-9650-1206506be6cd/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto('http://localhost:4412/', { waitUntil: 'networkidle' })
const s = ms => new Promise(r => setTimeout(r, ms))
const click = async n => { const x = p.getByRole('button', { name: n, exact: false }).first(); if (await x.count() && await x.isVisible().catch(()=>false)) { await x.click().catch(()=>{}); return true } return false }
await s(300)
await click('Continue Career'); await s(500)
// get back to schedule if stuck anywhere
for (let i = 0; i < 6; i++) {
  const body = await p.locator('body').innerText()
  if (/WEEK/.test(body) && /Advance Week|Play Match/.test(body)) break
  await click('Continue'); await s(200)
  const back = p.getByRole('button', { name: /Home|Back|‹/ }).first()
  if (await back.count()) await back.click().catch(()=>{})
  await s(200)
}
await p.getByRole('button', { name: 'Menu' }).click({ timeout: 5000 }).catch(()=>{})
await s(250); await click('Legacy'); await s(300)
await click('The Road Not Taken'); await s(1500)
const ghost = await p.locator('body').innerText()
console.log('ghost intro?', /never picked up the phone/.test(ghost))
console.log('empty state ok?', /hasn't been played yet/.test(ghost))
await p.screenshot({ path: `${SHOT}/ghost.png` })
console.log('errors:', errs.length, errs.slice(0,3))
await b.close()
