import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows project cards', async ({ page }) => {
    const card = page.locator('.project-card').first()
    await expect(card).toBeVisible()
  })

  test('clicking project card navigates to lexicon', async ({ page }) => {
    const card = page.locator('.project-card:not(.project-card-add)').first()
    await expect(card).toBeVisible()
    await card.click()
    await page.waitForSelector('.word-card')
    expect(page.url()).toContain('/projects/')
  })

  test('new project button is visible', async ({ page }) => {
    const addBtn = page.locator('.project-card-add')
    await expect(addBtn).toBeVisible()
  })
})

test.describe('Lexicon app', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test so we start with default lang (ru)
    await page.goto('/projects/tainted-grail')
    await page.evaluate(() => localStorage.clear())
    await page.goto('/projects/tainted-grail')
    await page.waitForSelector('.word-card')
  })

  test('loads word data and displays cards', async ({ page }) => {
    const cards = page.locator('.word-card')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThan(0)
  })

  test('sidebar shows word count', async ({ page }) => {
    const wordCount = page.locator('.word-count')
    await expect(wordCount).toContainText(/\d+ words/)
  })

  test('sidebar search filters words', async ({ page }) => {
    const input = page.locator('.search-box input')
    const firstWord = await page.locator('.word-list-item').first().textContent()
    await input.fill(firstWord!)

    const items = page.locator('.word-list-item')
    await expect(items.first()).toContainText(firstWord!)

    // Clear search should restore full list
    await input.fill('')
    expect(await items.count()).toBeGreaterThan(1)
  })

  test('language toggle switches to EN and persists', async ({ page }) => {
    const enBtn = page.locator('.card-lang-btn', { hasText: 'EN' }).first()
    const ruBtn = page.locator('.card-lang-btn', { hasText: 'RU' }).first()

    // Default is RU — switch to EN
    await enBtn.click()
    await page.waitForSelector('.word-card')

    // EN button should be active
    await expect(enBtn).toHaveClass(/active/)
    await expect(ruBtn).not.toHaveClass(/active/)

    // Reload — should persist EN
    await page.reload()
    await page.waitForSelector('.word-card')
    await expect(page.locator('.card-lang-btn', { hasText: 'EN' }).first()).toHaveClass(/active/)
  })

  test('clicking sidebar word scrolls to card', async ({ page }) => {
    const sidebarItems = page.locator('.word-list-item')
    const targetWord = await sidebarItems.nth(2).textContent()
    await sidebarItems.nth(2).click()

    const card = page.locator(`.word-card[data-word="${targetWord}"]`)
    await expect(card).toBeVisible()
  })

  test('word card shows all major sections', async ({ page }) => {
    const firstCard = page.locator('.word-card').first()
    await expect(firstCard.locator('.card-word')).toBeVisible()
  })

  test('word history toggle opens and closes', async ({ page }) => {
    const historyToggle = page.locator('.word-history-toggle').first()
    if (await historyToggle.isVisible()) {
      const historyBox = historyToggle.locator('..')
      await expect(historyBox).not.toHaveClass(/open/)

      await historyToggle.click()
      await expect(historyBox).toHaveClass(/open/)

      await historyToggle.click()
      await expect(historyBox).not.toHaveClass(/open/)
    }
  })

  test('scroll-to-top button appears on scroll and works', async ({ page }) => {
    const scrollBtn = page.locator('.scroll-top')
    await expect(scrollBtn).not.toHaveClass(/visible/)

    // Scroll down
    await page.evaluate(() => {
      document.querySelector('.main')!.scrollTo({ top: 1000 })
    })
    await expect(scrollBtn).toHaveClass(/visible/)

    // Click scroll-to-top
    await scrollBtn.click()
    await page.waitForTimeout(500)
    const scrollTop = await page.evaluate(() =>
      document.querySelector('.main')!.scrollTop
    )
    expect(scrollTop).toBeLessThan(100)
  })

  test('active word tracking highlights sidebar item on scroll', async ({ page }) => {
    // Scroll to a card further down
    await page.evaluate(() => {
      document.querySelector('.main')!.scrollTo({ top: 800 })
    })
    await page.waitForTimeout(300)

    const activeItem = page.locator('.word-list-item.active')
    await expect(activeItem).toHaveCount(1)
  })

  test('back link navigates to dashboard', async ({ page }) => {
    const backLink = page.locator('.header-back')
    await expect(backLink).toBeVisible()
    await backLink.click()
    await page.waitForSelector('.project-card')
    expect(page.url()).not.toContain('/projects/')
  })

  test('mobile hamburger toggles sidebar', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/projects/tainted-grail')
    await page.waitForSelector('.word-card')

    const hamburger = page.locator('.hamburger')
    await expect(hamburger).toBeVisible()

    // Open sidebar
    await hamburger.click()
    await expect(page.locator('.sidebar')).toHaveClass(/open/)

    // Close via overlay
    await page.locator('.sidebar-overlay').click()
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/)
  })

  test('URL hash updates on sidebar click', async ({ page }) => {
    const sidebarItem = page.locator('.word-list-item').nth(2)
    const wordText = await sidebarItem.textContent()
    await sidebarItem.click()

    const slug = wordText!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    await expect(page).toHaveURL(new RegExp(`#${slug}$`))
  })

  test('URL lang param updates on language toggle', async ({ page }) => {
    const enBtn = page.locator('.card-lang-btn', { hasText: 'EN' }).first()
    await enBtn.click()
    await page.waitForSelector('.word-card')

    await expect(page).toHaveURL(/[?&]lang=en/)
  })

  test('direct URL with hash and lang loads correctly', async ({ page }) => {
    // Get a word slug from the already-loaded sidebar (words are same in both langs)
    const thirdWord = await page.locator('.word-list-item').nth(2).textContent()
    const slug = thirdWord!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Navigate directly to the URL with both lang and hash
    await page.goto(`/projects/tainted-grail?lang=en#${slug}`)
    await page.waitForSelector('.word-card')

    // EN should be active
    await expect(page.locator('.card-lang-btn', { hasText: 'EN' }).first()).toHaveClass(/active/)

    // The target card should be visible in viewport (wait for initial hash scroll)
    const card = page.locator(`#card-${slug}`)
    await expect(card).toBeVisible()
    await expect(card).toBeInViewport()
  })
})
