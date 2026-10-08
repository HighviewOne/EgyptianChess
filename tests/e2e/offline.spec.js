const { test, expect, play, plies, status } = require('./fixtures');

test('manifest is valid and every icon it lists loads', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const res = await request.get('/' + href);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name).toBe("Pharaoh's Chess");
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some(i => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const r = await request.get('/' + icon.src);
    expect(r.ok(), icon.src).toBe(true);
  }
  expect((await request.get('/' + await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'))).ok()).toBe(true);
});

test('after one visit, the game works offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // The install step stored the web fonts too
  const fonts = await page.evaluate(async () => (await (await caches.open('pharaoh-chess')).keys())
    .map(r => new URL(r.url).hostname).filter(h => h.startsWith('fonts.')).length);
  expect(fonts).toBeGreaterThan(1);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('#board .piece')).toHaveCount(32);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px "Noto Sans Egyptian Hieroglyphs"', '𓂀')
      && [...document.fonts].some(f => f.family.includes('Hieroglyphs') && f.status === 'loaded'))).toBe(true);

    // Play against the computer: its worker script also comes from the cache
    await page.selectOption('#opponent-select', 'easy');
    await play(page, 'e2-e4');
    await page.waitForFunction(() => game.history.length >= 2, null, { timeout: 20_000 });

    // A share link opens offline too (accepting "replace the game in progress?")
    page.on('dialog', d => d.accept());
    await page.goto('/?offline#g=d2d4.d7d5');
    await expect(status(page)).toHaveText(/Shared game opened/i);
    expect(await plies(page)).toBe(2);
  } finally {
    await context.setOffline(false);
  }
});
