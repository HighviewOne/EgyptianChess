const path = require('node:path');
const { test, expect, play, status } = require('./fixtures');

test('phone width: everything fits without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const frame = await page.locator('.board-frame').boundingBox();
  expect(frame.x + frame.width).toBeLessThanOrEqual(390);
});

test('opened straight from disk, the game and computer still work', async ({ page }) => {
  const workers = [];
  page.on('worker', w => workers.push(w));
  await page.goto('file://' + path.resolve(__dirname, '..', '..', 'index.html'));
  await page.selectOption('#opponent-select', 'easy');
  await play(page, 'e2-e4');
  await page.waitForFunction(() => game.history.length >= 2, null, { timeout: 20_000 });
  expect(workers).toHaveLength(0);   // file:// pages can't start workers; search runs on the page
  await expect(status(page)).toHaveText(/White to move/i);
});

test('phone: the whole board shows on load and both Ankh buttons sit just below it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const frame = await page.locator('.board-frame').boundingBox();
  expect(frame.y + frame.height).toBeLessThanOrEqual(844);
  const controls = await page.locator('.controls-row').boundingBox();
  for (const side of ['white', 'black']) {
    const ankh = await page.locator(`#${side}-ankh`).boundingBox();
    expect(ankh.y).toBeGreaterThan(frame.y + frame.height);
    expect(ankh.y).toBeLessThan(controls.y);
  }
});
