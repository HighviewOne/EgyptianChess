const { test, expect, square, play, log, plies, status } = require('./fixtures');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('board, pieces, and status render', async ({ page }) => {
  await expect(page.locator('#board .square')).toHaveCount(64);
  await expect(page.locator('#board .piece svg')).toHaveCount(32);
  await expect(status(page)).toHaveText(/White to move/i);
});

test('keyboard play: Enter selects, arrows move the focus', async ({ page }) => {
  await square(page, 'e2').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^e4 \(Pyramid\), legal move/);
  await page.keyboard.press('Enter');
  expect(await log(page)).toBe('1. e2-e4');
});

test('captures and en passant are logged', async ({ page }) => {
  await play(page, 'e2-e4', 'a7-a6', 'e4-e5', 'd7-d5', 'e5-d6');
  expect(await log(page)).toContain('e5xd6');
  await expect(page.locator('#white-captured .cap-piece')).toHaveCount(0);
  await expect(page.locator('#black-captured .cap-piece')).toHaveCount(1);
});

test('Ankh: explains a wrong square, then resurrects', async ({ page }) => {
  await play(page, 'e2-e4', 'd7-d5', 'e4-d5', 'd8-d5');
  await page.click('#white-ankh');
  await expect(page.locator('#white-ankh')).toHaveText(/cancel/i);
  await square(page, 'e4').click();
  await expect(status(page)).toHaveText(/back two ranks/i);
  await square(page, 'e2').click();
  expect(await log(page)).toContain('☥e2');
  await expect(page.locator('#white-ankh')).toHaveText(/used/i);
});

test('Blessing of the Pyramid shows extra steps', async ({ page }) => {
  await play(page, 'e2-e4', 'a7-a6');
  await square(page, 'e4').click();
  // Forward e5, plus blessed d5 f5 d4 f4 d3 e3 f3
  await expect(page.locator('#board .move-dot')).toHaveCount(8);
});

test('take back, flip, and mute', async ({ page }) => {
  await play(page, 'e2-e4', 'e7-e5');
  await page.click('#undo-btn');
  expect(await log(page)).toBe('1. e2-e4');
  await page.keyboard.press('Control+z');
  await expect(page.locator('#undo-btn')).toBeDisabled();

  await page.click('#flip-btn');
  await expect(page.locator('#board .square').first()).toHaveAttribute('aria-label', /^h1/);

  await page.click('#mute-btn');
  await page.reload();
  await expect(page.locator('#mute-btn')).toHaveText(/off/i);
});

test('promotion dialog: choose a piece or take back', async ({ page }) => {
  await play(page, 'b2-b4', 'a7-a5', 'b4-a5', 'h7-h6', 'a5-a6', 'h6-h5', 'a6-b7', 'h5-h4', 'b7-a8');
  await expect(page.locator('#promo-dialog')).toBeVisible();
  await page.click('#promo-undo-btn');
  await expect(page.locator('#promo-dialog')).toBeHidden();
  expect(await plies(page)).toBe(8);
  await play(page, 'b7-a8');
  await page.locator('.promo-btn', { hasText: 'Chariot' }).click();
  expect(await log(page)).toContain('b7xa8=C');
});

test('threefold repetition: draw dialog, then View Board', async ({ page }) => {
  for (let k = 0; k < 2; k++) await play(page, 'g1-f3', 'g8-f6', 'f3-g1', 'f6-g8');
  await expect(page.locator('#over-dialog')).toBeVisible();
  await expect(page.locator('#over-msg')).toHaveText(/threefold repetition/);
  await page.click('#over-view-btn');
  await expect(page.locator('#over-dialog')).toBeHidden();
  await expect(status(page)).toHaveText(/Draw/i);
});
