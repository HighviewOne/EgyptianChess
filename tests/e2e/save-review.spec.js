const { test, expect, square, play, log, plies, status } = require('./fixtures');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('autosave: the game survives a reload, take back still works', async ({ page }) => {
  await play(page, 'e2-e4', 'd7-d5', 'e4-d5', 'd8-d5');
  await page.click('#white-ankh');
  await square(page, 'e2').click();
  const before = await log(page);
  await page.reload();
  expect(await log(page)).toBe(before);
  await expect(page.locator('#white-ankh')).toHaveText(/used/i);
  await page.click('#undo-btn');
  await expect(page.locator('#white-ankh')).toHaveText(/resurrection/i);
});

test('autosave: New Game clears it; a corrupted save is ignored', async ({ page }) => {
  await play(page, 'e2-e4');
  await page.click('#new-game-btn');
  await page.reload();
  expect(await plies(page)).toBe(0);
  await page.evaluate(() => localStorage.setItem('pharaoh-game', '{"version":1,"moves":[{"from":52,"to":20}]}'));
  await page.reload();
  expect(await plies(page)).toBe(0);
});

test('review: click a move, step with keys and buttons, return', async ({ page }) => {
  await play(page, 'e2-e4', 'd7-d5', 'e4-d5', 'd8-d5', 'b1-c3');
  await page.locator('#move-log [data-ply="3"]').click();
  await expect(status(page)).toHaveText(/Reviewing move 3 of 5/i);
  await expect(page.locator('#board')).toHaveClass(/reviewing/);
  await expect(square(page, 'd8')).toHaveAttribute('aria-label', /Black Vizier/);
  await expect(page.locator('#white-ankh')).toBeDisabled();

  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#move-log .current')).toHaveText('d7-d5');
  await page.keyboard.press('Home');
  await expect(status(page)).toHaveText(/Reviewing the start/i);
  await page.click('#nav-next');
  await expect(page.locator('#move-log .current')).toHaveText('e2-e4');
  await page.keyboard.press('Escape');
  await expect(page.locator('#board')).not.toHaveClass(/reviewing/);

  // Clicking the board while reviewing returns to the game without moving
  await page.click('#nav-start');
  await square(page, 'g8').click();
  await expect(status(page)).toHaveText(/Black to move/i);
  expect(await plies(page)).toBe(5);
});
