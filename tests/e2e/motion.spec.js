const { test, expect, idx, square, play } = require('./fixtures');

// Clicks from/to inside the page so the animation can be inspected before it ends
const moveAndInspect = (page, from, to) => page.evaluate(([f, t]) => {
  const click = i => document.querySelector(`#board .square[data-idx="${i}"]`).click();
  click(f); click(t);
  const piece = document.querySelector(`#board .square[data-idx="${t}"] .piece`);
  return {
    sliding: piece.getAnimations().length,
    dust: document.querySelectorAll('.dust').length,
  };
}, [from, to]);

test('a moved piece slides to its square', async ({ page }) => {
  await page.goto('/');
  const r = await moveAndInspect(page, idx('g1'), idx('f3'));
  expect(r.sliding).toBe(1);
  await expect.poll(() => square(page, 'f3').locator('.piece').evaluate(el => el.getAnimations().length)).toBe(0);
});

test('capture dust rises when the piece lands, not before', async ({ page }) => {
  await page.goto('/');
  await play(page, 'e2-e4', 'd7-d5');
  const r = await moveAndInspect(page, idx('e4'), idx('d5'));
  expect(r.sliding).toBe(1);
  expect(r.dust).toBe(0);
  await expect.poll(() => page.locator('.dust').count()).toBeGreaterThan(0);
});

test('a resurrected piece grows out of its square', async ({ page }) => {
  await page.goto('/');
  await play(page, 'e2-e4', 'd7-d5', 'e4-d5', 'd8-d5');
  await page.click('#white-ankh');
  const animating = await page.evaluate(i => {
    document.querySelector(`#board .square[data-idx="${i}"]`).click();
    return document.querySelector(`#board .square[data-idx="${i}"] .piece`).getAnimations().length;
  }, idx('e2'));
  expect(animating).toBe(1);
});

test('reduced motion: pieces move instantly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const r = await moveAndInspect(page, idx('g1'), idx('f3'));
  expect(r.sliding).toBe(0);
});
