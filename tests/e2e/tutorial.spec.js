const { test, expect, idx, plies } = require('./fixtures');

const tsq = (page, s) => page.locator(`#tutorial-board .square[data-idx="${idx(s)}"]`);
const feedback = (page) => page.locator('#tutorial-feedback');

test('the tutorial teaches the three Egyptian rules without touching the game', async ({ page }) => {
  await page.goto('/');
  await page.click('#learn-btn');
  const dialog = page.locator('#tutorial-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#tutorial-step')).toHaveText('Lesson 1 of 3');

  // 1. Sphinx: a wrong (but legal) move gets a hint and the pieces come back
  await tsq(page, 'b2').click();
  await tsq(page, 'c4').click();
  await expect(feedback(page)).toContainText('Try sliding diagonally');
  await expect(tsq(page, 'b2').locator('.piece')).toBeVisible();   // reset after the hint
  await tsq(page, 'b2').click();
  await tsq(page, 'd4').click();
  await expect(feedback(page)).toContainText('✓');
  await page.click('#tutorial-next');

  // 2. Ankh: a square that doesn't block is refused; blocking on rank 1 saves the Pharaoh
  await expect(page.locator('#tutorial-title')).toHaveText('The Ankh');
  await page.click('#tutorial-ankh');
  await expect(page.locator('#tutorial-board .ankh-target')).toHaveCount(6);
  await tsq(page, 'h2').click();
  await expect(feedback(page)).toContainText('doesn’t block');
  await tsq(page, 'e1').click();
  await expect(feedback(page)).toContainText('Saved!');
  await page.click('#tutorial-next');

  // 3. Pyramid
  await expect(page.locator('#tutorial-title')).toHaveText('The Pyramid');
  await tsq(page, 'd4').click();
  await tsq(page, 'e5').click();
  await expect(feedback(page)).toContainText('✓');
  await expect(page.locator('#tutorial-next')).toHaveText(/Play a game/);
  await page.click('#tutorial-next');

  await expect(dialog).toBeHidden();
  await expect(page.locator('#learn-btn')).toBeFocused();
  expect(await plies(page)).toBe(0);   // the real game was never touched
});

test('the tutorial opens from the rules box, works by keyboard, and closes on Escape', async ({ page }) => {
  await page.goto('/');
  await page.locator('.rules-box summary').click();
  await page.click('#rules-learn-btn');
  await expect(tsq(page, 'b2')).toBeFocused();          // starts on the lesson's piece
  await page.keyboard.press('Enter');                    // select the Sphinx
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowUp']) await page.keyboard.press(k);
  await expect(tsq(page, 'd4')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(feedback(page)).toContainText('✓');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tutorial-dialog')).toBeHidden();
});
