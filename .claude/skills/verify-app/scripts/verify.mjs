// End-to-end check of the built app in headless Chromium. Run via `npm run verify`
// (which builds first). Options:
//   --db <path>   also load this statistics file (e.g. a real export) and screenshot it
//   --quick       desktop only, skip tablet/mobile
//
// Writes screenshots and report.json to .verify/, exits 1 if any check fails.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { browserSupportProblems } from './browser-support.mjs'
import { makeFixtures } from './fixtures.mjs'

const { values: args } = parseArgs({
  options: { db: { type: 'string' }, quick: { type: 'boolean', default: false } },
})

const ROOT = process.cwd()
const OUT = resolve(ROOT, '.verify')
const SHOTS = join(OUT, 'screenshots')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(SHOTS, { recursive: true })

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
}

const results = []
const screenshots = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const { dir: fixtures, expected } = await makeFixtures(join(OUT, 'fixtures'))
const server = await preview({ root: ROOT, logLevel: 'silent', preview: { port: 4318 } })
const url = server.resolvedUrls?.local[0]
if (!url) throw new Error('vite preview did not report a URL')
const origin = new URL(url).origin

const browser = await chromium.launch()

/** Opens the app in a fresh context, recording console errors and off-origin requests. */
async function open(viewport, colorScheme) {
  const { width, height, ...rest } = viewport
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    locale: 'en-US',
    ...rest,
  })
  const page = await context.newPage()
  const problems = { errors: [], foreignRequests: [] }
  page.on('console', (m) => m.type() === 'error' && problems.errors.push(m.text()))
  page.on('pageerror', (e) => problems.errors.push(String(e)))
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'))
      problems.foreignRequests.push(u)
  })
  await page.goto(url)
  return { page, context, problems }
}

async function loadFile(page, file) {
  await page.setInputFiles('input[type=file]', file)
  await page.waitForSelector('.stat-tiles, [role=alert]', { timeout: 15000 })
}

async function shot(page, name) {
  const path = join(SHOTS, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  screenshots.push(path)
}

async function noOverflow(page, label) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }))
  check(
    `${label}: no horizontal page overflow`,
    scroll <= width,
    `scrollWidth ${scroll}, viewport ${width}`,
  )
}

function tile(page, label) {
  return page
    .locator('.stat-tile', { has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .locator('.stat-value')
}

try {
  // 1. Invalid files show the right error.
  {
    const { page, context, problems } = await open(VIEWPORTS.desktop, 'light')
    const cases = [
      ['not-a-database.sqlite3', 'not an SQLite database'],
      ['other.sqlite3', "doesn't contain KOReader reading statistics"],
      ['old-schema.sqlite3', 'old format'],
      ['empty.sqlite3', 'no reading activity'],
    ]
    for (const [file, message] of cases) {
      await loadFile(page, join(fixtures, file))
      const text = (await page.locator('[role=alert]').textContent()) ?? ''
      check(`error for ${file}`, text.includes(message), text.trim())
    }
    await shot(page, 'error-desktop-light')
    check(
      'error pages: no console errors',
      problems.errors.length === 0,
      problems.errors.join(' | '),
    )
    await context.close()
  }

  // 1b. The bundled example database loads from the upload panel, from this origin only.
  {
    const { page, context, problems } = await open(VIEWPORTS.mobile, 'light')
    const button = page.getByRole('button', { name: 'Try with example data' })
    check('example data button is shown on the upload panel', await button.isVisible())
    await shot(page, 'home-mobile-light')
    await button.click()
    await page.waitForSelector('.stat-tiles, [role=alert]', { timeout: 15000 })
    const heading = await page.locator('h1').textContent()
    const fileName = await page
      .locator('.file-name')
      .textContent()
      .catch(() => null)
    check(
      'example data opens the dashboard',
      heading === 'Your reading' && fileName === 'example-statistics.sqlite3',
      `h1 "${heading}", file "${fileName}"`,
    )
    check(
      'example data: no console errors or off-origin requests',
      problems.errors.length === 0 && problems.foreignRequests.length === 0,
      [...problems.errors, ...problems.foreignRequests].join(' | '),
    )
    await context.close()
  }

  // 1c. Browsers from 2020: no unsupported syntax/selectors in dist/, and the app works without
  // the APIs those browsers lack. WebAssembly.validate() returning false (as for Safari < 15,
  // which can't run sql.js's WebAssembly build) makes db.ts fall back to the asm.js build.
  // BigInt64Array itself can't be removed: Playwright's evaluate() needs it. .no-flex-gap
  // forces the margin fallback for flex gap.
  {
    const problems = browserSupportProblems(join(ROOT, 'dist'))
    check(
      'dist/ uses nothing newer than the 2020 targets',
      problems.length === 0,
      problems.join(' | '),
    )

    const { page, context, problems: runtime } = await open(VIEWPORTS.mobile, 'light')
    await context.addInitScript(() => {
      WebAssembly.validate = () => false
      delete Blob.prototype.arrayBuffer
    })
    const sqlBuilds = []
    page.on('request', (r) => {
      const name = r.url().split('/').pop()
      if (name.startsWith('sql-')) sqlBuilds.push(name.replace(/-[\w-]{8}\./, '.'))
    })
    await page.reload()
    await page.evaluate(() => document.documentElement.classList.add('no-flex-gap'))
    await loadFile(page, join(fixtures, 'statistics.sqlite3'))
    const books = await tile(page, 'Books')
      .textContent()
      .catch(() => null)
    check(
      'legacy browser: loads with the asm.js build of sql.js',
      books === String(expected.books) && sqlBuilds.some((n) => n.startsWith('sql-asm')),
      `Books tile "${books}", requested ${sqlBuilds.join(', ')}`,
    )
    await page.evaluate(() => document.documentElement.classList.add('no-flex-gap'))
    await noOverflow(page, 'legacy browser (no flex gap)')
    await shot(page, 'legacy-mobile-light')
    check(
      'legacy browser: no console errors',
      runtime.errors.length === 0,
      runtime.errors.join(' | '),
    )
    await context.close()
  }

  // 2. The fixture database in every viewport and theme.
  const viewports = args.quick ? ['desktop'] : Object.keys(VIEWPORTS)
  for (const name of viewports) {
    for (const theme of ['light', 'dark']) {
      const label = `${name}/${theme}`
      const { page, context, problems } = await open(VIEWPORTS[name], theme)
      await loadFile(page, join(fixtures, 'statistics.sqlite3'))

      const books = await tile(page, 'Books').textContent()
      check(
        `${label}: Books tile`,
        books === String(expected.books),
        `got ${books}, expected ${expected.books}`,
      )
      const pages = await tile(page, 'Pages read').textContent()
      check(
        `${label}: Pages read tile`,
        pages === expected.pagesRead.toLocaleString('en-US'),
        `got ${pages}, expected ${expected.pagesRead.toLocaleString('en-US')}`,
      )
      const streak = await tile(page, 'Current streak').textContent()
      check(
        `${label}: current streak counts today`,
        Boolean(streak) && !streak.startsWith('0 '),
        `got ${streak}`,
      )
      const rows = await page.locator('.books-table tbody tr').count()
      check(`${label}: one table row per read book`, rows === expected.books, `got ${rows}`)
      const titles = await page.locator('.books-table tbody th').allTextContents()
      check(`${label}: NUL characters stripped from titles`, !titles.some((t) => t.includes('\0')))
      await noOverflow(page, `${label} dashboard`)
      await shot(page, `dashboard-${name}-${theme}`)

      if (name === 'mobile') {
        const info = page.locator('.progress-chart .info-tip').first()
        await info.locator('button').tap()
        check(
          `${label}: tapping ? opens the info panel`,
          await info.locator('.info-tip-panel').isVisible(),
        )
        await info.scrollIntoViewIfNeeded()
        await page.screenshot({ path: join(SHOTS, `info-${name}-${theme}.png`) })
        screenshots.push(join(SHOTS, `info-${name}-${theme}.png`))
        await page.locator('h1').tap()
        check(
          `${label}: tapping elsewhere closes it`,
          !(await info.locator('.info-tip-panel').isVisible()),
        )
      }

      await page.locator('.book-link').first().click()
      await page.waitForSelector('.details-list')
      const focused = await page.evaluate(() => document.activeElement?.tagName)
      check(`${label}: focus moves to h1 on book page`, focused === 'H1', `focused ${focused}`)
      await noOverflow(page, `${label} book page`)
      await shot(page, `book-${name}-${theme}`)

      check(
        `${label}: no console errors`,
        problems.errors.length === 0,
        problems.errors.join(' | '),
      )
      check(
        `${label}: no requests to other sites`,
        problems.foreignRequests.length === 0,
        problems.foreignRequests.join(', '),
      )
      await context.close()
    }
  }

  // 3. Interactions: theme switch, sorting, chart keyboard access, book routing.
  {
    const { page, context } = await open(VIEWPORTS.desktop, 'light')
    // Full downloads only: vite preview sends Cache-Control: no-cache, so a later use of the
    // sprite (the upload panel has icons too) is a 304 revalidation, which downloads nothing.
    const spriteRequests = []
    page.on('response', (r) => {
      if (r.url().includes('stat-icons') && r.status() === 200) spriteRequests.push(r.url())
    })
    await loadFile(page, join(fixtures, 'statistics.sqlite3'))

    // Stat tile icons: every tile has one, each points at a symbol that exists in the sprite,
    // and the sprite is a single request shared by all icons.
    const hrefs = await page
      .locator('.stat-tile')
      .evaluateAll((tiles) =>
        tiles.map((t) => t.querySelector('.stat-icon use')?.getAttribute('href') ?? null),
      )
    check(
      'every stat tile has an icon',
      hrefs.length > 0 && hrefs.every(Boolean),
      `${hrefs.length} tiles`,
    )
    const spriteUrl = hrefs[0]?.split('#')[0]
    const sprite = spriteUrl
      ? await (await page.request.get(new URL(spriteUrl, url).href)).text()
      : ''
    const missing = hrefs.filter((h) => h && !sprite.includes(`id="${h.split('#')[1]}"`))
    check('every icon exists in the sprite', missing.length === 0, missing.join(', '))
    await page.waitForLoadState('networkidle')
    check(
      'icon sprite is downloaded once',
      spriteRequests.length === 1,
      `${spriteRequests.length} downloads`,
    )

    await page.getByLabel('Dark').check({ force: true })
    check(
      'theme switch sets data-theme',
      (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark',
    )
    await page.reload()
    check(
      'theme choice survives reload',
      (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark',
    )
    await page.getByLabel('System').check({ force: true })
    await loadFile(page, join(fixtures, 'statistics.sqlite3'))

    await page.getByRole('button', { name: 'Reading time' }).click()
    const sort = await page.locator('th[aria-sort]').getAttribute('aria-sort')
    check('sorting a column sets aria-sort', sort === 'descending', `aria-sort=${sort}`)

    await page.locator('.chart-plot').first().focus()
    await page.keyboard.press('End')
    const announced = await page.locator('.chart [aria-live=polite]').first().textContent()
    check('chart announces values via keyboard', Boolean(announced?.trim()), announced ?? '')

    await page.getByRole('searchbox', { name: 'Search books' }).fill('earthsea')
    const filtered = await page.locator('.books-table tbody tr').count()
    check('search filters the table', filtered === 1, `got ${filtered} rows`)

    await page.getByRole('searchbox', { name: 'Search books' }).fill('')

    // Reading periods timeline: one row per read book, scrolls inside its own box, opens at the
    // most recent end, and focusing a title shows its tooltip inside the chart.
    const timeline = page.locator('.timeline-chart')
    const tlRows = await timeline.locator('.timeline-labels a').count()
    check(
      'timeline has a row per read book',
      tlRows === expected.books,
      `got ${tlRows}, expected ${expected.books}`,
    )
    const tlScroll = await timeline
      .locator('.timeline-scroll')
      .evaluate((el) => ({ left: el.scrollLeft, max: el.scrollWidth - el.clientWidth }))
    check(
      'timeline opens scrolled to the latest date',
      tlScroll.max <= 0 || Math.abs(tlScroll.left - tlScroll.max) <= 1,
      JSON.stringify(tlScroll),
    )
    await timeline.locator('.timeline-labels a').first().focus()
    const tlTip = await timeline.locator('.timeline-tooltip').boundingBox()
    const tlBox = await timeline.locator('.timeline-frame').boundingBox()
    check(
      'timeline tooltip on focus stays inside the chart',
      Boolean(
        tlTip &&
        tlBox &&
        tlTip.x >= tlBox.x - 1 &&
        tlTip.x + tlTip.width <= tlBox.x + tlBox.width + 1,
      ),
      JSON.stringify({ tlTip, tlBox }),
    )
    await page.locator('body').focus()

    // Reading pace charts: one line and one legend entry per finished book, linked highlighting.
    const pace = page.locator('.progress-chart')
    check('one reading pace chart', (await pace.count()) === 1, `got ${await pace.count()}`)
    const first = pace.first()
    const lines = await first.locator('.progress-line').count()
    check(
      'pace chart has a line per book above 95%',
      lines === expected.finishedBooks,
      `got ${lines}, expected ${expected.finishedBooks}`,
    )
    await first.locator('.progress-legend button').first().hover()
    check(
      'hovering a legend name highlights its line',
      (await first.locator('.progress-line.is-active').count()) === 1 &&
        (await first.locator('.progress-line.is-dimmed').count()) === lines - 1,
    )
    await page.mouse.move(0, 0)
    // Hover the middle of the last line's hit path (the one drawn on top).
    const hit = first.locator('.progress-hit').last()
    const pt = await hit.evaluate((el) => {
      const p = el.getPointAtLength(el.getTotalLength() / 2)
      const m = el.getScreenCTM()
      return { x: p.x * m.a + m.e, y: p.y * m.d + m.f }
    })
    await page.mouse.move(pt.x, pt.y)
    const activeLegend = await first.locator('.progress-legend button.is-active').count()
    check(
      'hovering a line highlights its legend name',
      activeLegend === 1,
      `${activeLegend} active`,
    )
    const tip = await first
      .locator('.chart-tooltip')
      .textContent()
      .catch(() => null)
    check('hovering a line shows a tooltip', Boolean(tip), tip ?? '')
    await page.mouse.move(0, 0)

    // Info tip: opens on hover, closes on leave, toggles on click, closes on Escape.
    const infoButton = first.locator('.info-tip-button')
    const panel = first.locator('.info-tip-panel')
    await infoButton.hover()
    check('info panel opens on hover', await panel.isVisible())
    await page.mouse.move(0, 0)
    check('info panel closes when the mouse leaves', !(await panel.isVisible()))
    await infoButton.click()
    await page.mouse.move(0, 0)
    check('info panel stays open after a click', await panel.isVisible())
    await page.keyboard.press('Escape')
    check('Escape closes the info panel', !(await panel.isVisible()))

    await page.goto(`${url}#/book/99999`)
    await page.waitForSelector('h1')
    check(
      'unknown book id shows "Book not found"',
      (await page.locator('h1').textContent()) === 'Book not found',
    )
    await context.close()
  }

  // 4. Optional: a real database supplied by the user.
  if (args.db) {
    const file = resolve(args.db)
    for (const theme of ['light', 'dark']) {
      const { page, context, problems } = await open(VIEWPORTS.desktop, theme)
      await loadFile(page, file)
      const alert = await page
        .locator('[role=alert]')
        .textContent()
        .catch(() => null)
      check(`--db ${basename(file)} (${theme}) loads`, !alert, alert ?? '')
      if (!alert) await shot(page, `custom-dashboard-${theme}`)
      check(
        `--db ${basename(file)} (${theme}): no console errors`,
        problems.errors.length === 0,
        problems.errors.join(' | '),
      )
      await context.close()
    }
  }
} finally {
  await browser.close()
  await server.close()
}

const failed = results.filter((r) => !r.ok)
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ expected, results, screenshots }, null, 2))
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
console.log(`Screenshots: ${SHOTS}`)
process.exit(failed.length ? 1 : 0)
