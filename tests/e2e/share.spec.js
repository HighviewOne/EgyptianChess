const { test, expect, square, play, log, plies, status } = require('./fixtures');

test('share link round trip between two players', async ({ page, browser }) => {
  await page.goto('/');
  await play(page, 'e2-e4', 'd7-d5', 'e4-d5');
  await page.click('#share-btn');
  const link = await page.locator('#share-url').inputValue();
  expect(link).toMatch(/#g=e2e4\.d7d5\.e4d5$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#share-dialog')).toBeHidden();

  // The friend has the computer switched on; a shared game is person to person
  const friendCtx = await browser.newContext();
  const friend = await friendCtx.newPage();
  await friend.goto('/');
  await friend.selectOption('#opponent-select', 'hard');
  await friend.goto(link);
  await expect(status(friend)).toHaveText(/Shared game opened — Black to move/i);
  await expect(friend.locator('#opponent-select')).toHaveValue('human');
  await expect(friend.locator('#board .square').first()).toHaveAttribute('aria-label', /^h1/);
  expect(await friend.evaluate(() => location.hash)).toBe('');
  await play(friend, 'd8-d5');
  await friend.click('#share-btn');
  const reply = await friend.locator('#share-url').inputValue();
  await friendCtx.close();

  // Opening the reply in the same tab continues the game without asking
  let prompts = 0;
  page.on('dialog', d => { prompts++; d.accept(); });
  await page.evaluate(h => { location.hash = h; }, new URL(reply).hash);
  await expect.poll(() => plies(page)).toBe(4);
  expect(await log(page)).toContain('Vd8xd5');
  expect(prompts).toBe(0);

  // Opening an unrelated game asks before replacing the one in progress
  await page.click('#new-game-btn');
  await play(page, 'a2-a3');
  await page.evaluate(h => { location.hash = h; }, new URL(link).hash);
  await expect.poll(() => plies(page)).toBe(3);
  expect(prompts).toBe(1);
});

test('a broken share link keeps your game and says why', async ({ page }) => {
  await page.goto('/');
  await play(page, 'e2-e4');
  await page.goto('/index.html#g=e2e4.zz');
  await expect(status(page)).toHaveText(/isn’t valid/i);
  expect(await plies(page)).toBe(1);
});

test('copy button copies the link', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await play(page, 'e2-e4');
  await page.click('#share-btn');
  await page.click('#share-copy');
  await expect(page.locator('#share-copy')).toHaveText(/copied/i);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#g=e2e4$/);
});
