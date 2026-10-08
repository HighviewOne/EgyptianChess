const { test, expect, play, plies, status } = require('./fixtures');

const waitForReply = (page, n) => page.waitForFunction(
  n => game.history.length >= n && !document.getElementById('status-text').classList.contains('thinking'),
  n, { timeout: 20_000 });

test('computer replies, in a background thread, and take back undoes both moves', async ({ page }) => {
  const workers = [];
  page.on('worker', w => workers.push(w));
  await page.goto('/');
  await page.selectOption('#opponent-select', 'medium');
  await expect(page.locator('#black-panel')).toHaveClass(/computer/);
  await play(page, 'e2-e4');
  await waitForReply(page, 2);
  expect(workers.length).toBeGreaterThan(0);
  await expect(page.locator('#black-ankh')).toBeDisabled();
  await page.click('#undo-btn');
  expect(await plies(page)).toBe(0);
});

test('playing Black: the board flips and Hard opens', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#opponent-select', 'hard');
  await page.selectOption('#side-select', 'black');
  await expect(page.locator('#board .square').first()).toHaveAttribute('aria-label', /^h1/);
  await waitForReply(page, 1);
  await expect(status(page)).toHaveText(/Black to move/i);
});

test('the board ignores clicks while the computer thinks', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#opponent-select', 'hard');
  const selected = await page.evaluate(() => {
    const c = i => document.querySelector(`#board .square[data-idx="${i}"]`).click();
    c(52); c(36);   // e2-e4
    c(51);          // d2, during the computer's turn
    return game.selectedIdx;
  });
  expect(selected).toBeNull();
  await expect(status(page)).toHaveText(/thinking/i);
});

test('Expert opponent replies', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#opponent-select', 'expert');
  await play(page, 'e2-e4');
  await expect(status(page)).toHaveText(/thinking deeply/i);
  await waitForReply(page, 2);
  await expect(status(page)).toHaveText(/White to move/i);
});
